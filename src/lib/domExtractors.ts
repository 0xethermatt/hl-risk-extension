import type { DetectedField, DetectionConfidence, Direction } from "./types";

/**
 * Defensive, best-effort DOM scanning for the Hyperliquid trading UI.
 *
 * Hyperliquid's DOM structure and class names are not stable/public, and
 * TradingView's drawing-tool labels are canvas-rendered (not real DOM text)
 * in most cases. Every extractor here works purely off visible text content
 * and generic layout heuristics, never relying on specific class names,
 * private globals, canvas pixels, or OCR. When confidence is low the caller
 * should treat the result as a suggestion only — manual input always wins.
 */

export interface TextCandidate {
  text: string;
  element: Element;
}

const IGNORED_TAGS = new Set(["SCRIPT", "STYLE", "SVG", "NOSCRIPT", "HEAD", "TEMPLATE"]);

function isElementVisible(el: Element): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Walks visible text nodes under `root`, skipping script/style/svg and
 * hidden elements. Bounded by maxNodes/maxTextLength so a pathological page
 * can't make this scan expensive.
 */
export function visibleTextScanner(
  root: ParentNode = document.body,
  options: { maxNodes?: number; maxTextLength?: number } = {},
): TextCandidate[] {
  const maxNodes = options.maxNodes ?? 4000;
  const maxTextLength = options.maxTextLength ?? 200;
  const candidates: TextCandidate[] = [];

  if (typeof document === "undefined" || !root) {
    return candidates;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent?.trim();
      if (!text) {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentElement;
      if (!parent || IGNORED_TAGS.has(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let count = 0;
  let node = walker.nextNode();
  while (node && count < maxNodes) {
    count += 1;
    const parent = node.parentElement;
    const text = node.textContent?.trim() ?? "";
    if (parent && text && isElementVisible(parent)) {
      candidates.push({ text: text.slice(0, maxTextLength), element: parent });
    }
    node = walker.nextNode();
  }

  return candidates;
}

function parseNumberLike(text: string): number | null {
  const match = text.match(/-?\$?\d[\d,]*(\.\d+)?/);
  if (!match) {
    return null;
  }
  const cleaned = match[0].replace(/[$,]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function pushCandidate(sink: string[], text: string, limit = 25): void {
  if (sink.length < limit && !sink.includes(text)) {
    sink.push(text);
  }
}

const KNOWN_ASSETS = [
  "BTC",
  "ETH",
  "SOL",
  "HYPE",
  "ARB",
  "AVAX",
  "OP",
  "SUI",
  "APT",
  "DOGE",
  "LINK",
  "LTC",
  "BNB",
  "XRP",
  "ATOM",
  "NEAR",
  "FTM",
  "INJ",
  "TIA",
  "SEI",
  "WIF",
  "PEPE",
  "ORDI",
  "TON",
  "ADA",
  "DOT",
  "UNI",
  "AAVE",
  "CRV",
  "MKR",
  "LDO",
  "GMX",
  "RUNE",
  "FIL",
  "ICP",
  "ETC",
  "BCH",
  "TRX",
  "MATIC",
  "JUP",
  "PYTH",
  "STX",
  "KAS",
];

const QUOTE_TOKENS = new Set(["USD", "USDC", "USDT", "PERP"]);
const PAIR_PATTERN = /\b([A-Z0-9]{2,10})[/-](USDC|USDT|USD|PERP)\b/;
const KNOWN_ASSET_PATTERN = new RegExp(`\\b(${KNOWN_ASSETS.join("|")})\\b`);

function normalizePairToken(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase();
  const match = cleaned.match(/^([A-Z0-9]{2,10})[/-]?(USDC|USDT|USD|PERP)?$/);
  if (!match) {
    return null;
  }
  const symbol = match[1];
  if (QUOTE_TOKENS.has(symbol)) {
    return null;
  }
  return symbol;
}

/**
 * Detects the currently selected trading pair. Checks the document title
 * first (Hyperliquid sets it to something like "BTC-USD | Hyperliquid"),
 * then falls back to scanning visible text near the top of the page for
 * pair-like tokens (BTC/USDC, BTC-USD, BTC-PERP) or bare known symbols.
 */
export function extractCurrentPairFromHyperliquid(
  doc: Document = document,
  debugSink: string[] = [],
): DetectedField<string> {
  const titleMatch = doc.title.toUpperCase().match(PAIR_PATTERN);
  if (titleMatch) {
    const symbol = normalizePairToken(titleMatch[0]);
    if (symbol) {
      pushCandidate(debugSink, `title:${titleMatch[0]}`);
      return { value: symbol, raw: titleMatch[0], confidence: "high" };
    }
  }

  const textCandidates = visibleTextScanner(doc.body, { maxNodes: 3000, maxTextLength: 40 });
  let bestPairMatch: { symbol: string; raw: string; top: number } | null = null;
  let bestKnownMatch: { symbol: string; raw: string; top: number } | null = null;

  for (const candidate of textCandidates) {
    const text = candidate.text.toUpperCase();

    const pairMatch = text.match(PAIR_PATTERN);
    if (pairMatch) {
      const symbol = normalizePairToken(pairMatch[0]);
      if (symbol) {
        pushCandidate(debugSink, pairMatch[0]);
        const top = candidate.element.getBoundingClientRect().top;
        if (!bestPairMatch || top < bestPairMatch.top) {
          bestPairMatch = { symbol, raw: pairMatch[0], top };
        }
      }
      continue;
    }

    if (text.length <= 12) {
      const knownMatch = text.match(KNOWN_ASSET_PATTERN);
      if (knownMatch) {
        pushCandidate(debugSink, text);
        const top = candidate.element.getBoundingClientRect().top;
        if (!bestKnownMatch || top < bestKnownMatch.top) {
          bestKnownMatch = { symbol: knownMatch[0], raw: text, top };
        }
      }
    }
  }

  if (bestPairMatch) {
    return {
      value: bestPairMatch.symbol,
      raw: bestPairMatch.raw,
      confidence: bestPairMatch.top < 300 ? "high" : "medium",
    };
  }

  if (bestKnownMatch) {
    return {
      value: bestKnownMatch.symbol,
      raw: bestKnownMatch.raw,
      confidence: bestKnownMatch.top < 300 ? "medium" : "low",
    };
  }

  return { value: null, raw: null, confidence: debugSink.length > 0 ? "low" : "none" };
}

const LEVERAGE_PATTERN = /\b(cross|isolated)?\s*(leverage\s*[:\s]?\s*)?(\d{1,3})\s*x\b/i;

/**
 * Detects the currently displayed leverage multiplier (e.g. "10x",
 * "Cross 10x", "Leverage: 10x").
 */
export function extractVisibleLeverage(
  doc: Document = document,
  debugSink: string[] = [],
): DetectedField<number> {
  const textCandidates = visibleTextScanner(doc.body, { maxNodes: 3000, maxTextLength: 60 });
  let best: { value: number; raw: string; confidence: DetectionConfidence } | null = null;
  let anyMatch = false;

  for (const candidate of textCandidates) {
    const match = candidate.text.match(LEVERAGE_PATTERN);
    if (!match) {
      continue;
    }
    const value = Number(match[3]);
    if (!Number.isFinite(value) || value <= 0 || value > 200) {
      continue;
    }

    anyMatch = true;
    pushCandidate(debugSink, candidate.text);

    const hasContextWord = /leverage|cross|isolated/i.test(candidate.text);
    const confidence: DetectionConfidence = hasContextWord ? "high" : "medium";
    if (!best || (confidence === "high" && best.confidence !== "high")) {
      best = { value, raw: candidate.text, confidence };
    }
  }

  if (best) {
    return best;
  }
  return { value: null, raw: null, confidence: anyMatch ? "low" : "none" };
}

const BALANCE_LABELS = ["account value", "available", "withdrawable", "balance", "margin"];
const BALANCE_NUMBER_PATTERN = /\$?-?\d[\d,]*(\.\d+)?\s*(USDC)?/i;

/**
 * Detects an account/available balance figure near a recognizable label.
 * Deliberately conservative: if several distinct numeric candidates are
 * found and none stand out with high confidence, this returns null (the
 * candidates remain available for the debug panel).
 */
export function extractVisibleAccountBalance(
  doc: Document = document,
  debugSink: string[] = [],
): DetectedField<number> {
  const textCandidates = visibleTextScanner(doc.body, { maxNodes: 4000, maxTextLength: 80 });
  const matches: { value: number; raw: string; confidence: DetectionConfidence }[] = [];

  for (const candidate of textCandidates) {
    const lower = candidate.text.toLowerCase();
    const label = BALANCE_LABELS.find((l) => lower.includes(l));
    if (!label) {
      continue;
    }

    const inlineMatch = candidate.text.match(BALANCE_NUMBER_PATTERN);
    if (inlineMatch && /\d/.test(inlineMatch[0])) {
      const value = parseNumberLike(inlineMatch[0]);
      if (value !== null) {
        pushCandidate(debugSink, candidate.text);
        matches.push({ value, raw: candidate.text, confidence: "high" });
        continue;
      }
    }

    const container =
      candidate.element.closest("div, section, li, tr") ?? candidate.element.parentElement;
    if (!container) {
      continue;
    }
    const nearby = visibleTextScanner(container, { maxNodes: 20, maxTextLength: 40 });
    for (const sibling of nearby) {
      if (sibling.text === candidate.text) {
        continue;
      }
      const numberMatch = sibling.text.match(BALANCE_NUMBER_PATTERN);
      if (numberMatch && /\d/.test(numberMatch[0])) {
        const value = parseNumberLike(numberMatch[0]);
        if (value !== null) {
          const raw = `${candidate.text}: ${sibling.text}`;
          pushCandidate(debugSink, raw);
          matches.push({ value, raw, confidence: "medium" });
        }
      }
    }
  }

  const highConfidence = matches.filter((m) => m.confidence === "high");
  if (highConfidence.length === 1) {
    return highConfidence[0];
  }

  const mediumConfidence = matches.filter((m) => m.confidence === "medium");
  if (highConfidence.length === 0 && mediumConfidence.length === 1) {
    return mediumConfidence[0];
  }

  if (matches.length > 0) {
    // Multiple ambiguous candidates — stay conservative, debug still has them.
    return { value: null, raw: null, confidence: "low" };
  }

  return { value: null, raw: null, confidence: "none" };
}

export interface TradingViewExtraction {
  entryPrice: DetectedField<number>;
  stopLossPrice: DetectedField<number>;
  takeProfitPrice: DetectedField<number>;
  direction: DetectedField<Direction>;
}

const NULL_FIELD: DetectedField<never> = { value: null, raw: null, confidence: "none" };

const TV_LABELS: Record<"entry" | "stop" | "target", string[]> = {
  entry: ["entry"],
  stop: ["stop loss", "stop"],
  target: ["take profit", "target", "tp"],
};

function findPriceNearLabel(
  textCandidates: TextCandidate[],
  labels: string[],
  debugSink: string[],
): DetectedField<number> {
  for (const candidate of textCandidates) {
    const lower = candidate.text.toLowerCase();
    const matchedLabel = labels.find((label) => lower.includes(label));
    if (!matchedLabel) {
      continue;
    }

    const inlineMatch = candidate.text.match(/-?\d[\d,]*(\.\d+)?/);
    if (inlineMatch) {
      const value = parseNumberLike(inlineMatch[0]);
      if (value !== null && value > 0) {
        pushCandidate(debugSink, candidate.text);
        return { value, raw: candidate.text, confidence: "medium" };
      }
    }

    const container =
      candidate.element.closest("div, section, li, tr, g") ?? candidate.element.parentElement;
    if (container) {
      const nearby = visibleTextScanner(container, { maxNodes: 15, maxTextLength: 30 });
      for (const sibling of nearby) {
        if (sibling.text === candidate.text) {
          continue;
        }
        const numberMatch = sibling.text.match(/^-?\d[\d,]*(\.\d+)?$/);
        if (numberMatch) {
          const value = parseNumberLike(numberMatch[0]);
          if (value !== null && value > 0) {
            const raw = `${candidate.text}: ${sibling.text}`;
            pushCandidate(debugSink, raw);
            return { value, raw, confidence: "low" };
          }
        }
      }
    }
  }

  return { value: null, raw: null, confidence: "none" };
}

/**
 * Best-effort extraction of TradingView "long/short position tool" prices
 * (Entry / Stop / Target) from visible DOM text. TradingView typically
 * renders these labels on a <canvas>, so in most real sessions this will
 * legitimately return nulls — that is expected, not a bug. No OCR, no
 * canvas pixel reads, no private TradingView globals are used. Manual
 * input is always the reliable fallback.
 */
export function extractTradingViewPositionToolPrices(
  doc: Document = document,
  debugSink: string[] = [],
): TradingViewExtraction {
  const textCandidates = visibleTextScanner(doc.body, { maxNodes: 4000, maxTextLength: 60 });

  const entryPrice = findPriceNearLabel(textCandidates, TV_LABELS.entry, debugSink);
  const stopLossPrice = findPriceNearLabel(textCandidates, TV_LABELS.stop, debugSink);
  const takeProfitPrice = findPriceNearLabel(textCandidates, TV_LABELS.target, debugSink);

  let direction: DetectedField<Direction> = { value: null, raw: null, confidence: "none" };
  if (entryPrice.value !== null && stopLossPrice.value !== null) {
    const inferred: Direction = stopLossPrice.value < entryPrice.value ? "long" : "short";
    direction = { value: inferred, raw: `entry:${entryPrice.value} stop:${stopLossPrice.value}`, confidence: "low" };
  }

  for (const candidate of textCandidates) {
    const lower = candidate.text.toLowerCase();
    if (lower.includes("risk/reward") || lower.includes("open p&l") || lower.includes("open pnl")) {
      pushCandidate(debugSink, candidate.text);
    }
  }

  return {
    entryPrice: entryPrice.value !== null ? entryPrice : NULL_FIELD,
    stopLossPrice: stopLossPrice.value !== null ? stopLossPrice : NULL_FIELD,
    takeProfitPrice: takeProfitPrice.value !== null ? takeProfitPrice : NULL_FIELD,
    direction,
  };
}
