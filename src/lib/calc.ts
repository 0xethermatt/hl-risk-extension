import type { TradeCalculation, TradeInputs } from "./types";

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : 0;
}

/**
 * Pure position-sizing calculator.
 *
 * Position size is derived from risk amount and stop distance only.
 * Leverage never multiplies position size — it only determines how much
 * margin is required to hold that position.
 */
export function calculateTrade(inputs: TradeInputs): TradeCalculation {
  const accountBalance = Number.isFinite(inputs.accountBalance) ? inputs.accountBalance : 0;
  const riskPercent = Number.isFinite(inputs.riskPercent) ? inputs.riskPercent : 0;
  const entryPrice = Number.isFinite(inputs.entryPrice) ? inputs.entryPrice : 0;
  const stopLossPrice = Number.isFinite(inputs.stopLossPrice) ? inputs.stopLossPrice : 0;
  const takeProfitPrice = Number.isFinite(inputs.takeProfitPrice) ? inputs.takeProfitPrice : 0;
  const leverage = Number.isFinite(inputs.leverage) ? inputs.leverage : 0;

  const riskAmount = accountBalance * (riskPercent / 100);
  const stopDistance = Math.abs(entryPrice - stopLossPrice);
  const takeProfitDistance = Math.abs(takeProfitPrice - entryPrice);

  const positionSize = safeDivide(riskAmount, stopDistance);
  const positionNotional = positionSize * entryPrice;
  const requiredMargin = safeDivide(positionNotional, leverage);

  const lossAtStop = stopDistance * positionSize;
  const profitAtTakeProfit = takeProfitDistance * positionSize;
  const riskRewardRatio = safeDivide(profitAtTakeProfit, lossAtStop);

  const stopDistancePercent = safeDivide(stopDistance, entryPrice) * 100;
  const takeProfitDistancePercent = safeDivide(takeProfitDistance, entryPrice) * 100;
  const marginUsagePercent = safeDivide(requiredMargin, accountBalance) * 100;

  // Rough approximation of how far price can move against the position
  // before its backing collateral is exhausted. This is a directional
  // estimate only, not an exact liquidation price — maintenance margin,
  // funding, and (for cross) other open positions are not modeled.
  //
  // Isolated: only this position's own allocated margin backs it, so loss
  // reaches that margin when distance/entry == 1/leverage, i.e.
  // distancePercent == 100/leverage.
  //
  // Cross: the whole account balance backs it, so loss reaches the account
  // balance when distance/entry == accountBalance/positionNotional, i.e.
  // distancePercent == (accountBalance / positionNotional) * 100. This is
  // usually a much wider buffer than isolated mode's estimate — at the cost
  // of putting the whole account on the line rather than just this position.
  const approxLiquidationDistancePercent =
    inputs.marginMode === "cross"
      ? safeDivide(accountBalance, positionNotional) * 100
      : safeDivide(100, leverage);

  return {
    riskAmount,
    stopDistance,
    takeProfitDistance,
    positionSize,
    positionNotional,
    requiredMargin,
    lossAtStop,
    profitAtTakeProfit,
    riskRewardRatio,
    stopDistancePercent,
    takeProfitDistancePercent,
    marginUsagePercent,
    approxLiquidationDistancePercent,
  };
}
