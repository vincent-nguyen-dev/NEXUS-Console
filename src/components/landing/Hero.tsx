// The hero: the product's name first (the usability gate found the old headline drowned it out), then
// the hook, what a background job is, the two ways in, and one recorded enquiry that plays (step 5.3a).
import { GUIDED_RUN, GUIDED_WF } from '../../lib/guided';
import { heroModel } from '../../lib/hero';
import { CONSOLE_PATH, STORY_HREF } from '../../lib/routes';
import { NexusMark } from '../NexusMark';
import { workflowMesh } from '../../lib/heroMesh';
import { ArrowLink } from './ArrowLink';
import { HeroReplay, type HeroReplayState } from './HeroReplay';
import { MeshCanvas } from './MeshCanvas';

const MODEL = heroModel(GUIDED_RUN, GUIDED_WF);
/** The recorded workflow among 80 neighbours (the lab's Dense was 46; the user asked for more, 2026-10-30). */
const MESH = workflowMesh(GUIDED_RUN, GUIDED_WF, 80);

export function Hero({ onReplay, pulse = null }: { onReplay?: (s: HeroReplayState) => void; pulse?: { edge: number; key: number } | null }) {
  return (
    // Side by side only from 1360 px: the figure's 14 px labels need about 700 px to stay 14 px.
    <section aria-labelledby="hero-title" className="relative isolate grid gap-10 pt-6 pb-20 min-[1100px]:pt-10 min-[1100px]:pb-24 min-[1360px]:grid-cols-[minmax(0,460px)_minmax(0,1fr)] min-[1360px]:items-center min-[1360px]:gap-14">
      <div className="flex flex-col gap-6">
        <h1 id="hero-title" className="flex flex-col gap-4">
          <span className="rise flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-3 font-display text-xl font-semibold tracking-[0.04em] min-[720px]:text-5xl">
              <NexusMark size={36} className="min-[720px]:h-12 min-[720px]:w-12" />
              NEXUS
            </span>{' '}
            <span className="text-reading font-normal text-muted">Workflow operations console</span>
          </span>{' '}
          <span className="rise-2 font-display text-4xl font-semibold tracking-[-0.02em] min-[720px]:text-6xl">
            Background jobs fail quietly.
          </span>
        </h1>
        {/* The plain definition comes first (checkpoint B, T1): "workflow operations console" meant nothing until it. */}
        <p className="rise-3 max-w-[34rem] text-reading">
          A background job is the work your website does after a visitor leaves, like emailing your team about their enquiry.
          When one fails, nothing on the page tells you.
        </p>
        <p className="rise-3 text-lg font-medium min-[720px]:text-3xl">
          NEXUS shows what ran, what retried, and whether anything was sent twice.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-7 gap-y-4">
          <span className="metal">
            <a href={STORY_HREF} className="btn-primary inline-flex min-h-13 items-center rounded-sm bg-route px-6 text-md font-semibold text-bg">
              See it solve a real failure
            </a>
          </span>
          <ArrowLink href={CONSOLE_PATH}>Open the live console</ArrowLink>
        </div>
      </div>

      <HeroReplay model={MODEL} onState={onReplay} />
      {/* The workflow behind the hero, 720 px and wider: it reaches the page's edges, decoration only. */}
      <MeshCanvas mesh={MESH} tone="hero" pulse={pulse} className="inset-y-0 -inset-x-10 hidden min-[720px]:block min-[1100px]:-inset-x-16" />
    </section>
  );
}
