// What I can build (step 5.4c, S6, board F-3): three services, each with an example from this project and
// "Get in touch". No prices. Websites don't claim "fast" or "accessible": nothing has measured Northstar for either.
import { mailtoHref } from '../../lib/credits';
import { ArrowLink } from './ArrowLink';

const SERVICES = [
  {
    title: 'Job reliability',
    text: 'Retries designed not to send twice, a record that shows whether one did, and an alert when a job gives up.',
    like: "Like Northstar's queue and this console.",
  },
  {
    title: 'Websites for small teams',
    text: 'Sites with the backend they need: forms, a job queue, a database.',
    like: 'Like Northstar Digital.',
  },
  {
    title: 'AI features and scripts',
    text: 'Assistants, document tools and the automations behind them.',
    like: "Like Northstar's quote assistant, priced by the server.",
  },
];

export function Services() {
  return (
    <section aria-labelledby="services-title" className="flex flex-col gap-5 pb-24">
      <div className="flex flex-col gap-3">
        <h2 id="services-title" className="font-display text-xl font-semibold min-[720px]:text-5xl">What I can build for you</h2>
        <p className="text-md text-muted">No packages or prices here: every job is different. Tell me what yours does.</p>
      </div>
      <ol className="grid gap-4.5 min-[1100px]:grid-cols-3">
        {SERVICES.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-3 rounded-md border border-glass bg-panel p-7">
            <span aria-hidden="true" className="font-display text-[22px] leading-none font-semibold text-route">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="font-display text-2xl font-semibold min-[720px]:text-[30px]">{s.title}</h3>
            <p className="text-reading">{s.text}</p>
            <p className="text-sm text-muted">{s.like}</p>
            <div className="mt-auto pt-2">
              <ArrowLink href={mailtoHref}>Get in touch<span className="sr-only"> about {s.title.toLowerCase()}</span></ArrowLink>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
