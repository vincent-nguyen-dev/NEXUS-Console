// "The same run, three ways" on /how (step 5.4b, board F-2): the recorded run as NEXUS receives it (the raw feed,
// typed once when it scrolls into view), the timeline it draws, and the numbers it counts. "Copy the feed" copies
// the whole recorded page, a file NEXUS can read under "Your file". Traffic-light dots would read as statuses here
// (amber = retry, red = gave up), so the window's three dots are plain track grey.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { feedFileText, feedLines, linesShown, type TokenKind } from '../../lib/feedText';
import { formatUtcDay } from '../../lib/format';
import { GUIDED_PAGE, GUIDED_RAW_PAGE, GUIDED_RUN, GUIDED_WF } from '../../lib/guided';
import { runSummary, stepTimeline } from '../../lib/runDetail';
import { primaryStep, stepLabel } from '../../lib/workflow';
import { CONSOLE_PATH } from '../../lib/routes';
import { ToneIcon } from '../ToneIcon';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const LINES = feedLines(GUIDED_RUN);
const FILE_TEXT = feedFileText(GUIDED_RAW_PAGE);
const TEAM = primaryStep(GUIDED_WF);
const TIMELINE = stepTimeline(GUIDED_RUN, TEAM, GUIDED_WF);
const SUMMARY = runSummary(GUIDED_RUN, GUIDED_PAGE.now, GUIDED_WF);
/** '22 Oct': the recording's day, without the year. */
const DAY = formatUtcDay(GUIDED_RUN.created_at).replace(/ \d{4}$/, '');
const COPIED_MS = 2400;
const LINE_PX = 23;

const COLOR: Record<TokenKind, string> = {
  key: 'text-route', text: 'text-ink', time: 'text-muted', punct: 'text-muted', failed: 'text-retry', ok: 'text-ok', dead: 'text-dead',
};

const TABS = [
  { id: 'raw', label: 'Raw feed' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'numbers', label: 'Numbers' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Types the feed once, the first time 40 % of it is on screen; reduced motion shows it typed. */
function useTypeOnce(total: number) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || still || shown === total) return;
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const n = linesShown(t - t0, total);
        setShown(n);
        if (n < total) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
    // Runs once (again only if reduced motion is turned off before it typed): the typing never restarts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);
  // Reduced motion shows it typed, whenever the setting is on.
  return { ref, shown: still ? total : shown };
}

function CopyButton() {
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle');
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state === 'selected') area.current?.select();
    if (state !== 'copied') return;
    const id = window.setTimeout(() => setState('idle'), COPIED_MS);
    return () => window.clearTimeout(id);
  }, [state]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(FILE_TEXT);
      setState('copied');
    } catch {
      // A refused clipboard: the whole file, selected, for Ctrl+C.
      setState('selected');
    }
  };
  return (
    <>
      <button type="button" onClick={() => void copy()} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-glass px-3 text-sm hover:border-route">
        {state === 'copied' && (
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="var(--color-ok)" strokeWidth="2" strokeLinecap="round" /></svg>
        )}
        {state === 'copied' ? 'Copied' : state === 'selected' ? 'Selected: press Ctrl+C' : 'Copy the feed'}
      </button>
      <span role="status" className="sr-only">{state === 'copied' ? 'Copied the feed file' : state === 'selected' ? 'The feed file is selected: press Ctrl+C to copy it' : ''}</span>
      {state === 'selected' && (
        <textarea
          ref={area} readOnly value={FILE_TEXT} rows={8} aria-label="The recorded feed file"
          className="order-last w-full basis-full rounded-sm border border-glass bg-bg p-3 font-mono text-sm text-ink"
        />
      )}
    </>
  );
}

