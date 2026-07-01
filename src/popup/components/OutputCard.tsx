export type OutputTone = "default" | "danger" | "warn" | "ok";

interface OutputCardProps {
  label: string;
  value: string;
  tone?: OutputTone;
  hint?: string;
}

const VALUE_CLASSES: Record<OutputTone, string> = {
  default: "text-slate-100",
  danger:  "text-danger",
  warn:    "text-warn",
  ok:      "text-ok",
};

export function OutputCard({ label, value, tone = "default", hint }: OutputCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className={`font-mono text-sm font-bold leading-none ${VALUE_CLASSES[tone]}`}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[10px] leading-tight text-muted">{hint}</div>
      ) : null}
    </div>
  );
}
