// The status pill and, under the header row, one muted line: where the data comes from and the window (step 5.2).
import type { FeedStatus } from '../lib/feedStatus';
import type { WindowKey } from '../lib/filters';
import type { DataSource } from '../lib/source';
import { FreshnessBadge } from './FreshnessBadge';

const WINDOW_TEXT: Record<WindowKey, string> = {
  '24h': 'window: last 24 hours', '7d': 'window: last 7 days', '30d': 'window: last 30 days', all: 'window: all recorded runs',
};

const SOURCE_TEXT: Record<DataSource, string> = {
  live: 'Real Northstar runs · test enquiries from the owner and from visitors, including one scheduled test a day',
  recording: 'Frozen copy of one real run',
  file: 'Read in this tab only: nothing was uploaded, and reloading clears it',
};

interface PillProps {
  status: FeedStatus;
  source: DataSource;
  recordedDay: string;
  /** "sample-feed.json · as of 28 Oct, 12:00 UTC", or null without a file. */
  fileLabel: string | null;
  /** "Newest enquiry 12 h ago" (the feed's noun), or null (no runs, no data, the recording). */
  newest: string | null;
  /** When the last check succeeded (ms): each new one while live is a heartbeat. */
  checkedAt: number | null;
  onResume: () => void;
}

export function StatusPill({ status, source, recordedDay, fileLabel, newest, checkedAt, onResume }: PillProps) {
  return (
    <FreshnessBadge
      status={status} recordedDay={recordedDay} fileLabel={fileLabel} newest={source === 'recording' ? null : newest}
      checkedAt={source === 'live' ? checkedAt : null} onResume={onResume}
    />
  );
}

export function SourceLine({ win, source, fileLabel, onClearFile }: { win: WindowKey; source: DataSource; fileLabel: string | null; onClearFile: () => void }) {
  const guided = source === 'recording';
  return (
    <p className="-mt-1 flex flex-wrap items-center gap-x-2 pl-1 text-sm text-muted">
      <span>{SOURCE_TEXT[source]} · {guided ? 'the window isn’t used for the recording' : WINDOW_TEXT[win]}</span>
      {source === 'file' && fileLabel !== null && (
        <button
          type="button"
          onClick={() => {
            onClearFile();
            // The loader takes this button's place: focus goes to its title (7.1c, F6).
            requestAnimationFrame(() => document.getElementById('loader-title')?.focus());
          }}
          className="min-h-11 rounded-sm px-1 text-route underline underline-offset-2"
        >
          Load another file
        </button>
      )}
    </p>
  );
}