export function Terminal() {
  const [tab, setTab] = useState<TabId>('raw');
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ raw: null, timeline: null, numbers: null });
  const { ref, shown } = useTypeOnce(LINES.length);
  const typing = shown < LINES.length;

  const choose = (id: TabId) => {
    setTab(id);
    tabRefs.current[id]?.focus();
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = TABS.length;
    const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    const next = to === null ? undefined : TABS[to];
    if (!next) return;
    e.preventDefault();
    choose(next.id);
  };

  return (
    <section aria-labelledby="terminal-title" className="flex flex-col gap-5 pb-24">
      <div className="flex max-w-[760px] flex-col gap-3.5">
        <h2 id="terminal-title" className="font-display text-xl font-semibold min-[720px]:text-5xl">The same run, three ways</h2>
        <p className="text-reading">
          One real {GUIDED_WF.trigger.one} from {DAY}, as NEXUS receives it: the raw feed, the timeline it draws, and the numbers it counts.
        </p>
      </div>
      <div ref={ref} className="overflow-hidden rounded-md border border-glass bg-panel">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-glass bg-deep px-3.5 py-2.5">
          <span aria-hidden="true" className="flex gap-1.5">{[0, 1, 2].map((i) => <i key={i} className="size-2.5 rounded-full bg-track" />)}</span>
          <span className="font-mono text-sm text-muted">northstar · /api/ops/runs · recorded {DAY}</span>
          <div role="tablist" aria-label="The same run, three ways" className="flex gap-1">
            {TABS.map((t, i) => (
              <button
                key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} type="button" role="tab" id={`term-tab-${t.id}`}
                aria-selected={tab === t.id} aria-controls={`term-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
                onClick={() => choose(t.id)} onKeyDown={(e) => onKey(e, i)}
                className={`min-h-11 rounded-sm px-3 text-sm ${tab === t.id ? 'bg-raised text-ink shadow-[inset_0_0_0_1px_var(--color-route)]' : 'text-muted hover:text-ink'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <CopyButton />
        </div>

        <div role="tabpanel" id="term-panel-raw" aria-labelledby="term-tab-raw" hidden={tab !== 'raw'}>
          <pre
            tabIndex={0} aria-label="The recorded run's feed, as JSON" aria-busy={typing}
            className="overflow-x-auto px-4.5 py-4 font-mono text-sm whitespace-pre"
            style={{ lineHeight: `${LINE_PX}px`, minHeight: LINES.length * LINE_PX + 32 }}
          >
            {LINES.slice(0, shown).map((line, i) => (
              <div key={i}>
                {line.map((t, j) => <span key={j} className={COLOR[t.kind]}>{t.text}</span>)}
                {typing && i === shown - 1 && <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-route" />}
              </div>
            ))}
          </pre>
        </div>

        <div role="tabpanel" id="term-panel-timeline" aria-labelledby="term-tab-timeline" hidden={tab !== 'timeline'} className="px-4.5 py-4">
          <p className="pb-2 text-sm text-muted">The {stepLabel(GUIDED_WF, TEAM).toLowerCase()}, as the run&apos;s details tell it.</p>
          <ol>
            {TIMELINE.map((r) => (
              <li key={r.key} className="grid grid-cols-[1.25rem_5rem_minmax(0,1fr)] items-start gap-3 border-t border-glass py-2 text-base">
                <ToneIcon tone={r.tone} className="mt-1" />
                <span className="font-mono text-sm text-muted">{r.offset}</span>
                <span className="flex flex-col">
                  <span>{r.text}</span>
                  {r.note !== null && <span className="text-sm text-muted">{r.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div role="tabpanel" id="term-panel-numbers" aria-labelledby="term-tab-numbers" hidden={tab !== 'numbers'} className="flex flex-col gap-4 px-4.5 py-4">
          <p className="text-reading">{SUMMARY.headline}</p>
          <dl className="grid gap-3 min-[720px]:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
            {SUMMARY.facts.map((f) => (
              <div key={f.id} className="flex flex-col gap-0.5 border-t border-glass pt-2">
                <dt className="text-sm text-muted">{f.label}</dt>
                <dd className="text-md">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="border-t border-glass px-4.5 py-3 text-sm text-muted">
          This is what NEXUS reads. Everything on these pages is drawn from feeds like it. The raw feed shows the run&apos;s
          events; the copy is the whole file, with its workflow description, ready to load under{' '}
          <a href={`${CONSOLE_PATH}?mode=file`} className="text-route underline underline-offset-2">Your file</a>.
        </p>
      </div>
    </section>
  );
}
