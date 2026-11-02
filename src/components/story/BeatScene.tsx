// Beat 1: the scene. The visitor guesses which of the three jobs failed, or skips; either way the
// answer and its reason come from the recording.
import { useRef } from 'react';
import { formatUtcMinute } from '../../lib/format';
import { GUIDED_WF as WF } from '../../lib/guided';
import { roles } from '../../lib/hero';
import { failingJob, sceneAnswer, sceneFeedback } from '../../lib/story';
import type { Run, StepKind } from '../../lib/types';
import { isScheduled, stepLabel, stepSpec } from '../../lib/workflow';
import { ToneIcon } from '../ToneIcon';

const ROLE = roles(WF);
// One purpose per job: the recording's own description says what each is for.
const JOBS: { kind: StepKind; purpose: string }[] = [ROLE.team, ROLE.visitor, ROLE.deletion]
  .map((kind) => ({ kind, purpose: stepSpec(WF, kind).purpose }));

interface Props {
  run: Run;
  picked: StepKind | null;
  revealed: boolean;
  onPick: (kind: StepKind) => void;
  onSkip: () => void;
}

export function BeatScene({ run, picked, revealed, onPick, onSkip }: Props) {
  const failing = failingJob(run);
  // Skip goes away once pressed, so focus moves to the answer it shows (7.1c, F6). A picked card keeps focus.
  const answer = useRef<HTMLParagraphElement>(null);
  const skip = () => {
    onSkip();
    requestAnimationFrame(() => answer.current?.focus());
  };
  const feedback = picked === null ? null : sceneFeedback(run, picked, WF);
  return (
    <div className="grid gap-10 min-[1100px]:grid-cols-[minmax(0,560px)_minmax(0,1fr)] min-[1100px]:items-center min-[1100px]:gap-16">
      <div className="flex flex-col gap-5">
        <p className="font-mono text-md text-route">{formatUtcMinute(run.created_at)}</p>
        <h1 id="beat-title" tabIndex={-1} className="outline-none font-display text-4xl font-semibold tracking-[-0.02em] min-[720px]:text-6xl">
          Someone sends the contact form.
        </h1>
        <p className="text-reading min-[720px]:text-lg">Northstar starts three jobs. One of them is about to fail. Which one?</p>
        {!revealed && <p className="text-base text-muted">Tap the job you think failed, or skip.</p>}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {!revealed && (
            <button type="button" onClick={skip} className="inline-flex min-h-11 items-center rounded-sm bg-raised px-5 text-base font-medium hover:bg-rule">
              Skip, show me
            </button>
          )}
          <span className="text-sm text-muted">The visitor&apos;s details are never shown.</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {JOBS.map((j) => {
          const amber = revealed && j.kind === failing;
          const inner = (
            <button
              type="button"
              onClick={() => onPick(j.kind)}
              className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-md p-5 text-left ${picked === j.kind ? 'ring-2 ring-route' : ''} ${amber ? 'bg-raised' : 'bg-panel hover:bg-raised'}`}
            >
              <span className="font-display text-2xl font-semibold">
                {stepLabel(WF, j.kind)}
                {picked === j.kind && <span className="sr-only"> (your guess)</span>}
              </span>
              {revealed ? <Outcome run={run} kind={j.kind} failing={failing} /> : <span />}
              <span className="col-span-2 text-base text-muted">{j.purpose}</span>
            </button>
          );
          return <div key={j.kind} className={amber ? 'edge-retry' : ''}>{inner}</div>;
        })}
        <div aria-live="polite">
          {feedback !== null && (
            <p className="flex items-start gap-2.5 rounded-md bg-panel p-4 text-base">
              <ToneIcon tone={feedback.right ? 'ok' : 'neutral'} className="mt-1" />
              <span>{feedback.text}</span>
            </p>
          )}
          {feedback === null && revealed && <p ref={answer} tabIndex={-1} className="rounded-md bg-panel p-4 text-base outline-none">{sceneAnswer(run, WF)}</p>}
        </div>
      </div>
    </div>
  );
}

function Outcome({ run, kind, failing }: { run: Run; kind: StepKind; failing: StepKind | null }) {
  if (kind === failing) {
    const first = run.events.find((e) => e.kind === kind && e.event === 'failed');
    return <span className="flex items-center gap-2 text-base text-retry"><ToneIcon tone="retry" />failed on try {first?.attempt ?? 1}</span>;
  }
  if (isScheduled(WF, kind)) {
    return <span className="flex items-center gap-2 text-base text-muted"><ToneIcon tone="scheduled" />day {Math.round(stepSpec(WF, kind).starts_after_s / 86_400)}</span>;
  }
  return <span className="flex items-center gap-2 text-base"><ToneIcon tone="simulated" />worked, simulated</span>;
}
