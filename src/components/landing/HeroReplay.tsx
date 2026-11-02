// The hero's replay card (step 5.3a, board E1–E3): the recorded enquiry, played one moment at a time. It opens on
// its final frame (the whole run, one sentence) and starts only on a click. A read head can be dragged along the
// scrubber or moved with the arrow keys; the caption follows. Phones keep the list (HeroList) and step through the
// same moments. The card takes the 5.2 cursor light; it's no longer a hidden link to the story.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useCursorLight } from '../../hooks/useCursorLight';
import { useReplay } from '../../hooks/useReplay';
import { formatDuration } from '../../lib/format';
import { GUIDED_RUN, GUIDED_WF } from '../../lib/guided';
import type { HeroModel } from '../../lib/hero';
import { captionAt, frameAt, promiseFor, restCaption, scrubToDisplayS, type HeroPromise } from '../../lib/heroReplay';
import { realAt, replayModel } from '../../lib/replay';
import { STORY_HREF } from '../../lib/routes';
import { ToneIcon } from '../ToneIcon';
import { HeroFigure } from './HeroFigure';
import { HeroList } from './HeroList';

const REPLAY = replayModel(GUIDED_RUN, GUIDED_WF);
const REST = restCaption(GUIDED_RUN, GUIDED_WF, REPLAY);
const SECONDS = Math.round(REPLAY.totalRealS);

const side = 'flex size-11 shrink-0 items-center justify-center rounded-sm border border-glass text-lg hover:border-route aria-disabled:cursor-not-allowed aria-disabled:opacity-50';
const main = 'btn-primary inline-flex min-h-11 items-center justify-center rounded-sm bg-route px-5 text-base font-semibold text-bg';

function Scrubber({ displayS, onSeek, onStep }: { displayS: number; onSeek: (s: number) => void; onStep: (d: 1 | -1 | 'start' | 'end') => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const total = REPLAY.totalDisplayS;
  const seekAt = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (r && r.width > 0) onSeek(scrubToDisplayS((clientX - r.left) / r.width, REPLAY));
  };
  const pct = (s: number) => `${(s / total) * 100}%`;
  const shown = frameAt(REPLAY, displayS).shown;
  return (
    <div
      ref={ref}
      role="slider" tabIndex={0} aria-label="Replay position"
      aria-valuemin={1} aria-valuemax={REPLAY.moments.length} aria-valuenow={shown}
      aria-valuetext={`Moment ${shown} of ${REPLAY.moments.length}, +${formatDuration(realAt(REPLAY, displayS))}`}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(true);
        seekAt(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seekAt(e.clientX);
      }}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
      onKeyDown={(e) => {
        const keys: Record<string, 1 | -1 | 'start' | 'end'> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, Home: 'start', End: 'end' };
        const k = keys[e.key];
        if (k === undefined) return;
        e.preventDefault();
        onStep(k);
      }}
      className="group relative mx-3 h-7 cursor-pointer touch-none rounded-sm"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-[13px] h-0.5 bg-rule" />
      <span aria-hidden="true" className="absolute left-0 top-[13px] h-0.5 bg-route" style={{ width: pct(displayS) }} />
      {REPLAY.moments.map((m) => (
        <span key={m.displayS} aria-hidden="true" className={`absolute top-[9px] h-2.5 w-0.5 ${m.shape === 'retry' ? 'bg-retry' : m.shape === 'ok' ? 'bg-ok' : 'bg-track'}`} style={{ left: pct(m.displayS) }} />
      ))}
      <span
        aria-hidden="true"
        className={`absolute top-[3px] -ml-[11px] size-[22px] rounded-full bg-ink shadow-[0_0_14px_rgb(124_207_227/0.6)] ${drag ? 'ring-[5px] ring-route/50' : 'ring-4 ring-route/20 group-focus-visible:ring-[5px] group-focus-visible:ring-route/50'}`}
        style={{ left: pct(displayS) }}
      />
    </div>
  );
}

/** What the scroll band follows (5.3b): whether the replay plays, and the promise its moment is about. */
export interface HeroReplayState {
  playing: boolean;
  lit: HeroPromise | null;
  /** The moments shown (0 at rest) and the primary job's try the latest one is about (0 for the enquiry, null for others): the mesh pulses for it. */
  shown: number;
  attempt: number | null;
}

