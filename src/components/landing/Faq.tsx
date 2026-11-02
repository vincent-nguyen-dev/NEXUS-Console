// Questions on /how (step 5.4b, board F-2): hairlines between questions, no boxes. Each question is a real button
// with aria-expanded; its answer's height slides open (grid rows 0fr → 1fr, 240 ms) and the + turns into × (300 ms).
// A closed answer is inert, so its links stay out of the tab order. Reduced motion opens it at once.
import { useState, type ReactNode } from 'react';
import { CONNECT_PATH, CONSOLE_PATH } from '../../lib/routes';

const link = 'text-route underline underline-offset-2';

const QUESTIONS: { q: string; a: ReactNode }[] = [
  {
    q: 'Is this real data?',
    a: (
      <>
        Yes. Northstar is a live demo site with a real backend; every run is a real enquiry from its owner or a visitor, including
        one scheduled test a day. The email failures so far come from a test switch that makes tries 1 and 2 fail on
        purpose. NEXUS names the cause of every failure, so a real one would show as itself. The visitor confirmation is
        always simulated.
      </>
    ),
  },
  {
    q: 'Can I connect my own system?',
    a: (
      <>
        Yes: it publishes one read-only feed of what its jobs did. <a href={CONNECT_PATH} className={link}>The connect page</a> has
        the contract, and you can <a href={`${CONSOLE_PATH}?mode=file`} className={link}>try a file of your own</a>.
      </>
    ),
  },
  {
    q: 'Why does Northstar take a minute?',
    a: <>Its free hosting sleeps after 15 minutes without visitors and takes about a minute to wake. This page wakes it while you read.</>,
  },
];

export function Faq() {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
  const toggle = (i: number) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  });
  return (
    <section aria-labelledby="faq-title" className="flex flex-col gap-6 pb-24">
      <h2 id="faq-title" className="font-display text-xl font-semibold min-[720px]:text-5xl">Questions</h2>
      <ul className="max-w-[920px] border-b border-rule">
        {QUESTIONS.map(({ q, a }, i) => {
          const isOpen = open.has(i);
          return (
            <li key={q} className="border-t border-rule">
              <h3>
                <button
                  type="button" id={`faq-q-${i}`} aria-expanded={isOpen} aria-controls={`faq-a-${i}`} onClick={() => toggle(i)}
                  className="flex min-h-16 w-full items-center justify-between gap-4 text-left font-display text-2xl font-semibold hover:text-route"
                >
                  {q}
                  <span aria-hidden="true" className="faq-plus shrink-0 font-sans text-[28px] leading-none font-normal text-route">+</span>
                </button>
              </h3>
              <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} data-open={isOpen || undefined} inert={!isOpen} className="faq-answer">
                <div>
                  <p className="max-w-[70ch] pb-5.5 text-reading">{a}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
