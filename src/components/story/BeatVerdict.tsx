// Beat 5: the visitor's answers beside the data's, then the ways on: email, the live console, or again.
// A question that wasn't answered is neutral: the point is the evidence, not a score.
import { mailtoHref } from '../../lib/credits';
import { GUIDED_WF } from '../../lib/guided';
import { CONSOLE_PATH } from '../../lib/routes';
import { verdictRows, type Answers } from '../../lib/story';
import type { Run } from '../../lib/types';
import { ToneIcon } from '../ToneIcon';

export function BeatVerdict({ run, answers, onRestart }: { run: Run; answers: Answers; onRestart: () => void }) {
  const rows = verdictRows(run, answers, GUIDED_WF);
  return (
    <div className="grid gap-10 min-[1100px]:grid-cols-2 min-[1100px]:gap-14">
      <div className="flex flex-col gap-5">
        <h1 id="beat-title" tabIndex={-1} className="outline-none font-display text-4xl leading-[0.98] font-semibold min-[720px]:text-6xl">
          Your answers, checked against the data
        </h1>
        <ol className="flex flex-col gap-2.5">
          {rows.map((r) => {
            let tone: 'ok' | 'dead' | 'neutral' = 'neutral';
            if (r.right === true) tone = 'ok';
            else if (r.right === false) tone = 'dead';
            return (
              <li key={r.id} className="grid grid-cols-[1.25rem_1fr] gap-3 rounded-sm bg-raised px-5 py-4">
                <span className="pt-1"><ToneIcon tone={tone} /></span>
                <span className="flex flex-col gap-1.5">
                  <span className="text-md font-semibold">{r.question}</span>
                  <span className="grid gap-x-6 gap-y-1 text-base min-[720px]:grid-cols-2">
                    <span><span className="text-muted">Your answer: </span>{r.answer ?? 'not answered'}</span>
                    <span><span className="text-muted">The data: </span>{r.data}{r.right === false && ' (not quite)'}</span>
                  </span>
                  <span className="text-sm text-muted">{r.fact}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-muted">The data&apos;s answers come from the recording, not from anything typed in.</p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="edge-route">
          <div className="flex flex-col gap-3 rounded-md bg-panel p-7">
            <p className="text-sm tracking-wide text-muted">What you just saw</p>
            <p className="text-lg">
              A job failed twice, waited the planned time, and recorded one &ldquo;sent&rdquo; result. NEXUS showed every try from one
              read-only feed.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-md bg-panel p-7">
          <p className="text-reading">Want this for your own forms and emails?</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="metal">
              <a href={mailtoHref} className="btn-primary inline-flex min-h-13 items-center rounded-sm bg-route px-6 text-md font-semibold text-bg">Email Vincent</a>
            </span>
            <a href={CONSOLE_PATH} className="inline-flex min-h-12 items-center rounded-sm bg-raised px-5 text-md font-medium hover:bg-rule">
              Open the live console
            </a>
          </div>
          <p className="text-base text-muted">
            In the live console, look for: amber loops on the map (retries), Latest activity, and any run&apos;s &ldquo;Sent once?&rdquo;
            answer in its drawer. You can also send your own test enquiry there and watch it arrive.
          </p>
        </div>
        <button type="button" onClick={onRestart} className="inline-flex min-h-11 items-center self-start text-md text-route underline underline-offset-4">
          Replay from the start
        </button>
      </div>
    </div>
  );
}
