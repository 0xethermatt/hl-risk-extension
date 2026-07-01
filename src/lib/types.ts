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
  /** Rough, isolated-margin estimate of %-move-to-liquidation (~100/leverage). Not exact. */
  approxLiquidationDistancePercent: number;
}

export type WarningLevel = "error" | "warning" | "info";

export interface RiskWarning {
  id: string;
  level: WarningLevel;
  message: string;
}

export type DetectionConfidence = "high" | "medium" | "low" | "none";

export interface DetectedField<T> {
  value: T | null;
  raw: string | null;
  confidence: DetectionConfidence;
}

export type DetectionSource = "dom" | "api" | "manual";

export interface DetectedContext {
  url: string;
  asset: DetectedField<string>;
  leverage: DetectedField<number>;
  accountBalance: DetectedField<number>;
  entryPrice: DetectedField<number>;
  stopLossPrice: DetectedField<number>;
  takeProfitPrice: DetectedField<number>;
  direction: DetectedField<Direction>;
  source: DetectionSource;
  extractedAt: number;
  debugCandidates: DebugCandidates;
}

export interface DebugCandidates {
  pairCandidates: string[];
  leverageCandidates: string[];
  balanceCandidates: string[];
  tradingViewCandidates: string[];
}

export interface AssetPositionSummary {
  coin: string;
  size: number;
  entryPrice: number | null;
  positionValue: number | null;
  unrealizedPnl: number | null;
  leverage: number | null;
  liquidationPrice: number | null;
  marginUsed: number | null;
}

export interface HyperliquidAccountState {
  accountValue: number | null;
  totalMarginUsed: number | null;
  withdrawable: number | null;
  positions: AssetPositionSummary[];
}

export type ConnectionStatus = "connected" | "manual" | "api";

export interface StorageSchema {
  lastInputs: TradeInputs;
  riskPercentDefault: number;
  leverageDefault: number;
  walletAddress: string;
  overlayEnabled: boolean;
  lastDetectedContext: DetectedContext | null;
  autoFillEnabled: boolean;
}
