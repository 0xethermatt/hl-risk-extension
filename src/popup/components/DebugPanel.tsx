import type { DetectedContext } from "../../lib/types";

interface DebugPanelProps {
  context: DetectedContext | null;
}

function CandidateList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{title}</div>
      {items.length === 0 ? (
        <div className="text-[11px] text-slate-600">none</div>
      ) : (
        <ul className="mt-0.5 space-y-0.5">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="break-all font-mono text-[10px] text-slate-400">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DebugPanel({ context }: DebugPanelProps) {
  return (
    <details className="rounded-lg border border-border bg-surface p-3 text-slate-300">
      <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-slate-400">
        Debug: extracted values
      </summary>

      {context ? (
        <div className="mt-2 space-y-3">
          <pre className="max-h-40 overflow-auto rounded bg-panel p-2 text-[10px] leading-snug text-slate-400">
            {JSON.stringify(
              {
                url: context.url,
                source: context.source,
                extractedAt: new Date(context.extractedAt).toISOString(),
                asset: context.asset,
                leverage: context.leverage,
                accountBalance: context.accountBalance,
                entryPrice: context.entryPrice,
                stopLossPrice: context.stopLossPrice,
                takeProfitPrice: context.takeProfitPrice,
                direction: context.direction,
              },
              null,
              2,
            )}
          </pre>

          <div className="grid grid-cols-2 gap-3">
            <CandidateList title="Pair candidates" items={context.debugCandidates.pairCandidates} />
            <CandidateList title="Leverage candidates" items={context.debugCandidates.leverageCandidates} />
            <CandidateList title="Balance candidates" items={context.debugCandidates.balanceCandidates} />
            <CandidateList
              title="TradingView candidates"
              items={context.debugCandidates.tradingViewCandidates}
            />
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">
          No context extracted yet — nothing to inspect.
        </p>
      )}
    </details>
  );
}
