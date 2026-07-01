export interface PositionSizeInput {
  accountEquity: number;
  riskPercent: number;
  entryPrice: number;
  stopLossPrice: number;
}

export interface PositionSizeResult {
  riskAmount: number;
  positionSize: number;
  positionValue: number;
}

export function calculatePositionSize({
  accountEquity,
  riskPercent,
  entryPrice,
  stopLossPrice,
}: PositionSizeInput): PositionSizeResult {
  if (accountEquity <= 0) {
    throw new Error("accountEquity must be greater than 0");
  }
  if (riskPercent <= 0 || riskPercent > 100) {
    throw new Error("riskPercent must be between 0 and 100");
  }
  if (entryPrice <= 0 || stopLossPrice <= 0) {
    throw new Error("entryPrice and stopLossPrice must be greater than 0");
  }
  if (entryPrice === stopLossPrice) {
    throw new Error("entryPrice and stopLossPrice must differ");
  }

  const riskAmount = accountEquity * (riskPercent / 100);
  const priceDelta = Math.abs(entryPrice - stopLossPrice);
  const positionSize = riskAmount / priceDelta;
  const positionValue = positionSize * entryPrice;

  return { riskAmount, positionSize, positionValue };
}
