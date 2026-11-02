// "What's inside the console" on /how (step 5.4b, board F-2): five questions, each answered by the console's own
// component fed the 22 Oct recording (no extra requests). The component bleeds past the card's bottom-right edge on
// its own raised surface; its text stays inside that surface's padding, so only the surface is cut.
import { useState, type ReactNode } from 'react';
import { buildKpis } from '../../lib/kpis';
import { formatUtcDay, formatUtcTime, uniquePrefixes } from '../../lib/format';
import { GUIDED_META, GUIDED_PAGE, GUIDED_RUN, GUIDED_WF } from '../../lib/guided';
import { chainText, runChain } from '../../lib/runDetail';
import { CONSOLE_PATH } from '../../lib/routes';
import { latestRuns } from '../../lib/signalsFeed';
import { primaryStep, stepLabel } from '../../lib/workflow';
import { FreshnessBadge } from '../FreshnessBadge';
import { KpiTile } from '../KpiStrip';
import { RunRoute } from '../RunRoute';
import { LatestRunRow } from '../SignalsFeed';
import { MapLegend } from '../map/MapLegend';

const TEAM = primaryStep(GUIDED_WF);
const RECORDING_HREF = `${CONSOLE_PATH}?mode=guided`;
const KPI = buildKpis(
  [GUIDED_RUN], false,
  { win: 'all', source: 'recording', fileName: null, asOf: GUIDED_PAGE.now, capturedAt: GUIDED_META.captured_at },
  GUIDED_WF,
).find((k) => k.id === 'first_try');
const ROW = latestRuns([GUIDED_RUN], GUIDED_WF, { step: null, attempt: null }).rows[0];
const SHORT = uniquePrefixes([GUIDED_RUN.run_id]).get(GUIDED_RUN.run_id) ?? GUIDED_RUN.run_id;
const DAY = formatUtcDay(GUIDED_RUN.created_at);
const NOOP = () => {};

/**
 * Places at 1100 px and wider (12 columns), paired by height: the tall route takes two rows on the right beside the
 * pill and the number; the run's row and the key share the last row. 2 columns from 720 px, 1 on phones.
 */
const PLACE = {
  left: 'min-[1100px]:col-span-7 min-[1100px]:col-start-1',
  tall: 'min-[1100px]:col-span-5 min-[1100px]:col-start-8 min-[1100px]:row-span-2 min-[1100px]:row-start-1',
  wide: 'min-[1100px]:col-span-7',
  narrow: 'min-[720px]:col-span-2 min-[1100px]:col-span-5',
} as const;

function Tile({ place, title, text, children }: { place: keyof typeof PLACE; title: string; text: string; children: ReactNode }) {
  return (
    <li className={`flex min-h-60 flex-col gap-2 overflow-hidden rounded-md border border-glass bg-panel px-6 pt-6 ${PLACE[place]}`}>
      <h3 className="font-display text-2xl font-semibold">{title}</h3>
      <p className="max-w-[44ch] text-md text-muted">{text}</p>
      {children}
    </li>
  );
}

/** The real component on its raised surface, pushed 16 px past the card's right and bottom edges. */
function Bleed({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`-mr-10 mt-auto ml-auto max-w-[calc(100%+16px)] translate-y-4 rounded-md border border-glass bg-raised pt-4 pr-10 pb-10 pl-4 ${className}`}>
      {children}
    </div>
  );
}

export function Bento() {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="bento-title" className="flex flex-col gap-6 pb-24">
      <div className="flex max-w-[760px] flex-col gap-3.5">
        <h2 id="bento-title" className="font-display text-xl font-semibold min-[720px]:text-5xl">What&apos;s inside the console</h2>
        <p className="text-reading">Five questions the console answers, each with its own piece of the console.</p>
      </div>
      <ul className="grid gap-4 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-12">
        <Tile place="left" title="Is it live?" text="Says where its numbers come from, and never claims “now” when it can’t. Fed the recording, it says so.">
          <Bleed>
            <FreshnessBadge status={{ kind: 'recorded', ageMs: null, retryInMs: null, error: null }} recordedDay={DAY} onResume={NOOP} />
          </Bleed>
        </Tile>
        <Tile place="left" title="How sure is a number?" text="Below a minimum it says so, instead of guessing from one run.">
          {KPI && <Bleed className="w-[300px]"><dl><KpiTile k={KPI} bars={null} delta={null} onFocus={undefined} /></dl></Bleed>}
        </Tile>
        <Tile place="tall" title="Where did it wait?" text="Every try and every real wait, drawn from the run.">
          <Bleed className="w-[300px]">
            <RunRoute run={GUIDED_RUN} kind={TEAM} wf={GUIDED_WF} />
            <p className="sr-only">{chainText(runChain(GUIDED_RUN, TEAM, GUIDED_WF))}</p>
          </Bleed>
        </Tile>
        <Tile place="wide" title="What happened to this run?" text={`One row per run, told by its ${stepLabel(GUIDED_WF, TEAM).toLowerCase()}.`}>
          {ROW && (
            <Bleed className="w-full">
              <ol>
                <LatestRunRow
                  r={ROW} short={SHORT} when={formatUtcTime} watched={false} traced={false} open={open}
                  onToggle={() => setOpen((o) => !o)} onOpenRun={(id) => window.location.assign(`${RECORDING_HREF}&run=${id}`)}
                  onPin={undefined} onPreviewRun={NOOP}
                />
              </ol>
            </Bleed>
          )}
        </Tile>
        <Tile place="narrow" title="What does each shape mean?" text="A shape for every outcome, never colour alone.">
          <Bleed className="w-full"><MapLegend /></Bleed>
        </Tile>
      </ul>
      <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
        Every tile is the console&apos;s own component, from the {DAY.replace(/ \d{4}$/, '')} recording.
        <a href={RECORDING_HREF} className="inline-flex min-h-11 items-center text-route underline underline-offset-2">Open the recording in the console</a>
      </p>
    </section>
  );
}
