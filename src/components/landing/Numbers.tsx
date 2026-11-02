// Northstar's last 30 days in four tiles (step 5.4), right after the problem. Every value is a count from the
// feed with its n; while Northstar wakes, is unreachable or sent a cut-off window, the row says so instead.
import type { ReactNode } from 'react';
import { useCursorLight } from '../../hooks/useCursorLight';
import { numbersView, type LandingFeed, type Tile } from '../../lib/landing';
import { STORY_HREF } from '../../lib/routes';
import { Sep } from '../Sep';

function NumberTile({ t }: { t: Tile }) {
  const ref = useCursorLight<HTMLLIElement>();
  return (
    <li ref={ref} className="lit-card flex flex-col gap-1.5 rounded-md border border-glass bg-panel p-5">
      <span className="text-sm text-muted">{t.label}</span>
      <Sep text=": " />
      <span className="kpi-value font-display text-[32px] leading-none font-semibold whitespace-nowrap min-[720px]:text-[44px]">{t.value}</span>
      <Sep />
      <span className="text-sm text-muted">{t.note}</span>
    </li>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-glass bg-panel px-5 py-5 text-md">{children}</p>;
}

export function Numbers({ feed }: { feed: LandingFeed }) {
  const v = numbersView(feed);
  return (
    <section aria-labelledby="numbers-title" className="flex flex-col gap-4 pb-24">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
        <h2 id="numbers-title" className="font-display text-2xl font-semibold min-[720px]:text-[30px]">Northstar, last 30 days</h2>
        <span className="text-sm text-muted">
          test enquiries from the owner and from visitors{v.kind === 'tiles' ? ` · as of ${v.asOf}` : ''}
        </span>
      </div>
      <div>
        {v.kind === 'tiles' && (
          <ul className="grid grid-cols-2 gap-3.5 min-[1100px]:grid-cols-4">
            {v.tiles.map((t) => <NumberTile key={t.label} t={t} />)}
          </ul>
        )}
        {/* Only the row's state is announced (7.1b, F18): reading all four tiles at once ran them together. */}
        <div aria-live="polite">
          {v.kind === 'tiles' && <p className="sr-only">Northstar&apos;s numbers for the last 30 days are in.</p>}
          {v.kind === 'waiting' && <Note>Waking Northstar… its free server can take about a minute. The numbers appear here when it answers.</Note>}
          {v.kind === 'unavailable' && (
            <Note>
              Northstar can&apos;t be reached right now, so there are no live numbers. The{' '}
              <a href={STORY_HREF} className="text-route underline underline-offset-2">recorded run</a> still works.
            </Note>
          )}
          {v.kind === 'preview' && (
          <Note>
            This preview doesn&apos;t read Northstar: it answers only the production site. The{' '}
            <a href={STORY_HREF} className="text-route underline underline-offset-2">recorded run</a> works here.
          </Note>
        )}
        {v.kind === 'partial' && (
            <Note>Northstar sent only its newest 500 runs and this window has more, so it isn&apos;t counted here. The live console shows what it has.</Note>
          )}
          {v.kind === 'empty' && <Note>No enquiries in the last 30 days.</Note>}
        </div>
      </div>
    </section>
  );
}
