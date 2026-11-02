// The workflow mesh (step 5.3c, lab picks of 30 Oct): one canvas behind a landing section, decoration only. The
// nodes drift slowly; links bend softly toward the pointer; a pulse travels a link for each replay moment (the hero)
// or along a random pathway now and then (the other sections), and a click on empty space sends one along the whole
// path. It stops off screen and in hidden tabs, and reduced motion draws one still frame. Canvas 2D, no library.
import { useEffect, useRef } from 'react';
import { bendToward, randomWalk, seeded, type Mesh } from '../../lib/heroMesh';

const DRIFT_PX = 6;
const PULL_PX = 40;
const PULL_RADIUS_PX = 260;
const PULSE_PER_S = 1.4;
/** The pathways send one ambient pulse this often while on screen. */
const AMBIENT_MS = 5000;

const LOOK = {
  hero: { line: 'rgba(143,163,201,0.11)', path: 'rgba(124,207,227,0.26)', node: 'rgba(143,163,201,0.28)', wfNode: 'rgba(124,207,227,0.55)' },
  pathway: { line: 'rgba(143,163,201,0.07)', path: 'rgba(124,207,227,0.18)', node: 'rgba(143,163,201,0.18)', wfNode: 'rgba(124,207,227,0.4)' },
} as const;

interface Props {
  mesh: Mesh;
  tone: keyof typeof LOOK;
  /** A replay moment to answer with one pulse: which edge of the recorded path, and a counter that changes per moment. */
  pulse?: { edge: number; key: number } | null;
  /** Ambient pathway pulses (the sections without a workflow). */
  ambient?: boolean;
  /** Where the canvas reaches beyond its section (Tailwind inset classes), e.g. to the page's edges. */
  className?: string;
}

interface Pulse {
  a: number;
  b: number;
  t: number;
}

export function MeshCanvas({ mesh, tone, pulse = null, ambient = false, className = '' }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pulses = useRef<Pulse[]>([]);
  const meshRef = useRef(mesh);
  useEffect(() => {
    meshRef.current = mesh;
  });

  // A replay moment: one pulse along its edge of the recorded path (keyed on the moment, not the object).
  const edge = pulse?.edge ?? null;
  const key = pulse?.key ?? null;
  useEffect(() => {
    if (edge === null || key === null) return;
    const e = meshRef.current.path[edge];
    if (e) pulses.current.push({ a: e[0], b: e[1], t: 0 });
  }, [edge, key]);

  useEffect(() => {
    const el = canvas.current;
    // The canvas fills a positioned wrapper (sized by its inset classes); pointer events come from the section.
    const box = el?.parentElement;
    const host = box?.parentElement;
    const ctx = el?.getContext('2d');
    if (!el || !box || !host || !ctx) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const look = LOOK[tone];
    let w = 0;
    let h = 0;
    let pointer: { x: number; y: number } | null = null;
    let visible = true;
    let frame = 0;
    let prev = 0;
    let ambientAt = 0;
    const rnd = seeded(7);

    const size = () => {
      const r = box.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (still.matches) draw(0, 0);
    };

    const draw = (t: number, dt: number) => {
      const m = meshRef.current;
      const moving = !still.matches;
      const pos = m.nodes.map((n) => ({
        x: n.x * w + (moving ? Math.cos(n.phase + t * 0.25) * DRIFT_PX : 0),
        y: n.y * h + (moving ? Math.sin((n.phase + t * 0.25) * 1.3) * DRIFT_PX : 0),
      }));
      ctx.clearRect(0, 0, w, h);
      const onPath = (a: number, b: number) => m.path.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
      for (const [a, b] of m.edges) {
        const p = pos[a];
        const q = pos[b];
        if (!p || !q) continue;
        const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
        const { dx, dy } = moving ? bendToward(mid, pointer, PULL_RADIUS_PX, PULL_PX) : { dx: 0, dy: 0 };
        const lit = onPath(a, b);
        ctx.strokeStyle = lit ? look.path : look.line;
        ctx.lineWidth = lit ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(mid.x + dx, mid.y + dy, q.x, q.y);
        ctx.stroke();
      }
      m.nodes.forEach((n, i) => {
        const p = pos[i];
        if (!p) return;
        ctx.fillStyle = n.workflow ? look.wfNode : look.node;
        ctx.beginPath();
        ctx.arc(p.x, p.y, n.workflow ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!moving) return;
      pulses.current = pulses.current.filter((pl) => pl.t < 1);
      for (const pl of pulses.current) {
        pl.t += dt * PULSE_PER_S;
        const p = pos[pl.a];
        const q = pos[pl.b];
        if (pl.t < 0 || !p || !q) continue;
        const x = p.x + (q.x - p.x) * pl.t;
        const y = p.y + (q.y - p.y) * pl.t;
        ctx.fillStyle = 'rgba(124,207,227,0.9)';
        ctx.shadowColor = '#7CCFE3';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    // Under reduced motion no loop runs (7.1d, F11): one still frame, redrawn on a resize or when the setting changes.
    const onMotion = () => {
      if (still.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
        draw(0, 0);
      } else if (frame === 0) {
        prev = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const tick = (now: number) => {
      if (still.matches) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden) {
        prev = now;
        return;
      }
      const dt = prev === 0 ? 0 : Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (ambient && now - ambientAt > AMBIENT_MS) {
        ambientAt = now;
        const m = meshRef.current;
        randomWalk(m, Math.floor(rnd() * m.nodes.length), 4, rnd).forEach(([a, b], i) => pulses.current.push({ a, b, t: -i * 0.7 }));
      }
      draw(now / 1000, dt);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => {
      pointer = null;
    };
    // A click on empty space (not a link, button or card) sends a pulse down the whole path, or a pathway.
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest('a, button, [role="slider"], figure, input, details, summary')) return;
      const m = meshRef.current;
      const route = m.path.length > 0 ? m.path : randomWalk(m, Math.floor(rnd() * m.nodes.length), 5, rnd);
      route.forEach(([a, b], i) => pulses.current.push({ a, b, t: -i * 0.6 }));
    };

    const resize = new ResizeObserver(size);
    resize.observe(box);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    seen.observe(el);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('click', onClick);
    still.addEventListener('change', onMotion);
    size();
    if (!still.matches) frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      still.removeEventListener('change', onMotion);
      resize.disconnect();
      seen.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('click', onClick);
    };
  }, [tone, ambient]);

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute -z-10 ${className}`}>
      <canvas ref={canvas} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}
