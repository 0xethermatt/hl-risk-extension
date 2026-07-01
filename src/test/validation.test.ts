import { describe, expect, it } from "vitest";
import { calculateTrade } from "../lib/calc";
import type { TradeInputs } from "../lib/types";
import {
  getAllWarnings,
  getMissingInputWarnings,
  getThresholdWarnings,
  validateDirection,
} from "../lib/validation";

const baseLong: TradeInputs = {
  direction: "long",
  asset: "BTC",
  accountBalance: 10000,
  riskPercent: 1,
  entryPrice: 100,
  stopLossPrice: 90,
  takeProfitPrice: 120,
  leverage: 10,
};

const baseShort: TradeInputs = {
  ...baseLong,
  direction: "short",
  stopLossPrice: 110,
  takeProfitPrice: 80,
};

function hasWarning(warnings: { id: string }[], id: string): boolean {
  return warnings.some((w) => w.id === id);
}

describe("validateDirection", () => {
  it("flags a long stop loss placed above entry", () => {
    const warnings = validateDirection({ ...baseLong, stopLossPrice: 110 });
    expect(hasWarning(warnings, "direction-stop-long")).toBe(true);
  });

  it("flags a long take profit placed below entry", () => {
    const warnings = validateDirection({ ...baseLong, takeProfitPrice: 90 });
    expect(hasWarning(warnings, "direction-tp-long")).toBe(true);
  });

  it("flags a short stop loss placed below entry", () => {
    const warnings = validateDirection({ ...baseShort, stopLossPrice: 90 });
    expect(hasWarning(warnings, "direction-stop-short")).toBe(true);
  });

  it("flags a short take profit placed above entry", () => {
    const warnings = validateDirection({ ...baseShort, takeProfitPrice: 110 });
    expect(hasWarning(warnings, "direction-tp-short")).toBe(true);
  });

  it("does not flag a correctly structured long trade", () => {
    const warnings = validateDirection(baseLong);
    expect(warnings).toHaveLength(0);
  });

  it("does not flag a correctly structured short trade", () => {
    const warnings = validateDirection(baseShort);
    expect(warnings).toHaveLength(0);
  });

  it("skips direction checks when prices are incomplete", () => {
    const warnings = validateDirection({ ...baseLong, takeProfitPrice: 0 });
    expect(warnings).toHaveLength(0);
  });
});

