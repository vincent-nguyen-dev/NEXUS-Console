// A status shape beside its text: ✓ ok, ↻ failed and will retry, ✕ gave up, • neutral, ● enquiry saved,
// ○ simulated, ◌ never reported back (dashed), clock scheduled. Decorative: the text next to it always says the same thing.
import type { Tone } from '../lib/format';

export type IconTone = Tone | 'scheduled';

const COLOR: Record<IconTone, string> = {
  ok: 'text-ok', retry: 'text-retry', dead: 'text-dead', neutral: 'text-muted', lead: 'text-route', simulated: 'text-ok', noresult: 'text-ink', scheduled: 'text-muted',
};

export function ToneIcon({ tone, className = '' }: { tone: IconTone; className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={`shrink-0 ${COLOR[tone]} ${className}`}>
      {tone === 'ok' && <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {tone === 'retry' && (
        <path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {tone === 'dead' && <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      {tone === 'neutral' && <circle cx="8" cy="8" r="2.5" fill="currentColor" />}
      {tone === 'lead' && <circle cx="8" cy="8" r="4" fill="currentColor" />}
      {tone === 'simulated' && <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />}
      {tone === 'noresult' && <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeDasharray="2.5 2.2" />}
      {tone === 'scheduled' && (
        <>
          <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 5v3l2 1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
