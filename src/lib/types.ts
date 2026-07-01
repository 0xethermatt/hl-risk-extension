export type Direction = "long" | "short";
export type MarginMode = "cross" | "isolated";

export interface TradeInputs {
  direction: Direction;
  asset: string;
  accountBalance: number;
  riskPercent: number;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  leverage: number;
  marginMode: MarginMode;
}

export const EMPTY_TRADE_INPUTS: TradeInputs = {
  direction: "long",
  asset: "",
  accountBalance: 0,
  riskPercent: 1,
  entryPrice: 0,
  stopLossPrice: 0,
  takeProfitPrice: 0,
  leverage: 1,
  marginMode: "cross",
};

export interface TradeCalculation {
  riskAmount: number;
  stopDistance: number;
  takeProfitDistance: number;
  positionSize: number;
  positionNotional: number;
  requiredMargin: number;
  lossAtStop: number;
  profitAtTakeProfit: number;
  riskRewardRatio: number;
  stopDistancePercent: number;
  takeProfitDistancePercent: number;
  marginUsagePercent: number;
  /** Rough estimate of %-move-to-liquidation. Not exact. */
  approxLiquidationDistancePercent: number;
}

export type WarningLevel = "error" | "warning" | "info";

export interface RiskWarning {
  id: string;
  level: WarningLevel;
  message: string;
}

export interface StorageSchema {
  lastInputs: TradeInputs;
  riskPercentDefault: number;
  leverageDefault: number;
  overlayEnabled: boolean;
}
