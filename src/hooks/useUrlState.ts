// The URL query as React state. Back/Forward restore it; invalid queries are rewritten to their
// normalized form on load (replace, so the junk URL isn't a history entry).
import { useCallback, useEffect, useRef, useState } from 'react';
import { historyAction, parseUrlState, serializeUrlState, type UrlState } from '../lib/urlState';

const urlFor = (s: UrlState) => `${window.location.pathname}${serializeUrlState(s)}${window.location.hash}`;

export function useUrlState(): [UrlState, (patch: Partial<UrlState>) => void] {
  const [state, setState] = useState(() => parseUrlState(window.location.search));
  // History is written outside the state updater, so StrictMode's double calls can't push twice.
  const current = useRef(state);

  useEffect(() => {
    if (window.location.search !== serializeUrlState(current.current)) {
      window.history.replaceState(null, '', urlFor(current.current));
    }
    const onPop = () => {
      const next = parseUrlState(window.location.search);
      current.current = next;
      setState(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = useCallback((patch: Partial<UrlState>) => {
    const prev = current.current;
    // Round-trip through the parser so the state always matches what the URL can hold.
    const next = parseUrlState(serializeUrlState({ ...prev, ...patch }));
    const action = historyAction(prev, next);
    if (action === 'none') return;
    if (action === 'push') window.history.pushState(null, '', urlFor(next));
    else window.history.replaceState(null, '', urlFor(next));
    current.current = next;
    setState(next);
  }, []);

  return [state, update];
}
