// The replay's moments as plain HTML: always on the page, so the story reads without the animation.
// Moments still ahead are muted; the current one is marked in words for screen readers too.
import type { MomentShape, ReplayModel } from '../../lib/replay';
import { momentsShown } from '../../lib/replay';
import { ToneIcon, type IconTone } from '../ToneIcon';

const ICON: Record<MomentShape, IconTone> = { lead: 'lead', neutral: 'neutral', retry: 'retry', ok: 'ok', simulated: 'simulated', dead: 'dead' };

export function Moments({ model, displayS }: { model: ReplayModel; displayS: number }) {
  const shown = momentsShown(model, displayS);
  return (
    <ol className="flex flex-col gap-0.5">
      {model.moments.map((m, i) => {
        const current = i === shown - 1;
        const ahead = i >= shown;
        return (
          <li
            key={`${m.realS}-${i}`}
            aria-current={current ? 'true' : undefined}
            className={`grid grid-cols-[4.5rem_1rem_1fr] items-start gap-3 rounded-sm px-3.5 py-2.5 ${current ? 'bg-raised' : ''} ${ahead ? 'text-muted' : ''}`}
          >
            <span className="pt-0.5 font-mono text-sm text-muted">{m.time}</span>
            <span className="pt-1"><ToneIcon tone={ICON[m.shape]} /></span>
            <span className="text-base">
              {m.text}
              {current && <span className="sr-only"> (current moment)</span>}
              {ahead && <span className="sr-only"> (still ahead)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
