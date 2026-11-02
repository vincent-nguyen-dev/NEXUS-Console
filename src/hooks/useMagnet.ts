// The CTA band's magnet (step 5.4c, F11): while a fine pointer moves over the band, its button leans toward it
// (`magnetOffset`: at most 6 px, within 120 px of the button), written once a frame straight to the style, never
// through React state. Leaving the band, keyboard focus and reduced motion put it back; the CSS springs it there.
import { useEffect, useRef } from 'react';
import { magnetOffset } from '../lib/magnet';

export function useMagnet<A extends HTMLElement, B extends HTMLElement>() {
  const area = useRef<A>(null);
  const target = useRef<B>(null);
  useEffect(() => {
    const el = area.current;
    const btn = target.current;
    if (!el || !btn) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let p = { x: 0, y: 0 };
    const rest = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      btn.style.removeProperty('transform');
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !fine.matches || still.matches) return;
      p = { x: e.clientX, y: e.clientY };
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // The box without the current lean, so the offset doesn't feed on itself.
        const r = btn.getBoundingClientRect();
        const now = new DOMMatrixReadOnly(getComputedStyle(btn).transform);
        const o = magnetOffset(p, { left: r.left - now.m41, top: r.top - now.m42, width: r.width, height: r.height });
        btn.style.transform = o.x === 0 && o.y === 0 ? '' : `translate(${o.x}px, ${o.y}px)`;
      });
    };
    const focusIn = (e: FocusEvent) => {
      if (btn.contains(e.target as Node | null)) rest();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', rest);
    el.addEventListener('focusin', focusIn);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', rest);
      el.removeEventListener('focusin', focusIn);
      cancelAnimationFrame(frame);
    };
  }, []);
  return { area, target };
}
