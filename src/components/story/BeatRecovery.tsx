// Beat 3: did it recover, and how long did it take? The visitor answers (or skips), then sees the
// evidence: the tape's last frame, planned vs actual waits, and a total that reconciles to the second.
import { formatDuration } from '../../lib/format';
import { GUIDED_WF as WF } from '../../lib/guided';
import type { ReplayModel } from '../../lib/replay';
import { checkAnswers, factFor, recoveryBreakdown, type Answers, type QuestionId } from '../../lib/story';
import type { Run } from '../../lib/types';
import { useFocusOnReveal } from '../../hooks/useFocusOnReveal';
import { ToneIcon } from '../ToneIcon';
import { Question } from './Question';
import { Tape } from './Tape';
import { WaitBars } from './WaitBars';

const IDS: QuestionId[] = ['recovered', 'duration'];

interface Props {
  run: Run;
  model: ReplayModel;
  answers: Answers;
  onAnswer: (id: QuestionId, value: string) => void;
  revealed: boolean;
  onReveal: () => void;
}

export function BeatRecovery({ run, model, answers, onAnswer, revealed, onReveal }: Props) {
  const b = recoveryBreakdown(run, WF);
  const checks = checkAnswers(run, answers, WF);
  const answeredAll = IDS.every((id) => answers[id] !== undefined);
  const deciding = model.moments.findIndex((m) => m.shape === 'ok');
  const evidence = useFocusOnReveal<HTMLHeadingElement>(revealed);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-[760px] flex-col gap-4">
        <h1 id="beat-title" tabIndex={-1} className="outline-none font-display text-4xl font-semibold min-[720px]:text-5xl">Did it recover?</h1>
        <p className="text-reading">Take a guess from the replay you just watched. The evidence comes next, and a wrong guess is fine.</p>
      </div>
      <div className="flex flex-col gap-6">
        {IDS.map((id) => <Question key={id} id={id} value={answers[id]} onChange={(v) => onAnswer(id, v)} />)}
        {!revealed && (
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!answeredAll} onClick={onReveal} className="inline-flex min-h-11 items-center rounded-sm bg-route px-5 text-base font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-50">
              Check
            </button>
            <button type="button" onClick={onReveal} className="inline-flex min-h-11 items-center rounded-sm bg-raised px-5 text-base font-medium hover:bg-rule">
              Skip, show me
            </button>
          </div>
        )}
      </div>

      {revealed && (
        <section aria-labelledby="evidence-3" className="flex flex-col gap-6">
          <h2 id="evidence-3" ref={evidence} tabIndex={-1} className="outline-none font-display text-2xl font-semibold">The evidence</h2>
          <ul className="flex flex-col gap-2">
            {IDS.map((id) => {
              const c = checks.find((x) => x.id === id);
              return (
                <li key={id} className="flex items-start gap-2.5 text-base">
                  <ToneIcon tone={c === undefined ? 'neutral' : c.right ? 'ok' : 'dead'} className="mt-1" />
                  <span>{c?.text ?? `Not answered. The data says: ${factFor(run, id, WF)}`}</span>
                </li>
              );
            })}
          </ul>
          <div className="ticks hidden p-7 min-[720px]:block">
            <Tape model={model} displayS={model.totalDisplayS} mark={deciding} head={false} label={`The whole run, with the deciding moment marked: ${model.ending}`} />
          </div>
          <div className="grid gap-6 min-[1100px]:grid-cols-2">
            <div className="rounded-md bg-panel p-6"><WaitBars waits={model.waits} /></div>
            {b !== null && (
              <div className="flex flex-col gap-3 rounded-md bg-panel p-6">
                <p className="font-display text-3xl font-semibold">
                  {formatDuration(b.totalS)} = {formatDuration(b.waitingS)} waiting + {formatDuration(b.workingS)} working
                </p>
                <p className="text-base">
                  From the enquiry to the email. Northstar spent {formatDuration(b.waitingS)} waiting on purpose, to give the email
                  service time to come back.
                </p>
                <p className="text-sm text-muted">
                  Working: {b.parts.map((p) => `${p.label} ${formatDuration(p.s)}`).join(' · ')}.
                  {formatDuration(b.partsRoundedSumS) !== formatDuration(b.workingS) &&
                    ` Each is rounded, so they add up to ${formatDuration(b.partsRoundedSumS)}.`}
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
