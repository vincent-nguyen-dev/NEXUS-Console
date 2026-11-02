// The console frame: rail, header, status strip, then the view (overview or events), and the run
// drawer over either. All of it reads the same runs page; the drawer never navigates away. The page comes
// from Northstar's live feed, the recording, or the visitor's own file (held in memory, never stored).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NotLiveNote, WakingBanner } from './components/Banners';
import { AiUsage } from './components/ai/AiUsage';
import { RetriesView } from './components/retries/RetriesView';
import { EventTable, type TableFilter } from './components/EventTable';
import { FileLoader, loadSample } from './components/FileLoader';
import { Intro } from './components/Intro';
import { KpiSkeleton } from './components/KpiStrip';
import { Overview } from './components/Overview';
import { Rail } from './components/Rail';
import { RunDrawer } from './components/RunDrawer';
import { SiteFooter } from './components/SiteFooter';
import { EmptyPanel, ErrorPanel, PreviewPanel } from './components/StatePanels';
import { SourceLine, StatusPill } from './components/StatusStrip';
import { ToggleGroup } from './components/ToggleGroup';
import { WatchPanel } from './components/WatchPanel';
import { TopologyMap } from './components/map/TopologyMap';
import { useNow } from './hooks/useNow';
import { useAiFeed, useRunsFeed } from './hooks/useRunsFeed';
import { useSignals } from './hooks/useSignals';
import { useUrlState } from './hooks/useUrlState';
import { useWatch } from './hooks/useWatch';
import { feedStatus, isLive, newestEnquiryAgo } from './lib/feedStatus';
import { applyFlagFilter, filterScope, flagControl, flagPhrase, type FlagFilter } from './lib/flagFilter';
import { runsInWindow, type WindowKey } from './lib/filters';
import { agoFromServer, formatUtcDay, uniquePrefixes } from './lib/format';
import { callsInWindow } from './lib/aiMetrics';
import { aiView } from './lib/aiText';
import { retryView } from './lib/retryText';
import { GUIDED_META, GUIDED_PAGE, GUIDED_RUN } from './lib/guided';
import { PERIOD, headline } from './lib/headline';
import { complete, completeFrom, windowStartMs } from './lib/pollPolicy';
import { lookupRun } from './lib/runDetail';
import { GUIDED_RESET } from './lib/story';
import { parseInstant } from './lib/time';
import type { FileRead } from './lib/fileFeed';
import type { Kpi } from './lib/kpis';
import { formatUtcMinute } from './lib/format';
import { RUNS_MAX_LIMIT } from './lib/api';
import { isStatic, sourceOf, sourceText } from './lib/source';
import type { RunsPage } from './lib/types';
import { serializeUrlState, type Mode } from './lib/urlState';
import { arrivals, isCurrent, serverNowMs } from './lib/watch';

const MODE_OPTIONS = [
  { value: 'live', label: 'Live' }, { value: 'guided', label: 'Recording' }, { value: 'file', label: 'Your file' },
] as const satisfies readonly { value: Mode; label: string }[];
const WINDOW_OPTIONS = [
  { value: '24h', label: '24 h' }, { value: '7d', label: '7 d' }, { value: '30d', label: '30 d' }, { value: 'all', label: 'All' },
] as const satisfies readonly { value: WindowKey; label: string }[];
const RECORDED_DAY = formatUtcDay(GUIDED_RUN.created_at);
const AI_WINDOW_TEXT: Record<WindowKey, string> = {
  '24h': 'window: last 24 hours', '7d': 'window: last 7 days', '30d': 'window: last 30 days', all: 'window: every row kept',
};
/** Read before the first render: useUrlState drops keys it doesn't know from the URL on mount. */
const SAMPLE_ASKED = new URLSearchParams(window.location.search).get('sample') === '1';

