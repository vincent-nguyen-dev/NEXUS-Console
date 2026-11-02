// Messages that sit above the panels: Render waking up, and data that isn't live.
import type { FeedStatus } from '../lib/feedStatus';
import { formatAgo } from '../lib/format';

export function WakingBanner() {
  return (
    <p className="rounded-md border border-rule bg-panel p-4 text-base">
      The Northstar API is waking up. Its free hosting sleeps after 15 minutes without visitors and takes about a minute to start.
    </p>
  );
}

/** Shown above the headline while data is on screen but not live. */
export function NotLiveNote({ status }: { status: FeedStatus }) {
  const age = status.ageMs === null ? null : formatAgo(status.ageMs);
  let text: string | null = null;
  if (status.kind === 'stale') text = `This data is ${age} old. Nothing here is live until Northstar answers again.`;
  if (status.kind === 'reconnecting') text = `Showing data from ${age} ago while Northstar reconnects (it may be waking up, about 1 min).`;
  if (status.kind === 'paused') text = `Updates are paused after 30 minutes without activity. Showing data from ${age} ago.`;
  if (text === null) return null;
  return (
    <p className="flex items-start gap-2 text-base text-muted">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="mt-1.5 shrink-0 text-retry">
        <path d="M6 1 11 10.5H1Z" fill="currentColor" />
      </svg>
      {text}
    </p>
  );
}
