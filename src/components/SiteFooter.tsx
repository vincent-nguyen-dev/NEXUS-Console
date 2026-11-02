// Who built NEXUS and how to reach them, at the end of every view and at every width (the rail's
// credit is hidden on phones). Same-tab links, no tracking. Its first row lists every page, so each page has a next
// destination (checkpoint B, C2).
import { CREDITS, mailtoHref, repoLink } from '../lib/credits';
import { CONNECTED } from '../lib/connected';
import { CONNECT_PATH, CONSOLE_PATH, HOW_PATH, STORY_PATH, WORK_PATH } from '../lib/routes';

const linkClass = 'inline-flex min-h-11 items-center text-route underline underline-offset-2';

const PAGES: [string, string][] = [
  ['/', 'Home'], [HOW_PATH, 'How it works'], [CONSOLE_PATH, 'Live console'], [STORY_PATH, 'The story'],
  [WORK_PATH, 'Work with me'], [CONNECT_PATH, 'Connect your system'],
];

export function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-col gap-1 border-t border-rule pt-4 text-sm text-muted">
      <nav aria-label="Pages">
        <ul className="flex flex-wrap gap-x-5">
          {PAGES.map(([href, label]) => (
            <li key={href}><a href={href} className="inline-flex min-h-11 items-center text-ink hover:text-route">{label}</a></li>
          ))}
        </ul>
      </nav>
      <p className="max-w-[80ch]">
        NEXUS is a portfolio project by <b className="font-semibold text-ink">{CREDITS.name}</b>, {CREDITS.pitch}.
      </p>
      {/* Spacing separates the links, not a "·", which would wrap onto a line of its own on phones. */}
      <p className="flex flex-wrap items-center gap-x-4">
        <span>Get in touch:</span>
        <a href={mailtoHref} className={`${linkClass} break-all`}>{CREDITS.email}</a>
        <a href={CREDITS.github} className={linkClass}>GitHub profile</a>
        {/* A private repo would 404, so it says so until the owner flips REPO_PUBLIC. */}
        {repoLink() === null ? <span>Source code: private for now</span> : <a href={repoLink() ?? undefined} className={linkClass}>Source code</a>}
      </p>
      <p className="max-w-[80ch]">
        Connected system:{' '}
        <a className="text-route underline underline-offset-2" href={CONNECTED.site}>{CONNECTED.name}</a>, a demo
        site for a fictional company, with test traffic from the owner and from visitors (including one scheduled test
        enquiry and one test chat a day).
      </p>
    </footer>
  );
}
