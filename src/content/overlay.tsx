import { createRoot, type Root } from "react-dom/client";
import { formatAssetAmount, formatRatio, formatUSDC } from "../lib/format";

/**
 * Small, read-only floating overlay injected into app.hyperliquid.xyz.
 * Rendered inside a shadow root so it never leaks styles onto the host page
 * and the host page's CSS never leaks into it. No trade buttons, no order
 * placement — display only.
 */

export interface OverlayData {
  asset: string | null;
  riskAmount: number | null;
  positionSize: number | null;
  requiredMargin: number | null;
  riskRewardRatio: number | null;
  warningCount: number;
}

const HOST_ID = "hl-risk-tool-overlay-host";

let hostElement: HTMLDivElement | null = null;
let reactRoot: Root | null = null;

const OVERLAY_STYLES = `
  :host { all: initial; }
  .panel {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483000;
    width: 220px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: #e2e8f0;
    background: rgba(11, 15, 20, 0.95);
    border: 1px solid #1f2833;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    padding: 10px 12px;
    pointer-events: auto;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
  }
  .label { color: #94a3b8; }
  .value { color: #e2e8f0; font-weight: 600; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid #1f2833;
  }
  .title { font-weight: 700; letter-spacing: 0.02em; }
  .warn-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 999px;
    background: #3f2d0a;
    color: #facc15;
  }
  .warn-badge.zero { background: #0b2f22; color: #4ade80; }
  .hint {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid #1f2833;
    color: #64748b;
    font-size: 10px;
  }
`;

function OverlayPanel({ data }: { data: OverlayData }) {
  return (
    <div className="panel">
      <div className="header">
        <span className="title">HL Risk Tool</span>
        <span className={`warn-badge ${data.warningCount === 0 ? "zero" : ""}`}>
          {data.warningCount} warning{data.warningCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="row">
        <span className="label">Asset</span>
        <span className="value">{data.asset ?? "—"}</span>
      </div>
      <div className="row">
        <span className="label">Risk</span>
        <span className="value">{data.riskAmount !== null ? formatUSDC(data.riskAmount) : "—"}</span>
      </div>
      <div className="row">
        <span className="label">Size</span>
        <span className="value">
          {data.positionSize !== null ? formatAssetAmount(data.positionSize, data.asset ?? "") : "—"}
        </span>
      </div>
      <div className="row">
        <span className="label">Margin</span>
        <span className="value">
          {data.requiredMargin !== null ? formatUSDC(data.requiredMargin) : "—"}
        </span>
      </div>
      <div className="row">
        <span className="label">R:R</span>
        <span className="value">
          {data.riskRewardRatio !== null ? formatRatio(data.riskRewardRatio) : "—"}
        </span>
      </div>
      <div className="hint">Open the extension popup for full details.</div>
    </div>
  );
}

export function isOverlayMounted(): boolean {
  return hostElement !== null;
}

export function mountOverlay(data: OverlayData): void {
  if (hostElement) {
    updateOverlay(data);
    return;
  }

  hostElement = document.createElement("div");
  hostElement.id = HOST_ID;
  document.body.appendChild(hostElement);

  const shadowRoot = hostElement.attachShadow({ mode: "open" });
  const styleEl = document.createElement("style");
  styleEl.textContent = OVERLAY_STYLES;
  shadowRoot.appendChild(styleEl);

  const container = document.createElement("div");
  shadowRoot.appendChild(container);

  reactRoot = createRoot(container);
  reactRoot.render(<OverlayPanel data={data} />);
}

export function updateOverlay(data: OverlayData): void {
  if (!reactRoot) {
    mountOverlay(data);
    return;
  }
  reactRoot.render(<OverlayPanel data={data} />);
}

export function unmountOverlay(): void {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  if (hostElement) {
    hostElement.remove();
    hostElement = null;
  }
}
