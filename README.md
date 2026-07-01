# HL Risk Tool

A private Chrome extension (Manifest V3) that helps size Hyperliquid
positions and catch overleveraged setups **before** you enter them on
[app.hyperliquid.xyz](https://app.hyperliquid.xyz).

## What this is (and is not)

This is a **calculator and read-only helper**. It is deliberately incapable
of touching your funds:

- It does **not** place trades.
- It does **not** sign transactions.
- It does **not** request wallet signatures.
- It does **not** store or ask for private keys.
- It does **not** create API wallets.
- It does **not** implement order placement.
- It does **not** call any Hyperliquid *exchange* (trading) endpoint — only
  the public, read-only `/info` endpoint, and only when you explicitly enter
  a wallet address and click "Fetch account data".

Everything it produces is meant to be reviewed and manually re-entered into
Hyperliquid's own UI. You are always the one who places the trade.

## Tech stack

- Chrome Extension Manifest V3
- [Vite](https://vitejs.dev/) + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin) for MV3 bundling/HMR
- React 19 + TypeScript (strict mode)
- Tailwind CSS
- Vitest for unit tests
- `chrome.storage.local` for persistence — no backend, no paid APIs, no secrets

## Project structure

```
manifest.json                    Source MV3 manifest (transformed by @crxjs/vite-plugin)
index.html                       Popup entry point
src/
  popup/
    main.tsx                     Popup React entry
    Popup.tsx                    Main popup UI/state
    components/                  InputField, OutputCard, WarningList,
                                  DetectedContextCard, DebugPanel
  content/
    hyperliquidContent.ts        Content script (app.hyperliquid.xyz only)
    overlay.tsx                  Optional read-only in-page overlay (shadow DOM)
  background/
    serviceWorker.ts             MV3 service worker (storage bootstrap only)
  lib/
    types.ts                     Shared TypeScript types
    calc.ts                      Pure position-sizing calculator
    validation.ts                Direction/threshold validation & warnings
    format.ts                    USDC/asset/percent formatting helpers
    storage.ts                   Typed chrome.storage.local wrapper
    domExtractors.ts             Defensive, best-effort DOM scanning
    hyperliquidApi.ts            Read-only Hyperliquid /info API client
    messageBus.ts                Typed popup <-> content script messaging
  test/
    calc.test.ts
    validation.test.ts
```

## Local development

### Prerequisites

- Node.js 20+ and npm

### Install dependencies

```sh
npm install
```

### Build

```sh
npm run build
```

This produces an unpacked extension in `dist/`.

### Dev mode (optional)

```sh
npm run dev
```

Runs Vite with HMR for the popup. For content-script/manifest changes you
generally still want a full `npm run build` + reload, since content scripts
and the service worker don't hot-reload the same way the popup does.

### Load the extension in Chrome

1. Run `npm run build` (the `dist/` folder is what you load).
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked** and select the `dist/` folder.
5. Pin the extension (puzzle-piece icon in the toolbar → pin "HL Risk Tool").

### Test it

1. Open [app.hyperliquid.xyz](https://app.hyperliquid.xyz) in a tab.
2. Click the extension icon to open the popup.
   - The header status pill should read **Connected** once the content
     script responds (may take a moment on first load — click the refresh
     icon if it still says "Manual Mode").
   - The **Detected context** card will show whatever it could infer from
     the page (asset, leverage, balance, TradingView tool prices) along
     with a confidence level for each. This is best-effort — see
     Limitations below.
3. Fill in (or auto-fill from detected values) direction, asset, account
   balance, risk %, entry/stop/take-profit, and leverage. Watch the
   **Results** and **Warnings** sections update live.
4. Try the quick risk % and leverage buttons, and toggle Long/Short.
5. Optionally paste a wallet address into the **Wallet (read-only)** card
   and click "Fetch account data" to pull account value/withdrawable/margin
   from Hyperliquid's public info endpoint, then "Use API balance" to feed
   it into the calculator.
6. Click **Toggle Overlay** to show the small floating read-only panel in
   the bottom-right corner of the Hyperliquid page. It mirrors risk amount,
   position size, required margin, R:R, and warning count from your current
   inputs.
7. Click **Copy Hyperliquid Settings** to copy a plain-text summary you can
   paste anywhere, then manually re-enter the entry/size/leverage into
   Hyperliquid's own order form.
8. Expand **Debug: extracted values** at the bottom to see exactly what the
   DOM extractors found (or didn't find) and why, useful when detection
   confidence is low.

### Other scripts

```sh
npm run build       # Type-check and produce a production build in dist/
npm run typecheck   # Type-check only, no emit
npm run lint         # Lint the codebase with ESLint
npm test             # Run the Vitest test suite once
npm run test:watch  # Run Vitest in watch mode
npm run preview      # Preview the production build
```

## Limitations

- **This tool does not place trades, sign anything, or access private
  keys.** It only ever computes numbers locally and, optionally, reads
  public account data by wallet address.
- **TradingView drawing-tool extraction is best-effort.** TradingView
  typically renders its long/short position tool labels on a `<canvas>`,
  not as real DOM text. When that's the case, extraction will legitimately
  return "not detected" rather than a wrong number — this extension never
  uses OCR or reads canvas pixels to work around that.
- **DOM-based detection in general (pair, leverage, balance) is
  heuristic**, since Hyperliquid's class names/DOM structure aren't a
  public, stable contract. Confidence levels (`high` / `medium` / `low` /
  `none`) are shown so you can judge how much to trust a given value.
  **Manual input always works** regardless of detection quality.
- **Leverage affects required margin, not the planned stop-loss loss.**
  Position size is derived purely from risk amount and stop distance;
  changing leverage never changes position size, only how much margin that
  position requires.
- **The core idea of stop-loss risk management is that you get stopped out,
  not liquidated** — but that only holds if your stop is actually reachable
  before liquidation. The tool estimates this with a rough, isolated-margin
  approximation (`~100/leverage`% move to liquidation) and warns
  (`stop-near-liquidation`) or errors (`stop-beyond-liquidation`) when your
  stop distance gets close to or exceeds that estimate. This is **not** an
  exact liquidation price calculation — Hyperliquid's real liquidation price
  also depends on margin mode, maintenance margin tiers, funding, and other
  open positions, none of which this tool models. Treat "Est. Liquidation
  Distance" as a rough outer bound, not a guarantee, and leave real buffer
  between your stop and it.
- **Always verify every value in Hyperliquid's own UI before placing a
  trade.** This tool is an aid, not a source of truth.
