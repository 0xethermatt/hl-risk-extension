import type { AssetPositionSummary, HyperliquidAccountState } from "./types";

/**
 * Read-only client for the Hyperliquid public `/info` endpoint.
 *
 * This file ONLY ever issues informational reads (clearinghouseState,
 * openOrders). It must never be extended to place orders, cancel orders,
 * sign anything, or touch a private key. If Hyperliquid changes the exact
 * response shape, this is the one file that needs to change.
 */

const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";
const WALLET_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function isValidWalletAddress(address: string): boolean {
  return WALLET_ADDRESS_PATTERN.test(address.trim());
}

export type HyperliquidApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function postInfo(body: Record<string, unknown>): Promise<HyperliquidApiResult<unknown>> {
  try {
    const response = await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { ok: false, error: `Hyperliquid API returned ${response.status} ${response.statusText}` };
    }

    const data: unknown = await response.json();
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    return { ok: false, error: `Failed to reach Hyperliquid API: ${message}` };
  }
}

/** Raw clearinghouseState response — kept loose since Hyperliquid's schema isn't versioned here. */
export interface ClearinghouseStateResponse {
  marginSummary?: {
    accountValue?: string;
    totalMarginUsed?: string;
    totalNtlPos?: string;
    totalRawUsd?: string;
  };
  withdrawable?: string;
  assetPositions?: Array<{
    type?: string;
    position?: {
      coin?: string;
      szi?: string;
      entryPx?: string;
      positionValue?: string;
      unrealizedPnl?: string;
      liquidationPx?: string | null;
      marginUsed?: string;
      leverage?: { type?: string; value?: number };
    };
  }>;
}

export async function fetchClearinghouseState(
  walletAddress: string,
): Promise<HyperliquidApiResult<ClearinghouseStateResponse>> {
  if (!isValidWalletAddress(walletAddress)) {
    return { ok: false, error: "Enter a valid 0x-prefixed wallet address." };
  }
  const result = await postInfo({ type: "clearinghouseState", user: walletAddress.trim() });
  if (!result.ok) {
    return result;
  }
  return { ok: true, data: result.data as ClearinghouseStateResponse };
}

export interface OpenOrder {
  coin?: string;
  side?: string;
  limitPx?: string;
  sz?: string;
  oid?: number;
  timestamp?: number;
  origSz?: string;
  reduceOnly?: boolean;
}

export async function fetchOpenOrders(
  walletAddress: string,
): Promise<HyperliquidApiResult<OpenOrder[]>> {
  if (!isValidWalletAddress(walletAddress)) {
    return { ok: false, error: "Enter a valid 0x-prefixed wallet address." };
  }
  const result = await postInfo({ type: "openOrders", user: walletAddress.trim() });
  if (!result.ok) {
    return result;
  }
  const data = Array.isArray(result.data) ? (result.data as OpenOrder[]) : [];
  return { ok: true, data };
}

function toNumber(value: string | undefined | null): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeAccountState(
  response: ClearinghouseStateResponse,
): HyperliquidAccountState {
  const positions: AssetPositionSummary[] = (response.assetPositions ?? [])
    .map((entry): AssetPositionSummary | null => {
      const position = entry.position;
      if (!position?.coin) {
        return null;
      }
      return {
        coin: position.coin,
        size: toNumber(position.szi) ?? 0,
        entryPrice: toNumber(position.entryPx),
        positionValue: toNumber(position.positionValue),
        unrealizedPnl: toNumber(position.unrealizedPnl),
        leverage: position.leverage?.value ?? null,
        liquidationPrice: toNumber(position.liquidationPx ?? undefined),
        marginUsed: toNumber(position.marginUsed),
      };
    })
    .filter((position): position is AssetPositionSummary => position !== null && position.size !== 0);

  return {
    accountValue: toNumber(response.marginSummary?.accountValue),
    totalMarginUsed: toNumber(response.marginSummary?.totalMarginUsed),
    withdrawable: toNumber(response.withdrawable),
    positions,
  };
}

/** Convenience wrapper: fetch + normalize + friendly error handling in one call. */
export async function fetchHyperliquidAccountState(
  walletAddress: string,
): Promise<HyperliquidApiResult<HyperliquidAccountState>> {
  const result = await fetchClearinghouseState(walletAddress);
  if (!result.ok) {
    return result;
  }
  return { ok: true, data: normalizeAccountState(result.data) };
}
