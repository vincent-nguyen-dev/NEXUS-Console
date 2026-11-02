// The three ways in (step 5.4c, board F-1): the recorded story for newcomers, the live console for anyone who wants
// the real thing, and a test of their own ("Break it yourself", which opens the console's watch panel). Each card is
// one link (the expanding arrow, stretched over the card). Northstar's numbers sit in their own row above.
import type { ReactNode } from 'react';
import { CONNECTED } from '../../lib/connected';
import { CONSOLE_PATH, STORY_HREF, WATCH_HREF } from '../../lib/routes';
import { ArrowLink } from './ArrowLink';

function Door({ eyebrow, title, href, action, featured = false, children }: {
  eyebrow: string; title: string; href: string; action: string; featured?: boolean; children: ReactNode;
}) {
  const card = (
    <div className="group relative flex h-full flex-col gap-3 rounded-md border border-glass bg-panel p-7">
      <span className="text-sm tracking-wide text-muted">{eyebrow}</span>
      <h3 className="font-display text-xl font-semibold min-[720px]:text-4xl">{title}</h3>
      <p className="text-md">{children}</p>
      <div className="mt-auto pt-2"><ArrowLink href={href} stretch>{action}</ArrowLink></div>
    </div>
  );
  return <li className={featured ? 'edge-route' : undefined}>{card}</li>;
}

export function Doors() {
  return (
    <section aria-labelledby="doors-title" className="flex flex-col gap-5 pb-24">
      <h2 id="doors-title" className="font-display text-xl font-semibold min-[720px]:text-5xl">Three ways in</h2>
      <ul className="grid gap-4.5 min-[1100px]:grid-cols-3">
        <Door eyebrow="About 2 minutes · a recording" title="See it solve a real failure" href={STORY_HREF} action="Watch the story" featured>
          Replay one enquiry from 22 October: two failed tries, two waits, sent on try 3. Then check three answers against the
          data yourself.
        </Door>
        <Door eyebrow="Live · read-only" title="Open the live console" href={CONSOLE_PATH} action="Open the console">
          The same view on {CONNECTED.name}&apos;s real jobs, updated every 30 seconds while you look.
        </Door>
        <Door eyebrow="About 1 minute · your own test" title="Break it yourself" href={WATCH_HREF} action="Send a test enquiry">
          Send Northstar a test enquiry with the outage switch on, then watch NEXUS catch it. {CONNECTED.ownerNote}
        </Door>
      </ul>
    </section>
  );
}