export function App() {
  const [url, setUrl] = useUrlState();
  const source = sourceOf(url.mode);
  const guided = source === 'recording';
  const text = sourceText(source);
  const events = url.view === 'events';
  const retriesOn = url.view === 'retries';
  // AI usage reads the AI feed, which only live data has; on another source the overview shows instead.
  const aiOn = url.view === 'ai' && source === 'live';
  // Only the active view's feed is polled.
  const feed = useRunsFeed(url.win, source === 'live' && !aiOn);
  const aiFeed = useAiFeed(url.win, aiOn);
  const now = useNow();
  const status = aiOn ? feedStatus(aiFeed.snapshot, now, source) : feedStatus(feed.snapshot, now, source);
  const live = isLive(status);
  // The visitor's file: in memory only, so a reload or a shared link starts without it.
  const [file, setFile] = useState<{ page: RunsPage; name: string } | null>(null);
  const onFile = useCallback((read: Extract<FileRead, { ok: true }>) => setFile({ page: read.page, name: read.name }), []);

  // `?sample=1` (from /connect's "See the sample") opens the made-up shop at once. It's read when this module
  // loads, because useUrlState rewrites the URL to its canonical form (without `sample`) on mount, so a reload
  // behaves like any file: cleared.
  const sampleAsked = useRef(SAMPLE_ASKED);
  useEffect(() => {
    if (!sampleAsked.current || url.mode !== 'file') return;
    sampleAsked.current = false;
    void loadSample().then((read) => {
      if (read.ok) onFile(read);
    });
  }, [url.mode, onFile]);

  // Data for the window in the URL only: during a window change the poller may still hold the old one.
  const livePage = feed.snapshot.win === url.win ? feed.snapshot.page : null;
  const filePage = file?.page ?? null;
  const page: RunsPage | null = source === 'recording' ? GUIDED_PAGE : source === 'file' ? filePage : livePage;

  // The test-switch filter narrows what the overview and events show (`runs`). `all` is the window's every run:
  // the status line, the watch panel and the drawer's lookup keep it, and `partial` is about the window, not the filter.
  const flags: FlagFilter | null = guided ? null : url.flags;
  const data = useMemo(() => {
    if (page === null) return null;
    if (guided) return { runs: page.runs, all: page.runs, partial: false };
    const serverNow = parseInstant(page.now);
    const all = runsInWindow(page.runs, url.win, serverNow);
    return { runs: applyFlagFilter(all, flags), all, partial: !complete(page, windowStartMs(url.win, serverNow)) };
  }, [page, guided, url.win, flags]);

  // The visitor's own test enquiry: every live run created since they started watching (server clock).
  const { sinceMs: watchSince, start: watchFrom, stop: stopWatch } = useWatch();
  const watchOn = source === 'live' && page !== null && status.ageMs !== null && watchSince !== null
    && isCurrent(watchSince, serverNowMs(page.now, status.ageMs));
  const watchRuns = watchOn ? (data?.all ?? null) : null;
  // A run pinned on the map (its strip chip) and one a Latest activity row previews: page state, never the URL.
  // A pinned run that leaves the shown runs (window, filter, a newer page) simply stops being traced.
  const [pinned, setPinned] = useState<string | null>(null);
  const [rowPreview, setRowPreview] = useState<string | null>(null);
  // A KPI tile pointed at or focused: the map lights what it counts (page state, never the URL).
  const [focusKpi, setFocusKpi] = useState<Kpi['id'] | null>(null);
  // Phones fold the three controls under one View button (step 5.2c, board D7), so the map reaches screen 1.
  const [viewOpen, setViewOpen] = useState(false);
  const viewToggle = useRef<HTMLButtonElement>(null);
  const shownPinned = pinned !== null && data !== null && data.runs.some((r) => r.run_id === pinned) ? pinned : null;
  // Lanes that retried in the unfiltered window keep their siding's room on the map, so the filter moves nothing.
  const reserve = useMemo(
    () => new Set((data?.all ?? []).flatMap((r) => r.events.filter((e) => e.attempt >= 2).map((e) => e.kind))),
    [data],
  );
  const arrived = useMemo(
    () => (watchRuns !== null && watchSince !== null ? arrivals(watchRuns, watchSince) : []),
    [watchRuns, watchSince],
  );
  const watched = useMemo(() => new Set(arrived.map((r) => r.run_id)), [arrived]);
  // An hour on, "since you started watching" says little: the watch is dropped.
  const expired = source === 'live' && page !== null && status.ageMs !== null && watchSince !== null && !watchOn;
  useEffect(() => {
    if (expired) stopWatch();
  }, [expired, stopWatch]);
  const startWatch = () => {
    const at = feed.snapshot.lastSuccessAt;
    if (livePage !== null && at !== null) watchFrom(serverNowMs(livePage.now, Date.now() - at));
  };

  // The map's one-off highlights: live data only, compared within one window and one filter, and only for runs
  // the filter shows (a hidden run's new event must not light a track).
  const shownPage = useMemo(
    () => (page === null || flags === null ? page : { ...page, runs: applyFlagFilter(page.runs, flags) }),
    [page, flags],
  );
  const signals = useSignals(source === 'live' ? shownPage : null, `${url.mode}|${url.win}|${flags ?? 'all'}`);

  // The description the data came with. During a window change the previous answer's still applies.
  const workflow = page?.workflow ?? (source === 'live' ? feed.snapshot.page?.workflow : null) ?? null;
  const control = workflow === null ? null : flagControl(workflow);
  const phrase = workflow === null ? null : flagPhrase(workflow, flags);
  const scopeLine = workflow === null ? null : filterScope(workflow, flags);
  // A filter on a feed that describes no flag means nothing: drop it from the URL (replace, no history entry).
  const staleFlags = workflow !== null && control === null && url.flags !== null;
  useEffect(() => {
    if (staleFlags) setUrl({ flags: null });
  }, [staleFlags, setUrl]);
  const lines = data === null || workflow === null ? null : headline(data.runs, { win: url.win, source, partial: data.partial, live, filter: phrase }, workflow);
  // When NEXUS last checked (the badge) and when the newest enquiry arrived are separate facts.
  const newestAgo = isStatic(source) || data === null || page === null || status.ageMs === null ? null : newestEnquiryAgo(data.all, page.now, status.ageMs);
  const newest = newestAgo === null || page === null ? null : `Newest ${page.workflow.trigger.one} ${newestAgo}`;
  const fileLabel = file === null ? null : `${file.name} · as of ${formatUtcMinute(file.page.now)}`;
  const viewSummary = [
    MODE_OPTIONS.find((o) => o.value === url.mode)?.label,
    guided ? null : WINDOW_OPTIONS.find((o) => o.value === url.win)?.label,
    control === null || guided ? null : flags === null ? 'All' : flags === 'on' ? control.on : control.off,
  ].filter((p) => p !== null && p !== undefined).join(' · ');
  let viewTitle = events ? 'Events' : 'Overview';
  if (!events && guided) viewTitle = 'Recorded run';
  if (!events && source === 'file') viewTitle = 'Your file';
  if (aiOn) viewTitle = 'AI usage';
  if (retriesOn) viewTitle = 'Retries';
  const retries = !retriesOn || data === null || page === null || workflow === null ? null
    : retryView(data.runs, workflow, { win: url.win, source, asOf: page.now, filter: phrase });

  // The AI usage view's page: only for the window in the URL, as with runs.
  const aiPage = aiOn && aiFeed.snapshot.win === url.win ? aiFeed.snapshot.page : null;
  const ai = useMemo(() => {
    if (aiPage === null) return null;
    const serverNow = parseInstant(aiPage.now);
    const calls = callsInWindow(aiPage.calls, url.win, serverNow);
    const oldest = aiPage.calls.length === 0 ? null : Math.min(...aiPage.calls.map((c) => parseInstant(c.at)));
    const partial = !completeFrom(aiPage.truncated, oldest, windowStartMs(url.win, serverNow));
    return { page: aiPage, calls, view: aiView(calls, aiPage.ai, { win: url.win, asOf: aiPage.now, partial }) };
  }, [aiPage, url.win]);
  const newestCall = ai === null || ai.calls.length === 0 || status.ageMs === null
    ? null : `Newest ${ai.page.ai.call.one} ${agoFromServer(ai.calls.reduce((a, c) => (c.at > a ? c.at : a), ai.calls[0]?.at ?? ''), ai.page.now, status.ageMs)}`;

  useEffect(() => {
    const run = url.run === null ? '' : `Run ${uniquePrefixes([url.run]).get(url.run)} · `;
    document.title = `${run}${viewTitle} · NEXUS`;
  }, [viewTitle, url.run]);

  // Entering the recorded run always starts clean, whatever was selected before.
  const toGuided = () => setUrl(GUIDED_RESET);
  // A new source starts unfiltered: its runs (and maybe its switches) are different ones.
  const toLive = () => setUrl({ mode: 'live', run: null, flags: null });
  const toFile = () => setUrl({ mode: 'file', run: null, step: null, attempt: null, event: null, flags: null, ...(url.view === 'ai' ? { view: 'overview' } : {}) });
  const clearFlags = () => setUrl({ flags: null });
  const toAll = () => setUrl({ win: 'all' });
  const openRun = useCallback((run: string) => setUrl({ run }), [setUrl]);
  const closeRun = useCallback(() => setUrl({ run: null }), [setUrl]);
  const lookup = url.run === null ? null : lookupRun(url.run, page, { source, win: url.win });
  const eventsPatch = { view: 'events', run: null } as const;
  const eventsHref = `${window.location.pathname}${serializeUrlState({ ...url, ...eventsPatch })}`;
  const filter: TableFilter = { step: url.step, attempt: url.attempt, event: url.event, order: url.order };
  let scope = guided ? 'in the recording' : `created in ${PERIOD[url.win]}`;
  if (!guided && url.win === 'all') scope = source === 'file' ? 'in your file' : 'recorded so far';
  if (phrase !== null) scope += ` with ${phrase}`;

  const noData = data === null;
  const failed = noData && (status.kind === 'offline' || status.kind === 'rate_limited' || status.kind === 'api_error' || status.kind === 'preview');
  let mapNote = 'The map fills in with the first answer from Northstar.';
  if (failed) mapNote = 'No data from Northstar yet, so every track stays dark.';
  if (data?.partial) mapNote = `Withheld: ${text.onlyNewest(RUNS_MAX_LIMIT).replace(/^Y/, 'y')}, and this window has more.`;
  const map = (
    <TopologyMap
      workflow={workflow}
      runs={data !== null && !data.partial ? data.runs : null}
      emptyNote={mapNote}
      filterLabel={phrase === null ? null : phrase.replace(/^the /, '')}
      reserve={reserve}
      serverNow={page?.now ?? null}
      drawKey={`${source}|${url.win}|${flags ?? 'all'}`}
      recording={guided}
      pinned={shownPinned}
      rowPreview={rowPreview}
      onPin={setPinned}
      onOpenRun={openRun}
      selection={{ step: url.step, attempt: url.attempt }}
      onSelect={({ step, attempt }) => setUrl({ step, attempt })}
      signals={signals}
      focusKpi={events ? null : focusKpi}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col min-[720px]:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded-sm focus:bg-raised focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Rail state={url} onNavigate={setUrl} sections={status.kind !== 'preview'} sectionsKey={!events && data !== null ? `${url.mode}|${url.win}|${flags ?? 'all'}|${data.runs.length === 0}` : null} />

      {/* The footer sits beside main, not in it, so it's the page's contentinfo (7.1c, F12). */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-4 min-[720px]:gap-6 min-[720px]:px-10 min-[720px]:py-7">
      {/* At least a screen tall, so the footer starts below the fold and doesn't jump when the runs arrive (7.1d, P3). */}
      <main id="main" tabIndex={-1} className="flex min-h-dvh min-w-0 flex-1 flex-col gap-4 min-[720px]:gap-6">
        {/* Step 5.2 (board D1): the status pill beside the controls, the source line, the h1, then the headline. */}
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusPill
              status={status} source={source} recordedDay={RECORDED_DAY} fileLabel={fileLabel} newest={aiOn ? newestCall : newest}
              checkedAt={aiOn ? aiFeed.snapshot.lastSuccessAt : feed.snapshot.lastSuccessAt} onResume={aiOn ? aiFeed.resume : feed.resume}
            />
            <button
              ref={viewToggle} type="button" aria-expanded={viewOpen} aria-controls="view-controls" onClick={() => setViewOpen(!viewOpen)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm border border-glass bg-panel px-3.5 text-left text-base min-[720px]:hidden"
            >
              <span>View: <b className="font-semibold">{viewSummary}</b></span>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={viewOpen ? 'rotate-180' : ''}>
                <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div
              id="view-controls"
              onKeyDown={(e) => {
                // Esc folds the controls away on a phone and returns to the View button (7.1c, F7).
                if (e.key !== 'Escape' || !viewOpen) return;
                setViewOpen(false);
                viewToggle.current?.focus();
              }}
              className={`${viewOpen ? 'flex' : 'hidden'} w-full flex-col items-start gap-3 rounded-md border border-glass bg-panel p-3.5 min-[720px]:flex min-[720px]:w-auto min-[720px]:flex-row min-[720px]:flex-wrap min-[720px]:items-center min-[720px]:border-0 min-[720px]:bg-transparent min-[720px]:p-0`}>
              <ToggleGroup
                label="Data source"
                options={MODE_OPTIONS}
                value={url.mode}
                onChange={(mode) => (mode === 'guided' ? toGuided() : mode === 'file' ? toFile() : toLive())}
              />
              <ToggleGroup
                label="Time window"
                options={WINDOW_OPTIONS}
                value={url.win}
                onChange={(win) => setUrl({ win })}
                disabled={guided}
                {...(guided ? { describedBy: 'window-note' } : {})}
              />
              {guided && <span id="window-note" className="sr-only">The time window doesn't apply to the single recorded run.</span>}
              {control !== null && !aiOn && (
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-sm text-muted">{control.label}</span>
                  <ToggleGroup
                    label={control.label}
                    options={[{ value: 'all', label: 'All' }, { value: 'on', label: control.on }, { value: 'off', label: control.off }] as const}
                    value={flags ?? 'all'}
                    onChange={(v) => setUrl({ flags: v === 'all' ? null : v })}
                    disabled={guided}
                    {...(guided ? { describedBy: 'flags-note' } : {})}
                  />
                  {guided && <span id="flags-note" className="sr-only">The filter doesn't apply to the single recorded run.</span>}
                </div>
              )}
            </div>
          </div>
          {aiOn ? (
            <p className="-mt-1 pl-1 text-sm text-muted">{ai?.view.sourceLine ?? 'Northstar’s ops feed, AI rows'} · {AI_WINDOW_TEXT[url.win]}</p>
          ) : (
            <SourceLine win={url.win} source={source} fileLabel={fileLabel} onClearFile={() => setFile(null)} />
          )}
          {scopeLine !== null && !aiOn && <p className="max-w-[90ch] pl-1 text-sm text-route">{scopeLine}</p>}
          <h1 className="mt-1 font-display text-xl font-semibold min-[720px]:text-4xl">{viewTitle}</h1>
          {events && data !== null && <NotLiveNote status={status} />}
          {aiOn && ai !== null && (
            <section aria-label="Summary" className="flex flex-col gap-2">
              <NotLiveNote status={status} />
              <p className="max-w-[70ch] text-md">{ai.view.headline}</p>
              {ai.view.windowNote !== null && <p className="max-w-[80ch] text-base text-muted">{ai.view.windowNote}</p>}
            </section>
          )}
          {retriesOn && retries !== null && (
            <section aria-label="Summary" className="flex flex-col gap-2">
              <NotLiveNote status={status} />
              <p className="max-w-[70ch] text-md">{retries.headline}</p>
              {data?.partial && <p className="text-base text-muted">{text.onlyNewest(RUNS_MAX_LIMIT)}; older runs in this window aren&apos;t counted.</p>}
            </section>
          )}
          {!events && !aiOn && !retriesOn && data !== null && lines !== null && (
            <section aria-label="Summary" className="flex flex-col gap-2">
              <NotLiveNote status={status} />
              <p className="max-w-[70ch] text-md">{lines.window}</p>
              {lines.now !== null && <p className="text-base text-muted">{lines.now}</p>}
            </section>
          )}
        </header>

        {aiOn && (
          <>
            {status.kind === 'waking' && <WakingBanner />}
            {ai === null && status.kind === 'preview' && <PreviewPanel onRecording={toGuided} onFile={null} />}
            {ai === null && (status.kind === 'offline' || status.kind === 'rate_limited' || status.kind === 'api_error') && (
              <ErrorPanel error={aiFeed.snapshot.lastError} retryInMs={status.retryInMs} busy={aiFeed.snapshot.inFlightSince !== null} onRetry={aiFeed.retry} />
            )}
            {ai === null && status.kind !== 'offline' && status.kind !== 'rate_limited' && status.kind !== 'api_error' && status.kind !== 'preview' && (
              <div aria-busy="true" className="flex flex-col gap-4">
                <span className="sr-only">Loading Northstar&apos;s AI usage…</span>
                <div aria-hidden="true" className="h-72 rounded-md border border-rule bg-panel" />
              </div>
            )}
            {/* Keyed by the window: a new window draws at once, only a poll animates. */}
            {ai !== null && <AiUsage key={url.win} view={ai.view} ai={ai.page.ai} />}
          </>
        )}

        {retries !== null && (data?.runs.length ?? 0) > 0 && <RetriesView key={`${url.mode}|${url.win}`} view={retries} />}
        {retriesOn && data !== null && data.runs.length === 0 && !data.partial && (
          <EmptyPanel canWiden={url.win !== 'all'} onAll={toAll} source={source} filter={phrase} onClearFilter={clearFlags} />
        )}

        {source === 'live' && !events && !aiOn && !retriesOn && <Intro />}

        {source === 'live' && !events && !aiOn && !retriesOn && livePage !== null && data !== null && (
          <WatchPanel
            page={livePage} runs={data.all} arrived={arrived} sinceMs={watchOn ? watchSince : null} status={status}
            onStart={startWatch} onStop={stopWatch} onOpenRun={openRun}
          />
        )}

        {source === 'file' && file === null && <FileLoader onLoad={onFile} reloaded />}

        {status.kind === 'waking' && !aiOn && <WakingBanner />}

        {failed && !aiOn && status.kind === 'preview' && <PreviewPanel onRecording={toGuided} onFile={toFile} />}
        {failed && !aiOn && status.kind !== 'preview' && (
          <ErrorPanel
            error={feed.snapshot.lastError}
            retryInMs={status.retryInMs}
            busy={feed.snapshot.inFlightSince !== null}
            onRetry={feed.retry}
          />
        )}
        {/* A preview never asks, so an empty map would only repeat the panel (7.2a). */}
        {failed && status.kind !== 'preview' && !events && !aiOn && !retriesOn && map}

        {noData && !failed && source !== 'file' && !aiOn && !retriesOn && (
          <div aria-busy="true" className="flex flex-col gap-6">
            <span className="sr-only">Loading Northstar data…</span>
            {events ? <div aria-hidden="true" className="h-80 rounded-md border border-rule bg-panel" /> : map}
            {!events && <KpiSkeleton />}
          </div>
        )}

        {data !== null && page !== null && lines !== null && !events && !aiOn && !retriesOn && (
          <Overview
            runs={data.runs} partial={data.partial} page={page} map={map} status={status} source={source} fileName={file?.name ?? null} win={url.win}
            selection={{ step: url.step, attempt: url.attempt }}
            onClearSelection={() => setUrl({ step: null, attempt: null })}
            onOpenRun={openRun}
            eventsHref={eventsHref}
            onEvents={() => setUrl(eventsPatch)}
            onAll={toAll}
            watched={watched}
            onPreviewRun={setRowPreview}
            filter={phrase}
            onClearFilter={clearFlags}
            pinned={shownPinned}
            onPin={setPinned}
            onFocusKpi={setFocusKpi}
          />
        )}

        {data !== null && events && !aiOn && (
          <>
            <p className="text-sm text-muted">
              {text.everyEvent}, one row each. Filter by job, try or event; click a run to open it.
            </p>
            {data.partial && <p className="text-base text-muted">{text.onlyNewest(RUNS_MAX_LIMIT)}; older runs in this window aren&apos;t listed.</p>}
            {data.runs.length === 0 && !data.partial ? (
              <EmptyPanel canWiden={url.win !== 'all'} onAll={toAll} source={source} filter={phrase} onClearFilter={clearFlags} />
            ) : (
              workflow !== null && (
                <EventTable runs={data.runs} workflow={workflow} filter={filter} onFilter={setUrl} onOpenRun={openRun} scope={scope} more={data.partial ? '+' : ''} />
              )
            )}
          </>
        )}

      </main>
      <SiteFooter />
      </div>

      <RunDrawer
        runId={url.run}
        lookup={lookup}
        serverNow={page?.now ?? null}
        workflow={page?.workflow ?? null}
        status={status}
        source={source}
        capturedAt={GUIDED_META.captured_at}
        onClose={closeRun}
        onAll={toAll}
        onRecorded={() => setUrl({ run: GUIDED_RUN.run_id })}
      />
    </div>
  );
}
