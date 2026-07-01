export type OutputTone = "default" | "danger" | "warn" | "ok";

interface OutputCardProps {
  label: string;
  value: string;
  tone?: OutputTone;
  hint?: string;
}

const TONE_CLASSES: Record<OutputTone, string> = {
  default: "text-slate-100",
  danger: "text-danger",
  warn: "text-warn",
  ok: "text-ok",
};

export function OutputCard({ label, value, tone = "default", hint }: OutputCardProps) {
  return (
    <div className="rounded-md border border-border bg-surface px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`font-mono text-sm font-semibold ${TONE_CLASSES[tone]}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-[10px] text-slate-500">{hint}</div> : null}
    </div>
  );
}
