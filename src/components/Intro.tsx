// What NEXUS is, for a first-time visitor: the product first, then the system it's connected to.
// Dismissing it is remembered per browser (never in the URL, so a shared link still shows it).
import { useState } from 'react';
import { introDismissed, setIntroDismissed, type PrefStorage } from '../lib/prefs';
import { CONNECTED } from '../lib/connected';
import { STORY_HREF } from '../lib/routes';
import { useFocusOnReveal } from '../hooks/useFocusOnReveal';

function browserStorage(): PrefStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const buttonClass = 'min-h-11 rounded-sm px-4 text-base font-medium';

export function Intro() {
  const [dismissed, setDismissed] = useState(() => introDismissed(browserStorage()));
  const set = (value: boolean) => {
    setIntroDismissed(browserStorage(), value);
    setDismissed(value);
  };
  // The button pressed goes away with its card: focus moves to the other state's control (7.1c, F6).
  const again = useFocusOnReveal<HTMLButtonElement>(dismissed);
  const title = useFocusOnReveal<HTMLHeadingElement>(!dismissed);

  if (dismissed) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
        NEXUS · workflow operations console · connected now:{' '}
        <a className="text-route underline underline-offset-2" href={CONNECTED.site}>{CONNECTED.name}</a>, a demo agency site
        (fictional company) ·
        <button ref={again} type="button" onClick={() => set(false)} className="min-h-11 px-1 text-route underline underline-offset-2">
          What is this?
        </button>
      </p>
    );
  }

  // One card: what this is, one sentence, the two ways on (step 5.2, board D1).
  return (
    <section aria-labelledby="intro-title" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-glass bg-panel px-4 py-3.5 min-[720px]:gap-4 min-[720px]:px-5 min-[720px]:py-4">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
        <h2 id="intro-title" ref={title} tabIndex={-1} className="font-display text-lg font-semibold outline-none">Northstar&apos;s real runs, live.</h2>
        {/* Phones get two lines, so the map reaches the first screen; the source line above says it's test traffic. */}
        <p className="text-base text-muted min-[720px]:hidden">
          Every enquiry on {CONNECTED.name}&apos;s demo site and its three jobs, read live. New here? Start with the story.
        </p>
        <p className="hidden max-w-[70ch] text-base text-muted min-[720px]:block">
          Every enquiry sent on{' '}
          <a className="text-route underline underline-offset-2" href={CONNECTED.site}>{CONNECTED.name}</a>&apos;s demo site
          (a fictional company; test enquiries from the owner and from visitors), its three jobs and every try, read from its
          ops feed every 30 seconds while you look. New
          here? The story walks through one recorded failure first.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <a href={STORY_HREF} className={`${buttonClass} btn-primary inline-flex items-center bg-route text-bg`}>
          See it solve a real failure
        </a>
        <button type="button" onClick={() => set(true)} className={`${buttonClass} border border-route text-route`}>
          Explore live data
        </button>
      </div>
    </section>
  );
}
