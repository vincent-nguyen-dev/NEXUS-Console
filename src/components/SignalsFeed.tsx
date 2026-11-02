// "Latest runs" (step 5.2, for checkpoint A's S4b): one row per run, newest update first, told by its primary job,
// filtered by the map's selection. A row opens its run; "Trace on the map" pins it; ▸ shows its moments.
import { useMemo, useState, type MouseEvent } from 'react';
import type { FeedStatus } from '../lib/feedStatus';
import { eventRows, filterRows, type WindowKey } from '../lib/filters';
import { agoFromServer, formatUtcTime, uniquePrefixes } from '../lib/format';
import { PERIOD } from '../lib/headline';
import type { Selection } from '../lib/map';
import { LATEST_SIGNALS, latestRuns, type RunRow } from '../lib/signalsFeed';
import type { Run, RunsPage } from '../lib/types';
import { delayText, isScheduled, primaryStep, stepLabel, stepSpec, triggerOf } from '../lib/workflow';
import { RUNS_MAX_LIMIT } from '../lib/api';
import { isStatic, sourceText, type DataSource } from '../lib/source';
import { useCursorLight } from '../hooks/useCursorLight';
import { useKeepFocus } from '../hooks/useKeepFocus';
import { Sep } from './Sep';
import { ToneIcon } from './ToneIcon';
import { StoryShape } from './map/StoryShape';

interface Props {
  runs: Run[];
  partial: boolean;
  page: RunsPage;
  status: FeedStatus;
  source: DataSource;
  win: WindowKey;
  selection: Selection;
  onClearSelection: () => void;
  onOpenRun: (runId: string) => void;
  eventsHref: string;
  onEvents: () => void;
  watched: ReadonlySet<string>;
  /** The test-switch filter as words, or null. */
  filter: string | null;
  /** Hovering a row previews its run on the map (desktop; a click still opens the run). */
  onPreviewRun: (runId: string | null) => void;
  /** The run traced on the map (pinned), and the way to pin or unpin one. */
  pinned?: string | null;
  onPin?: (runId: string | null) => void;
}

const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
const linkClass = 'min-h-11 rounded-sm px-1 text-base text-route underline underline-offset-2';
const pill = 'inline-flex items-center rounded-full border bg-bg px-2.5 text-sm';

