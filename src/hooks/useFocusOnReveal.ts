// Step 7.1b (F2): when an answer reveals its evidence, the button that was pressed goes away. Without a new focus a
// screen reader falls to the top of the page and never hears the evidence. This moves focus to the element the ref
// points at (a heading with tabIndex -1) when `revealed` turns true while the beat is on screen; coming back to a
// beat that's already revealed moves nothing.
import { useEffect, useRef } from 'react';

export function useFocusOnReveal<T extends HTMLElement>(revealed: boolean) {
  const ref = useRef<T>(null);
  const was = useRef(revealed);
  useEffect(() => {
    if (revealed && !was.current) ref.current?.focus();
    was.current = revealed;
  }, [revealed]);
  return ref;
}
