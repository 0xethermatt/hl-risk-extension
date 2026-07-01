import type { DetectedContext } from "./types";

export type ExtensionMessage =
  | { type: "PING" }
  | { type: "EXTRACT_CONTEXT" }
  | { type: "TOGGLE_OVERLAY"; enabled: boolean };

export interface PingResponse {
  ok: true;
  url: string;
}

export type ExtractContextResponse =
  | { ok: true; context: DetectedContext }
  | { ok: false; error: string };

export interface ToggleOverlayResponse {
  ok: true;
  enabled: boolean;
}

export const HYPERLIQUID_HOSTNAME = "app.hyperliquid.xyz";

export function isHyperliquidUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    return new URL(url).hostname === HYPERLIQUID_HOSTNAME;
  } catch {
    return false;
  }
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    return null;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

/**
 * Sends a message to the content script in the active tab. Resolves to null
 * (never throws) if there is no active tab, no content script listening, or
 * the tab isn't on app.hyperliquid.xyz — callers fall back to manual mode.
 */
export async function sendToActiveTab<TResponse>(
  message: ExtensionMessage,
): Promise<TResponse | null> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return null;
  }
  try {
    const response: unknown = await chrome.tabs.sendMessage(tab.id, message);
    return (response as TResponse) ?? null;
  } catch {
    return null;
  }
}

export async function pingContentScript(): Promise<PingResponse | null> {
  return sendToActiveTab<PingResponse>({ type: "PING" });
}

export async function requestExtractedContext(): Promise<DetectedContext | null> {
  const response = await sendToActiveTab<ExtractContextResponse>({ type: "EXTRACT_CONTEXT" });
  if (response?.ok) {
    return response.context;
  }
  return null;
}

export async function requestToggleOverlay(enabled: boolean): Promise<boolean> {
  const response = await sendToActiveTab<ToggleOverlayResponse>({
    type: "TOGGLE_OVERLAY",
    enabled,
  });
  return response?.ok === true ? response.enabled : enabled;
}
