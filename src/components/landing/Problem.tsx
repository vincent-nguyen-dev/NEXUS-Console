// What a background job is and what a quiet failure costs, then why Northstar's enquiry starts three
// jobs. The usability gate asked for exactly this context before the details.
import { GUIDED_WF } from '../../lib/guided';
import { roles } from '../../lib/hero';
import { stepLabel, stepSpec } from '../../lib/workflow';
import { ToneIcon, type IconTone } from '../ToneIcon';

const CARDS: { tone: IconTone; title: string; text: string; featured?: boolean }[] = [
  {
    tone: 'lead', title: 'Someone sends your form',
    text: 'An enquiry is saved. The page says thanks, the visitor leaves, and three jobs start behind the scenes.',
  },
  {
    tone: 'retry', title: 'A job fails, quietly', featured: true,
    text: 'The email service is down for a minute. Without a retry, the enquiry sits unanswered. With a careless one, your team gets the same email twice. Usually, nobody knows which happened.',
  },
  {
    tone: 'ok', title: 'NEXUS shows every one',
    text: 'Every job, every try, how long each wait really was, and whether the email went out exactly once.',
  },
];

// The recording's three jobs, by their role (the recording's own description names them).
const ROLE = roles(GUIDED_WF);

const WHY = [
  { label: stepLabel(GUIDED_WF, ROLE.team), text: stepSpec(GUIDED_WF, ROLE.team).purpose },
  { label: stepLabel(GUIDED_WF, ROLE.visitor), text: stepSpec(GUIDED_WF, ROLE.visitor).purpose },
  { label: stepLabel(GUIDED_WF, ROLE.deletion), text: stepSpec(GUIDED_WF, ROLE.deletion).purpose },
];

function Card({ tone, title, text }: { tone: IconTone; title: string; text: string }) {
  return (
    <>
      <ToneIcon tone={tone} className="h-5 w-5" />
      <h3 className="font-display text-2xl font-semibold">{title}</h3>
      <p className="text-md">{text}</p>
    </>
  );
}

export function Problem() {
  return (
    <section id="how" aria-labelledby="how-title" className="flex scroll-mt-6 flex-col gap-8 pb-24">
      <div className="flex flex-col gap-8">
        <div className="flex max-w-[760px] flex-col gap-4">
          <h2 id="how-title" className="font-display text-xl font-semibold min-[720px]:text-5xl">The part of your website nobody watches</h2>
          <p className="text-reading">
            Your site doesn&apos;t stop when the form says &ldquo;Thanks&rdquo;. Jobs keep running after the visitor has gone, and if one
            fails, nothing on the screen tells anyone.
          </p>
        </div>
        <ol className="grid gap-4 min-[720px]:grid-cols-3">
          {CARDS.map((c) => (
            <li key={c.title} className={c.featured ? 'edge-retry' : 'rounded-md bg-panel'}>
              <div className={`flex h-full flex-col gap-2.5 p-6 ${c.featured ? 'rounded-md bg-raised' : ''}`}>
                <Card tone={c.tone} title={c.title} text={c.text} />
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-4 rounded-md bg-panel p-6">
        <h3 className="font-display text-2xl font-semibold">On Northstar&apos;s site, one enquiry starts three jobs:</h3>
        <ul className="grid gap-4 min-[720px]:grid-cols-3">
          {WHY.map((w) => (
            <li key={w.label} className="text-md"><b className="font-semibold">{w.label}:</b> {w.text}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
