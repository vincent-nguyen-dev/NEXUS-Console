// What a panel shows instead of data: the first load failed, or the window is empty.
import type { ApiError } from '../lib/api';
import { formatAgo } from '../lib/format';
import { CONSOLE_PATH, STORY_HREF } from '../lib/routes';
import { SITE_URL } from '../lib/credits';
import { PRODUCTION_HOST } from '../lib/origin';
import { useKeepFocus } from '../hooks/useKeepFocus';
import type { DataSource } from '../lib/source';

const storyLink = 'inline-flex min-h-11 items-center rounded-sm px-2 text-base text-route underline underline-offset-2';

function errorText(error: ApiError | null, retryInMs: number | null): string {
  switch (error?.kind) {
    case 'rate_limited':
      return `Northstar asked NEXUS to slow down (too many requests).${retryInMs === null ? '' : ` It will try again in ${formatAgo(retryInMs)}.`}`;
    case 'unavailable':
      return 'Northstar answered 503 (unavailable). Its free hosting may still be waking up, or its database is down.';
    case 'http':
      return `Northstar answered with an error (HTTP ${error.status ?? '?'}).`;
    case 'shape':
      return `Northstar's feed changed in a way NEXUS can't read: ${error.message}.`;
    default:
      return "Northstar didn't answer within 90 seconds, or the connection failed. Its free hosting may still be waking up.";
  }
}

/** A preview build (7.2a): live data can't load here, and nothing was asked. What works instead. */
export function PreviewPanel({ onRecording, onFile }: { onRecording: () => void; onFile: (() => void) | null }) {
  return (
    <section aria-labelledby="preview-title" className="flex flex-col gap-3 rounded-md border border-rule bg-panel p-5">
      <h2 id="preview-title" className="font-display text-lg font-semibold">Live data isn&apos;t available in this preview</h2>
      <p className="max-w-[70ch] text-base">
        Northstar answers only the production site, {PRODUCTION_HOST}, so a preview doesn&apos;t ask it. The recording and
        your own file work here.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onRecording} className="min-h-11 rounded-sm bg-raised px-4 text-base font-medium">Open the recording</button>
        {onFile && <button type="button" onClick={onFile} className="min-h-11 rounded-sm bg-raised px-4 text-base font-medium">Load your own file</button>}
        <a href={`${SITE_URL.replace(/\/$/, '')}${CONSOLE_PATH}`} className={storyLink}>Open the production console</a>
      </div>
    </section>
  );
}

interface ErrorProps {
  error: ApiError | null;
  retryInMs: number | null;
  busy: boolean;
  onRetry: () => void;
}

export function ErrorPanel({ error, retryInMs, busy, onRetry }: ErrorProps) {
  const waitFor429 = error?.kind === 'rate_limited' && retryInMs !== null && retryInMs > 0;
  const off = busy || waitFor429;
  // When Northstar answers, the panel goes: focus moves to the page's main area, not the top (7.1c, F6).
  const panel = useKeepFocus<HTMLElement>(() => document.getElementById('main'));
  return (
    <section ref={panel} aria-labelledby="error-title" className="flex flex-col gap-3 rounded-md border border-rule bg-panel p-5">
      <h2 id="error-title" className="font-display text-lg font-semibold">No data from Northstar yet</h2>
      <p className="max-w-[70ch] text-base">{errorText(error, retryInMs)}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            if (!off) onRetry();
          }}
          aria-disabled={off || undefined}
          className="min-h-11 rounded-sm bg-raised px-4 text-base font-medium aria-disabled:cursor-not-allowed aria-disabled:text-muted"
        >
          {busy ? 'Trying…' : 'Try again'}
        </button>
        <a href={STORY_HREF} className={storyLink}>
          Watch the recorded story instead
        </a>
      </div>
    </section>
  );
}

interface EmptyProps {
  canWiden: boolean;
  onAll: () => void;
  source?: DataSource;
  /** The test-switch filter as words ("the outage switch off"): the window may hold other runs. */
  filter?: string | null;
  onClearFilter?: () => void;
}

export function EmptyPanel({ canWiden, onAll, source = 'live', filter = null, onClearFilter }: EmptyProps) {
  let text = source === 'file'
    ? 'Your file has no runs created in this window. Windows count back from the file\'s own time.'
    : "Nothing was recorded in this window. An enquiry sent through the contact form on Northstar's site shows up here at the next refresh.";
  if (filter !== null) text = `No runs with ${filter} in this window. The filter may be hiding other runs.`;
  return (
    <section aria-label="No runs" className="flex flex-col gap-3 rounded-md border border-rule bg-panel p-5">
      <p className="max-w-[70ch] text-base">{text}</p>
      <div className="flex flex-wrap gap-3">
        {filter !== null && onClearFilter && (
          <button type="button" onClick={onClearFilter} className="min-h-11 rounded-sm bg-raised px-4 text-base font-medium">
            Show all runs
          </button>
        )}
        {canWiden && (
          <button type="button" onClick={onAll} className="min-h-11 rounded-sm bg-raised px-4 text-base font-medium">
            Show all recorded runs
          </button>
        )}
        <a href={STORY_HREF} className={storyLink}>
          Watch the recorded story
        </a>
      </div>
    </section>
  );
}
