interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "number" | "text";
  placeholder?: string;
  suffix?: string;
  step?: string;
  id?: string;
  inputClassName?: string;
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
  inputClassName,
}: InputFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </span>
      <div className="relative">
        <input
          id={inputId}
          type={type}
          inputMode={type === "number" ? "decimal" : undefined}
          step={type === "number" ? step : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm font-medium text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50${inputClassName ? ` ${inputClassName}` : ""}`}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}
