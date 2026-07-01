import { describe, expect, it } from "vitest";
import { calculatePositionSize } from "./positionSizing";

describe("calculatePositionSize", () => {
  it("computes risk amount, position size, and position value for a long setup", () => {
    const result = calculatePositionSize({
      accountEquity: 10000,
      riskPercent: 1,
      entryPrice: 100,
      stopLossPrice: 90,
    });

    expect(result.riskAmount).toBe(100);
    expect(result.positionSize).toBeCloseTo(10);
    expect(result.positionValue).toBeCloseTo(1000);
  });

  it("computes the same magnitude regardless of long or short direction", () => {
    const long = calculatePositionSize({
      accountEquity: 5000,
      riskPercent: 2,
      entryPrice: 50,
      stopLossPrice: 45,
    });
    const short = calculatePositionSize({
      accountEquity: 5000,
      riskPercent: 2,
      entryPrice: 50,
      stopLossPrice: 55,
    });

    expect(long.positionSize).toBeCloseTo(short.positionSize);
  });

  it("throws when accountEquity is not positive", () => {
    expect(() =>
      calculatePositionSize({
        accountEquity: 0,
        riskPercent: 1,
        entryPrice: 100,
        stopLossPrice: 90,
      }),
    ).toThrow(/accountEquity/);
  });

  it("throws when riskPercent is out of range", () => {
    expect(() =>
      calculatePositionSize({
        accountEquity: 1000,
        riskPercent: 150,
        entryPrice: 100,
        stopLossPrice: 90,
      }),
    ).toThrow(/riskPercent/);
  });

  it("throws when entryPrice equals stopLossPrice", () => {
    expect(() =>
      calculatePositionSize({
        accountEquity: 1000,
        riskPercent: 1,
        entryPrice: 100,
        stopLossPrice: 100,
      }),
    ).toThrow(/differ/);
  });
});
