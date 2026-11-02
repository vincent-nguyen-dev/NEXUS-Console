// /connect: what a system has to publish for NEXUS to draw it. Written for the developer who would build
// the adapter. The contract comes from code (src/lib/contract.ts, checked against the parser), the example
// is Northstar's real recorded answer, and the adapter excerpts are Northstar's own code.
import { useEffect, type ReactNode } from 'react';
import aiFixture from '../../fixtures/ai-page.json';
import fixture from '../../fixtures/guided-run.json';
import finishEvents from '../../fixtures/adapter/finish_events.py?raw';
import tables from '../../fixtures/adapter/tables.sql?raw';
import workflowJson from '../../fixtures/adapter/workflow_json.py?raw';
import { AI_FIELD_GROUPS, AI_LIMITS, FIELD_GROUPS, LIMITS, documentedOnly, firstTryTrace, formatJson, objectAt } from '../../lib/contract';
import { mailtoHref } from '../../lib/credits';
import { GUIDED_RUN, GUIDED_WF } from '../../lib/guided';
import { CONSOLE_PATH } from '../../lib/routes';
import { SAMPLE_HREF } from '../FileLoader';
import { SAMPLE_EDITS } from '../../lib/sampleGuide';
import { SiteFooter } from '../SiteFooter';
import { LandingHeader } from '../landing/LandingHeader';
import { LIBRARIES } from './libraries';
import { C, CodeBlock, FieldList, Segs } from './parts';

type Json = Parameters<typeof documentedOnly>[0];
const PAGE = fixture.page as unknown as Record<string, unknown>;
/** Opens the console with the made-up shop already drawn (App reads `sample=1` once). */
const SAMPLE_CONSOLE = `${CONSOLE_PATH}?mode=file&sample=1`;
const EXAMPLE = formatJson(documentedOnly(fixture.page as unknown as Json));
const TRACE = firstTryTrace(GUIDED_RUN, GUIDED_WF);
/** Northstar's AI answer, frozen on 31 Oct 2026, cut to its newest call (the description is the point). */
const AI_PAGE = { ...aiFixture.page, calls: aiFixture.page.calls.slice(0, 1) } as unknown as Record<string, unknown>;
const AI_EXAMPLE = formatJson(AI_PAGE as unknown as Json);
/** A guide's id: its name in lowercase words joined by dashes (an id with a space breaks aria-labelledby). */
const libId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const SECTIONS = [
  ['picture', 'The feed in one picture'],
  ['try', 'Try it with your own file'],
  ['example', 'A real answer'],
  ['fields', 'Every field'],
  ['ai', 'The optional AI feed'],
  ['rules', 'The rules NEXUS relies on'],
  ['adapter', 'Writing an adapter'],
  ['never', 'What never goes in the feed'],
  ['libraries', 'If you use a job library'],
  ['checklist', 'Before you point NEXUS at it'],
] as const;

/** Northstar's value for a field, short enough for one line. */
function exampleOf(at: string, key: string, page: Record<string, unknown> = PAGE): string | null {
  const v = objectAt(page, at)?.[key];
  if (v === undefined) return null;
  const text = Array.isArray(v) ? `${v.length} ${v.length === 1 ? 'entry' : 'entries'}` : JSON.stringify(v);
  return text.length > 70 ? `${text.slice(0, 67)}…` : text;
}

/** A closed disclosure for the long reference parts, so the page reads short until someone opens one. */
function Fold({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group flex flex-col gap-5">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-base font-medium text-route underline underline-offset-2">
        {summary}
      </summary>
      <div className="flex flex-col gap-5 pt-4">{children}</div>
    </details>
  );
}

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-6 flex-col gap-5 border-t border-rule pt-10">
      <h2 id={`${id}-title`} className="font-display text-xl font-semibold min-[720px]:text-4xl">
        <span className="text-route">{n}</span> {title}
      </h2>
      {children}
    </section>
  );
}

const PARTS = [
  { code: 'workflow', what: 'What your jobs are: their names, purposes, tries and waits, and what each code means.' },
  { code: 'runs[].steps', what: "Each job's current state in one run." },
  { code: 'runs[].events', what: 'Every change to those jobs, in the order it happened.' },
  { code: 'now · truncated', what: 'When you answered, and whether more runs exist than you sent.' },
];

