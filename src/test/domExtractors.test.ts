import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractCurrentPairFromHyperliquid,
  extractTradingViewPositionToolPrices,
  extractVisibleAccountBalance,
  extractVisibleLeverage,
  visibleTextScanner,
} from "../lib/domExtractors";

// jsdom has no layout engine, so getBoundingClientRect always returns an
// all-zero rect. isElementVisible() treats a zero-size rect as hidden,
// which would make every extractor see an empty page. Stub a plausible,
// uniformly "visible, near the top" rect so the extraction logic itself is
// what's under test, not jsdom's lack of layout.
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function stubbedRect() {
    return {
      width: 100,
      height: 20,
      top: 50,
      left: 0,
      right: 100,
      bottom: 70,
      x: 0,
      y: 50,
      toJSON() {
        return {};
      },
    } as DOMRect;
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  document.body.innerHTML = "";
  document.title = "";
});

describe("visibleTextScanner", () => {
  it("collects visible text and skips script/style content", () => {
    document.body.innerHTML = `
      <script>var x = 1;</script>
      <style>.a { color: red; }</style>
      <p>Hello world</p>
    `;
    const candidates = visibleTextScanner(document.body);
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain("Hello world");
    expect(texts.some((t) => t.includes("var x"))).toBe(false);
    expect(texts.some((t) => t.includes("color: red"))).toBe(false);
  });

  it("skips elements hidden via display:none", () => {
    document.body.innerHTML = `
      <p style="display:none">Hidden</p>
      <p>Visible</p>
    `;
    const texts = visibleTextScanner(document.body).map((c) => c.text);
    expect(texts).not.toContain("Hidden");
    expect(texts).toContain("Visible");
  });

  it("truncates text to maxTextLength", () => {
    document.body.innerHTML = `<p>${"a".repeat(50)}</p>`;
    const candidates = visibleTextScanner(document.body, { maxTextLength: 10 });
    expect(candidates[0]?.text).toHaveLength(10);
  });
});

describe("extractCurrentPairFromHyperliquid", () => {
  it("prefers a pair-pattern token in visible body text over document.title", () => {
    document.title = "BTC-USD | Hyperliquid";
    document.body.innerHTML = `<div><span>ETH/USDC</span></div>`;
    const result = extractCurrentPairFromHyperliquid(document);
    expect(result.value).toBe("ETH");
    expect(result.confidence).toBe("high");
  });

  it("ignores a misleading document.title that reflects an unrelated ticker/watchlist item", () => {
    // Regression test: Hyperliquid's tab title can mirror a
    // starred/first-favorited watchlist asset (e.g. BTC-USDC) rather than
    // the pair actually selected for trading — the real, large pair-selector
    // header in the DOM must win over that.
    document.title = "BTC-USDC 60,070 | Hyperliquid";
    document.body.innerHTML = `<div><span>XYZ100-USDC</span></div>`;
    const result = extractCurrentPairFromHyperliquid(document);
    expect(result.value).toBe("XYZ100");
  });

  it("falls back to document.title (medium confidence) when the DOM scan finds nothing", () => {
    document.title = "BTC-USD | Hyperliquid";
    const result = extractCurrentPairFromHyperliquid(document);
    expect(result).toEqual({ value: "BTC", raw: "BTC-USD", confidence: "medium" });
  });

  it("falls back to a bare known-asset symbol with medium confidence", () => {
    document.title = "Hyperliquid";
    document.body.innerHTML = `<div><span>SOL</span></div>`;
    const result = extractCurrentPairFromHyperliquid(document);
    expect(result.value).toBe("SOL");
    expect(result.confidence).toBe("medium");
  });

  it("returns none when nothing pair-like is present", () => {
    document.title = "Hyperliquid";
    document.body.innerHTML = `<div><span>Hello world</span></div>`;
    const result = extractCurrentPairFromHyperliquid(document);
    expect(result).toEqual({ value: null, raw: null, confidence: "none" });
  });

  it("collects raw matches into the provided debug sink", () => {
    document.title = "BTC-USD | Hyperliquid";
    const debugSink: string[] = [];
    extractCurrentPairFromHyperliquid(document, debugSink);
    expect(debugSink.length).toBeGreaterThan(0);
  });
});

