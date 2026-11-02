// A run's story as one 24 px shape (the run strip and its legend). Each story has its own shape, never colour
// alone: ✓ sent on try 1 · ✓ in a dashed amber ring, sent after failed tries · ○ simulated · ↻ waiting to retry ·
// ✕ gave up · ⊖ skipped · clock scheduled · ● still running. Decorative: its button or label says the same.
import type { ReactNode } from 'react';
import type { StoryKind } from '../../lib/runStory';

export function StoryShape({ kind, size = 24 }: { kind: StoryKind; size?: number }) {
  const svg = (children: ReactNode) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">{children}</svg>
  );
  switch (kind) {
    case 'sent':
      return svg(<><circle cx="12" cy="12" r="10" className="fill-ok" /><path d="M7 12l3.5 3.5L17 9" fill="none" className="stroke-bg" strokeWidth="2.5" /></>);
    case 'recovered':
      return svg(
        <>
          <circle cx="12" cy="12" r="10.5" fill="none" className="stroke-retry" strokeWidth="2" strokeDasharray="3 2.5" />
          <circle cx="12" cy="12" r="7" className="fill-ok" />
          <path d="M8.6 12l2.4 2.4 4.4-4.4" fill="none" className="stroke-bg" strokeWidth="2.2" />
        </>,
      );
    case 'simulated':
      return svg(<circle cx="12" cy="12" r="8.5" fill="none" className="stroke-ok" strokeWidth="3" />);
    case 'done':
      return svg(<><circle cx="12" cy="12" r="8.5" fill="none" className="stroke-ink" strokeWidth="2.5" /><path d="M8 12l3 3 5.5-5.5" fill="none" className="stroke-ink" strokeWidth="2.2" /></>);
    case 'waiting':
      return svg(<path transform="translate(4 4)" d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" fill="none" className="stroke-retry" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />);
    case 'gaveup':
    case 'duplicate':
      return svg(<><circle cx="12" cy="12" r="9.5" fill="none" className="stroke-dead" strokeWidth="2.5" /><path d="M8 8l8 8M16 8l-8 8" className="stroke-dead" strokeWidth="2.5" strokeLinecap="round" /></>);
    case 'skipped':
      return svg(<><circle cx="12" cy="12" r="8.5" fill="none" className="stroke-muted" strokeWidth="2.5" /><path d="M8 12h8" className="stroke-muted" strokeWidth="2.5" strokeLinecap="round" /></>);
    case 'scheduled':
      return svg(<><circle cx="12" cy="12" r="8.5" fill="none" className="stroke-muted" strokeWidth="2.5" /><path d="M12 8v4l3 2" fill="none" className="stroke-muted" strokeWidth="2.5" strokeLinecap="round" /></>);
    case 'running':
      return svg(<circle cx="12" cy="12" r="4.5" className="fill-ink" />);
  }
}