export function ConnectPage() {
  useEffect(() => {
    document.title = 'Connect your system · NEXUS';
    // A link into a folded part (e.g. /connect#fields from the file loader) opens it, then scrolls to it.
    const openTarget = () => {
      const target = window.location.hash === '' ? null : document.getElementById(window.location.hash.slice(1));
      const fold = target?.querySelector('details');
      if (target && fold && !fold.open) {
        fold.open = true;
        target.scrollIntoView();
      }
    };
    openTarget();
    window.addEventListener('hashchange', openTarget);
    return () => window.removeEventListener('hashchange', openTarget);
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded-sm focus:bg-raised focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 min-[720px]:px-10 min-[1100px]:px-16">
        <LandingHeader />

        <main id="main" tabIndex={-1} className="flex w-full max-w-[860px] flex-col gap-12 pb-20 outline-none">
          <div className="flex flex-col gap-5 pt-4">
            <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] min-[720px]:text-6xl">Connect your system</h1>
            <p className="text-reading min-[720px]:text-lg">
              NEXUS can draw any business&apos;s background jobs, not only Northstar&apos;s, from one small file that describes
              them. Two ways to use this page:
            </p>
            <div className="grid gap-4 min-[720px]:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-md bg-panel p-5">
                <h2 className="font-display text-2xl font-semibold">Just curious?</h2>
                <p className="text-base">See NEXUS draw a made-up shop in one click, then try changing it yourself.</p>
                <a href={SAMPLE_CONSOLE} className="mt-auto inline-flex min-h-11 items-center self-start rounded-sm bg-route px-5 text-base font-semibold text-bg">
                  See the sample
                </a>
                <a href="#try" className="inline-flex min-h-11 items-center self-start text-base text-route underline underline-offset-2">
                  Change it in three edits
                </a>
              </div>
              <div className="flex flex-col gap-3 rounded-md bg-panel p-5">
                <h2 className="font-display text-2xl font-semibold">Building an adapter?</h2>
                <p className="text-base">
                  Everything your system has to publish for NEXUS to draw it, with Northstar&apos;s real code as the example.
                </p>
                <a href="#picture" className="mt-auto inline-flex min-h-11 items-center self-start rounded-sm bg-raised px-5 text-base font-semibold hover:bg-rule">
                  Start with the four parts
                </a>
              </div>
            </div>
            <div className="edge-route">
              <div className="flex flex-col gap-3 rounded-md bg-panel p-5 min-[720px]:p-6">
                <p className="text-base">
                  <b className="font-semibold">Connected today: Northstar Digital</b>, a demo agency site. NEXUS reads one feed per
                  build; pointing it at yours means changing its feed address and its security policy, which I set up with you.
                  There is no sign-up and no upload.
                </p>
                <a href={mailtoHref} className="inline-flex min-h-11 items-center self-start rounded-sm bg-raised px-5 text-base font-semibold hover:bg-rule">
                  Email me about yours
                </a>
              </div>
            </div>
            <nav aria-label="On this page" className="flex flex-col gap-2">
              <p className="text-sm text-muted">On this page</p>
              <ol className="grid gap-x-6 gap-y-1 min-[720px]:grid-cols-2">
                {SECTIONS.map(([id, title], i) => (
                  <li key={id}>
                    <a href={`#${id}`} className="inline-flex min-h-11 items-center gap-2 text-base text-route underline underline-offset-2">
                      <span className="text-muted">{i + 1}</span>{title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <Section id="picture" n={1} title="The feed in one picture">
            <p className="text-reading">
              Your system describes itself in four parts, in one answer to <C c="GET /api/ops/runs?since=…&limit=…" />. The
              description comes with every answer, so the runs and what they mean can never disagree.
            </p>
            <ul className="grid gap-3 min-[720px]:grid-cols-2">
              {PARTS.map((p) => (
                <li key={p.code} className="flex flex-col gap-2 rounded-md bg-panel p-5">
                  <C c={p.code} />
                  <span className="text-base">{p.what}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="try" n={2} title="Try it with your own file">
            <p className="text-reading">
              See NEXUS draw a different business: a made-up shop, already loaded, with nothing to download or install. Or change the
              sample yourself and watch the console follow. Either way it stays in your browser tab: nothing is uploaded, and
              reloading clears it.
            </p>
            <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
              <a href={SAMPLE_CONSOLE} className="inline-flex min-h-11 items-center rounded-sm bg-route px-5 text-base font-semibold text-bg">
                See the sample
              </a>
              <a href={SAMPLE_HREF} download="sample-feed.json" className="inline-flex min-h-11 items-center text-base text-route underline underline-offset-2">
                Download it to change it
              </a>
            </div>
            <div className="flex flex-col gap-4 rounded-md bg-panel p-5">
              <h3 className="font-display text-2xl font-semibold">Change the sample in three edits</h3>
              <ol className="flex list-decimal flex-col gap-1 pl-6 text-base marker:text-muted">
                <li>Download the sample, and open it in any plain-text editor (Notepad on Windows, TextEdit on a Mac).</li>
                <li>Make one of the changes below: find the line, change it, save the file.</li>
                <li>
                  In the console, choose <b>Your file</b>, then <b>Choose a file</b> (or drop it on the box), and pick the file you
                  saved.
                </li>
              </ol>
              <ol className="flex flex-col gap-4">
                {SAMPLE_EDITS.map((e, i) => (
                  <li key={e.id} className="flex flex-col gap-2 border-t border-rule pt-4">
                    <p className="font-semibold">{i + 1}. {e.title} <span className="font-normal text-muted">· {e.where}</span></p>
                    {e.changes.map((c) => (
                      <div key={c.find} className="grid gap-1 text-sm min-[720px]:grid-cols-[110px_1fr] min-[720px]:gap-x-3">
                        <span className="text-muted">Find</span>
                        <code className="font-mono break-all">{c.find}</code>
                        <span className="text-muted">Change it to</span>
                        <code className="font-mono break-all text-route">{c.replace}</code>
                      </div>
                    ))}
                    <p className="text-base"><span className="text-muted">You&apos;ll see: </span>{e.result}</p>
                  </li>
                ))}
              </ol>
              <p className="text-sm text-muted">
                Keep the quotes and the comma at the end of each line as they are: a missing one makes the file unreadable, and
                NEXUS says so.
              </p>
            </div>
          </Section>

          <div className="flex flex-col gap-2 border-t-2 border-route/40 pt-8">
            <p className="text-sm tracking-wide text-route">For developers</p>
            <h2 className="font-display text-2xl font-semibold min-[720px]:text-4xl">The full contract</h2>
            <p className="text-reading">Everything an adapter needs. The longer parts are folded: open the one you need.</p>
          </div>

          <Section id="example" n={3} title="A real answer">
            <p className="text-reading">
              Northstar&apos;s recorded run, as its feed sent it: frozen on 23 Oct 2026, with the description it added on 28 Oct.
              Fields NEXUS doesn&apos;t read are left out. The same parser that reads the live feed checks this example.
            </p>
            <Fold summary="Show the example (one real run)">
            <CodeBlock label="Northstar's answer, one run" code={EXAMPLE} note="Scroll sideways inside the box for long lines" />
            </Fold>
          </Section>

          <Section id="fields" n={4} title="Every field">
            <p className="text-reading">
              Every field is required. A missing or malformed one makes NEXUS refuse the whole answer, and its error panel names the
              field, for example: &ldquo;unexpected feed data at runs[0].steps[1].status&rdquo;.
            </p>
            <Fold summary="Show every field (ten groups)">
            {FIELD_GROUPS.map((g) => (
              <FieldList key={g.id} group={g} example={(key) => exampleOf(g.at, key)} />
            ))}
            </Fold>
          </Section>

          <Section id="ai" n={5} title="The optional AI feed">
            <p className="text-reading">
              If your system asks an AI model questions, it can publish a second feed, <C c="GET /api/ops/ai?since=…&limit=…" />, with
              one entry per question the model was asked to answer (at most {AI_LIMITS.calls} per answer). Like the runs feed it
              describes itself: what one call is called, what each outcome means, how long a call may take, how long you keep them, and
              each model&apos;s list price. NEXUS reads it with the same field-by-field checks, and never needs to know a model by name.
              The console&apos;s AI usage view draws it: how many were answered, how long they took, the tokens, and a cost estimate from
              your prices. Northstar serves one for its assistant.
            </p>
            <Fold summary="Show the AI fields (six groups)">
            {AI_FIELD_GROUPS.map((g) => (
              <FieldList key={g.id} group={g} example={(key) => exampleOf(g.at, key, AI_PAGE)} />
            ))}
            </Fold>
            <Fold summary="Show Northstar's AI answer (its newest call)">
            <CodeBlock label="Northstar's AI answer, one call" code={AI_EXAMPLE} note="Frozen on 31 Oct 2026. No message text is ever in the feed" />
            </Fold>
          </Section>

          <Section id="rules" n={6} title="The rules NEXUS relies on">
            <Fold summary="Show the nine rules, and what NEXUS does with odd events">
            <ol className="flex list-decimal flex-col gap-3 pl-6 text-base marker:text-muted">
              <li>Events are only ever added, never changed, and each run lists them in the order they happened.</li>
              <li>Tries count from 1. The <C c="queued" /> event belongs to try <C c="0" />.</li>
              <li>
                A failed try records <C c="failed" />, then either <C c="retry_scheduled" /> with the planned wait in seconds as its
                detail, or, on the last try, <C c="dead" />: the job gave up.
              </li>
              <li>
                A try that started and never reported back shows as a new <C c="started" /> for the next try, with no <C c="failed" />{' '}
                before it. If no tries are left, the job gives up with the detail <C c="lease_expired" />.
              </li>
              <li>
                A success records its result code as its detail. One success per job: two are flagged as a possible duplicate send.
              </li>
              <li>
                Times are ISO 8601 with a timezone, like <C c="2026-10-28T12:00:00Z" />. <C c="created_at" /> is when the run started, and <C c="now" /> is your clock when
                you answered.
              </li>
              <li>
                Runs come newest first. <C c="since" /> is ISO 8601, URL-encoded (a <C c="+" /> becomes <C c="%2B" />).{' '}
                <C c="limit" /> goes up to {LIMITS.runs}, and <C c="truncated" /> says more exist.
              </li>
              <li>
                <C c="run_id" /> is opaque: <C c="r_" /> and 12 hex characters. Northstar makes it with an HMAC (a keyed
                fingerprint) of its own row id, so nobody can turn it back into a customer&apos;s reference.
              </li>
              <li>There is no personal data anywhere in the feed.</li>
            </ol>
            <div className="flex flex-col gap-3 rounded-md bg-panel p-5">
              <h3 className="font-display text-2xl font-semibold">Missing or ambiguous events</h3>
              <ul className="flex flex-col gap-2 text-base">
                <li>A <C c="started" /> with nothing after it reads as a try still running.</li>
                <li>A later <C c="started" /> with no <C c="failed" /> before it reads as a try that never reported back.</li>
                <li>A <C c="retry_scheduled" /> without its <C c="failed" /> still shows, as a retry plan on its own.</li>
                <li>Two successes for one job are shown, and flagged as a possible duplicate.</li>
                <li>A result or error code the description doesn&apos;t list shows as the code itself.</li>
              </ul>
            </div>
            </Fold>
          </Section>

          <Section id="adapter" n={7} title="Writing an adapter">
            <ol className="flex list-decimal flex-col gap-3 pl-6 text-base marker:text-muted">
              <li>Decide what starts a run (an enquiry, an order, a sign-up): one run, its time, and an opaque id.</li>
              <li>Record every change to a job as an event when it happens, in the same transaction as the change itself.</li>
              <li>Build the description from your own configuration, so its tries and waits can&apos;t drift from what runs.</li>
              <li>
                Serve it read-only at one address. NEXUS asks every {LIMITS.pollS} s while someone is looking and waits up to{' '}
                {LIMITS.waitS} s for an answer.
              </li>
            </ol>
            <Fold summary="Show Northstar's adapter in code, and one try traced">
            <p className="text-reading">
              Northstar&apos;s adapter, in three short excerpts from its code (the repo is private for now, so these are excerpts,
              not the whole source):
            </p>
            <CodeBlock label="1 · Two tables: each job's state, and every change" code={tables} note="002_workflow.sql" />
            <CodeBlock label="2 · The events a finished try adds, and the opaque run id" code={finishEvents} note="store.py · ops.py" />
            <CodeBlock label="3 · The description, built from the job plan and the settings" code={workflowJson} note="ops.py" />

            <div className="flex flex-col gap-4 rounded-md bg-panel p-5">
              <h3 className="font-display text-2xl font-semibold">One try, traced</h3>
              <p className="text-base">
                The recording&apos;s first try, from what Northstar stored to what NEXUS says. These three events are the rows
                Northstar appended to <C c="run_events" /> as the try ran, sent as they are:
              </p>
              <CodeBlock label="In the feed" code={TRACE.events.map((e) => JSON.stringify(e)).join('\n')} />
              <p className="text-base">
                <span className="text-muted">NEXUS says: </span>&ldquo;{TRACE.sentence}&rdquo;
              </p>
              <p className="text-sm text-muted">
                &ldquo;So nothing was sent&rdquo; appears only because the description marks that error code as sending nothing.
              </p>
            </div>
            </Fold>
          </Section>

          <Section id="never" n={8} title="What never goes in the feed">
            <ul className="flex flex-col gap-2 text-base">
              <li>Personal data: names, email addresses, messages, phone numbers, addresses.</li>
              <li>Secrets: keys, tokens, passwords, connection strings.</li>
              <li>Raw request bodies.</li>
              <li>Exception messages or stack traces. Send a short error code and describe it in <C c="errors" />.</li>
              <li>Ids that trace back to a customer. Use an HMAC (a keyed fingerprint) of your own id, as Northstar does.</li>
            </ul>
            <p className="text-reading">
              A connection is secured in several places: the feed only answers GET (it reads, never changes anything); your CORS
              rules (which websites may read it) allow NEXUS&apos;s address and nobody else&apos;s; your rate limit holds; the HMAC key stays on your server. On NEXUS&apos;s side, its feed address and
              security policy are changed to allow yours, which I set up with you.
            </p>
          </Section>

          <Section id="libraries" n={9} title="If you use a job library">
            <p className="text-reading">
              These are guides from each library&apos;s own documentation, not tested against NEXUS: Northstar is the only system
              connected today. Each library counts tries in its own way, so the line to check first is <b>Fits NEXUS when</b>.
            </p>
            <Fold summary="Show the guides for Celery, BullMQ, Sidekiq and a jobs table">
            {LIBRARIES.map((lib) => (
              <section key={lib.name} aria-labelledby={`lib-${libId(lib.name)}`} className="flex flex-col gap-2 rounded-md bg-panel p-5">
                <h3 id={`lib-${libId(lib.name)}`} className="font-display text-2xl font-semibold">{lib.name}</h3>
                <dl className="flex flex-col">
                  {lib.rows.map((r) => (
                    <div key={r.aspect} className="grid gap-1 border-t border-rule py-2.5 min-[720px]:grid-cols-[200px_1fr] min-[720px]:gap-4">
                      <dt className="text-sm font-medium text-muted">{r.aspect}</dt>
                      <dd className="text-base"><Segs segs={r.how} /></dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            </Fold>
          </Section>

          <Section id="checklist" n={10} title="Before you point NEXUS at it">
            <ul className="flex flex-col gap-2 text-base">
              <li>It answers GET only, and changes nothing.</li>
              <li>Its CORS rules (which websites may read it) allow NEXUS&apos;s address.</li>
              <li>It takes at least 2 requests a minute per viewer (NEXUS asks every {LIMITS.pollS} s while visible). A short <C c="Cache-Control" /> helps.</li>
              <li>It answers within {LIMITS.waitS} s.</li>
              <li>
                At most {LIMITS.runs} runs per answer, {LIMITS.jobs} jobs, and {LIMITS.tries} tries per job. More is refused as a whole
                answer: that&apos;s a feed problem, not a sign your queue failed.
              </li>
              <li>Labels of up to {LIMITS.label} characters, purposes up to {LIMITS.purpose}.</li>
              <li>No personal data.</li>
              <li>A file you load passes the same checks: a .json file of up to 5 MB.</li>
              <li><C c="version" /> is <C c={String(LIMITS.version)} />.</li>
            </ul>
          </Section>

          <div className="flex flex-col gap-4 border-t border-rule pt-10">
            <h2 className="font-display text-xl font-semibold min-[720px]:text-4xl">Want this for your system?</h2>
            <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
              <a href={mailtoHref} className="inline-flex min-h-13 items-center rounded-sm bg-route px-6 text-md font-semibold text-bg">Email me</a>
              <a href={CONSOLE_PATH} className="inline-flex min-h-11 items-center text-md font-medium underline underline-offset-[6px] hover:text-route">
                See it on Northstar&apos;s live data
              </a>
            </div>
          </div>
        </main>
        <div className="pb-8">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
