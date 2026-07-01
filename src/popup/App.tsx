import { useMemo, useState } from "react";
import { calculatePositionSize } from "../lib/positionSizing";

export function App() {
  const [accountEquity, setAccountEquity] = useState("10000");
  const [riskPercent, setRiskPercent] = useState("1");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");

  const result = useMemo(() => {
    const equity = Number(accountEquity);
    const risk = Number(riskPercent);
    const entry = Number(entryPrice);
    const stop = Number(stopLossPrice);

    if (!equity || !risk || !entry || !stop) {
      return null;
    }

    try {
      return calculatePositionSize({
        accountEquity: equity,
        riskPercent: risk,
        entryPrice: entry,
        stopLossPrice: stop,
      });
    } catch {
      return null;
    }
  }, [accountEquity, riskPercent, entryPrice, stopLossPrice]);

  return (
    <div className="min-w-80 space-y-4 bg-slate-950 p-4 text-slate-100">
      <h1 className="text-lg font-semibold">Hyperliquid Risk Manager</h1>

      <div className="space-y-2">
        <Field label="Account Equity (USD)" value={accountEquity} onChange={setAccountEquity} />
        <Field label="Risk %" value={riskPercent} onChange={setRiskPercent} />
        <Field label="Entry Price" value={entryPrice} onChange={setEntryPrice} />
        <Field label="Stop-Loss Price" value={stopLossPrice} onChange={setStopLossPrice} />
      </div>

      <div className="rounded-md bg-slate-900 p-3 text-sm">
        {result ? (
          <dl className="space-y-1">
            <Row label="Risk Amount" value={`$${result.riskAmount.toFixed(2)}`} />
            <Row label="Position Size" value={result.positionSize.toFixed(4)} />
            <Row label="Position Value" value={`$${result.positionValue.toFixed(2)}`} />
          </dl>
        ) : (
          <p className="text-slate-400">Enter values to calculate position size.</p>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function Field({ label, value, onChange }: FieldProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <input
        type="number"
        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-emerald-500 focus:outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
