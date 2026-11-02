// One choice out of a few (data source, time window, test switch): a radio group (step 7.1c, F9). The chosen option
// gets the raised fill and ink text, so it never rests on color alone. One Tab stop; arrow keys move and choose, as
// native radio buttons do.
import { useRef, type KeyboardEvent } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  describedBy?: string;
}

export function ToggleGroup<T extends string>({ label, options, value, onChange, disabled = false, describedBy }: Props<T>) {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (step === 0 || disabled) return;
    e.preventDefault();
    const next = options[(i + step + options.length) % options.length];
    if (!next) return;
    buttons.current.get(next.value)?.focus();
    onChange(next.value);
  };
  return (
    <div role="radiogroup" aria-label={label} aria-describedby={describedBy} aria-disabled={disabled || undefined} className="flex rounded-md border border-rule p-0.5">
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            if (el) buttons.current.set(o.value, el);
            else buttons.current.delete(o.value);
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-disabled={disabled || undefined}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => {
            if (!disabled) onChange(o.value);
          }}
          onKeyDown={(e) => onKey(e, i)}
          className="min-h-11 rounded-sm px-3 text-base font-medium text-muted aria-checked:bg-raised aria-checked:text-ink aria-disabled:cursor-not-allowed aria-disabled:aria-checked:bg-transparent aria-disabled:aria-checked:text-muted"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
