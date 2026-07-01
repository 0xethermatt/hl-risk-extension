import { calculateTrade } from "../lib/calc";
import type { ExtensionMessage, PingResponse, ToggleOverlayResponse } from "../lib/messageBus";
import { getStoredValue, setStoredValue } from "../lib/storage";
import { getAllWarnings } from "../lib/validation";
import {
  isOverlayMounted,
  mountOverlay,
  unmountOverlay,
  updateOverlay,
  type OverlayData,
} from "./overlay";

/**
 * Content script for app.hyperliquid.xyz.
 *
 * Strictly read-only display: manages the floating overlay that mirrors the
 * popup's calculator results. Never writes to page inputs, never dispatches
 * clicks, and never places or modifies orders.
 */

const HYPERLIQUID_HOSTNAME = "app.hyperliquid.xyz";

function initContentScript(): void {
  async function refreshOverlay(forceMount = false): Promise<void> {
    if (!forceMount && !isOverlayMounted()) {
      return;
    }
    const inputs = await getStoredValue("lastInputs");
    const calc = calculateTrade(inputs);
    const warnings = getAllWarnings(inputs, calc);

    const actionableWarnings = warnings.filter(
      (w): w is typeof w & { level: "error" | "warning" } =>
        w.level === "error" || w.level === "warning",
    );

    const data: OverlayData = {
      asset: inputs.asset || null,
      riskAmount: inputs.accountBalance > 0 && inputs.riskPercent > 0 ? calc.riskAmount : null,
      positionSize: calc.positionSize > 0 ? calc.positionSize : null,
      requiredMargin: calc.requiredMargin > 0 ? calc.requiredMargin : null,
      riskRewardRatio: calc.riskRewardRatio > 0 ? calc.riskRewardRatio : null,
      warningCount: actionableWarnings.length,
      warnings: actionableWarnings.map((w) => ({ level: w.level, message: w.message })),
    };

    if (isOverlayMounted()) {
      updateOverlay(data);
    } else {
      mountOverlay(data);
    }
  }

  async function handleMessage(
    message: ExtensionMessage,
  ): Promise<PingResponse | ToggleOverlayResponse | { ok: false; error: string }> {
    switch (message.type) {
      case "PING":
        return { ok: true, url: window.location.href };

      case "TOGGLE_OVERLAY": {
        await setStoredValue("overlayEnabled", message.enabled);
        if (message.enabled) {
          await refreshOverlay(true);
        } else {
          unmountOverlay();
        }
        return { ok: true, enabled: message.enabled };
      }

      default:
        return { ok: false, error: "Unknown message type" };
    }
  }

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "Content script error" }));
    return true;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes["lastInputs"]) {
      void refreshOverlay();
    }
  });

  void getStoredValue("overlayEnabled").then((enabled) => {
    if (enabled) {
      void refreshOverlay(true);
    }
  });
}

if (window.location.hostname === HYPERLIQUID_HOSTNAME) {
  initContentScript();
}
