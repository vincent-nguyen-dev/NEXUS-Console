// How NEXUS gets its data, what is real in this demo, and the same chain for a visitor's own system
// (the offer, drawn dashed because it isn't connected).
import { CONNECT_PATH } from '../../lib/routes';
import { ToneIcon, type IconTone } from '../ToneIcon';

const NORTHSTAR = 'https://northstar-demodigital.netlify.app';

const CONNECTED = [
  { title: "Northstar's contact form", note: 'a visitor sends an enquiry' },
  { title: 'Its background jobs', note: 'notify the team, confirm, delete data later' },
  { title: 'One read-only feed', note: 'what ran, every try, every result' },
  { title: 'NEXUS', note: 'shows it, live, in plain words' },
];

const YOURS = [
  { title: 'Your forms and checkout', note: 'or bookings, sign-ups, invoices' },
  { title: 'Your emails and automations', note: 'the jobs nobody watches' },
  { title: 'A feed like this one', note: 'added to your system, read-only' },
  { title: 'A view like NEXUS', note: 'for you and your team' },
];

const REAL: { tone: IconTone; text: string }[] = [
  { tone: 'ok', text: 'Northstar Digital is a live website with a real backend, built as a demo for a fictional agency.' },
  { tone: 'ok', text: "Every run is a real enquiry sent through its contact form, by the site's owner or by a visitor trying it, including one scheduled test a day." },
  { tone: 'retry', text: 'The email failures are on purpose: a test switch makes the email service fail tries 1 and 2.' },
  { tone: 'neutral', text: "No names, emails or messages are shown. The feed doesn't contain any." },
];

function Arrow({ dashed }: { dashed: boolean }) {
  return (
    <svg width="48" height="20" viewBox="0 0 48 20" aria-hidden="true" className={`shrink-0 rotate-90 min-[1100px]:rotate-0 ${dashed ? 'text-track' : 'text-route'}`}>
      <path d="M2 10H40" stroke="currentColor" strokeWidth="3" strokeDasharray={dashed ? '6 6' : undefined} />
      <path d="M36 4l8 6-8 6" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

function Chain({ boxes, dashed }: { boxes: { title: string; note: string }[]; dashed: boolean }) {
  const box = dashed ? 'rounded-md border-2 border-dashed border-track' : 'rounded-md bg-panel ring-1 ring-rule ring-inset';
  return (
    // Boxes and arrows share one grid, so every box gets the same width and height.
    <ol className="grid justify-items-center gap-2 min-[1100px]:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] min-[1100px]:items-stretch min-[1100px]:gap-3">
      {boxes.flatMap((b, i) => [
        ...(i > 0 ? [<li key={`arrow-${b.title}`} aria-hidden="true" className="self-center"><Arrow dashed={dashed} /></li>] : []),
        <li key={b.title} className={`flex w-full flex-col gap-1 px-5 py-4 ${box}`}>
          <span className="text-base font-semibold">{b.title}</span>
          <span className="text-sm text-muted">{b.note}</span>
        </li>,
      ])}
    </ol>
  );
}

export function Connect() {
  return (
    <section aria-labelledby="connect-title" className="flex flex-col gap-7 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-3">
        <div className="flex max-w-[760px] flex-col gap-3.5">
          <h2 id="connect-title" className="font-display text-xl font-semibold min-[720px]:text-5xl">How it connects</h2>
          <p className="text-reading">
            NEXUS never touches your customers&apos; details. Your system publishes one read-only feed of what its jobs did; NEXUS
            reads it and draws it.
          </p>
        </div>
        <a href={CONNECT_PATH} className="inline-flex min-h-11 items-center text-md font-medium underline underline-offset-[6px] hover:text-route">
          How it&apos;s built
        </a>
      </div>

      <div className="edge-route">
        <div className="flex flex-col gap-4 rounded-md bg-panel px-5 py-6 min-[720px]:px-7">
          <p className="flex flex-wrap items-center gap-x-2.5 text-base font-semibold">
            <ToneIcon tone="ok" />
            Connected now: <a href={NORTHSTAR} className="text-route underline underline-offset-2">Northstar Digital</a>
            <span className="font-normal text-muted">· a demo agency site with a real backend</span>
          </p>
          <Chain boxes={CONNECTED} dashed={false} />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-md bg-panel p-6 min-[720px]:px-7">
        <h3 className="font-display text-2xl font-semibold">What&apos;s real here</h3>
        <ul className="grid gap-x-10 gap-y-3 min-[1100px]:grid-cols-2">
          {REAL.map((r) => (
            <li key={r.text} className="flex items-start gap-3 text-md"><ToneIcon tone={r.tone} className="mt-1" />{r.text}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4 px-0 pt-2 min-[720px]:px-7">
        <p className="text-base font-semibold">
          Your system <span className="font-normal text-muted">· what I&apos;d build for you (not connected; this part is the offer)</span>
        </p>
        <Chain boxes={YOURS} dashed />
      </div>
    </section>
  );
}
