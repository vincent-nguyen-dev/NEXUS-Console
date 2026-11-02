// The landing pages' header: the wordmark, three links (the current page marked) and the status chip. On
// phones the links wrap into a row under the wordmark (no menu button: nothing hidden, no disclosure to manage).
// /connect uses it too, without the chip: no request, and none of the chip's code (checkpoint B, C2).
import type { ReactNode } from 'react';
import { CONSOLE_PATH, HOW_PATH, WORK_PATH } from '../../lib/routes';
import { NexusMark } from '../NexusMark';

/** Which landing page is showing. Home has no link of its own: the wordmark is home. */
export type LandingPageId = 'home' | 'how' | 'work';

const LINKS: { href: string; label: string; page?: LandingPageId }[] = [
  { href: HOW_PATH, label: 'How it works', page: 'how' },
  { href: CONSOLE_PATH, label: 'Live console' },
  { href: WORK_PATH, label: 'Work with me', page: 'work' },
];

export function LandingHeader({ chip, current }: { chip?: ReactNode; current?: LandingPageId }) {
  return (
    <header className="relative flex flex-wrap items-center justify-between gap-x-12 gap-y-3 py-4 min-[720px]:py-7">
      <div className="flex flex-wrap items-center gap-x-12 gap-y-1">
        <a href="/" aria-current={current === 'home' ? 'page' : undefined} className="flex min-h-11 items-center gap-2.5 rounded-sm font-display text-3xl font-semibold tracking-[0.04em]">
          <NexusMark size={24} />
          NEXUS
        </a>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-5 min-[720px]:gap-x-7">
            {LINKS.map((l) => {
              const here = l.page !== undefined && l.page === current;
              return (
                <li key={l.href}>
                  <a
                    href={l.href}
                    aria-current={here ? 'page' : undefined}
                    className={`relative inline-flex min-h-11 items-center text-md ${here ? 'text-ink' : 'text-muted hover:text-ink'}`}
                  >
                    {/* The dot sits in the gap before the link, so marking a page never makes the row wrap. */}
                    {here && <span aria-hidden="true" className="absolute top-1/2 -left-3 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-route shadow-[0_0_8px_var(--color-route)]" />}
                    {l.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      {chip}
    </header>
  );
}
