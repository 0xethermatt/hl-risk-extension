export type ExtensionMessage =
  | { type: "PING" }
  | { type: "TOGGLE_OVERLAY"; enabled: boolean };

export interface PingResponse {
  ok: true;
  url: string;
}

export interface ToggleOverlayResponse {
  ok: true;
  enabled: boolean;
}

export const HYPERLIQUID_HOSTNAME = "app.hyperliquid.xyz";

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    return null;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function sendToActiveTab<TResponse>(
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

export async function requestToggleOverlay(enabled: boolean): Promise<boolean> {
  const response = await sendToActiveTab<ToggleOverlayResponse>({
    type: "TOGGLE_OVERLAY",
    enabled,
  });
  return response?.ok === true ? response.enabled : enabled;
}
