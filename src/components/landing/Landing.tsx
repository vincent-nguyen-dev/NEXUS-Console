// The landing pages (step 5.4): Home `/` (the pitch: hero, problem, real numbers, the ways in), How it works
// `/how` (how NEXUS reads a system) and Work with me `/work` (who built it and for whom). They share one chunk,
// the header, the light and the pathway meshes. Each page asks Northstar once (the chip, and it wakes Render),
// then fetches the console's and the story's code while the visitor reads.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { pathwayMesh } from '../../lib/heroMesh';
import { useLandingFeed } from '../../hooks/useLandingFeed';
import type { LandingFeed } from '../../lib/landing';
import { SiteFooter } from '../SiteFooter';
import { Audience } from './Audience';
import { Bento } from './Bento';
import { Builder } from './Builder';
import { Connect } from './Connect';
import { CtaBand } from './CtaBand';
import { Doors } from './Doors';
import { Faq } from './Faq';
import { Hero } from './Hero';
import type { HeroReplayState } from './HeroReplay';
import { LandingHeader, type LandingPageId } from './LandingHeader';
import { MeshCanvas } from './MeshCanvas';
import { Numbers } from './Numbers';
import { Problem } from './Problem';
import { ScrollBand } from './ScrollBand';
import { Services } from './Services';
import { Spine } from './Spine';
import { StatusChip } from './StatusChip';
import { Terminal } from './Terminal';

const PREFETCH_FALLBACK_MS = 2000;
/** The CTA band's line: Home and /how say what I build; /work has just said it, so it asks. */
const PITCH = "I build this kind of reliability into small teams' sites: a record of every job, retries designed not to send twice, and an alert when one gives up.";
const ASK = 'Tell me what your site does after the visitor leaves.';
/** What happens after you write (owner's words, 2026-10-31). */
const NEXT = "Write a few lines about your site. I'll reply with questions, then a short plan of what I'd build. No cost to ask.";
/** The fainter "neural pathways" behind the other sections (user, 2026-10-30): one mesh each, no workflow. */
const PATHWAYS = [pathwayMesh(46, 11), pathwayMesh(40, 23), pathwayMesh(46, 37), pathwayMesh(40, 53)];

/** A section with a pathway mesh behind it (720 px and wider), reaching the page's edges (past the spine's gutter too). */
function WithPathway({ index, children }: { index: number; children: ReactNode }) {
  const mesh = PATHWAYS[index % PATHWAYS.length];
  return (
    <div className="relative isolate">
      {mesh && <MeshCanvas mesh={mesh} tone="pathway" ambient className="inset-y-0 -inset-x-10 hidden min-[720px]:block min-[1100px]:-right-16 min-[1100px]:-left-28" />}
      {children}
    </div>
  );
}

const TITLES: Record<LandingPageId, string> = {
  home: 'NEXUS · Workflow operations console',
  how: 'NEXUS · How it works',
  work: 'NEXUS · Work with me',
};

function usePrefetchAndTitle(page: LandingPageId) {
  useEffect(() => {
    document.title = TITLES[page];
    // Downloads (and caches) the console's and the story's chunks once the page is idle, so both doors open instantly.
    const prefetch = () => {
      void import('../../App');
      void import('../story/Story');
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetch);
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(prefetch, PREFETCH_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [page]);
}

/** What every landing page shares: the skip link, the light, the header, main and the footer. */
function LandingPage({ page, feed, children }: { page: LandingPageId; feed: LandingFeed; children: ReactNode }) {
  usePrefetchAndTitle(page);
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded-sm focus:bg-raised focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* The light: decoration only. On phones the teal peak sits off-screen, so no text lands on it. */}
      <div aria-hidden="true" className="light light-teal light-drift -top-80 -right-80 h-[560px] w-[560px] min-[720px]:-top-[300px] min-[720px]:-right-[220px] min-[720px]:h-[1100px] min-[720px]:w-[1100px]" />
      <div aria-hidden="true" className="light light-indigo light-drift-slow top-[360px] -left-80 hidden h-[900px] w-[900px] min-[720px]:block" />

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 min-[720px]:px-10 min-[1100px]:px-16">
        <LandingHeader chip={<StatusChip feed={feed} />} current={page} />
        <main id="main" tabIndex={-1} className="flex flex-col">
          {children}
        </main>
        <div className="pb-8">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}

/** `/`: the pitch, then the real numbers and the ways in. */
export function Home() {
  const feed = useLandingFeed();
  // The band follows the hero's replay: slower while it plays, lighting the promise of the current moment.
  const [replay, setReplay] = useState<HeroReplayState>({ playing: false, lit: null, shown: 0, attempt: null });
  // Each replay moment about the enquiry or a team try sends one pulse along its edge of the hero's mesh.
  const pulse = replay.shown > 0 && replay.attempt !== null ? { edge: replay.attempt, key: replay.shown } : null;
  // Below the band, only the numbers depend on state: the replay's moments don't re-render it (7.1d, P1).
  const below = useMemo(() => (
    <Spine>
      <WithPathway index={0}><Problem /></WithPathway>
      <Numbers feed={feed} />
      <WithPathway index={2}><Doors /></WithPathway>
      <CtaBand line={PITCH} workLink />
    </Spine>
  ), [feed]);
  return (
    <LandingPage page="home" feed={feed}>
      <Hero onReplay={setReplay} pulse={pulse} />
      <ScrollBand playing={replay.playing} lit={replay.lit} />
      {below}
    </LandingPage>
  );
}

/** `/how`: the same run three ways, how NEXUS reads a system (and what in this demo is real), the console's pieces, questions. */
export function How() {
  const feed = useLandingFeed();
  // The page doesn't depend on the feed (only the header's chip does), so its answer doesn't re-render it (7.1d, P1).
  const content = useMemo(() => (
    <Spine>
      <Terminal />
      <WithPathway index={1}><Connect /></WithPathway>
      <Bento />
      <WithPathway index={0}><Faq /></WithPathway>
      <CtaBand line={PITCH} workLink />
    </Spine>
  ), []);
  return (
    <LandingPage page="how" feed={feed}>
      <h1 className="sr-only">How it works</h1>
      {content}
    </LandingPage>
  );
}

/** `/work`: who built NEXUS, the proof, what I can build, and who it's for. */
export function Work() {
  const feed = useLandingFeed();
  const content = useMemo(() => (
    <Spine>
      <WithPathway index={3}><Builder /></WithPathway>
      <Services />
      <Audience />
      <CtaBand line={ASK} workLink={false} after={NEXT} />
    </Spine>
  ), []);
  return (
    <LandingPage page="work" feed={feed}>
      {content}
    </LandingPage>
  );
}
