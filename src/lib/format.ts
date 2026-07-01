const ASSET_DECIMALS: Record<string, number> = {
  BTC: 5,
  ETH: 4,
  SOL: 3,
};

const DEFAULT_ASSET_DECIMALS = 4;

function isDisplayable(value: number): boolean {
  return Number.isFinite(value);
}

export function formatUSDC(value: number): string {
  if (!isDisplayable(value)) {
    return "—";
  }
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatAssetAmount(value: number, asset: string): string {
  if (!isDisplayable(value)) {
    return "—";
  }
  const decimals = ASSET_DECIMALS[asset.toUpperCase()] ?? DEFAULT_ASSET_DECIMALS;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number): string {
  if (!isDisplayable(value)) {
    return "—";
  }
  return `${value.toFixed(2)}%`;
}

export function formatRatio(value: number): string {
  if (!isDisplayable(value)) {
    return "—";
  }
  return `${value.toFixed(2)}`;
}
