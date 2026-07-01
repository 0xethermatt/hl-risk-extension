import { DEFAULT_RISK_SETTINGS, type RiskSettings } from "../types/settings";

const STORAGE_KEY = "riskSettings";

export async function getRiskSettings(): Promise<RiskSettings> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as RiskSettings | undefined;
  return value ?? DEFAULT_RISK_SETTINGS;
}

export async function setRiskSettings(settings: RiskSettings): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}
