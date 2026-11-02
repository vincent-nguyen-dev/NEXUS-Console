// Beat 4: was it sent twice? The evidence is in two labelled parts: what this recording shows, and what
// Northstar's design guards against but this run never exercised. Only the first is a claim about this run.
// Checkpoint A: a newcomer read each try as a send, so the plain answer (a failed try sent nothing) comes
// first, then the count, then the timeline.
import { GUIDED_WF as WF } from '../../lib/guided';
import { stepTimeline } from '../../lib/runDetail';
import { checkAnswers, factFor, sendCount, type Answers, type QuestionId } from '../../lib/story';
import type { Run } from '../../lib/types';
import { useFocusOnReveal } from '../../hooks/useFocusOnReveal';
import { primaryStep } from '../../lib/workflow';
import { ToneIcon } from '../ToneIcon';
import { Question } from './Question';

const ID: QuestionId = 'sent';

interface Props {
  run: Run;
  answers: Answers;
  onAnswer: (id: QuestionId, value: string) => void;
  revealed: boolean;
  onReveal: () => void;
}

export function BeatSentOnce({ run, answers, onAnswer, revealed, onReveal }: Props) {
  const rows = stepTimeline(run, primaryStep(WF), WF);
  const check = checkAnswers(run, answers, WF).find((c) => c.id === ID);
  const evidence = useFocusOnReveal<HTMLHeadingElement>(revealed);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-[760px] flex-col gap-4">
        <h1 id="beat-title" tabIndex={-1} className="outline-none font-display text-4xl font-semibold min-[720px]:text-5xl">Was it sent twice?</h1>
        <p className="text-reading">Think back to the replay you just watched, then take a guess. The evidence comes next.</p>
      </div>
      <div className="flex flex-col gap-6">
        <Question id={ID} value={answers[ID]} onChange={(v) => onAnswer(ID, v)} />
        {!revealed && (
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={answers[ID] === undefined} onClick={onReveal} className="inline-flex min-h-11 items-center rounded-sm bg-route px-5 text-base font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-50">
              Check
            </button>
            <button type="button" onClick={onReveal} className="inline-flex min-h-11 items-center rounded-sm bg-raised px-5 text-base font-medium hover:bg-rule">
              Skip, show me
            </button>
          </div>
        )}
      </div>

      {revealed && (
        <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section aria-labelledby="shows-title" className="flex flex-col gap-4 rounded-md bg-panel p-6">
            <h2 id="shows-title" ref={evidence} tabIndex={-1} className="outline-none font-display text-2xl font-semibold">What this recording shows</h2>
            <p className="flex items-start gap-2.5 text-base">
              <ToneIcon tone={check === undefined ? 'neutral' : check.right ? 'ok' : 'dead'} className="mt-1" />
              <span>{check?.text ?? `Not answered. The data says: ${factFor(run, ID, WF)}`}</span>
            </p>
            <p className="font-mono text-base">{sendCount(run, WF)}</p>
            <ol className="flex flex-col gap-0.5" aria-label="Team notification timeline">
              {rows.map((r) => {
                const sent = r.tone === 'ok' && /email sent/.test(r.text);
                return (
                  <li key={r.key} className={`grid grid-cols-[4.5rem_1rem_1fr] items-start gap-3 rounded-sm px-3 py-2 ${sent ? 'bg-raised outline-2 -outline-offset-2 outline-ok' : ''}`}>
                    <span className="pt-0.5 font-mono text-sm text-muted">{r.offset}</span>
                    <span className="pt-1"><ToneIcon tone={r.tone} /></span>
                    <span className="flex flex-col">
                      <span className="text-base">{r.text}{sent && <span className="sr-only"> (the only sent result)</span>}</span>
                      {r.note !== null && <span className="text-sm text-muted">{r.note}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
          <section aria-labelledby="design-title" className="flex flex-col gap-4 self-start rounded-md p-6 ring-1 ring-rule ring-inset">
            <h2 id="design-title" className="font-display text-2xl font-semibold">What else guards against a duplicate</h2>
            <p className="text-sm text-muted">By design, in Northstar&apos;s code. This recording didn&apos;t exercise either one.</p>
            <ul className="flex flex-col gap-3 text-base">
              <li className="flex items-start gap-2.5">
                <ToneIcon tone="neutral" className="mt-1" />
                One enquiry gets one team notification job: Northstar&apos;s database refuses a second one.
              </li>
              <li className="flex items-start gap-2.5">
                <ToneIcon tone="neutral" className="mt-1" />
                The real send carries a key unique to the enquiry, so an email service that honours it ignores a repeat.
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
