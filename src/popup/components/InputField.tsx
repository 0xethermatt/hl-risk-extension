interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "number" | "text";
  placeholder?: string;
  suffix?: string;
  step?: string;
  id?: string;
}

export function InputField({
  label,
  value,
  onChange,
  type = "number",
  placeholder,
  suffix,
  step = "any",
  id,
}: InputFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <label htmlFor={inputId} className="block text-xs">
      <span className="mb-1 block font-medium text-slate-400">{label}</span>
      <div className="relative">
        <input
          id={inputId}
          type={type}
          inputMode={type === "number" ? "decimal" : undefined}
          step={type === "number" ? step : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}
