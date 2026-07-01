import { describe, expect, it } from "vitest";
import { calculateTrade } from "../lib/calc";
import type { TradeInputs } from "../lib/types";

const baseLong: TradeInputs = {
  direction: "long",
  asset: "BTC",
  accountBalance: 10000,
  riskPercent: 1,
  entryPrice: 100,
  stopLossPrice: 90,
  takeProfitPrice: 120,
  leverage: 10,
  marginMode: "isolated",
};

const baseShort: TradeInputs = {
  direction: "short",
  asset: "BTC",
  accountBalance: 10000,
  riskPercent: 1,
  entryPrice: 100,
  stopLossPrice: 110,
  takeProfitPrice: 80,
  leverage: 10,
  marginMode: "isolated",
};

describe("calculateTrade", () => {
  it("computes a valid long trade correctly", () => {
    const calc = calculateTrade(baseLong);

    expect(calc.riskAmount).toBe(100);
    expect(calc.stopDistance).toBe(10);
    expect(calc.takeProfitDistance).toBe(20);
    expect(calc.positionSize).toBeCloseTo(10);
    expect(calc.positionNotional).toBeCloseTo(1000);
    expect(calc.requiredMargin).toBeCloseTo(100);
    expect(calc.lossAtStop).toBeCloseTo(100);
    expect(calc.profitAtTakeProfit).toBeCloseTo(200);
    expect(calc.riskRewardRatio).toBeCloseTo(2);
    expect(calc.stopDistancePercent).toBeCloseTo(10);
    expect(calc.takeProfitDistancePercent).toBeCloseTo(20);
    expect(calc.marginUsagePercent).toBeCloseTo(1);
  });

  it("computes a valid short trade correctly", () => {
    const calc = calculateTrade(baseShort);

    expect(calc.riskAmount).toBe(100);
    expect(calc.stopDistance).toBe(10);
    expect(calc.takeProfitDistance).toBe(20);
    expect(calc.positionSize).toBeCloseTo(10);
    expect(calc.positionNotional).toBeCloseTo(1000);
    expect(calc.requiredMargin).toBeCloseTo(100);
    expect(calc.riskRewardRatio).toBeCloseTo(2);
  });

  it("does not let leverage change position size", () => {
    const low = calculateTrade({ ...baseLong, leverage: 1 });
    const mid = calculateTrade({ ...baseLong, leverage: 10 });
    const high = calculateTrade({ ...baseLong, leverage: 50 });

    expect(low.positionSize).toBeCloseTo(mid.positionSize);
    expect(mid.positionSize).toBeCloseTo(high.positionSize);
    expect(low.positionSize).toBeCloseTo(10);
  });

  it("changes required margin with leverage while notional stays fixed", () => {
    const low = calculateTrade({ ...baseLong, leverage: 1 });
    const high = calculateTrade({ ...baseLong, leverage: 10 });

    expect(low.positionNotional).toBeCloseTo(high.positionNotional);
    expect(low.requiredMargin).toBeCloseTo(1000);
    expect(high.requiredMargin).toBeCloseTo(100);
    expect(low.requiredMargin).toBeGreaterThan(high.requiredMargin);
  });

  it("computes risk amount from account balance and risk percent", () => {
    const calc = calculateTrade({ ...baseLong, accountBalance: 5000, riskPercent: 2 });
    expect(calc.riskAmount).toBe(100);
  });

  it("computes risk/reward ratio from loss and profit distances", () => {
    const calc = calculateTrade({ ...baseLong, entryPrice: 100, stopLossPrice: 95, takeProfitPrice: 115 });
    // stopDistance = 5, tpDistance = 15 -> RR = 3
    expect(calc.riskRewardRatio).toBeCloseTo(3);
  });

  it("computes stop distance percent relative to entry price", () => {
    const calc = calculateTrade({ ...baseLong, entryPrice: 200, stopLossPrice: 190 });
    expect(calc.stopDistancePercent).toBeCloseTo(5);
  });

  it("computes required margin as notional divided by leverage", () => {
    const calc = calculateTrade({ ...baseLong, leverage: 4 });
    expect(calc.requiredMargin).toBeCloseTo(calc.positionNotional / 4);
  });

  it("handles a zero stop distance without producing NaN or Infinity", () => {
    const calc = calculateTrade({ ...baseLong, entryPrice: 100, stopLossPrice: 100 });

    expect(calc.stopDistance).toBe(0);
    expect(calc.positionSize).toBe(0);
    expect(calc.positionNotional).toBe(0);
    expect(calc.riskRewardRatio).toBe(0);
    expect(Number.isFinite(calc.positionSize)).toBe(true);
    expect(Number.isFinite(calc.riskRewardRatio)).toBe(true);
  });

  it("handles zero leverage without producing NaN or Infinity", () => {
    const calc = calculateTrade({ ...baseLong, leverage: 0 });

    expect(calc.requiredMargin).toBe(0);
    expect(Number.isFinite(calc.requiredMargin)).toBe(true);
  });

  it("handles zero account balance without producing NaN or Infinity", () => {
    const calc = calculateTrade({ ...baseLong, accountBalance: 0 });

    expect(calc.riskAmount).toBe(0);
    expect(calc.marginUsagePercent).toBe(0);
    expect(Number.isFinite(calc.marginUsagePercent)).toBe(true);
  });

  it("estimates isolated liquidation distance as roughly 100/leverage percent", () => {
    expect(calculateTrade({ ...baseLong, leverage: 10 }).approxLiquidationDistancePercent).toBeCloseTo(10);
    expect(calculateTrade({ ...baseLong, leverage: 20 }).approxLiquidationDistancePercent).toBeCloseTo(5);
    expect(calculateTrade({ ...baseLong, leverage: 50 }).approxLiquidationDistancePercent).toBeCloseTo(2);
  });

  it("handles zero leverage in the isolated liquidation distance estimate without NaN or Infinity", () => {
    const calc = calculateTrade({ ...baseLong, leverage: 0 });
    expect(calc.approxLiquidationDistancePercent).toBe(0);
    expect(Number.isFinite(calc.approxLiquidationDistancePercent)).toBe(true);
  });

  it("estimates cross liquidation distance from account balance vs. position notional", () => {
    // riskAmount=100, stopDistance=10 -> positionSize=10, notional=1000
    // cross: accountBalance(10000)/notional(1000)*100 = 1000%
    const calc = calculateTrade({ ...baseLong, marginMode: "cross" });
    expect(calc.approxLiquidationDistancePercent).toBeCloseTo(1000);
  });

  it("gives cross margin a wider liquidation buffer than isolated at the same leverage", () => {
    const isolated = calculateTrade({ ...baseLong, marginMode: "isolated", leverage: 10 });
    const cross = calculateTrade({ ...baseLong, marginMode: "cross", leverage: 10 });
    expect(cross.approxLiquidationDistancePercent).toBeGreaterThan(isolated.approxLiquidationDistancePercent);
  });

  it("does not let margin mode affect required margin (initial margin is mode-independent)", () => {
    const isolated = calculateTrade({ ...baseLong, marginMode: "isolated" });
    const cross = calculateTrade({ ...baseLong, marginMode: "cross" });
    expect(cross.requiredMargin).toBeCloseTo(isolated.requiredMargin);
  });

  it("handles zero position notional in the cross liquidation distance estimate without NaN or Infinity", () => {
    const calc = calculateTrade({ ...baseLong, marginMode: "cross", stopLossPrice: baseLong.entryPrice });
    expect(calc.approxLiquidationDistancePercent).toBe(0);
    expect(Number.isFinite(calc.approxLiquidationDistancePercent)).toBe(true);
  });
});
