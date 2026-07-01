import { EMPTY_TRADE_INPUTS, type StorageSchema } from "./types";

export const DEFAULT_STORAGE: StorageSchema = {
  lastInputs: EMPTY_TRADE_INPUTS,
  riskPercentDefault: 1,
  leverageDefault: 1,
  walletAddress: "",
  overlayEnabled: false,
  lastDetectedContext: null,
  autoFillEnabled: false,
};

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

export async function getStoredValue<K extends keyof StorageSchema>(
  key: K,
): Promise<StorageSchema[K]> {
  if (!hasChromeStorage()) {
    return DEFAULT_STORAGE[key];
  }
  const result = await chrome.storage.local.get(key);
  const value = result[key] as StorageSchema[K] | undefined;
  return value ?? DEFAULT_STORAGE[key];
}

export async function setStoredValue<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K],
): Promise<void> {
  if (!hasChromeStorage()) {
    return;
  }
  await chrome.storage.local.set({ [key]: value });
}

export async function getAllStoredValues(): Promise<StorageSchema> {
  if (!hasChromeStorage()) {
    return DEFAULT_STORAGE;
  }
  const result = await chrome.storage.local.get(Object.keys(DEFAULT_STORAGE));
  return { ...DEFAULT_STORAGE, ...result } as StorageSchema;
}
