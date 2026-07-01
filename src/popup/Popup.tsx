import { useEffect, useMemo, useState } from "react";
import { calculateTrade } from "../lib/calc";
import { formatAssetAmount, formatPercent, formatRatio, formatUSDC } from "../lib/format";
import { fetchHyperliquidAccountState, isValidWalletAddress } from "../lib/hyperliquidApi";
import {
  pingContentScript,
  requestExtractedContext,
  requestToggleOverlay,
} from "../lib/messageBus";
import { getAllStoredValues, setStoredValue } from "../lib/storage";
import {
  EMPTY_TRADE_INPUTS,
  type ConnectionStatus,
  type DetectedContext,
  type Direction,
  type HyperliquidAccountState,
  type TradeCalculation,
  type TradeInputs,
} from "../lib/types";
import { getAllWarnings } from "../lib/validation";
import { DebugPanel } from "./components/DebugPanel";
import { DetectedContextCard } from "./components/DetectedContextCard";
import { InputField } from "./components/InputField";
import { OutputCard } from "./components/OutputCard";
import { WarningList } from "./components/WarningList";

const RISK_QUICK_VALUES = [0.25, 0.5, 1, 2, 3, 5];
const LEVERAGE_QUICK_VALUES = [1, 2, 3, 5, 10, 20, 50];

interface FormState {
  direction: Direction;
  asset: string;
  accountBalance: string;
  riskPercent: string;
  entryPrice: string;
  stopLossPrice: string;
  takeProfitPrice: string;
  leverage: string;
}

function numberToField(value: number): string {
  return value > 0 ? String(value) : "";
}

function formFromInputs(inputs: TradeInputs): FormState {
  return {
    direction: inputs.direction,
    asset: inputs.asset,
    accountBalance: numberToField(inputs.accountBalance),
    riskPercent: numberToField(inputs.riskPercent),
    entryPrice: numberToField(inputs.entryPrice),
    stopLossPrice: numberToField(inputs.stopLossPrice),
    takeProfitPrice: numberToField(inputs.takeProfitPrice),
    leverage: numberToField(inputs.leverage),
  };
}

function parseFieldNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inputsFromForm(form: FormState): TradeInputs {
  return {
    direction: form.direction,
    asset: form.asset.trim().toUpperCase(),
    accountBalance: parseFieldNumber(form.accountBalance),
    riskPercent: parseFieldNumber(form.riskPercent),
    entryPrice: parseFieldNumber(form.entryPrice),
    stopLossPrice: parseFieldNumber(form.stopLossPrice),
    takeProfitPrice: parseFieldNumber(form.takeProfitPrice),
    leverage: parseFieldNumber(form.leverage),
  };
}

function mergeDetectedIntoForm(form: FormState, context: DetectedContext): FormState {
  const next = { ...form };
  if (!next.asset && context.asset.value) next.asset = context.asset.value;
  if (!next.leverage && context.leverage.value) next.leverage = String(context.leverage.value);
  if (!next.accountBalance && context.accountBalance.value) {
    next.accountBalance = String(context.accountBalance.value);
  }
  if (!next.entryPrice && context.entryPrice.value) next.entryPrice = String(context.entryPrice.value);
  if (!next.stopLossPrice && context.stopLossPrice.value) {
    next.stopLossPrice = String(context.stopLossPrice.value);
  }
  if (!next.takeProfitPrice && context.takeProfitPrice.value) {
    next.takeProfitPrice = String(context.takeProfitPrice.value);
  }
  return next;
}

function buildCopyText(inputs: TradeInputs, calc: TradeCalculation): string {
  const positionSizeLine = `${formatAssetAmount(calc.positionSize, inputs.asset)}${
    inputs.asset ? ` ${inputs.asset}` : ""
  }`;

  return [
    "Hyperliquid Trade Settings",
    "",
    `Asset: ${inputs.asset || "—"}`,
    `Direction: ${inputs.direction.toUpperCase()}`,
    `Leverage: ${inputs.leverage}x`,
    `Account Balance: ${formatUSDC(inputs.accountBalance)}`,
    `Risk %: ${formatPercent(inputs.riskPercent)}`,
    `Risk Amount: ${formatUSDC(calc.riskAmount)}`,
    "",
    `Entry: ${formatUSDC(inputs.entryPrice)}`,
    `Stop Loss: ${formatUSDC(inputs.stopLossPrice)}`,
    `Take Profit: ${formatUSDC(inputs.takeProfitPrice)}`,
    "",
    `Position Size: ${positionSizeLine}`,
    `Position Notional: ${formatUSDC(calc.positionNotional)}`,
    `Required Margin: ${formatUSDC(calc.requiredMargin)}`,
    `Loss at Stop: ${formatUSDC(calc.lossAtStop)}`,
    `Profit at TP: ${formatUSDC(calc.profitAtTakeProfit)}`,
    `Risk/Reward: ${formatRatio(calc.riskRewardRatio)}`,
    `Stop Distance: ${formatPercent(calc.stopDistancePercent)}`,
    `TP Distance: ${formatPercent(calc.takeProfitDistancePercent)}`,
    `Margin Usage: ${formatPercent(calc.marginUsagePercent)}`,
    "",
    "Notes:",
    "Position size is calculated from risk amount and stop distance.",
    "Leverage affects required margin, not planned stop-loss risk.",
    "This tool does not place trades.",
  ].join("\n");
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "Connected",
  manual: "Manual Mode",
  api: "API Connected",
};

