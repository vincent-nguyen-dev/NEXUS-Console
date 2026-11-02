// The guided story at /story: five beats through one recorded run. The beat is in the URL (Back and
// Forward walk it); answers live here for the session only, so a reload shows them as not answered.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBeat } from '../../hooks/useBeat';
import { formatUtcDay } from '../../lib/format';
import { GUIDED_RUN, GUIDED_WF } from '../../lib/guided';
import { replayModel } from '../../lib/replay';
import { BEATS, type Answers, type QuestionId } from '../../lib/story';
import type { StepKind } from '../../lib/types';
import { SiteFooter } from '../SiteFooter';
import { BeatRecovery } from './BeatRecovery';
import { BeatScene } from './BeatScene';
import { BeatSentOnce } from './BeatSentOnce';
import { BeatVerdict } from './BeatVerdict';
import { BeatWatch } from './BeatWatch';
import { StoryHeader } from './StoryHeader';

const RUN = GUIDED_RUN;
// "22 Oct": the chip and the clock name the day, never a live time.
const RECORDED_DAY = formatUtcDay(RUN.created_at).split(' ').slice(0, 2).join(' ');

export function Story() {
  const [beat, go] = useBeat();
  const model = useMemo(() => replayModel(RUN, GUIDED_WF), []);
  const [answers, setAnswers] = useState<Answers>({});
  const [picked, setPicked] = useState<StepKind | null>(null);
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  const reveal = (n: number) => setRevealed(new Set([...revealed, n]));
  const answer = (id: QuestionId, value: string) => setAnswers({ ...answers, [id]: value });
  const title = BEATS[beat - 1]?.title ?? '';

  // A new beat: its heading takes focus and the page starts at the top. Not on the first load.
  // Compared with the last beat, not a "first run" flag: StrictMode runs effects twice on mount.
  const shownBeat = useRef(beat);
  useEffect(() => {
    document.title = `Step ${beat} of ${BEATS.length} · ${title} · NEXUS`;
    if (shownBeat.current === beat) return;
    shownBeat.current = beat;
    window.scrollTo(0, 0);
    document.getElementById('beat-title')?.focus();
  }, [beat, title]);

  const restart = () => {
    setAnswers({});
    setPicked(null);
    setRevealed(new Set());
    go(1);
  };
  const nextTitle = BEATS[beat]?.title;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded-sm focus:bg-raised focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div aria-hidden="true" className="light light-teal light-drift -top-80 -right-80 h-[560px] w-[560px] min-[720px]:-top-[280px] min-[720px]:-right-[260px] min-[720px]:h-[900px] min-[720px]:w-[900px]" />
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 min-[720px]:px-10 min-[1100px]:px-16">
        <StoryHeader beat={beat} recordedDay={RECORDED_DAY} />
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col gap-10 border-t border-rule pt-8 pb-12 min-[720px]:pt-12">
          {beat === 1 && (
            <BeatScene run={RUN} picked={picked} revealed={revealed.has(1)} onPick={(k) => { setPicked(k); reveal(1); }} onSkip={() => reveal(1)} />
          )}
          {beat === 2 && <BeatWatch model={model} recordedDay={RECORDED_DAY} />}
          {beat === 3 && (
            <BeatRecovery run={RUN} model={model} answers={answers} onAnswer={answer} revealed={revealed.has(3)} onReveal={() => reveal(3)} />
          )}
          {beat === 4 && <BeatSentOnce run={RUN} answers={answers} onAnswer={answer} revealed={revealed.has(4)} onReveal={() => reveal(4)} />}
          {beat === 5 && <BeatVerdict run={RUN} answers={answers} onRestart={restart} />}

          <nav aria-label="Story" className="mt-auto flex flex-wrap items-center gap-3 border-t border-rule pt-6">
            {beat > 1 && (
              <button type="button" onClick={() => go(beat - 1)} className="inline-flex min-h-12 items-center rounded-sm bg-raised px-5 text-md font-medium hover:bg-rule">
                Back
              </button>
            )}
            {nextTitle !== undefined && (
              <button type="button" onClick={() => go(beat + 1)} className="inline-flex min-h-12 items-center rounded-sm bg-route px-6 text-md font-semibold text-bg">
                Next: {nextTitle}
              </button>
            )}
          </nav>
        </main>
        <div className="flex flex-col gap-4 pb-8">
          <p className="text-sm text-muted">
            A frozen, anonymized recording of one real Northstar run, from {formatUtcDay(RUN.created_at)}. The visitor&apos;s details are
            never shown.
          </p>
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
