export interface RiskSettings {
  defaultRiskPercent: number;
  maxRiskPercent: number;
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  defaultRiskPercent: 1,
  maxRiskPercent: 5,
};
