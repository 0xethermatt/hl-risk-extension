import { useEffect, useMemo, useState } from "react";
import { calculateTrade } from "../lib/calc";
import { formatAssetAmount, formatPercent, formatRatio, formatUSDC } from "../lib/format";
import { requestToggleOverlay } from "../lib/messageBus";
import { getAllStoredValues, setStoredValue } from "../lib/storage";
import {
  EMPTY_TRADE_INPUTS,
  type Direction,
  type MarginMode,
  type TradeCalculation,
  type TradeInputs,
} from "../lib/types";
import { getAllWarnings } from "../lib/validation";
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
  marginMode: MarginMode;
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
    marginMode: inputs.marginMode,
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
    marginMode: form.marginMode,
  };
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
    `Margin Mode: ${inputs.marginMode.toUpperCase()}`,
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
    `Est. Liquidation Distance: ${formatPercent(calc.approxLiquidationDistancePercent)}`,
    "",
    "Notes:",
    "Position size is calculated from risk amount and stop distance.",
    "Leverage affects required margin, not planned stop-loss risk.",
    "With proper sizing, the stop loss should trigger before liquidation.",
    "This tool does not place trades.",
  ].join("\n");
}

export function Popup() {
  const [form, setForm] = useState<FormState>(formFromInputs(EMPTY_TRADE_INPUTS));
  const [hydrated, setHydrated] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getAllStoredValues();
      if (cancelled) return;
      setOverlayEnabled(stored.overlayEnabled);
      setForm(formFromInputs(stored.lastInputs));
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const liquidationBufferRatio =
    calc.approxLiquidationDistancePercent > 0
      ? calc.stopDistancePercent / calc.approxLiquidationDistancePercent
      : 0;
  const liquidationTone =
    liquidationBufferRatio >= 1 ? "danger" : liquidationBufferRatio >= 0.8 ? "warn" : "default";

  return (
    <div className="min-h-full bg-panel px-3 py-3 text-slate-100">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-sm font-bold tracking-tight text-accent">HL Risk Tool</h1>
        <button
          type="button"
          onClick={() => void handleToggleOverlay()}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            overlayEnabled ? "bg-accent/20 text-accent" : "bg-slate-700/40 text-slate-400"
          }`}
        >
          Overlay {overlayEnabled ? "On" : "Off"}
        </button>
      </header>

      <div className="space-y-3">
        {/* Trade setup */}
        <section className="rounded-lg border border-border bg-surface p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Trade Setup
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

          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => updateField("marginMode", "cross")}
              title="Whole account balance backs the position — wider liquidation buffer, whole account at risk."
              className={`rounded py-1.5 text-xs font-semibold ${
                form.marginMode === "cross" ? "bg-accent/20 text-accent" : "bg-panel text-slate-500"
              }`}
            >
              Cross
            </button>
            <button
              type="button"
              onClick={() => updateField("marginMode", "isolated")}
              title="Only this position's own margin backs it — losses capped to that margin, tighter liquidation buffer."
              className={`rounded py-1.5 text-xs font-semibold ${
                form.marginMode === "isolated" ? "bg-accent/20 text-accent" : "bg-panel text-slate-500"
              }`}
            >
              Isolated
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <InputField
              label="Asset"
              type="text"
              value={form.asset}
              onChange={(v) => updateField("asset", v)}
              placeholder="BTC"
            />
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
            <InputField
              label="Entry"
              value={form.entryPrice}
              onChange={(v) => updateField("entryPrice", v)}
            />
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

        {/* Results */}
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
            <OutputCard
              label="Margin Usage %"
              value={formatPercent(calc.marginUsagePercent)}
              tone={marginTone}
            />
            <OutputCard
              label="Est. Liquidation Distance"
              value={formatPercent(calc.approxLiquidationDistancePercent)}
              tone={liquidationTone}
              hint="Rough estimate — stop must trigger before this."
            />
          </div>
        </section>

        {/* Warnings */}
        <section>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Warnings
          </h2>
          <WarningList warnings={warnings} />
        </section>

        {/* Actions */}
        <section className="space-y-1.5">
          <button
            type="button"
            onClick={() => void handleCopySettings()}
            className="w-full rounded bg-accent/20 py-1.5 text-xs font-semibold text-accent hover:bg-accent/30"
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
            className="w-full rounded border border-border py-1.5 text-xs font-semibold text-slate-500 hover:bg-surface hover:text-slate-300"
          >
            Reset
          </button>
        </section>

        <footer className="pb-1 pt-1 text-center text-[10px] text-slate-600">
          Calculator only — does not place trades, sign transactions, or access private keys.
        </footer>
      </div>
    </div>
  );
}
