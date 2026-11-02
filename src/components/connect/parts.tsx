// Small parts of the /connect page: a code chip, prose with code in it, a scrollable code block and the
// field reference. Codes are passed as props, never as JSX text, so prose and code stay apart.
import type { FieldGroup } from '../../lib/contract';
import { Sep } from '../Sep';

/** A field name or code. */
export function C({ c }: { c: string }) {
  return <code className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-sm text-route">{c}</code>;
}

/** Prose with code in it: strings are text, `{ c }` is code. */
export type Seg = string | { c: string };

export function Segs({ segs }: { segs: readonly Seg[] }) {
  return <>{segs.map((s, i) => (typeof s === 'string' ? <span key={i}>{s}</span> : <C key={i} c={s.c} />))}</>;
}

/** A labelled block of code that scrolls inside itself, never the page. Focusable, so a keyboard can scroll it. */
export function CodeBlock({ label, code, note }: { label: string; code: string; note?: string }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">{label}</span>
        {note !== undefined && <><Sep text=". " /><span className="text-muted">{note}</span></>}
      </figcaption>
      <pre tabIndex={0} aria-label={label} className="max-w-full overflow-x-auto rounded-md bg-panel p-4 font-mono text-sm leading-6 ring-1 ring-rule ring-inset">
        <code>{code}</code>
      </pre>
    </figure>
  );
}

/** One group of fields as a list: each field's name and type, its codes, the rule, and Northstar's value. */
export function FieldList({ group, example }: { group: FieldGroup; example: (key: string) => string | null }) {
  return (
    <section aria-labelledby={`field-${group.id}`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={`field-${group.id}`} className="font-display text-2xl font-semibold">{group.title}</h3>
        {group.at !== '' && <C c={group.at} />}
      </div>
      <dl className="flex flex-col">
        {group.fields.map((f) => {
          const value = example(f.key);
          return (
            <div key={f.key} className="flex flex-col gap-1.5 border-t border-rule py-3">
              <dt className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <C c={f.key} />
                <span className="text-sm text-muted">{f.type}</span>
              </dt>
              <dd className="flex flex-col gap-1.5 text-base">
                <span>{f.rule}</span>
                {f.values !== undefined && (
                  <span className="flex flex-wrap gap-1.5">{f.values.map((v) => <C key={v} c={v} />)}</span>
                )}
                {value !== null && (
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm text-muted">
                    Northstar: <code className="min-w-0 font-mono break-all text-ink">{value}</code>
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
