// The landing page's status chip: what the one request to Northstar found. A shape per state, never
// colour alone; only state changes are announced, not the ticking age.
import { useNow } from '../../hooks/useNow';
import { chipView, type ChipTone, type LandingFeed } from '../../lib/landing';

function Lamp({ tone }: { tone: ChipTone }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      {tone === 'live' && <circle cx="7" cy="7" r="6" className="fill-ok" />}
      {(tone === 'checking' || tone === 'waking') && (
        <>
          <circle cx="7" cy="7" r="5.5" fill="none" className="stroke-track" strokeWidth="2" />
          <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" fill="none" className="chip-spin stroke-route" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {tone === 'stale' && (
        <>
          <circle cx="7" cy="7" r="5.5" fill="none" className="stroke-muted" strokeWidth="2" />
          <path d="M7 4.2v2.8l2 1.4" fill="none" className="stroke-muted" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {tone === 'preview' && <rect x="2.5" y="2.5" width="9" height="9" rx="1.5" fill="none" className="stroke-route" strokeWidth="2" />}
      {tone === 'unavailable' && <path d="M3 3l8 8M11 3l-8 8" fill="none" className="stroke-dead" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

export function StatusChip({ feed }: { feed: LandingFeed }) {
  const now = useNow();
  const view = chipView(feed, now);
  return (
    <p className="inline-flex max-w-full flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-[22px] bg-panel px-4 py-2.5 text-sm">
      <Lamp tone={view.tone} />
      <span>{view.text}</span>
      {view.detail !== '' && <span className="text-muted">{view.detail}</span>}
      <span role="status" className="sr-only">{view.announce}</span>
    </p>
  );
}
