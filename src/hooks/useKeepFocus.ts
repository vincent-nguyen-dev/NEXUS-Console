// Step 7.1c (F6): a panel whose controls can disappear under the keyboard (a poll changes it, or the button pressed
// is replaced) keeps focus inside instead of dropping it to the top of the page. While focus is in the element the
// ref points at, a render or unmount that leaves focus on <body> moves it to `target()` (default: the element
// itself, which needs tabIndex -1). Focus that leaves on purpose (Tab, a click elsewhere) is let go.
import { useEffect, useRef, type RefObject } from 'react';

const lost = () => {
  const a = document.activeElement;
  return a === null || a === document.body || !a.isConnected;
};

export function useKeepFocus<T extends HTMLElement>(target?: () => HTMLElement | null, existing?: RefObject<T | null>) {
  const own = useRef<T>(null);
  const ref = existing ?? own;
  const inside = useRef(false);
  const pick = useRef(target);
  useEffect(() => {
    pick.current = target;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onIn = () => {
      inside.current = true;
    };
    const onOut = (e: FocusEvent) => {
      const to = e.relatedTarget;
      if (to instanceof Node) {
        inside.current = el.contains(to);
        return;
      }
      // Nowhere to go: a click on empty page lets focus go; a removed control doesn't (it's checked once it's gone).
      const from = e.target as Node;
      setTimeout(() => {
        if (from.isConnected) inside.current = false;
      }, 0);
    };
    el.addEventListener('focusin', onIn);
    el.addEventListener('focusout', onOut);
    return () => {
      el.removeEventListener('focusin', onIn);
      el.removeEventListener('focusout', onOut);
      // The element itself is going: hand focus to the target if it had it (the element is no fallback any more).
      if (inside.current) {
        const next = pick.current;
        setTimeout(() => {
          if (lost()) next?.()?.focus({ preventScroll: true });
        }, 0);
      }
    };
  }, [ref]);

  // After every render: if focus was inside and the control holding it went away, bring it back.
  useEffect(() => {
    if (!inside.current || !lost()) return;
    (pick.current?.() ?? ref.current)?.focus({ preventScroll: true });
  });

  return ref;
}
