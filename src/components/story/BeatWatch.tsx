// Beat 2: the replay. The clock reads real time since the enquiry; the waits are shortened and say so.
// The moments list beside it is the same story in plain HTML, whether or not anything animates.
import { useState } from 'react';
import { useReplay } from '../../hooks/useReplay';
import { formatOffset } from '../../lib/format';
import { momentsShown, realAt, type ReplayModel } from '../../lib/replay';
import { Moments } from './Moments';
import { ReplayControls } from './ReplayControls';
import { Tape } from './Tape';
import { TapeCompact } from './TapeCompact';

export function BeatWatch({ model, recordedDay }: { model: ReplayModel; recordedDay: string }) {
  const replay = useReplay(model, { autoplay: true });
  const current = model.moments[momentsShown(model, replay.displayS) - 1];
  // Announced after a step or a pause, and at the end, never on every frame of playback.
  const [touched, setTouched] = useState(false);
  const said = `${current?.time ?? ''}: ${current?.text ?? ''}`;
  let announced = '';
  if (replay.atEnd) announced = `${said} End of the replay.`;
  else if (touched && !replay.playing) announced = said;
  const tapeLabel = `Event tape, ${replay.atEnd ? 'at the end' : `at ${current?.time ?? ''}`}: ${current?.text ?? ''}`;
  const clock = formatOffset(realAt(model, replay.displayS));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 id="beat-title" tabIndex={-1} className="outline-none font-display text-4xl font-semibold min-[720px]:text-5xl">Watch it happen</h1>
        <p aria-hidden="true" className="min-h-[3.5rem] max-w-[860px] text-lg font-medium min-[720px]:text-3xl">{current?.text}</p>
      </div>
      <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_400px] min-[1100px]:items-start">
        <div className="flex flex-col gap-4">
          <div className="ticks flex flex-col gap-4 p-5 min-[720px]:p-7">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <p className="flex flex-col">
                <span className="text-sm text-muted">Time since the enquiry (real)</span>
                <span className="font-mono text-3xl tabular-nums">{clock}</span>
              </p>
              <p className="text-sm text-muted">Recorded {recordedDay}, not live</p>
            </div>
            <div className="hidden min-[720px]:block"><Tape model={model} displayS={replay.displayS} label={tapeLabel} /></div>
            <div className="flex flex-col gap-2 min-[720px]:hidden">
              <TapeCompact model={model} displayS={replay.displayS} label={tapeLabel} />
              <div className="flex justify-between font-mono text-sm text-muted"><span>+0.0 s</span><span>{formatOffset(model.totalRealS)}</span></div>
              <ul className="flex flex-col gap-0.5 font-mono text-sm text-retry">
                {model.waits.map((w) => <li key={w.afterTry}>{w.label}</li>)}
              </ul>
            </div>
            <ReplayControls
              replay={replay}
              onStep={() => setTouched(true)}
            />
            <p className="text-sm text-muted">
              Waits are shortened in the replay; the times are real.
              {replay.mode === 'step' && ' Animation is off (your system asks for reduced motion): move between moments with ‹ and ›.'}
            </p>
          </div>
        </div>
        <section aria-labelledby="moments-title" className="flex flex-col gap-2 rounded-md bg-panel px-2 py-4">
          <h2 id="moments-title" className="px-3.5 font-display text-2xl font-semibold">What happened</h2>
          <Moments model={model} displayS={replay.displayS} />
        </section>
      </div>
      <p role="status" className="sr-only">{announced}</p>
    </div>
  );
}
