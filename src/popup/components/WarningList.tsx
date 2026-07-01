import type { RiskWarning } from "../../lib/types";

interface WarningListProps {
  warnings: RiskWarning[];
}

const DOT_CLASSES: Record<"error" | "warning" | "info", string> = {
  error:   "bg-danger",
  warning: "bg-warn",
  info:    "bg-muted",
};

const TEXT_CLASSES: Record<"error" | "warning" | "info", string> = {
  error:   "text-danger/90",
  warning: "text-warn/90",
  info:    "text-slate-400",
};

export function WarningList({ warnings }: WarningListProps) {
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-ok/20 bg-ok/5 px-3 py-2.5">
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ok" />
        <span className="text-xs text-ok/80">Setup looks good — verify in Hyperliquid before trading.</span>
      </div>
    );
  }

  const ordered = [
    ...warnings.filter((w) => w.level === "error"),
    ...warnings.filter((w) => w.level === "warning"),
    ...warnings.filter((w) => w.level === "info"),
  ];

  return (
    <ul className="space-y-1.5">
      {ordered.map((w) => (
        <li key={w.id} className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5">
          <span className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT_CLASSES[w.level]}`} />
          <span className={`text-xs leading-snug ${TEXT_CLASSES[w.level]}`}>{w.message}</span>
        </li>
      ))}
    </ul>
  );
}
