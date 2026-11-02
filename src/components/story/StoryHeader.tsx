// The story's top bar, as on the boards: the wordmark, five progress segments with "Step n of 5", the
// recording chip (this is never live data) and a way out.
import { BEATS } from '../../lib/story';
import { NexusMark } from '../NexusMark';

export function StoryHeader({ beat, recordedDay }: { beat: number; recordedDay: string }) {
  const title = BEATS[beat - 1]?.title ?? '';
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-4 min-[720px]:py-6">
      <a href="/" className="flex min-h-11 items-center gap-2.5 rounded-sm font-display text-2xl font-semibold tracking-[0.04em]">
        <NexusMark size={22} />
        NEXUS
      </a>
      <div className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-2 min-[900px]:order-none min-[900px]:w-auto">
        <span aria-hidden="true" className="flex gap-1.5">
          {BEATS.map((b) => (
            <span key={b.n} className={`h-1.5 w-8 rounded-full ${b.n <= beat ? 'bg-route' : 'bg-track'}`} />
          ))}
        </span>
        <span className="text-sm">Step {beat} of {BEATS.length} · {title}</span>
      </div>
      <span className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="rounded-full bg-panel px-3 py-1.5">Recording · {recordedDay}</span>
        <a href="/" className="inline-flex min-h-11 items-center text-route underline underline-offset-2">Leave the story</a>
      </span>
    </header>
  );
}
