import { calculateTrade } from "../lib/calc";
import {
  extractCurrentPairFromHyperliquid,
  extractTradingViewPositionToolPrices,
  extractVisibleAccountBalance,
  extractVisibleLeverage,
} from "../lib/domExtractors";
import type {
  ExtensionMessage,
  ExtractContextResponse,
  PingResponse,
  ToggleOverlayResponse,
} from "../lib/messageBus";
import { getStoredValue, setStoredValue } from "../lib/storage";
import type { DetectedContext } from "../lib/types";
import { getAllWarnings } from "../lib/validation";
import { isOverlayMounted, mountOverlay, unmountOverlay, updateOverlay, type OverlayData } from "./overlay";

/**
 * Content script for app.hyperliquid.xyz.
 *
 * Strictly read-only: it extracts visible context for the popup/overlay and
 * never writes to page inputs, never dispatches clicks, and never places or
 * modifies orders. See domExtractors.ts for extraction logic.
 */

const HYPERLIQUID_HOSTNAME = "app.hyperliquid.xyz";
const MUTATION_DEBOUNCE_MS = 800;

function buildDetectedContext(): DetectedContext {
  const pairCandidates: string[] = [];
  const leverageCandidates: string[] = [];
  const balanceCandidates: string[] = [];
  const tradingViewCandidates: string[] = [];

  const asset = extractCurrentPairFromHyperliquid(document, pairCandidates);
  const leverage = extractVisibleLeverage(document, leverageCandidates);
  const accountBalance = extractVisibleAccountBalance(document, balanceCandidates);
  const tradingView = extractTradingViewPositionToolPrices(document, tradingViewCandidates);

  return {
    url: window.location.href,
    asset,
    leverage,
    accountBalance,
    entryPrice: tradingView.entryPrice,
    stopLossPrice: tradingView.stopLossPrice,
    takeProfitPrice: tradingView.takeProfitPrice,
    direction: tradingView.direction,
    source: "dom",
    extractedAt: Date.now(),
    debugCandidates: {
      pairCandidates,
      leverageCandidates,
      balanceCandidates,
      tradingViewCandidates,
    },
  };
}

function initContentScript(): void {
  let cachedContext: DetectedContext = buildDetectedContext();
  let debounceTimer: number | null = null;

  const observer = new MutationObserver(() => {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      cachedContext = buildDetectedContext();
      void refreshOverlay();
    }, MUTATION_DEBOUNCE_MS);
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  async function refreshOverlay(forceMount = false): Promise<void> {
    if (!forceMount && !isOverlayMounted()) {
      return;
    }
    const inputs = await getStoredValue("lastInputs");
    const calc = calculateTrade(inputs);
    const warnings = getAllWarnings(inputs, calc);

    const data: OverlayData = {
      asset: inputs.asset || null,
      riskAmount: inputs.accountBalance > 0 && inputs.riskPercent > 0 ? calc.riskAmount : null,
      positionSize: calc.positionSize > 0 ? calc.positionSize : null,
      requiredMargin: calc.requiredMargin > 0 ? calc.requiredMargin : null,
      riskRewardRatio: calc.riskRewardRatio > 0 ? calc.riskRewardRatio : null,
      warningCount: warnings.filter((warning) => warning.level !== "info").length,
    };

    if (isOverlayMounted()) {
      updateOverlay(data);
    } else {
      mountOverlay(data);
    }
  }

  async function handleMessage(
    message: ExtensionMessage,
  ): Promise<PingResponse | ExtractContextResponse | ToggleOverlayResponse> {
    switch (message.type) {
      case "PING":
        return { ok: true, url: window.location.href };

      case "EXTRACT_CONTEXT": {
        cachedContext = buildDetectedContext();
        return { ok: true, context: cachedContext };
      }

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
    if (areaName !== "local") {
      return;
    }
    if (changes["lastInputs"]) {
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
