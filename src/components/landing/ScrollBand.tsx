// The scroll band (step 5.3b, board E5): NEXUS's three promises in big type, drifting slowly, faster while the page
// scrolls and backwards while it scrolls up (spring-smoothed). While the hero's replay plays it slows to 10 % and
// the promise the current moment is about lights. It moves on its own, so it has a visible pause (WCAG 2.2.2),
// kept for the tab's session; it stops off screen and in hidden tabs, and reduced motion keeps it still. Screen
// readers get the three promises once; the moving copies are decoration.
import { useEffect, useRef, useState } from 'react';
import { BAND_SPEED_PX_S, fadeScroll, springStep, velocityToSpeed, wrapOffset } from '../../lib/band';
import type { HeroPromise } from '../../lib/heroReplay';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const PROMISES: { id: HeroPromise; text: string }[] = [
  { id: 'ran', text: 'What ran' }, { id: 'retried', text: 'What retried' }, { id: 'twice', text: 'Was anything sent twice' },
];
const COPIES = 4;
const PAUSE_KEY = 'nexus.band.paused';

function readPaused(): boolean {
  try {
    return window.sessionStorage.getItem(PAUSE_KEY) === '1';
  } catch {
    return false;
  }
}
function writePaused(paused: boolean) {
  try {
    window.sessionStorage.setItem(PAUSE_KEY, paused ? '1' : '0');
  } catch {
    // Storage blocked: the choice lasts until the page reloads.
  }
}

export function ScrollBand({ playing, lit }: { playing: boolean; lit: HeroPromise | null }) {
  const row = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(readPaused);
  const reduced = useReducedMotion();
  const state = useRef({ playing, paused });
  useEffect(() => {
    state.current = { playing, paused };
  });

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = copy.current?.offsetWidth ?? 0;
    const measure = () => {
      width = copy.current?.offsetWidth ?? 0;
    };
    const resize = new ResizeObserver(measure);
    if (copy.current) resize.observe(copy.current);
    let visible = true;
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    seen.observe(el);

    let scroll = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    const onScroll = () => {
      const now = performance.now();
      const dt = Math.max(1, now - lastT) / 1000;
      scroll = (window.scrollY - lastY) / dt;
      lastY = window.scrollY;
      lastT = now;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    let x = 0;
    let speed = 1;
    let prev = 0;
    let frame = 0;
    // Under reduced motion no loop runs at all (7.1d, F11): the band rests at its start until the setting changes.
    const rest = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      x = 0;
      el.style.transform = 'translateX(0)';
    };
    const onMotion = () => {
      if (still.matches) rest();
      else if (frame === 0) {
        prev = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    still.addEventListener('change', onMotion);
    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      const dt = prev === 0 ? 0 : Math.min(0.05, (t - prev) / 1000);
      prev = t;
      scroll = fadeScroll(scroll, dt);
      if (still.matches) {
        rest();
        return;
      }
      if (state.current.paused || !visible || document.hidden) return;
      speed = springStep(speed, velocityToSpeed(scroll, { playing: state.current.playing }), dt);
      x = wrapOffset(x - speed * BAND_SPEED_PX_S * dt, width);
      el.style.transform = `translateX(${x}px)`;
    };
    if (still.matches) rest();
    else frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      still.removeEventListener('change', onMotion);
      window.removeEventListener('scroll', onScroll);
      resize.disconnect();
      seen.disconnect();
    };
  }, []);

  const toggle = () => {
    setPaused(!paused);
    writePaused(!paused);
  };

  const unit = PROMISES.map((p) => (
    <span key={p.id} className="contents">
      <span className={`transition-[color,opacity,text-shadow] duration-300 ${lit === p.id ? 'text-route opacity-100 [text-shadow:0_0_24px_rgb(124_207_227/0.45)]' : 'opacity-85'}`}>{p.text}</span>
      <span className="text-route opacity-70">&nbsp;·&nbsp;</span>
    </span>
  ));

  return (
    <section aria-label="What NEXUS shows" className="-mx-4 flex flex-col gap-3 pb-16 min-[720px]:-mx-10 min-[1100px]:-mx-16">
      <ul className="sr-only">
        {PROMISES.map((p) => <li key={p.id}>{p.text}</li>)}
      </ul>
      <div className="overflow-hidden border-y border-rule py-5 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div ref={row} aria-hidden="true" className="flex w-max font-display text-4xl leading-[1.1] font-semibold tracking-[-0.01em] whitespace-nowrap will-change-transform min-[720px]:text-6xl">
          {Array.from({ length: COPIES }, (_, i) => (
            <span key={i} ref={i === 0 ? copy : undefined} className="flex">{unit}</span>
          ))}
        </div>
      </div>
      {/* Nothing moves under reduced motion, so there's nothing to pause. */}
      <div className={`${reduced ? 'hidden' : 'flex'} justify-end px-4 min-[720px]:px-10 min-[1100px]:px-16`}>
        <button type="button" onClick={toggle} className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-glass px-4 text-sm hover:border-route">
          {paused ? 'Play the moving text' : 'Pause the moving text'}
        </button>
      </div>
    </section>
  );
}
