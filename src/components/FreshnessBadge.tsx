// The status pill (step 5.2, board D6): a shape and a color per state, never color alone. While live, the dot
// breathes once each time Northstar answers a check, then rests: the motion matches the poll, never a stream.
import { useRef, useState } from 'react';
import { announcedKind, pillState, type FeedStatus, type StatusKind } from '../lib/feedStatus';
import { formatAgo } from '../lib/format';
import { useKeepFocus } from '../hooks/useKeepFocus';

type Shape = 'dot' | 'ring' | 'triangle' | 'cross' | 'bars' | 'square';

const LOOK: Record<StatusKind, { shape: Shape; color: string; announce: string }> = {
  recorded: { shape: 'square', color: 'text-route', announce: 'Recorded run' },
  file: { shape: 'square', color: 'text-route', announce: 'Your file' },
  connecting: { shape: 'ring', color: 'text-route', announce: 'Connecting' },
  waking: { shape: 'ring', color: 'text-route', announce: 'Northstar API waking up' },
  offline: { shape: 'cross', color: 'text-dead', announce: 'Offline' },
  rate_limited: { shape: 'cross', color: 'text-dead', announce: 'Rate limited' },
  api_error: { shape: 'cross', color: 'text-dead', announce: 'Northstar API error' },
  preview: { shape: 'square', color: 'text-route', announce: 'Preview: no live data' },
  reconnecting: { shape: 'triangle', color: 'text-retry', announce: 'Reconnecting' },
  stale: { shape: 'triangle', color: 'text-retry', announce: 'Stale data' },
  paused: { shape: 'bars', color: 'text-muted', announce: 'Updates paused' },
  live: { shape: 'dot', color: 'text-ok', announce: 'Live' },
};

function Lamp({ shape, beat }: { shape: Shape; beat: number }) {
  return (
    <svg key={beat} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`shrink-0 overflow-visible ${beat > 0 ? 'lamp-beat' : ''}`}>
      {shape === 'dot' && beat > 0 && (
        <circle cx="6" cy="6" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="lamp-beat-ring" style={{ transformOrigin: '6px 6px' }} />
      )}
      {shape === 'dot' && <circle cx="6" cy="6" r="5" fill="currentColor" />}
      {shape === 'ring' && <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />}
      {shape === 'triangle' && <path d="M6 1 11 10.5H1Z" fill="currentColor" />}
      {shape === 'cross' && (
        <>
          <rect x="1" y="1" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3.75 3.75l4.5 4.5M8.25 3.75l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" />
        </>
      )}
      {shape === 'bars' && (
        <>
          <rect x="2" y="1" width="3" height="10" fill="currentColor" />
          <rect x="7" y="1" width="3" height="10" fill="currentColor" />
        </>
      )}
      {shape === 'square' && <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" />}
    </svg>
  );
}

const ago = (ms: number | null) => (ms === null ? '' : `${formatAgo(ms)} ago`);
const nextTry = (ms: number | null) => (ms === null ? '' : ` · next try in ${formatAgo(ms)}`);

function badgeText(s: FeedStatus, recordedDay: string, fileLabel: string | null): string {
  switch (s.kind) {
    case 'recorded': return `Recorded run, anonymized · run of ${recordedDay} (UTC) · not live`;
    case 'file': return fileLabel === null ? 'Your file · none loaded' : `Your file · ${fileLabel} · not live`;
    case 'connecting': return 'Connecting to Northstar…';
    case 'waking': return 'Northstar API waking up (about 1 min)';
    case 'offline': return `Offline · Northstar didn't answer${nextTry(s.retryInMs)}`;
    case 'rate_limited': return `Rate limited by Northstar${nextTry(s.retryInMs)}`;
    case 'api_error': return `Northstar API error${nextTry(s.retryInMs)}`;
    case 'preview': return 'Preview · no live data';
    case 'reconnecting': return `Reconnecting · last checked ${ago(s.ageMs)}`;
    case 'stale': return `Stale · last checked ${ago(s.ageMs)}`;
    case 'paused': return s.ageMs === null ? 'Paused after 30 min without activity' : `Paused after 30 min without activity · data from ${ago(s.ageMs)}`;
    case 'live': return `Live · checked ${ago(s.ageMs)}`;
  }
}

interface Props {
  status: FeedStatus;
  recordedDay: string;
  fileLabel?: string | null;
  /** "Newest enquiry 12 h ago", shown after the state while there is data. */
  newest?: string | null;
  /** When the last check succeeded (ms), or null: a new value while live is one heartbeat. */
  checkedAt?: number | null;
  onResume: () => void;
}

export function FreshnessBadge({ status, recordedDay, fileLabel = null, newest = null, checkedAt = null, onResume }: Props) {
  const look = LOOK[status.kind];
  // A heartbeat per new successful check while live; never on mount, a failure, the recording or a file.
  const [seen, setSeen] = useState({ at: checkedAt, beat: 0 });
  let beat = seen.beat;
  if (seen.at !== checkedAt) {
    beat = seen.at !== null && checkedAt !== null && pillState(status) === 'live' ? seen.beat + 1 : seen.beat;
    setSeen({ at: checkedAt, beat });
  }
  // Resume goes away once polling resumes: focus moves to the state it shows (7.1c, F6).
  const text = useRef<HTMLSpanElement>(null);
  const pill = useKeepFocus<HTMLSpanElement>(() => text.current);
  const [said, setSaid] = useState<StatusKind>(status.kind);
  const say = announcedKind(said, status.kind);
  if (say !== said) setSaid(say);
  return (
    <span ref={pill} className="inline-flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border border-glass bg-panel py-1.5 pr-4 pl-3.5 text-base">
      <span className={look.color}><Lamp shape={look.shape} beat={beat} /></span>
      <span ref={text} tabIndex={-1} className="outline-none">{badgeText(status, recordedDay, fileLabel)}</span>
      {/* On a phone the newest enquiry takes its own line, without a dangling separator. */}
      {newest !== null && <><span aria-hidden="true" className="hidden text-muted min-[720px]:inline">·</span><span className="basis-full pl-[22px] min-[720px]:basis-auto min-[720px]:pl-0">{newest}</span></>}
      {status.kind === 'paused' && (
        <button type="button" onClick={onResume} className="min-h-11 rounded-sm px-2 text-route underline underline-offset-2">
          Resume
        </button>
      )}
      {/* Only state changes are announced; the ticking age is not. */}
      <span role="status" className="sr-only">{LOOK[say].announce}</span>
    </span>
  );
}
