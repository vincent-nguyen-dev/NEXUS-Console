// Play, pause and step. With reduced motion there's no Play button: only the steps, over still frames. The main
// button keeps one place (Play, Pause, then Replay at the end), so a keyboard's focus stays on it (7.1c, F6); the
// steps are aria-disabled at the ends, not disabled, for the same reason.
import type { Replay } from '../../hooks/useReplay';

const side = 'flex size-12 shrink-0 items-center justify-center rounded-sm bg-raised text-lg font-semibold hover:bg-rule aria-disabled:cursor-not-allowed aria-disabled:opacity-50';
const main = 'btn-primary inline-flex min-h-12 items-center justify-center rounded-sm bg-route px-6 text-md font-semibold text-bg';

export function ReplayControls({ replay, onStep }: { replay: Replay; onStep: () => void }) {
  const atStart = replay.displayS <= 1e-6;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-label="Previous moment" aria-disabled={atStart || undefined} onClick={() => { if (atStart) return; replay.prev(); onStep(); }} className={side}>‹</button>
      {replay.atEnd ? (
        <button type="button" aria-label="Replay from the start" onClick={replay.restart} className={main}>Replay</button>
      ) : replay.mode === 'animate' && (
        replay.playing ? (
          <button type="button" aria-label="Pause the replay" onClick={() => { replay.pause(); onStep(); }} className={main}>Pause</button>
        ) : (
          <button type="button" aria-label="Play the replay" onClick={replay.play} className={main}>Play</button>
        )
      )}
      <button type="button" aria-label="Next moment" aria-disabled={replay.atEnd || undefined} onClick={() => { if (replay.atEnd) return; replay.next(); onStep(); }} className={side}>›</button>
    </div>
  );
}
