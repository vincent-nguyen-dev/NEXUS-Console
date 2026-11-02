// The Retries view (step 6.2b, board G2): four cards on a 12-column grid at 1100 px and wider (7/5, then 7/5), one
// column below. Tries per job as a table of sized dots, every wait as lateness against its plan, failed tries per day
// as an amber step line (hatched where the error sent nothing, over an 8 % tint, with a faint glow: lab picks of
// 31 Oct), and the retry paths the data hasn't exercised. Every word comes from retryText.ts.
import { useId } from 'react';
import { formatDuration, formatPlanned, formatUtcDay, formatUtcTime } from '../../lib/format';
import type { RetryCard, RetryView } from '../../lib/retryText';
import { CountUp } from '../CountUp';
import { ToneIcon } from '../ToneIcon';
import { ChartFrame, type ChartRow } from '../charts/ChartFrame';

const PAD = 16;
/** Hatch spacing and the tint behind it (lab picks: medium, 8 %). */
const HATCH_PX = 6;
const TINT = 0.08;
/** Each wait dot's opacity: contrast.test checks a lone one at this value. */
const WAIT_DOT_OPACITY = 0.6;

function How({ card }: { card: RetryCard }) {
  return (
    <details className="mt-auto">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-route hover:underline focus-visible:underline underline-offset-2">
        How it&rsquo;s counted
      </summary>
      <div className="flex flex-col gap-2 pt-1 pb-2 text-sm">
        <p>{card.how.rule}</p>
        <p className="font-mono break-words">{card.how.working}</p>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-muted">{card.how.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        <p className="text-muted">{card.how.source}</p>
      </div>
    </details>
  );
}

function Card({ id, card, span, children }: { id: string; card: RetryCard; span: 5 | 7; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className={`flex min-w-0 flex-col gap-4 rounded-md border border-glass bg-panel p-5 min-[720px]:p-6 ${span === 5 ? 'min-[1100px]:col-span-5' : 'min-[1100px]:col-span-7'}`}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 id={`${id}-title`} className="text-base font-medium text-muted">{card.label}</h2>
        <p className="flex flex-wrap items-baseline gap-x-2.5 font-display text-4xl leading-none font-semibold">
          <CountUp value={card.value} />
          {card.unit !== '' && <span className="font-display text-2xl font-medium text-muted">{card.unit}</span>}
        </p>
        <p className="text-sm text-muted">{card.note}</p>
      </div>
      {children}
      <How card={card} />
    </section>
  );
}