describe("extractVisibleLeverage", () => {
  it("detects 'Leverage: 10x' with high confidence", () => {
    document.body.innerHTML = `<div>Leverage: 10x</div>`;
    const result = extractVisibleLeverage(document);
    expect(result).toEqual({ value: 10, raw: "Leverage: 10x", confidence: "high" });
  });

  it("detects 'Cross 10x' with high confidence", () => {
    document.body.innerHTML = `<div>Cross 10x</div>`;
    const result = extractVisibleLeverage(document);
    expect(result.value).toBe(10);
    expect(result.confidence).toBe("high");
  });

  it("detects a bare '10x' with medium confidence", () => {
    document.body.innerHTML = `<div>10x</div>`;
    const result = extractVisibleLeverage(document);
    expect(result.value).toBe(10);
    expect(result.confidence).toBe("medium");
  });

  it("ignores out-of-range leverage values", () => {
    document.body.innerHTML = `<div>300x</div>`;
    const result = extractVisibleLeverage(document);
    expect(result).toEqual({ value: null, raw: null, confidence: "none" });
  });

  it("returns none when no leverage-like text is present", () => {
    document.body.innerHTML = `<div>Nothing here</div>`;
    const result = extractVisibleLeverage(document);
    expect(result.value).toBeNull();
    expect(result.confidence).toBe("none");
  });
});

describe("extractVisibleAccountBalance", () => {
  it("detects an inline label + number with high confidence", () => {
    document.body.innerHTML = `<div>Account Value $1,234.56</div>`;
    const result = extractVisibleAccountBalance(document);
    expect(result.value).toBeCloseTo(1234.56);
    expect(result.confidence).toBe("high");
  });

  it("detects a label and a separate sibling number with medium confidence", () => {
    document.body.innerHTML = `
      <div>
        <span>Account Value</span>
        <span>$500.00</span>
      </div>
    `;
    const result = extractVisibleAccountBalance(document);
    expect(result.value).toBeCloseTo(500);
    expect(result.confidence).toBe("medium");
  });

  it("stays conservative (null) when multiple ambiguous candidates are found", () => {
    document.body.innerHTML = `
      <div>Balance $100.00</div>
      <div>Margin $200.00</div>
    `;
    const result = extractVisibleAccountBalance(document);
    expect(result.value).toBeNull();
    expect(result.confidence).toBe("low");
  });

  it("returns none when no balance label is present", () => {
    document.body.innerHTML = `<div>Nothing here</div>`;
    const result = extractVisibleAccountBalance(document);
    expect(result).toEqual({ value: null, raw: null, confidence: "none" });
  });
});

describe("extractTradingViewPositionToolPrices", () => {
  it("extracts inline entry/stop/target prices and infers a long direction", () => {
    document.body.innerHTML = `
      <div>Entry 60000</div>
      <div>Stop Loss 58000</div>
      <div>Take Profit 65000</div>
    `;
    const result = extractTradingViewPositionToolPrices(document);

    expect(result.entryPrice.value).toBe(60000);
    expect(result.stopLossPrice.value).toBe(58000);
    expect(result.takeProfitPrice.value).toBe(65000);
    expect(result.direction.value).toBe("long");
  });

  it("infers a short direction when the stop is above entry", () => {
    document.body.innerHTML = `
      <div>Entry 60000</div>
      <div>Stop Loss 62000</div>
    `;
    const result = extractTradingViewPositionToolPrices(document);
    expect(result.direction.value).toBe("short");
  });

  it("finds a price in a separate sibling element with low confidence", () => {
    document.body.innerHTML = `
      <div>
        <span>Entry</span>
        <span>60000</span>
      </div>
    `;
    const result = extractTradingViewPositionToolPrices(document);
    expect(result.entryPrice.value).toBe(60000);
    expect(result.entryPrice.confidence).toBe("low");
  });

  it("returns null fields when no TradingView labels are present (e.g. canvas-rendered tool)", () => {
    document.body.innerHTML = `<div>Just some chart chrome</div>`;
    const result = extractTradingViewPositionToolPrices(document);

    expect(result.entryPrice).toEqual({ value: null, raw: null, confidence: "none" });
    expect(result.stopLossPrice).toEqual({ value: null, raw: null, confidence: "none" });
    expect(result.takeProfitPrice).toEqual({ value: null, raw: null, confidence: "none" });
    expect(result.direction).toEqual({ value: null, raw: null, confidence: "none" });
  });
});