/** One run in "Latest runs" (also the bento on /how, fed the recording). */
export function LatestRunRow({ r, short, when, watched, traced, open, onToggle, onOpenRun, onPin, onPreviewRun }: {
  r: RunRow; short: string; when: (at: string) => string; watched: boolean; traced: boolean; open: boolean;
  onToggle: () => void; onOpenRun: (id: string) => void; onPin: ((id: string | null) => void) | undefined; onPreviewRun: (id: string | null) => void;
}) {
  const momentsId = `moments-${r.runId}`;
  return (
    <li className="border-t border-rule" onMouseEnter={() => onPreviewRun(r.runId)}>
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm px-2 py-1 hover:bg-raised ${traced ? 'shadow-[inset_3px_0_0_var(--color-route)]' : ''}`}>
        <button type="button" onClick={() => onOpenRun(r.runId)} className="flex min-h-11 min-w-0 flex-[1_1_320px] items-center gap-3 py-1.5 text-left">
          <StoryShape kind={r.story.kind} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base">
              <b className="font-mono text-sm font-semibold">Run {short}</b>
              <Sep />
              <span>{r.story.text}</span>
              {r.flags.map((f) => <span key={f} className={`${pill} border-retry/35 text-retry`}><Sep />{f.toLowerCase()} on</span>)}
              {watched && <span className={`${pill} border-route/35 text-route`}><Sep />new since you started watching</span>}
              {traced && <span className={`${pill} border-route/35 text-route`}><Sep />traced</span>}
            </span>
            {r.trouble.map((t) => <span key={t} className="text-sm text-muted"><Sep />{t}</span>)}
          </span>
          <Sep />
          <span className="ml-auto shrink-0 font-mono text-sm text-muted" title={r.at}>{when(r.at)}</span>
          <span className="sr-only">. Opens the run&apos;s details.</span>
        </button>
        <div className="flex items-center gap-1">
          {onPin && (
            <button
              type="button" onClick={() => onPin(traced ? null : r.runId)}
              className={`min-h-11 rounded-sm border px-3 text-sm text-route ${traced ? 'border-route' : 'border-glass'}`}
            >
              {traced ? 'Stop tracing' : 'Trace on the map'}<span className="sr-only">: run {short}</span>
            </button>
          )}
          <button
            type="button" aria-expanded={open} aria-controls={momentsId} onClick={onToggle}
            aria-label={`${open ? 'Hide' : 'Show'} the moments of run ${short}`}
            className="flex size-11 items-center justify-center rounded-sm text-muted hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={open ? 'rotate-90' : ''}>
              <path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <ol id={momentsId} className="mb-2 ml-11 flex flex-col pr-2">
          {r.moments.map((m) => (
            <li key={m.key} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-3 border-t border-glass py-1.5 text-base">
              <ToneIcon tone={m.tone} className="mt-1" />
              <span>{m.text}</span>
              <span className="font-mono text-sm text-muted" title={m.at}>{when(m.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

export function SignalsFeed({ runs, partial, page, status, source, win, selection, onClearSelection, onOpenRun, eventsHref, onEvents, watched, filter, onPreviewRun, pinned = null, onPin }: Props) {
  const wf = page.workflow;
  const guided = source === 'recording';
  const { step, attempt } = selection;
  const { rows, total } = useMemo(() => latestRuns(runs, wf, { step, attempt }, LATEST_SIGNALS), [runs, wf, step, attempt]);
  const prefixes = useMemo(() => uniquePrefixes(runs.map((r) => r.run_id)), [runs]);
  const events = useMemo(
    () => filterRows(eventRows(runs), { step: selection.step, attempt: selection.attempt }).length,
    [runs, selection.step, selection.attempt],
  );
  // The recording's one run starts open: its moments are the point there.
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const isOpen = (id: string) => opened.has(id) || (guided && rows.length === 1);
  const toggle = (id: string) => setOpened((s) => {
    const next = new Set(s);
    if (isOpen(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const card = useCursorLight<HTMLElement>();
  // Show all, or a poll that reorders or drops the focused row, keeps focus in the card (7.1c, F6).
  useKeepFocus(undefined, card);

  const when = (at: string) => (isStatic(source) || status.ageMs === null ? formatUtcTime(at) : agoFromServer(at, page.now, status.ageMs));
  const from = (win === 'all' ? (source === 'file' ? 'all runs in your file' : 'all recorded runs') : `runs created in ${PERIOD[win]}`)
    + (filter === null ? '' : ` with ${filter}`);
  const t = triggerOf(wf);
  const primary = stepLabel(wf, primaryStep(wf)).toLowerCase();
  // Checkpoint A: a newcomer was lost here, so the first line says what one row is.
  const what = `One row per run, newest update first, told by its ${primary}. Click a row for the whole run, or open its moments.`;
  const scope = guided ? 'The recorded run, one row. Every event is in the events table.' : `The ${LATEST_SIGNALS} newest from ${from}. Every event is in the events table.`;
  const tryText = selection.attempt === null ? '' : ` · try ${selection.attempt}`;
  const known = selection.step !== null && wf.steps.some((s) => s.kind === selection.step) ? selection.step : null;
  const selected = known === null ? null : `${stepLabel(wf, known)}${tryText}`;
  let empty = 'No run has activity for this selection in the window.';
  if (known !== null && isScheduled(wf, known) && selection.attempt === null) {
    empty = `No ${stepLabel(wf, known).toLowerCase()} has run yet: it runs ${delayText(stepSpec(wf, known).starts_after_s)} after each ${t.one}.`;
  }

  return (
    <section id="runs" tabIndex={-1} ref={card} aria-labelledby="signals-title" className="focus:outline-none lit-card flex scroll-mt-6 flex-col gap-2 rounded-md border border-glass bg-panel px-4 pt-4 pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-2">
        <h2 id="signals-title" className="font-display text-2xl font-semibold">{guided ? 'The recorded run' : 'Latest runs'}</h2>
        <span className="text-sm text-muted">
          {total > rows.length ? `${rows.length} of ${total} runs` : `${total} ${total === 1 ? 'run' : 'runs'}`} ·{' '}
          <a
            href={eventsHref}
            onClick={(e) => {
              if (!isPlainClick(e)) return;
              e.preventDefault();
              onEvents();
            }}
            className="text-route underline underline-offset-2"
          >
            See all {events} {events === 1 ? 'event' : 'events'}
          </a>
        </span>
      </div>
      <p className="px-2 text-base">{what}</p>
      <p className="px-2 text-sm text-muted">{scope}</p>
      {partial && (
        <p className="px-2 text-sm text-muted">{sourceText(source).onlyNewest(RUNS_MAX_LIMIT)}; older runs in this window aren&apos;t listed.</p>
      )}
      {selected !== null && (
        <p className="flex flex-wrap items-center gap-x-2 px-2 text-base">
          <span>Only runs with activity at <b className="font-semibold">{selected}</b>, as selected on the map.</span>
          <button type="button" onClick={onClearSelection} className={linkClass}>Show all</button>
        </p>
      )}
      {rows.length === 0 ? (
        <p className="border-t border-rule px-2 py-4 text-base text-muted">{empty}</p>
      ) : (
        <ol onMouseLeave={() => onPreviewRun(null)}>
          {rows.map((r) => (
            <LatestRunRow
              key={r.runId} r={r} short={prefixes.get(r.runId) ?? r.runId} when={when} watched={watched.has(r.runId)}
              traced={pinned === r.runId} open={isOpen(r.runId)} onToggle={() => toggle(r.runId)}
              onOpenRun={onOpenRun} onPin={guided ? undefined : onPin} onPreviewRun={onPreviewRun}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
