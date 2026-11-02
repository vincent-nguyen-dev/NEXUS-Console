// The hero figure on phones: the same recorded enquiry as a vertical list in HTML, not the desktop SVG
// scaled down. A retry is a dashed amber row between two tries, like the siding on the wide figure.
import type { HeroModel } from '../../lib/hero';
import { ToneIcon, type IconTone } from '../ToneIcon';

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `framed` draws its own corner ticks; inside the hero's replay card (5.3a) it doesn't. */
export function HeroList({ model, framed = true }: { model: HeroModel; framed?: boolean }) {
  const { tries, waits, sentOnce, failureNote } = model.team;
  const rows: { key: string; tone: IconTone | null; title: string; detail: string }[] = [];
  tries.forEach((t, i) => {
    let tone: IconTone = 'neutral';
    if (t.outcome === 'failed') tone = 'retry';
    else if (t.outcome === 'sent') tone = 'ok';
    rows.push({ key: `try-${t.attempt}`, tone, title: capital(t.title), detail: t.outcome === 'sent' && sentOnce ? `${t.time} · sent once` : t.time });
    const wait = waits[i];
    if (wait) rows.push({ key: `wait-${wait.afterTry}`, tone: null, title: wait.label, detail: '' });
  });

  return (
    <div role="img" aria-label={model.summary} className={`flex flex-col gap-4 ${framed ? 'ticks p-5' : ''}`}>
      <div aria-hidden="true" className="flex flex-col gap-1">
        <p className="font-display text-2xl font-semibold">{model.titles.team}</p>
        <p className="text-sm text-muted">{model.purposes.team}</p>
      </div>
      <ol aria-hidden="true" className="flex flex-col gap-1.5">
        {rows.map((r) => r.tone === null ? (
          <li key={r.key} className="ml-2 border-l-2 border-dashed border-retry py-1 pl-5 font-mono text-sm text-retry">{r.title}</li>
        ) : (
          <li key={r.key} className="flex items-start gap-3">
            <ToneIcon tone={r.tone} className="mt-1" />
            <span className="flex flex-col">
              <span className={`text-base font-medium ${r.tone === 'ok' ? 'text-ok' : ''}`}>{r.title}</span>
              <span className="font-mono text-sm text-muted">{r.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      {failureNote !== null && <p aria-hidden="true" className="text-sm">{failureNote}</p>}
      <ul aria-hidden="true" className="flex flex-col gap-3 border-t border-rule pt-4">
        <li className="flex items-start gap-3">
          <ToneIcon tone="simulated" className="mt-1" />
          <span className="flex flex-col">
            <span className="text-base font-medium">{model.titles.visitor}</span>
            <span className="font-mono text-sm text-muted">{model.visitor.label}</span>
            <span className="text-sm text-muted">{model.visitor.simulated ? 'no email goes to visitors; ' : ''}the outage only affects team emails</span>
          </span>
        </li>
        <li className="flex items-start gap-3">
          <ToneIcon tone="scheduled" className="mt-1" />
          <span className="flex flex-col">
            <span className="text-base font-medium">{model.titles.deletion}</span>
            <span className="font-mono text-sm text-muted">{model.deletion}</span>
          </span>
        </li>
      </ul>
    </div>
  );
}
