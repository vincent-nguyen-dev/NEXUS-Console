// The story's beat as URL state (`/story?beat=n`): a new beat is a history entry, so Back and Forward
// walk the story. An invalid beat is rewritten to its normalized form on load (replace, not a new entry).
import { useCallback, useEffect, useRef, useState } from 'react';
import { STORY_PATH } from '../lib/routes';
import { parseBeat, serializeBeat } from '../lib/story';

const urlFor = (beat: number) => `${STORY_PATH}${serializeBeat(beat)}`;

export function useBeat(): [number, (beat: number) => void] {
  const [beat, setBeat] = useState(() => parseBeat(window.location.search));
  const current = useRef(beat);

  useEffect(() => {
    if (window.location.search !== serializeBeat(current.current)) window.history.replaceState(null, '', urlFor(current.current));
    const onPop = () => {
      current.current = parseBeat(window.location.search);
      setBeat(current.current);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((next: number) => {
    if (next === current.current) return;
    window.history.pushState(null, '', urlFor(next));
    current.current = next;
    setBeat(next);
  }, []);

  return [beat, go];
}
