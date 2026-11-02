// The left rail (step 5.2c, board D8): the darkest surface. Its entries are real links (copy, middle-click and
// open-in-new-tab work); a plain click updates the URL state in place. The current view is ink text and a route
// dot. While the overview shows, its sections (Map · Numbers · Latest runs) sit under it as in-page links, and the
// one in view gets the route line; they scroll the page and write nothing to the URL. On phones the rail is a top
// bar whose menu holds the same list. It lists only views that exist; later steps add theirs.
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { CREDITS, mailtoHref } from '../lib/credits';
import { NexusMark } from './NexusMark';
import { Sep } from './Sep';
import { HOW_PATH, STORY_HREF, WORK_PATH } from '../lib/routes';
import { serializeUrlState, type UrlState } from '../lib/urlState';

interface Props {
  state: UrlState;
  onNavigate: (patch: Partial<UrlState>) => void;
  /** Changes whenever the overview's sections mount again (first data, a new window or source), or null when
   * they aren't on the page: the rail then watches the new ones. */
  sectionsKey: string | null;
  /** False when the overview has no sections to jump to (a preview shows only its panel, 7.2a). */
  sections?: boolean;
}

const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
const SECTIONS = [
  { id: 'map', label: 'Map' }, { id: 'numbers', label: 'Numbers' }, { id: 'runs', label: 'Latest runs' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

/** The overview section in a band near the top of the window, or null when none is (or the overview isn't shown). */
function useSectionInView(key: string | null): SectionId | null {
  const [inView, setInView] = useState<SectionId | null>(null);
  useEffect(() => {
    if (key === null || !('IntersectionObserver' in window)) return;
    const seen = new Map<SectionId, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id as SectionId, e.isIntersecting);
      setInView(SECTIONS.find((s) => seen.get(s.id))?.id ?? null);
    }, { rootMargin: '-25% 0px -60% 0px' });
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key]);
  return key === null ? null : inView;
}

const itemClass = 'flex min-h-11 items-center gap-2.5 rounded-sm px-3 text-base font-medium text-muted hover:text-ink aria-[current=page]:text-ink';

function Dot({ on }: { on: boolean }) {
  return <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${on ? 'bg-route shadow-[0_0_8px_var(--color-route)]' : 'bg-transparent'}`} />;
}

export function Rail({ state, onNavigate, sectionsKey, sections = true }: Props) {
  const [menu, setMenu] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const overview = state.view === 'overview';
  const section = useSectionInView(overview ? sectionsKey : null);
  const items: { label: string; patch: Partial<UrlState>; current: boolean }[] = [
    { label: 'Overview', patch: { view: 'overview', mode: 'live', run: null }, current: state.mode === 'live' && overview },
    { label: 'Events', patch: { view: 'events' }, current: state.view === 'events' },
    { label: 'Retries', patch: { view: 'retries' }, current: state.view === 'retries' },
    // AI usage reads the live AI feed only, so it always opens on live data.
    { label: 'AI usage', patch: { view: 'ai', mode: 'live', run: null, flags: null }, current: state.view === 'ai' && state.mode === 'live' },
  ];
  // The phone menu closes first (synchronously, so the layout no longer holds it), then the page jumps there. An
  // instant jump: moving focus cancels a smooth scroll (Chrome), and keyboard users need the focus there.
  const go = (id: SectionId) => {
    flushSync(() => setMenu(false));
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    el.focus({ preventScroll: true });
  };


  return (
    <nav
      aria-label="Main"
      onKeyDown={(e) => {
        // Esc closes the phone menu and returns to its button (7.1c, F7).
        if (e.key !== 'Escape' || !menu) return;
        setMenu(false);
        toggle.current?.focus();
      }}
      className="flex flex-col border-b border-rule bg-deep px-4 py-2 min-[720px]:sticky min-[720px]:top-0 min-[720px]:h-dvh min-[720px]:w-56 min-[720px]:shrink-0 min-[720px]:gap-7 min-[720px]:border-r min-[720px]:border-b-0 min-[720px]:px-5 min-[720px]:py-7">
      <div className="flex items-center justify-between gap-3">
        {/* The wordmark leads back to the landing page, a plain link like any site's logo. */}
        <a href="/" className="flex min-h-11 items-center gap-2.5 self-start rounded-sm">
          <NexusMark size={22} />
          <span className="flex flex-col">
            <span className="font-display text-lg leading-tight font-semibold tracking-wide">NEXUS</span>
            <Sep />
            <span className="hidden text-sm text-muted min-[720px]:inline">Workflow operations console</span>
          </span>
        </a>
        <button
          ref={toggle} type="button" aria-expanded={menu} aria-controls="rail-list" onClick={() => setMenu(!menu)}
          className="flex min-h-11 items-center gap-2 rounded-sm border border-glass px-3 text-base min-[720px]:hidden"
        >
          {items.find((i) => i.current)?.label ?? 'Overview'}
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d={menu ? 'M4 4l8 8M12 4l-8 8' : 'M2 4h12M2 8h12M2 12h12'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="sr-only">menu</span>
        </button>
      </div>
      <ul id="rail-list" className={`${menu ? 'flex' : 'hidden'} flex-col gap-0.5 pt-2 pb-2 min-[720px]:flex min-[720px]:p-0`}>
        {items.map((item) => {
          const href = `${window.location.pathname}${serializeUrlState({ ...state, ...item.patch })}`;
          return (
            <li key={item.label}>
              <a
                href={href}
                aria-current={item.current ? 'page' : undefined}
                onClick={(e) => {
                  if (!isPlainClick(e)) return;
                  e.preventDefault();
                  // On a phone the menu (and the link with the focus) closes: focus goes to the new view.
                  const wasOpen = menu;
                  setMenu(false);
                  onNavigate(item.patch);
                  if (wasOpen) requestAnimationFrame(() => document.getElementById('main')?.focus());
                }}
                className={itemClass}
              >
                <Dot on={item.current} />
                {item.label}
              </a>
              {item.label === 'Overview' && overview && sections && (
                <ul aria-label="On this page" className="mt-0.5 mb-1.5 ml-[18px] flex flex-col">
                  {SECTIONS.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        aria-current={section === s.id ? 'location' : undefined}
                        onClick={(e) => {
                          if (!isPlainClick(e)) return;
                          e.preventDefault();
                          go(s.id);
                        }}
                        className="flex min-h-11 items-center border-l border-rule pl-3.5 text-sm text-muted hover:text-ink aria-[current=location]:border-route aria-[current=location]:text-ink min-[720px]:min-h-9"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {/* The story and the landing pages are pages of their own, so these are plain links, never the current view. */}
        {([[STORY_HREF, 'The story'], [HOW_PATH, 'How it works'], [WORK_PATH, 'Work with me']] as const).map(([href, label]) => (
          <li key={href}>
            <a href={href} className={itemClass}>
              <Dot on={false} />
              {label}
            </a>
          </li>
        ))}
      </ul>
      {/* Phones get the same credit in the footer of every view. */}
      <div className="mt-auto hidden flex-col gap-3 text-sm text-muted min-[720px]:flex">
        <p>
          A portfolio project by {CREDITS.name} ·{' '}
          <a className="text-route underline underline-offset-2" href={mailtoHref}>Get in touch</a>
        </p>
        <p>
          Connected system:{' '}
          <a className="text-route underline underline-offset-2" href="https://northstar-demodigital.netlify.app">Northstar Digital</a>, a demo
          site for a fictional company.
        </p>
      </div>
    </nav>
  );
}
