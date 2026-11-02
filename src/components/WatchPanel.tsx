// "Send your own test enquiry and watch it arrive": one line at rest, the steps on request, and a plain card
// (the map is the screen's one featured card) while watching that lists every run created since then. The live console only, once the feed has described its jobs.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CONNECTED } from '../lib/connected';
import type { FeedStatus } from '../lib/feedStatus';
import { uniquePrefixes } from '../lib/format';
import type { Run, RunsPage } from '../lib/types';
import { arrivalView, checkText, howTo, watchingText } from '../lib/watch';
import { ToneIcon } from './ToneIcon';
import { useKeepFocus } from '../hooks/useKeepFocus';

interface Props {
  page: RunsPage;
  runs: Run[];
  /** Runs created since the watch started, newest first. */
  arrived: Run[];
  sinceMs: number | null;
  status: FeedStatus;
  /** Starts (or restarts) the watch at the server's time now. */
  onStart: () => void;
  onStop: () => void;
  onOpenRun: (runId: string) => void;
}

const linkClass = 'min-h-11 rounded-sm px-1 text-base text-route underline underline-offset-2';
const buttonClass = 'inline-flex min-h-11 items-center rounded-sm px-4 text-base font-medium';

/**
 * The landing page's "Break it yourself" door links to `/console#watch`. The panel appears only once the feed has
 * loaded, after the browser has given up on the hash, so it scrolls itself into view, opens its steps and takes focus,
 * once per page load. The visitor still starts the watch with the form button.
 */
let hashHandled = false;
const arrivedByLink = () => !hashHandled && window.location.hash === '#watch';

export function WatchPanel({ page, runs, arrived, sinceMs, status, onStart, onStop, onOpenRun }: Props) {
  const [open, setOpen] = useState(arrivedByLink);
  const section = useRef<HTMLElement>(null);
  // Starting, stopping or the first arrival replaces the panel's controls: focus stays in the panel (7.1c, F6).
  useKeepFocus(undefined, section);
  useEffect(() => {
    if (!arrivedByLink()) return;
    hashHandled = true;
    section.current?.focus({ preventScroll: true });
    section.current?.scrollIntoView({ block: 'start' });
  }, []);
  const wf = page.workflow;
  const prefixes = useMemo(() => uniquePrefixes(runs.map((r) => r.run_id)), [runs]);
  const view = sinceMs === null ? null : arrivalView(arrived, sinceMs, page.now, wf, prefixes);

  const formLink = (
    <a
      href={CONNECTED.form} target="_blank" rel="noopener" onClick={onStart}
      className={`${buttonClass} bg-route text-bg`}
    >
      Open {CONNECTED.name}&apos;s form<span aria-hidden="true">&nbsp;↗</span><span className="sr-only"> (opens a new tab)</span>
    </a>
  );
  const steps = (
    <ol className="flex max-w-[75ch] list-decimal flex-col gap-2 pl-5 text-base">
      {howTo(wf).map((line) => <li key={line}>{line}</li>)}
    </ol>
  );

  if (sinceMs === null || view === null) {
    return (
      <section ref={section} tabIndex={-1} aria-labelledby="watch-title" id="watch" className="flex scroll-mt-6 flex-col gap-3 outline-none">
        <p className="flex flex-wrap items-center gap-x-3 text-base">
          <span className="flex min-w-0 flex-[1_1_220px] items-center gap-3 min-[720px]:flex-none">
            <ToneIcon tone="lead" />
            <span id="watch-title">Send your own test {wf.trigger.one} and watch it arrive here.</span>
          </span>
          <button type="button" aria-expanded={open} aria-controls="watch-steps" onClick={() => setOpen(!open)} className={linkClass}>
            {open ? 'Hide how it works' : 'How it works'}
          </button>
        </p>
        {open && (
          <div id="watch-steps" className="flex flex-col gap-4 rounded-md bg-panel p-5">
            {steps}
            <div>{formLink}</div>
          </div>
        )}
      </section>
    );
  }

  const found = view.rows.length > 0;
  return (
    <section ref={section} tabIndex={-1} aria-labelledby="watch-title" id="watch" className="scroll-mt-6 outline-none">
      <div className="flex flex-col gap-3 rounded-md bg-panel p-5">
        {/* The heading changes only when the number of arrivals does, so it's the live region; the ticking check line isn't. */}
        <div aria-live="polite">
          <h2 id="watch-title" className="font-display text-lg font-semibold text-route">
            {found ? view.heading : watchingText(sinceMs, wf)}
          </h2>
        </div>
        <p className="text-sm text-muted">{found ? `${watchingText(sinceMs, wf)} ${checkText(status)}` : checkText(status)}</p>

        {found ? (
          <>
            <ul className="flex flex-col">
              {view.rows.map((r) => (
                <li key={r.runId} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-t border-rule py-3">
                  <div className="flex min-w-0 flex-[1_1_320px] gap-3">
                    <ToneIcon tone="lead" className="mt-1" />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted">{r.line}</span>
                      <span className="text-base">{r.headline}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => onOpenRun(r.runId)} className={`${buttonClass} border border-route text-route`}>
                    Open its run
                  </button>
                </li>
              ))}
            </ul>
            {view.more !== null && <p className="text-sm text-muted">{view.more}</p>}
            <p className="max-w-[75ch] text-sm text-muted">
              NEXUS can&apos;t tell whose it is: it never sees names or addresses, so every {wf.trigger.one} since you started
              watching is listed.
            </p>
          </>
        ) : (
          <>
            <p className="max-w-[75ch] text-base">
              Not here yet? If {CONNECTED.name}&apos;s form said your message reached its demo server, it appears at the next check.
            </p>
            <details className="text-base">
              <summary className="min-h-11 cursor-pointer py-2 text-route">How it works</summary>
              <div className="flex flex-col gap-4 pt-2">{steps}<div>{formLink}</div></div>
            </details>
          </>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          {found && (
            <button type="button" onClick={onStart} className={`${buttonClass} border border-route text-route`}>Watch for another</button>
          )}
          <button type="button" onClick={onStop} className={`${buttonClass} bg-raised hover:bg-rule`}>Stop watching</button>
        </div>
      </div>
    </section>
  );
}
