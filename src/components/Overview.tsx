// The overview below the header (step 5.2, board D1): the map, the numbers in one row, then the latest runs.
import { useMemo, useState, type ReactNode } from 'react';
import type { FeedStatus } from '../lib/feedStatus';
import type { WindowKey } from '../lib/filters';
import { GUIDED_META } from '../lib/guided';
import type { DataSource } from '../lib/source';
import { buildKpis, type Kpi } from '../lib/kpis';
import type { Selection } from '../lib/map';
import { perDay } from '../lib/perDay';
import { parseInstant } from '../lib/time';
import type { Run, RunsPage } from '../lib/types';
import { KpiStrip } from './KpiStrip';
import { SignalsFeed } from './SignalsFeed';
import { EmptyPanel } from './StatePanels';

const KPI_TITLE: Record<WindowKey, string> = {
  '24h': 'Last 24 hours in numbers', '7d': 'Last 7 days in numbers', '30d': 'Last 30 days in numbers', all: 'All recorded runs in numbers',
};

interface Props {
  runs: Run[];
  partial: boolean;
  page: RunsPage;
  map: ReactNode;
  status: FeedStatus;
  source: DataSource;
  fileName: string | null;
  win: WindowKey;
  selection: Selection;
  onClearSelection: () => void;
  onOpenRun: (runId: string) => void;
  eventsHref: string;
  onEvents: () => void;
  onAll: () => void;
  /** Runs that arrived since the visitor started watching (live only). */
  watched: ReadonlySet<string>;
  /** Hovering a Latest runs row previews its run on the map. */
  onPreviewRun: (runId: string | null) => void;
  /** The test-switch filter as words ("the outage switch off"), or null. */
  filter: string | null;
  onClearFilter: () => void;
  /** The run traced on the map, and the way to pin one from a row. */
  pinned: string | null;
  onPin: (runId: string | null) => void;
  /** A KPI tile pointed at or focused, so the map lights what it counts. */
  onFocusKpi: (id: Kpi['id'] | null) => void;
}

export function Overview(p: Props) {
  const kpis = useMemo(
    () => buildKpis(p.runs, p.partial, { win: p.win, source: p.source, fileName: p.fileName, asOf: p.page.now, capturedAt: GUIDED_META.captured_at, filter: p.filter }, p.page.workflow),
    [p.runs, p.partial, p.win, p.source, p.fileName, p.page.now, p.page.workflow, p.filter],
  );
  const bars = useMemo(
    () => (p.partial || p.source === 'recording' ? null : perDay(p.runs, p.win, parseInstant(p.page.now))),
    [p.runs, p.partial, p.source, p.win, p.page.now],
  );
  // "+1 since you opened this": counted from the first complete page in this source, window and filter. A new
  // scope (or a remount) starts a new count, and a run leaving the window shows nothing.
  const scope = `${p.source}|${p.win}|${p.filter ?? 'all'}`;
  const [base, setBase] = useState<{ scope: string; n: number } | null>(null);
  if (p.source === 'live' && !p.partial && base?.scope !== scope) setBase({ scope, n: p.runs.length });
  const added = p.source === 'live' && base?.scope === scope ? p.runs.length - base.n : 0;
  const delta = added > 0 ? `+${added} since you opened this` : null;

  const empty = p.runs.length === 0 && !p.partial;
  return (
    <>
      {p.map}
      {empty ? (
        <EmptyPanel canWiden={p.win !== 'all'} onAll={p.onAll} filter={p.filter} onClearFilter={p.onClearFilter} />
      ) : (
        <>
          <KpiStrip
            title={p.source === 'recording' ? 'This recorded run in numbers' : `${KPI_TITLE[p.win]}${p.filter === null ? '' : ` · ${p.filter.replace(/^the /, '')}`}`}
            kpis={kpis} bars={bars} delta={delta} onFocus={p.onFocusKpi}
          />
          <SignalsFeed
            runs={p.runs} partial={p.partial} page={p.page} status={p.status} source={p.source} win={p.win}
            selection={p.selection} onClearSelection={p.onClearSelection} onOpenRun={p.onOpenRun}
            eventsHref={p.eventsHref} onEvents={p.onEvents} watched={p.watched} filter={p.filter} onPreviewRun={p.onPreviewRun}
            pinned={p.pinned} onPin={p.onPin}
          />
        </>
      )}
    </>
  );
}
