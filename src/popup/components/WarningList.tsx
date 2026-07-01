import type { RiskWarning } from "../../lib/types";

interface WarningListProps {
  warnings: RiskWarning[];
}

const LEVEL_CLASSES: Record<RiskWarning["level"], string> = {
  error: "border-danger/40 bg-danger/10 text-danger",
  warning: "border-warn/40 bg-warn/10 text-warn",
  info: "border-border bg-surface text-slate-400",
};

export function WarningList({ warnings }: WarningListProps) {
  if (warnings.length === 0) {
    return (
      <div className="rounded-md border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">
        No warnings — setup looks reasonable. Always verify before trading.
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
      {ordered.map((warning) => (
        <li
          key={warning.id}
          className={`rounded-md border px-3 py-1.5 text-xs leading-snug ${LEVEL_CLASSES[warning.level]}`}
        >
          {warning.message}
        </li>
      ))}
    </ul>
  );
}
