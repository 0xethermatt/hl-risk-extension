import { useEffect, useMemo, useState } from "react";
import { calculateTrade } from "../lib/calc";
import { formatAssetAmount, formatPercent, formatRatio, formatUSDC } from "../lib/format";
import { requestToggleOverlay } from "../lib/messageBus";
import { getAllStoredValues, setStoredValue } from "../lib/storage";
import {
  EMPTY_TRADE_INPUTS,
  type Direction,
  type MarginMode,
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

export function Popup() {
  const [form, setForm] = useState<FormState>(formFromInputs(EMPTY_TRADE_INPUTS));
  const [hydrated, setHydrated] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getAllStoredValues();
      if (cancelled) return;
      setOverlayEnabled(stored.overlayEnabled);
      setForm(formFromInputs(stored.lastInputs));
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const handle = setTimeout(() => {
      const numericInputs = inputsFromForm(form);
      void setStoredValue("lastInputs", numericInputs);
      if (numericInputs.riskPercent > 0) void setStoredValue("riskPercentDefault", numericInputs.riskPercent);
      if (numericInputs.leverage > 0) void setStoredValue("leverageDefault", numericInputs.leverage);
    }, 400);
    return () => clearTimeout(handle);
  }, [form, hydrated]);

  const inputs = useMemo(() => inputsFromForm(form), [form]);
  const calc   = useMemo(() => calculateTrade(inputs), [inputs]);
  const warnings = useMemo(() => getAllWarnings(inputs, calc), [inputs, calc]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleReset() {
    setForm(formFromInputs(EMPTY_TRADE_INPUTS));
  }

  async function handleToggleOverlay() {
    const next = !overlayEnabled;
    setOverlayEnabled(next);
    void setStoredValue("overlayEnabled", next);
    void requestToggleOverlay(next);
  }

  const rrTone = calc.riskRewardRatio <= 0 ? "default" : calc.riskRewardRatio >= 1.5 ? "ok" : "warn";
  const liqRatio = calc.approxLiquidationDistancePercent > 0
    ? calc.stopDistancePercent / calc.approxLiquidationDistancePercent
    : 0;
  const liqTone = liqRatio >= 1 ? "danger" : liqRatio >= 0.8 ? "warn" : "default";

  return (
    <div className="min-h-full bg-panel px-4 py-4 text-slate-100">

      {/* ── Header ── */}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Hyperliquid
          </div>
          <div className="text-base font-bold leading-tight tracking-tight text-slate-100">
            Risk Pilot
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleToggleOverlay()}
          className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            overlayEnabled
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-border bg-surface text-muted hover:border-accent/30 hover:text-accent/60"
          }`}
        >
          {overlayEnabled ? "● Overlay On" : "○ Overlay Off"}
        </button>
      </header>

      <div className="space-y-3">

        {/* ── Direction + Margin Mode ── */}
        <div className="space-y-2">
          {/* Direction */}
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => updateField("direction", "long")}
              className={`py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                form.direction === "long"
                  ? "bg-accent/15 text-accent"
                  : "bg-surface text-muted hover:text-slate-300"
              }`}
            >
              ▲ Long
            </button>
            <button
              type="button"
              onClick={() => updateField("direction", "short")}
              className={`border-l border-border py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                form.direction === "short"
                  ? "bg-danger/15 text-danger"
                  : "bg-surface text-muted hover:text-slate-300"
              }`}
            >
              ▼ Short
            </button>
          </div>

          {/* Margin Mode */}
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => updateField("marginMode", "cross")}
              title="Whole account balance backs the position"
              className={`py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                form.marginMode === "cross"
                  ? "bg-accent/10 text-accent"
                  : "bg-surface text-muted hover:text-slate-300"
              }`}
            >
              Cross
            </button>
            <button
              type="button"
              onClick={() => updateField("marginMode", "isolated")}
              title="Only this position's margin backs it"
              className={`border-l border-border py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                form.marginMode === "isolated"
                  ? "bg-accent/10 text-accent"
                  : "bg-surface text-muted hover:text-slate-300"
              }`}
            >
              Isolated
            </button>
          </div>
        </div>

        {/* ── Inputs ── */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-4">

          {/* Asset + Balance */}
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Asset"
              type="text"
              value={form.asset}
              onChange={(v) => updateField("asset", v)}
              placeholder="BTC"
            />
            <InputField
              label="Balance"
              value={form.accountBalance}
              onChange={(v) => updateField("accountBalance", v)}
              suffix="USDC"
            />
          </div>

          {/* Risk % */}
          <div>
            <InputField
              label="Risk per trade"
              value={form.riskPercent}
              onChange={(v) => updateField("riskPercent", v)}
              suffix="%"
            />
            <div className="mt-2 flex gap-1.5">
              {RISK_QUICK_VALUES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateField("riskPercent", String(v))}
                  className={`flex-1 rounded-md py-1 text-[10px] font-semibold transition-colors ${
                    form.riskPercent === String(v)
                      ? "bg-accent/20 text-accent"
                      : "bg-surface2 text-muted hover:text-slate-300"
                  }`}
                >
                  {v}%
                </button>
              ))}
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-3 gap-2">
            <InputField label="Entry" value={form.entryPrice} onChange={(v) => updateField("entryPrice", v)} />
            <InputField label="Stop Loss" value={form.stopLossPrice} onChange={(v) => updateField("stopLossPrice", v)} />
            <InputField label="Take Profit" value={form.takeProfitPrice} onChange={(v) => updateField("takeProfitPrice", v)} />
          </div>

          {/* Leverage */}
          <div>
            <InputField
              label="Leverage"
              value={form.leverage}
              onChange={(v) => updateField("leverage", v)}
              suffix="×"
            />
            <div className="mt-2 flex gap-1.5">
              {LEVERAGE_QUICK_VALUES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateField("leverage", String(v))}
                  className={`flex-1 rounded-md py-1 text-[10px] font-semibold transition-colors ${
                    form.leverage === String(v)
                      ? "bg-accent/20 text-accent"
                      : "bg-surface2 text-muted hover:text-slate-300"
                  }`}
                >
                  {v}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
            Results
          </div>
          <div className="grid grid-cols-2 gap-2">
            <OutputCard label="Risk Amount"     value={formatUSDC(calc.riskAmount)} />
            <OutputCard
              label="Position Size"
              value={`${formatAssetAmount(calc.positionSize, inputs.asset)}${inputs.asset ? ` ${inputs.asset}` : ""}`}
            />
            <OutputCard label="Required Margin"     value={formatUSDC(calc.requiredMargin)} />
            <OutputCard label="Risk / Reward"   value={formatRatio(calc.riskRewardRatio)} tone={rrTone} />
            <OutputCard label="Stop Distance"   value={formatPercent(calc.stopDistancePercent)} />
            <OutputCard
              label="Est. Liq. Distance"
              value={formatPercent(calc.approxLiquidationDistancePercent)}
              tone={liqTone}
              hint="Stop must trigger before this"
            />
          </div>
        </div>

        {/* ── Warnings ── */}
        <WarningList warnings={warnings} />

        {/* ── Actions ── */}
        <button
          type="button"
          onClick={handleReset}
          className="w-full rounded-lg border border-border py-2 text-xs font-semibold text-muted transition-colors hover:border-accent/30 hover:text-slate-300"
        >
          Reset
        </button>

        <p className="pb-1 text-center text-[10px] text-muted">
          Read-only calculator · does not place trades or access private keys
        </p>
      </div>
    </div>
  );
}