const STATUS_CLASSES: Record<ConnectionStatus, string> = {
  connected: "bg-ok/15 text-ok",
  manual: "bg-slate-700/40 text-slate-300",
  api: "bg-accent/15 text-accent",
};

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
      <path
        d="M4 4v5h5M20 20v-5h-5M4.5 15a8 8 0 0 0 14.4 3.5M19.5 9A8 8 0 0 0 5.1 5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Popup() {
  const [form, setForm] = useState<FormState>(formFromInputs(EMPTY_TRADE_INPUTS));
  const [hydrated, setHydrated] = useState(false);

  const [walletAddress, setWalletAddress] = useState("");
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [accountState, setAccountState] = useState<HyperliquidAccountState | null>(null);

  const [detectedContext, setDetectedContext] = useState<DetectedContext | null>(null);
  const [contentReachable, setContentReachable] = useState(false);
  const [detectionLoading, setDetectionLoading] = useState(false);
  const [autoFillEnabled, setAutoFillEnabled] = useState(false);

  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const connectionStatus: ConnectionStatus = accountState
    ? "api"
    : contentReachable
      ? "connected"
      : "manual";

  // Initial hydration: load storage, ping content script, extract context.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await getAllStoredValues();
      if (cancelled) return;

      setWalletAddress(stored.walletAddress);
      setOverlayEnabled(stored.overlayEnabled);
      setAutoFillEnabled(stored.autoFillEnabled);
      if (stored.lastDetectedContext) {
        setDetectedContext(stored.lastDetectedContext);
      }

      let nextForm = formFromInputs(stored.lastInputs);

      setDetectionLoading(true);
      const ping = await pingContentScript();
      if (cancelled) return;

      if (ping) {
        setContentReachable(true);
        const context = await requestExtractedContext();
        if (cancelled) return;
        if (context) {
          setDetectedContext(context);
          void setStoredValue("lastDetectedContext", context);
          if (stored.autoFillEnabled) {
            nextForm = mergeDetectedIntoForm(nextForm, context);
          }
        }
      } else {
        setContentReachable(false);
      }

      setForm(nextForm);
      setDetectionLoading(false);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist inputs (debounced) once hydrated.
  useEffect(() => {
    if (!hydrated) return;
    const handle = setTimeout(() => {
      const numericInputs = inputsFromForm(form);
      void setStoredValue("lastInputs", numericInputs);
      if (numericInputs.riskPercent > 0) {
        void setStoredValue("riskPercentDefault", numericInputs.riskPercent);
      }
      if (numericInputs.leverage > 0) {
        void setStoredValue("leverageDefault", numericInputs.leverage);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [form, hydrated]);

  const inputs = useMemo(() => inputsFromForm(form), [form]);
  const calc = useMemo(() => calculateTrade(inputs), [inputs]);
  const warnings = useMemo(() => getAllWarnings(inputs, calc), [inputs, calc]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRefresh() {
    setDetectionLoading(true);
    const ping = await pingContentScript();
    setContentReachable(Boolean(ping));
    if (!ping) {
      setDetectedContext(null);
      setDetectionLoading(false);
      return;
    }
    const context = await requestExtractedContext();
    setDetectedContext(context);
    if (context) {
      void setStoredValue("lastDetectedContext", context);
    }
    setDetectionLoading(false);
  }

  function handleUseDetectedValues() {
    if (!detectedContext) return;
    setForm((prev) => mergeDetectedIntoForm(prev, detectedContext));
  }

  function handleAutoFillChange(enabled: boolean) {
    setAutoFillEnabled(enabled);
    void setStoredValue("autoFillEnabled", enabled);
  }

  async function handleFetchAccountData() {
    if (!isValidWalletAddress(walletAddress)) {
      setApiError("Enter a valid 0x-prefixed wallet address.");
      return;
    }
    setApiLoading(true);
    setApiError(null);
    const result = await fetchHyperliquidAccountState(walletAddress);
    setApiLoading(false);
    if (result.ok) {
      setAccountState(result.data);
      void setStoredValue("walletAddress", walletAddress.trim());
    } else {
      setApiError(result.error);
      setAccountState(null);
    }
  }

  function handleUseApiBalance() {
    if (accountState?.accountValue != null) {
      updateField("accountBalance", String(accountState.accountValue));
    }
  }

  async function handleCopySettings() {
    const text = buildCopyText(inputs, calc);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    setTimeout(() => setCopyStatus("idle"), 1600);
  }

  function handleReset() {
    setForm(formFromInputs(EMPTY_TRADE_INPUTS));
    setAccountState(null);
    setApiError(null);
    setCopyStatus("idle");
  }

  async function handleToggleOverlay() {
    const next = !overlayEnabled;
    setOverlayEnabled(next);
    void setStoredValue("overlayEnabled", next);
    void requestToggleOverlay(next);
  }

  const rrTone = calc.riskRewardRatio <= 0 ? "default" : calc.riskRewardRatio >= 1.5 ? "ok" : "warn";
  const marginTone =
    calc.marginUsagePercent > 100 ? "danger" : calc.marginUsagePercent > 50 ? "warn" : "default";

  return (
    <div className="min-h-full bg-panel px-3 py-3 text-slate-100">
      {/* 1. Header */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold tracking-tight">HL Risk Tool</h1>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASSES[connectionStatus]}`}>
            {STATUS_LABEL[connectionStatus]}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={detectionLoading}
          title="Refresh from Hyperliquid"
          aria-label="Refresh from Hyperliquid"
          className="rounded p-1 text-slate-400 hover:bg-surface hover:text-accent disabled:opacity-40"
        >
          <span className={detectionLoading ? "inline-block animate-spin" : "inline-block"}>
            <RefreshIcon />
          </span>
        </button>
      </header>

      <div className="space-y-3">
        {/* 2. Detection card */}
        <DetectedContextCard
          context={detectedContext}
          autoFillEnabled={autoFillEnabled}
          onAutoFillChange={handleAutoFillChange}
        />

        {/* 3. Wallet / API card */}
        <section className="rounded-lg border border-border bg-surface p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Wallet (read-only)
          </h2>
          <div className="flex gap-2">
            <div className="flex-1">
              <InputField
                label="Wallet address"
                type="text"
                value={walletAddress}
                onChange={setWalletAddress}
                placeholder="0x…"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleFetchAccountData()}
              disabled={apiLoading}
              className="mt-[18px] h-[30px] shrink-0 rounded bg-accent/20 px-3 text-xs font-semibold text-accent hover:bg-accent/30 disabled:opacity-50"
            >
              {apiLoading ? "Fetching…" : "Fetch account data"}
            </button>
          </div>

          {apiError ? <p className="mt-2 text-xs text-danger">{apiError}</p> : null}

          {accountState ? (
            <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Account value</span>
                <span className="font-mono">
                  {accountState.accountValue !== null ? formatUSDC(accountState.accountValue) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Withdrawable</span>
                <span className="font-mono">
                  {accountState.withdrawable !== null ? formatUSDC(accountState.withdrawable) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Margin used</span>
                <span className="font-mono">
                  {accountState.totalMarginUsed !== null ? formatUSDC(accountState.totalMarginUsed) : "—"}
                </span>
              </div>
              {accountState.positions.length > 0 ? (
                <div className="pt-1">
                  <div className="text-slate-500">Open positions</div>
                  <ul className="mt-0.5 space-y-0.5 font-mono text-[11px] text-slate-300">
                    {accountState.positions.map((position) => (
                      <li key={position.coin} className="flex justify-between">
                        <span>{position.coin}</span>
                        <span>{position.size}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleUseApiBalance}
                disabled={accountState.accountValue === null}
                className="mt-1 w-full rounded border border-accent/40 py-1 text-[11px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
              >
                Use API balance
              </button>
            </div>
          ) : null}

          <p className="mt-2 text-[10px] text-slate-600">
            Read-only lookup via Hyperliquid&apos;s public info endpoint. Never asks for a private
            key or signature.
          </p>
        </section>

        {/* 4. Trade input card */}
        <section className="rounded-lg border border-border bg-surface p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Trade setup
          </h2>

          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => updateField("direction", "long")}
              className={`rounded py-1.5 text-xs font-semibold ${
                form.direction === "long" ? "bg-ok/20 text-ok" : "bg-panel text-slate-500"
              }`}
            >
              Long
            </button>
            <button
              type="button"
              onClick={() => updateField("direction", "short")}
              className={`rounded py-1.5 text-xs font-semibold ${
                form.direction === "short" ? "bg-danger/20 text-danger" : "bg-panel text-slate-500"
              }`}
            >
              Short
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <InputField label="Asset" type="text" value={form.asset} onChange={(v) => updateField("asset", v)} placeholder="BTC" />
            <InputField
              label="Account Balance"
              value={form.accountBalance}
              onChange={(v) => updateField("accountBalance", v)}
              suffix="USDC"
            />
          </div>

          <div className="mt-2">
            <InputField
              label="Risk %"
              value={form.riskPercent}
              onChange={(v) => updateField("riskPercent", v)}
              suffix="%"
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {RISK_QUICK_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateField("riskPercent", String(value))}
                  className="rounded bg-panel px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-border hover:text-slate-200"
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <InputField label="Entry" value={form.entryPrice} onChange={(v) => updateField("entryPrice", v)} />
            <InputField
              label="Stop Loss"
              value={form.stopLossPrice}
              onChange={(v) => updateField("stopLossPrice", v)}
            />
            <InputField
              label="Take Profit"
              value={form.takeProfitPrice}
              onChange={(v) => updateField("takeProfitPrice", v)}
            />
          </div>

          <div className="mt-2">
            <InputField
              label="Leverage"
              value={form.leverage}
              onChange={(v) => updateField("leverage", v)}
              suffix="x"
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {LEVERAGE_QUICK_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateField("leverage", String(value))}
                  className="rounded bg-panel px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-border hover:text-slate-200"
                >
                  {value}x
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Result cards */}
        <section>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Results
          </h2>
          <div className="grid grid-cols-2 gap-1.5">
            <OutputCard label="Risk Amount" value={formatUSDC(calc.riskAmount)} />
            <OutputCard
              label="Position Size"
              value={`${formatAssetAmount(calc.positionSize, inputs.asset)}${
                inputs.asset ? ` ${inputs.asset}` : ""
              }`}
            />
            <OutputCard label="Position Notional" value={formatUSDC(calc.positionNotional)} />
            <OutputCard label="Required Margin" value={formatUSDC(calc.requiredMargin)} />
            <OutputCard label="Loss at Stop" value={formatUSDC(calc.lossAtStop)} tone="danger" />
            <OutputCard label="Profit at TP" value={formatUSDC(calc.profitAtTakeProfit)} tone="ok" />
            <OutputCard label="Risk/Reward" value={formatRatio(calc.riskRewardRatio)} tone={rrTone} />
            <OutputCard label="Stop Distance %" value={formatPercent(calc.stopDistancePercent)} />
            <OutputCard label="TP Distance %" value={formatPercent(calc.takeProfitDistancePercent)} />
            <OutputCard label="Margin Usage %" value={formatPercent(calc.marginUsagePercent)} tone={marginTone} />
          </div>
        </section>

        {/* 6. Warnings */}
        <section>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Warnings
          </h2>
          <WarningList warnings={warnings} />
        </section>

        {/* 7. Actions */}
        <section className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="rounded bg-surface py-1.5 text-xs font-semibold text-slate-200 hover:bg-border"
          >
            Refresh from Hyperliquid
          </button>
          <button
            type="button"
            onClick={handleUseDetectedValues}
            disabled={!detectedContext}
            className="rounded bg-surface py-1.5 text-xs font-semibold text-slate-200 hover:bg-border disabled:opacity-40"
          >
            Use detected values
          </button>
          <button
            type="button"
            onClick={handleUseApiBalance}
            disabled={!accountState || accountState.accountValue === null}
            className="rounded bg-surface py-1.5 text-xs font-semibold text-slate-200 hover:bg-border disabled:opacity-40"
          >
            Use API balance
          </button>
          <button
            type="button"
            onClick={() => void handleToggleOverlay()}
            className="rounded bg-surface py-1.5 text-xs font-semibold text-slate-200 hover:bg-border"
          >
            Overlay: {overlayEnabled ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={() => void handleCopySettings()}
            className="col-span-2 rounded bg-accent/20 py-1.5 text-xs font-semibold text-accent hover:bg-accent/30"
          >
            {copyStatus === "copied"
              ? "Copied!"
              : copyStatus === "failed"
                ? "Copy failed — select text manually"
                : "Copy Hyperliquid Settings"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="col-span-2 rounded border border-border py-1.5 text-xs font-semibold text-slate-500 hover:bg-surface hover:text-slate-300"
          >
            Reset
          </button>
        </section>

        <DebugPanel context={detectedContext} />

        <footer className="pb-1 pt-1 text-center text-[10px] text-slate-600">
          Calculator only — does not place trades, sign transactions, or access private keys.
        </footer>
      </div>
    </div>
  );
}
