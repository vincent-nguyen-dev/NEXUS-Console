// The console cards' light (step 5.2): while a fine pointer is over the card, its edge and pool follow the pointer
// through CSS variables, written at most once a frame and never through React state. Keyboard focus, touch and
// reduced motion light the card evenly instead. `onActive` reports when the card is lit (the KPI tiles' map link).
import { useEffect, useRef } from 'react';

export function useCursorLight<T extends HTMLElement>(onActive?: (active: boolean) => void) {
  const ref = useRef<T>(null);
  const active = useRef(onActive);
  useEffect(() => {
    active.current = onActive;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let x = 0;
    let y = 0;
    const even = () => {
      el.style.removeProperty('--x');
      el.style.removeProperty('--y');
    };
    const light = (on: boolean) => {
      if (on) el.dataset.lit = '';
      else delete el.dataset.lit;
      active.current?.(on);
    };
    const enter = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      light(true);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !fine.matches || still.matches) return;
      const r = el.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (frame === 0) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          el.style.setProperty('--x', `${x}px`);
          el.style.setProperty('--y', `${y}px`);
        });
      }
    };
    const leave = () => {
      if (el.contains(document.activeElement)) return;
      even();
      light(false);
    };
    const focusIn = () => {
      even();
      light(true);
    };
    const focusOut = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null) && !el.matches(':hover')) light(false);
    };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focusin', focusIn);
    el.addEventListener('focusout', focusOut);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('focusin', focusIn);
      el.removeEventListener('focusout', focusOut);
    };
  }, []);
  return ref;
}