export function HeroReplay({ model, onState }: { model: HeroModel; onState?: ((s: HeroReplayState) => void) | undefined }) {
  const replay = useReplay(REPLAY, { autoplay: false, startAtEnd: true });
  // At rest until the visitor plays, steps or scrubs: the whole run and its one sentence.
  const [rest, setRest] = useState(true);
  const card = useCursorLight<HTMLElement>();
  const wake = () => setRest(false);
  const frame = rest ? null : frameAt(REPLAY, replay.displayS);
  const caption = rest ? REST : captionAt(REPLAY, replay.displayS);
  const step = (d: 1 | -1 | 'start' | 'end') => {
    wake();
    if (d === 1) replay.next();
    else if (d === -1) replay.prev();
    else replay.seek(d === 'start' ? 0 : REPLAY.totalDisplayS);
  };
  // Walking through (reduced motion) replaces the start button with the steps: focus goes to Next (7.1c, F6).
  // With motion, Pause takes the start button's place and keeps the focus.
  const nextRef = useRef<HTMLButtonElement>(null);
  const start = () => {
    wake();
    if (replay.mode === 'animate') replay.restart();
    else {
      replay.seek(0);
      requestAnimationFrame(() => nextRef.current?.focus());
    }
  };
  const atStart = replay.displayS <= 1e-6;
  const lit = rest ? null : promiseFor(REPLAY, replay.displayS);
  const shown = frame?.shown ?? 0;
  const latest = shown > 0 ? REPLAY.moments[shown - 1] : undefined;
  const attempt = latest === undefined ? null : latest.lane === 'team' ? latest.attempt : latest.lane === null ? 0 : null;
  useEffect(() => {
    onState?.({ playing: replay.playing, lit, shown, attempt });
  }, [onState, replay.playing, lit, shown, attempt]);

  return (
    <figure ref={card} className="lit-card flex w-full max-w-[860px] flex-col gap-3.5 rounded-md border border-glass bg-panel px-5 pt-5 pb-4 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)] min-[720px]:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm tracking-wide text-muted">One real enquiry, recorded {model.when}. The outage was switched on for the test.</p>
        <a href={STORY_HREF} className="inline-flex min-h-11 items-center text-sm text-route underline underline-offset-4">Watch the full story</a>
      </div>
      <div className="hidden min-[720px]:block">
        <HeroFigure model={model} frame={frame} />
      </div>
      <div className="min-[720px]:hidden">
        <HeroList model={model} framed={false} />
      </div>
      <div className="hidden min-[720px]:block">
        <Scrubber displayS={rest ? REPLAY.totalDisplayS : replay.displayS} onSeek={(s) => { wake(); replay.seek(s); }} onStep={step} />
      </div>
      <figcaption aria-live="polite" className="flex min-h-13 items-start justify-between gap-4 rounded-sm bg-raised px-3.5 py-3 text-md">
        <span>{caption}</span>
        {!rest && <span aria-hidden="true" className="shrink-0 font-mono text-sm text-muted">{frame?.shown ?? 0} of {REPLAY.moments.length}</span>}
      </figcaption>
      <div className="flex flex-wrap items-center gap-2">
        {rest ? (
          <>
            <button type="button" onClick={start} className={main}>
              {replay.mode === 'animate' ? `Play the ${SECONDS} seconds` : `Walk through the ${SECONDS} seconds`}
            </button>
            <span className="text-sm text-muted">
              {replay.mode === 'animate' ? `Plays in ${Math.round(REPLAY.totalDisplayS)} s: the waits are shortened, and say so.` : 'One moment at a time.'}
            </span>
          </>
        ) : (
          <>
            {replay.mode === 'animate' && (
              replay.playing
                ? <button type="button" onClick={replay.pause} className={main}>Pause</button>
                : <button type="button" onClick={replay.atEnd ? start : replay.play} className={main}>{replay.atEnd ? 'Play again' : 'Play'}</button>
            )}
            {/* aria-disabled, not disabled: a disabled button drops the keyboard's focus at either end. */}
            <button type="button" aria-label="Previous moment" aria-disabled={atStart || undefined} onClick={() => { if (!atStart) step(-1); }} className={side}>‹</button>
            <button ref={nextRef} type="button" aria-label="Next moment" aria-disabled={replay.atEnd || undefined} onClick={() => { if (!replay.atEnd) step(1); }} className={side}>›</button>
            <span className="ml-auto font-mono text-sm text-muted">
              +{formatDuration(realAt(REPLAY, replay.displayS))}{frame?.wait ? ` · ${frame.wait.label}` : ''}
            </span>
          </>
        )}
      </div>
      {/* The key: only the shapes the figure uses. ✓ is a real send; the ring is a finish that sent nothing. */}
      <ul className="hidden flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-3 text-sm text-muted min-[720px]:flex">
        <li className="flex items-center gap-2"><ToneIcon tone="retry" />Failed, waited, tried again</li>
        <li className="flex items-center gap-2"><ToneIcon tone="ok" />An email was really sent</li>
        <li className="flex items-center gap-2"><ToneIcon tone="simulated" />Finished, nothing sent (simulated)</li>
      </ul>
    </figure>
  );
}