describe("getThresholdWarnings", () => {
  it("raises a caution for risk percent above 3", () => {
    const inputs = { ...baseLong, riskPercent: 4 };
    const warnings = getThresholdWarnings(inputs, calculateTrade(inputs));
    expect(hasWarning(warnings, "risk-caution")).toBe(true);
    expect(hasWarning(warnings, "risk-danger")).toBe(false);
  });

  it("raises a danger warning for risk percent above 5", () => {
    const inputs = { ...baseLong, riskPercent: 6 };
    const warnings = getThresholdWarnings(inputs, calculateTrade(inputs));
    expect(hasWarning(warnings, "risk-danger")).toBe(true);
  });

  it("raises a high leverage warning at 20x and above", () => {
    const inputs = { ...baseLong, leverage: 20 };
    const warnings = getThresholdWarnings(inputs, calculateTrade(inputs));
    expect(hasWarning(warnings, "leverage-high")).toBe(true);
  });

  it("raises an extreme leverage warning at 50x and above", () => {
    const inputs = { ...baseLong, leverage: 50 };
    const warnings = getThresholdWarnings(inputs, calculateTrade(inputs));
    expect(hasWarning(warnings, "leverage-extreme")).toBe(true);
  });

  it("raises a margin-insufficient error when required margin exceeds balance", () => {
    // riskAmount=100, stopDistance=0.5 -> positionSize=200, notional=20000,
    // requiredMargin=20000 at 1x leverage — well above the 10000 balance.
    const inputs: TradeInputs = { ...baseLong, stopLossPrice: 99.5, leverage: 1 };
    const warnings = getThresholdWarnings(inputs, calculateTrade(inputs));
    expect(hasWarning(warnings, "margin-insufficient")).toBe(true);
  });

  it("raises a high margin usage warning above 50% (but below insufficient)", () => {
    // stopDistance=1.9 -> marginUsagePercent = riskPercent*entry/(stopDistance*leverage)
    // = 1*100/(1.9*1) ~= 52.6%, which is >50% but comfortably <100%.
    const inputs: TradeInputs = { ...baseLong, stopLossPrice: 98.1, leverage: 1 };
    const calc = calculateTrade(inputs);
    expect(calc.marginUsagePercent).toBeGreaterThan(50);
    expect(calc.marginUsagePercent).toBeLessThan(100);

    const warnings = getThresholdWarnings(inputs, calc);
    expect(hasWarning(warnings, "margin-high-usage")).toBe(true);
    expect(hasWarning(warnings, "margin-insufficient")).toBe(false);
  });

  it("raises a weak risk/reward warning below 1.5", () => {
    const inputs: TradeInputs = { ...baseLong, takeProfitPrice: 105 }; // RR = 0.5
    const warnings = getThresholdWarnings(inputs, calculateTrade(inputs));
    expect(hasWarning(warnings, "rr-weak")).toBe(true);
  });

  it("does not raise a weak R:R warning when R:R is healthy", () => {
    const inputs: TradeInputs = { ...baseLong, takeProfitPrice: 130 }; // RR = 3
    const warnings = getThresholdWarnings(inputs, calculateTrade(inputs));
    expect(hasWarning(warnings, "rr-weak")).toBe(false);
  });

  it("flags an invalid (zero) stop distance", () => {
    const inputs: TradeInputs = { ...baseLong, stopLossPrice: baseLong.entryPrice };
    const warnings = getThresholdWarnings(inputs, calculateTrade(inputs));
    expect(hasWarning(warnings, "stop-distance-invalid")).toBe(true);
  });

  it("flags a stop distance under 0.1% as too tight", () => {
    const inputs: TradeInputs = { ...baseLong, entryPrice: 1000, stopLossPrice: 999.5 };
    const warnings = getThresholdWarnings(inputs, calculateTrade(inputs));
    expect(hasWarning(warnings, "stop-distance-tight")).toBe(true);
  });

  it("flags a stop distance over 10% as large", () => {
    const inputs: TradeInputs = { ...baseLong, entryPrice: 100, stopLossPrice: 85 };
    const warnings = getThresholdWarnings(inputs, calculateTrade(inputs));
    expect(hasWarning(warnings, "stop-distance-large")).toBe(true);
  });
});

describe("getMissingInputWarnings", () => {
  it("flags missing entry/stop/take-profit for manual input", () => {
    const warnings = getMissingInputWarnings({ ...baseLong, entryPrice: 0, stopLossPrice: 0, takeProfitPrice: 0 });
    expect(hasWarning(warnings, "missing-inputs")).toBe(true);
  });

  it("does not flag anything once all prices are present", () => {
    const warnings = getMissingInputWarnings(baseLong);
    expect(warnings).toHaveLength(0);
  });
});

describe("getAllWarnings", () => {
  it("combines direction, threshold, and missing-input warnings", () => {
    const inputs: TradeInputs = {
      ...baseLong,
      stopLossPrice: 110, // wrong side for a long
      riskPercent: 6, // danger
      leverage: 50, // extreme
    };
    const warnings = getAllWarnings(inputs, calculateTrade(inputs));

    expect(hasWarning(warnings, "direction-stop-long")).toBe(true);
    expect(hasWarning(warnings, "risk-danger")).toBe(true);
    expect(hasWarning(warnings, "leverage-extreme")).toBe(true);
  });

  it("returns no warnings for a clean, well-sized long setup", () => {
    const warnings = getAllWarnings(baseLong, calculateTrade(baseLong));
    expect(warnings).toHaveLength(0);
  });
});
