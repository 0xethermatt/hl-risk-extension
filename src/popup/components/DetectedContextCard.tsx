import type { DetectedContext, DetectedField, DetectionConfidence } from "../../lib/types";
import { formatUSDC } from "../../lib/format";

interface DetectedContextCardProps {
  context: DetectedContext | null;
  autoFillEnabled: boolean;
  onAutoFillChange: (enabled: boolean) => void;
}

const CONFIDENCE_CLASSES: Record<DetectionConfidence, string> = {
  high: "bg-ok/15 text-ok",
  medium: "bg-warn/15 text-warn",
  low: "bg-slate-700/40 text-slate-400",
  none: "bg-slate-800 text-slate-600",
};

function ConfidenceBadge({ confidence }: { confidence: DetectionConfidence }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${CONFIDENCE_CLASSES[confidence]}`}>
      {confidence}
    </span>
  );
}

function DetectionRow({
  label,
  field,
  displayValue,
}: {
  label: string;
  field: DetectedField<unknown>;
  displayValue: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-slate-200">{field.value !== null ? displayValue : "—"}</span>
        <ConfidenceBadge confidence={field.confidence} />
      </span>
    </div>
  );
}

export function DetectedContextCard({
  context,
  autoFillEnabled,
  onAutoFillChange,
}: DetectedContextCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Detected context
        </h2>
        {context ? (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase text-slate-400">
            source: {context.source}
          </span>
        ) : null}
      </div>

      {context ? (
        <>
          <div className="mb-2 truncate font-mono text-[10px] text-slate-500" title={context.url}>
            {context.url}
          </div>
          <div className="divide-y divide-border/60">
            <DetectionRow label="Asset" field={context.asset} displayValue={String(context.asset.value)} />
            <DetectionRow
              label="Leverage"
              field={context.leverage}
              displayValue={`${String(context.leverage.value)}x`}
            />
            <DetectionRow
              label="Balance"
              field={context.accountBalance}
              displayValue={formatUSDC(Number(context.accountBalance.value))}
            />
            <DetectionRow
              label="Entry"
              field={context.entryPrice}
              displayValue={formatUSDC(Number(context.entryPrice.value))}
            />
            <DetectionRow
              label="Stop Loss"
              field={context.stopLossPrice}
              displayValue={formatUSDC(Number(context.stopLossPrice.value))}
            />
            <DetectionRow
              label="Take Profit"
              field={context.takeProfitPrice}
              displayValue={formatUSDC(Number(context.takeProfitPrice.value))}
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">
          No Hyperliquid tab detected. Open app.hyperliquid.xyz and click “Refresh from Hyperliquid”,
          or continue in manual mode below.
        </p>
      )}

      <label className="mt-2.5 flex items-center gap-2 border-t border-border pt-2 text-[11px] text-slate-400">
        <input
          type="checkbox"
          checked={autoFillEnabled}
          onChange={(event) => onAutoFillChange(event.target.checked)}
          className="h-3 w-3 rounded border-border bg-surface accent-accent"
        />
        Auto-fill empty fields on open
      </label>
    </div>
  );
}
