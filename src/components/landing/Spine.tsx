// The spine (step 5.4d, M2, boards F-1 and F-3): at 1100 px and wider, a route line in the left gutter from the first
// section to the CTA band. It bends in to a station at each section title (found through each top-level section's
// aria-labelledby), and ends in a curve into the band's button. It draws as the visitor scrolls (one frame of work
// per scroll, straight to the DOM) and never undraws; reduced motion shows it drawn. Decoration only.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  END_RISE, SPINE_REACH, drawnY, lengthAt, spinePath, spineProgress, spineSpan, stationsReached,
  type LengthSample, type SpineGeometry,
} from '../../lib/spine';

/** The SVG sits 32 px left of the content's padded gutter; the line runs at x 8, the stations at x 30. */
const SVG_LEFT = -32;
const LINE_X = 8;
const BEND_X = 30;
const END_GAP = 12;
const SAMPLES = 400;
/** The far end of the line's gradient: an indigo bright enough to read as light (decoration, not a text colour). */
const INDIGO_END = '#6E6FD8';

interface Layout { g: SpineGeometry; height: number }

function measure(el: HTMLElement): Layout {
  const box = el.getBoundingClientRect();
  const stations = [...el.querySelectorAll<HTMLElement>('section[aria-labelledby]')]
    .filter((s) => !s.parentElement?.closest('section') && s.querySelector('.magnet') === null)
    .map((s) => document.getElementById(s.getAttribute('aria-labelledby') ?? ''))
    .filter((h): h is HTMLElement => h !== null && el.contains(h))
    .map((h) => {
      const r = h.getBoundingClientRect();
      return Math.round(r.top - box.top + r.height / 2);
    });
  const btn = el.querySelector('.magnet')?.getBoundingClientRect();
  const end = btn ? { x: Math.round(btn.left - box.left - SVG_LEFT - END_GAP), y: Math.round(btn.top - box.top + btn.height / 2) } : null;
  return { g: { x: LINE_X, bend: BEND_X, stations, end }, height: Math.round(box.height) };
}

export function Spine({ children }: { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const lit = useRef<SVGGElement>(null);
  const path = useRef<SVGPathElement>(null);
  const dots = useRef<SVGGElement>(null);
  const drawn = useRef(0);
  const [layout, setLayout] = useState<Layout | null>(null);

  // Layout: the stations and the button, measured at 1100 px and wider, again whenever the page's height changes.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const wide = window.matchMedia('(min-width: 1100px)');
    let key = '';
    const update = () => {
      const next = wide.matches ? measure(el) : null;
      const k = JSON.stringify(next);
      if (k === key) return;
      key = k;
      setLayout(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    wide.addEventListener('change', update);
    void document.fonts?.ready.then(update);
    return () => {
      ro.disconnect();
      wide.removeEventListener('change', update);
    };
  }, []);

  // Drawing: the tip follows the window's 60 % line, at most once a frame.
  useEffect(() => {
    const el = wrap.current;
    const p = path.current;
    if (!el || !p || layout === null) return;
    const span = spineSpan(layout.g);
    if (span === null) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    // The length at each y, down to where the curve into the button starts (it draws over its last 120 px of y).
    const total = p.getTotalLength();
    const curveFrom = layout.g.end === null ? Infinity : layout.g.end.y - END_RISE;
    const samples: LengthSample[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const len = (total * i) / SAMPLES;
      const y = p.getPointAtLength(len).y;
      if (y >= curveFrom) break;
      if (samples.length === 0 || y > (samples[samples.length - 1]?.y ?? -Infinity)) samples.push({ y, len });
    }
    if (layout.g.end !== null) samples.push({ y: layout.g.end.y, len: total });

    let frame = 0;
    const draw = () => {
      frame = 0;
      const top = el.getBoundingClientRect().top;
      const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      drawn.current = still.matches ? 1 : spineProgress(window.innerHeight * SPINE_REACH - top, span, drawn.current, atEnd);
      const tip = drawnY(span, drawn.current);
      const frac = drawn.current >= 1 ? 1 : lengthAt(samples, total, tip);
      lit.current?.style.setProperty('--spine-off', String(1 - frac));
      const reached = stationsReached(layout.g.stations, tip);
      dots.current?.querySelectorAll('circle').forEach((c, i) => {
        if (i < reached) c.dataset.on = '';
        else delete c.dataset.on;
      });
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [layout]);

  const d = layout === null ? '' : spinePath(layout.g);
  return (
    <div ref={wrap} className="relative min-[1100px]:pl-12">
      {children}
      {layout !== null && d !== '' && (
        <svg
          aria-hidden="true" width="80" height={layout.height} overflow="visible"
          className="pointer-events-none absolute top-0 hidden min-[1100px]:block" style={{ left: SVG_LEFT }}
        >
          <defs>
            <linearGradient id="spine-light" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-route)" />
              <stop offset="1" stopColor={INDIGO_END} />
            </linearGradient>
          </defs>
          <path d={d} fill="none" className="stroke-rule" strokeWidth="2" />
          <g ref={lit} className="spine-lit">
            {/* A wide faint stroke under the line instead of a blur filter: a filter over a page-tall SVG repaints on every scroll. */}
            <path d={d} fill="none" stroke="url(#spine-light)" strokeWidth="7" strokeOpacity="0.18" pathLength="1" />
            <path ref={path} d={d} fill="none" stroke="url(#spine-light)" strokeWidth="2.5" pathLength="1" />
          </g>
          <g ref={dots}>
            {layout.g.stations.map((y) => <circle key={y} cx={BEND_X} cy={y} r="5" className="spine-station" strokeWidth="2" />)}
          </g>
        </svg>
      )}
    </div>
  );
}