/** Tries per job: a real table, each count a dot sized by its share (area), with its number. */
function TriesTable({ view }: { view: RetryView }) {
  const jobs = view.tries.jobs;
  const max = Math.max(1, ...jobs.map((j) => j.maxAttempts));
  const most = Math.max(1, ...jobs.flatMap((j) => [...j.succeededOn, j.gaveUp]));
  const cols = [...Array.from({ length: max }, (_, i) => `Try ${i + 1}`), 'Gave up'];
  const dot = (n: number, tone: 'ok' | 'retry' | 'dead') => {
    const r = n === 0 ? 3 : 6 + 12 * Math.sqrt(n / most);
    const fill = n === 0 ? 'fill-track' : tone === 'ok' ? 'fill-ok' : tone === 'retry' ? 'fill-retry' : 'fill-dead';
    return (
      <span className="flex flex-col items-center gap-1">
        <svg width={40} height={40} viewBox="0 0 40 40" aria-hidden="true"><circle cx={20} cy={20} r={r} className={fill} opacity={n === 0 ? 1 : 0.85} /></svg>
        <span className={`font-mono text-sm ${n === 0 ? 'text-muted' : 'text-ink'}`}>{n}</span>
      </span>
    );
  };
  return (
    <div className="chart-inset overflow-x-auto rounded-sm border border-glass bg-raised p-3">
      <table className="w-full min-w-[30rem] border-collapse text-left">
        <caption className="sr-only">Jobs by the try they succeeded on, or gave up</caption>
        <thead>
          <tr>
            <th scope="col" className="pb-2 text-sm font-normal text-muted"><span className="sr-only">Job</span></th>
            {cols.map((c) => <th key={c} scope="col" className="pb-2 text-center text-sm font-normal text-muted">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.kind} className="border-t border-glass">
              <th scope="row" className="py-2 pr-3 text-base font-medium">{j.label}</th>
              {Array.from({ length: max }, (_, i) => (
                <td key={i} className="py-2 text-center">{i < j.maxAttempts ? dot(j.succeededOn[i] ?? 0, i === 0 ? 'ok' : 'retry') : <span className="text-muted">–</span>}</td>
              ))}
              <td className="py-2 text-center">{dot(j.gaveUp, 'dead')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every measured wait as lateness against its plan, one row per planned wait. */
function WaitsChart({ view }: { view: RetryView }) {
  const steps = view.waits.steps;
  const rowH = 62;
  const top = 44;
  const h = top + steps.length * rowH;
  const lateMax = Math.max(2, Math.ceil(Math.max(0, ...steps.flatMap((s) => s.actual.map((a) => a - s.plannedS)))));
  const x0 = 96;
  const X = (late: number, w: number) => x0 + (Math.max(0, late) / lateMax) * (w - x0 - PAD);
  const lineY = (si: number) => top + si * rowH;
  const items = steps.flatMap((s, si) => s.actual.map((a, ai) => ({ si, ai, late: a - s.plannedS, planned: s.plannedS })));
  const rows: ChartRow[] = items.map((it) => ({ head: `${formatPlanned(it.planned)} wait, #${it.ai + 1}`, value: `+${formatDuration(Math.max(0, it.late))} late` }));
  // Dots sit on their row's line and may overlap (faint, so a pile reads darker): waits a few hundredths of a second
  // apart would otherwise stack into a column over the row above.
  const place = (w: number) => items.map((it) => ({ x: X(it.late, w), y: lineY(it.si) }));
  return (
    <ChartFrame
      label={`${view.waits.job}: each wait against its plan`}
      columns={['Wait', 'Lateness']}
      rows={rows}
      height={h}
      indexAt={(x, w, y) => {
        const dots = place(w);
        let best: number | null = null;
        dots.forEach((d, i) => { if (best === null || Math.hypot(d.x - x, d.y - y) < Math.hypot((dots[best]?.x ?? 0) - x, (dots[best]?.y ?? 0) - y)) best = i; });
        return best;
      }}
      pointAt={(i, w) => place(w)[i] ?? { x: 0, y: 0 }}
      draw={(w, active) => {
        const dots = place(w);
        return (
          <>
            <text x={x0} y={20} className="fill-muted font-mono text-sm">on time</text>
            <text x={w - PAD} y={20} textAnchor="end" className="fill-muted font-mono text-sm">+{lateMax} s late</text>
            {steps.map((s, si) => {
              const y = lineY(si);
              const lo = s.late === null ? '' : formatDuration(Math.max(0, s.late.min));
              const hi = s.late === null ? '' : formatDuration(Math.max(0, s.late.max));
              const range = s.late === null ? null : `${s.actual.length} · +${lo}${hi === lo ? '' : ` to +${hi}`}`;
              return (
                <g key={s.after}>
                  <text x={PAD} y={y + 5} className="fill-ink font-mono text-sm">{formatPlanned(s.plannedS)}</text>
                  <line x1={x0} x2={w - PAD} y1={y} y2={y} className="stroke-track" strokeDasharray={s.late === null ? '4 4' : undefined} />
                  <line x1={x0} x2={x0} y1={y - 11} y2={y + 11} className="stroke-ink" strokeWidth={2} />
                  {s.late !== null && <line x1={X(s.late.min, w)} x2={X(s.late.max, w)} y1={y} y2={y} className="stroke-retry" strokeWidth={3} strokeOpacity={0.6} />}
                  {s.late !== null && <line x1={X(s.late.median, w)} x2={X(s.late.median, w)} y1={y - 9} y2={y + 9} className="stroke-retry" strokeWidth={2} />}
                  <text x={x0 + 8} y={y + 26} className={`font-mono text-sm ${s.late === null ? 'fill-ink' : 'fill-muted'}`}>{range ?? 'never needed'}</text>
                </g>
              );
            })}
            {/* 60 %: a lone dot still reaches 3:1 on the inset (contrast.test); a pile reads darker. */}
            {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={active === i ? 6 : 4.5} className="fill-retry" opacity={active === i ? 1 : WAIT_DOT_OPACITY} />)}
          </>
        );
      }}
    />
  );
}

/** Failed tries per day: an amber step line; hatched where the error sent nothing, solid for any other. */
function FailsChart({ view }: { view: RetryView }) {
  const hatch = `hatch-${useId().replace(/:/g, '')}`;
  const { buckets, per } = view.fails;
  const h = 210;
  const top = 34;
  const base = h - 34;
  const n = buckets.length;
  const max = Math.max(1, ...buckets.map((b) => b.sentNothing + b.other));
  const slotX = (i: number, w: number) => PAD + ((i + 0.5) / Math.max(1, n)) * (w - 2 * PAD);
  const Y = (v: number) => base - (v / max) * (base - top);
  const name = (ms: number) => {
    const iso = new Date(ms).toISOString();
    return per === 'hour' ? formatUtcTime(iso) : formatUtcDay(iso).replace(/ \d{4}$/, '');
  };
  const rows: ChartRow[] = buckets.map((b) => ({ head: name(b.startMs), value: `${b.sentNothing + b.other} failed (${b.sentNothing} sent nothing)` }));
  return (
    <ChartFrame
      label={`Failed tries per ${per}`}
      columns={[per === 'hour' ? 'Hour (UTC)' : 'Day (UTC)', 'Failed tries']}
      rows={rows}
      height={h}
      indexAt={(x, w) => (n === 0 ? null : Math.max(0, Math.min(n - 1, Math.floor(((x - PAD) / (w - 2 * PAD)) * n))))}
      pointAt={(i, w) => ({ x: slotX(i, w), y: Y((buckets[i]?.sentNothing ?? 0) + (buckets[i]?.other ?? 0)) })}
      draw={(w, active) => {
        const half = (w - 2 * PAD) / Math.max(1, n) / 2;
        const step = (f: (i: number) => number) => buckets.map((_, i) => `${i === 0 ? 'M' : 'L'} ${slotX(i, w) - half} ${Y(f(i))} L ${slotX(i, w) + half} ${Y(f(i))}`).join(' ');
        const totalLine = step((i) => (buckets[i]?.sentNothing ?? 0) + (buckets[i]?.other ?? 0));
        const area = (f: (i: number) => number, g: (i: number) => number) => {
          const upper = buckets.map((_, i) => `${i === 0 ? 'M' : 'L'} ${slotX(i, w) - half} ${Y(f(i))} L ${slotX(i, w) + half} ${Y(f(i))}`).join(' ');
          const lower = [...buckets.keys()].reverse().map((i) => `L ${slotX(i, w) + half} ${Y(g(i))} L ${slotX(i, w) - half} ${Y(g(i))}`).join(' ');
          return `${upper} ${lower} Z`;
        };
        const nothingArea = area((i) => buckets[i]?.sentNothing ?? 0, () => 0);
        const otherArea = area((i) => (buckets[i]?.sentNothing ?? 0) + (buckets[i]?.other ?? 0), (i) => buckets[i]?.sentNothing ?? 0);
        return (
          <>
            <defs>
              <pattern id={hatch} width={HATCH_PX} height={HATCH_PX} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1={0} y1={0} x2={0} y2={HATCH_PX} className="stroke-retry" strokeWidth={2} strokeOpacity={0.55} />
              </pattern>
            </defs>
            <path d={nothingArea} className="fill-retry" fillOpacity={TINT} />
            <path d={nothingArea} fill={`url(#${hatch})`} />
            <path d={otherArea} className="fill-retry" fillOpacity={0.85} />
            {/* A faint wide stroke under the line instead of a blur filter (the spine's glow, lab pick). */}
            <path d={totalLine} fill="none" className="stroke-retry" strokeWidth={7} strokeOpacity={0.16} />
            <path d={totalLine} fill="none" className="stroke-retry" strokeWidth={1.8} strokeLinejoin="miter" />
            <line x1={PAD} x2={w - PAD} y1={base} y2={base} className="stroke-track" />
            {active !== null && <line x1={slotX(active, w)} x2={slotX(active, w)} y1={top - 10} y2={base} className="stroke-muted" strokeDasharray="3 3" />}
            {n > 0 && [0, Math.floor((n - 1) / 2), n - 1].map((i, k) => (
              <text key={k} x={k === 0 ? PAD : k === 2 ? w - PAD : slotX(i, w)} y={h - 8} textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'} className="fill-muted font-mono text-sm">
                {name(buckets[i]?.startMs ?? 0)}
              </text>
            ))}
            <text x={w - PAD} y={top - 14} textAnchor="end" className="fill-muted font-mono text-sm">up to {max} per {per}</text>
          </>
        );
      }}
    />
  );
}

export function RetriesView({ view }: { view: RetryView }) {
  const swatch = 'inline-block h-3.5 w-6 shrink-0 rounded-[3px] border border-retry';
  return (
    <div className="grid grid-cols-1 gap-4 min-[1100px]:grid-cols-12">
      <Card id="retry-tries" card={view.tries} span={7}><TriesTable view={view} /></Card>
      <Card id="retry-waits" card={view.waits} span={5}><WaitsChart view={view} /></Card>
      <Card id="retry-fails" card={view.fails} span={7}>
        <FailsChart view={view} />
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
          <li className="flex items-center gap-2"><span aria-hidden="true" className={`${swatch} retry-hatch`} />{view.fails.nothingLabel}</li>
          <li className="flex items-center gap-2"><span aria-hidden="true" className={`${swatch} bg-retry`} />{view.fails.otherLabel}</li>
        </ul>
      </Card>
      <Card id="retry-paths" card={view.paths} span={5}>
        <ul className="flex flex-col">
          {view.paths.unseen.map((p) => (
            <li key={p.text} className="flex items-start gap-3 border-t border-glass py-3">
              <span aria-hidden="true" className="mt-1 inline-block size-4 shrink-0 rounded-full border-2 border-dashed border-track" />
              <span className="flex flex-col gap-0.5"><span className="text-md">{p.text}</span><span className="text-sm text-muted">{p.detail}</span></span>
            </li>
          ))}
        </ul>
        {view.paths.seen.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-medium text-muted">Seen in these runs</h3>
            <ul className="flex flex-col gap-1.5">
              {view.paths.seen.map((p) => (
                <li key={p.text} className="flex items-start gap-2.5 text-sm">
                  <ToneIcon tone="ok" className="mt-0.5" />
                  <span><span className="text-ink">{p.text}</span> <span className="text-muted">· {p.detail}</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
