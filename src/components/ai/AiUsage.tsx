// The AI usage view (step 6.1b, board G1): four cards on a 12-column grid at 1100 px and wider (5/7, then 7/5), one
// column below. Each card is a value with its n, a chart in a raised inset, and "How it's counted". Every word comes
// from aiText.ts; this file only lays them out. Values count to a new value on a poll only (CountUp).
import type { AiCard, AiView } from '../../lib/aiText';
import type { AiDescription } from '../../lib/types';
import { CountUp } from '../CountUp';
import { ToneIcon } from '../ToneIcon';
import { ChatsChart, TimesChart, TokensChart } from './AiCharts';

function How({ card }: { card: AiCard }) {
  return (
    <details className="mt-auto">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-route hover:underline focus-visible:underline underline-offset-2">
        How it&rsquo;s counted
      </summary>
      <div className="flex flex-col gap-2 pt-1 pb-2 text-sm">
        <p>{card.how.rule}</p>
        <p className="font-mono break-words">{card.how.working}</p>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-muted">
          {card.how.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
        <p className="text-muted">{card.how.source}</p>
      </div>
    </details>
  );
}

function Card({ id, card, span, aside, children }: { id: string; card: AiCard; span: 5 | 7; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`flex min-w-0 flex-col gap-4 rounded-md border border-glass bg-panel p-5 min-[720px]:p-6 ${span === 5 ? 'min-[1100px]:col-span-5' : 'min-[1100px]:col-span-7'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 id={`${id}-title`} className="text-base font-medium text-muted">{card.label}</h2>
          <p className={card.hasValue ? 'font-display text-4xl leading-none font-semibold' : 'font-display text-2xl leading-tight font-semibold text-muted'}>
            <CountUp value={card.value} />
          </p>
          <p className="text-sm text-muted">{card.note}</p>
        </div>
        {aside}
      </div>
      {children}
      <How card={card} />
    </section>
  );
}

export function AiUsage({ view, ai }: { view: AiView; ai: AiDescription }) {
  const { chats, times, tokens, outcomes } = view;
  const cost = (
    <div className="flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-2 rounded-full border border-glass bg-raised px-3.5 py-1.5 font-mono text-md">
        {tokens.costValue ?? '–'} <span className="font-sans text-sm text-muted">estimated</span>
      </span>
      <span className="text-sm text-muted">{tokens.costNote}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-4 min-[1100px]:grid-cols-12">
      <Card id="ai-calls" card={chats} span={5}>
        <ChatsChart buckets={chats.buckets} unit={chats.unit} peak={chats.peak} peakText={chats.peakText} one={ai.call.one} many={ai.call.many} />
      </Card>
      <Card id="ai-times" card={times} span={7}>
        {times.hasValue && <TimesChart ms={times.answeredMs} median={times.stats.median} p95={times.stats.p95} />}
      </Card>
      <Card id="ai-tokens" card={tokens} span={7} aside={cost}>
        <TokensChart buckets={chats.buckets} unit={chats.unit} />
        {tokens.formula.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-glass pt-3 text-sm text-muted">
            {tokens.formula.map((line, i) => <p key={line} className={i === 0 ? 'font-mono break-words text-ink' : 'break-words'}>{line}</p>)}
          </div>
        )}
      </Card>
      <Card id="ai-outcomes" card={outcomes} span={5}>
        <ul className="flex flex-col">
          {outcomes.rows.map((r) => (
            <li key={r.code} className="flex min-h-11 items-center gap-3 border-t border-glass text-md">
              <ToneIcon tone={r.answered ? 'ok' : 'dead'} />
              <span className="flex-1">{r.label.charAt(0).toUpperCase() + r.label.slice(1)}</span>
              <span className="font-mono"><CountUp value={String(r.n)} /></span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">A {ai.call.one} that wasn&apos;t answered is timed until it failed, so it never counts toward response time.</p>
      </Card>
    </div>
  );
}
