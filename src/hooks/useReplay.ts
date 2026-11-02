// Plays a replay model: a requestAnimationFrame loop that moves the replay position by real elapsed
// time, so a throttled tab only drops frames, never changes the timing. With reduced motion it never
// starts: the visitor steps between moments, and every frame is still.
import { useCallback, useEffect, useRef, useState } from 'react';
import { nextStop, playbackMode, prevStop, type ReplayModel } from '../lib/replay';
import { useReducedMotion } from './useReducedMotion';

export interface Replay {
  mode: 'animate' | 'step';
  displayS: number;
  playing: boolean;
  atEnd: boolean;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  restart: () => void;
  /** Jumps to a replay time (the hero's scrubber), pausing. */
  seek: (displayS: number) => void;
}

export function useReplay(model: ReplayModel, { autoplay, startAtEnd = false }: { autoplay: boolean; startAtEnd?: boolean }): Replay {
  // Follows the setting: turning reduced motion on mid-replay stops it on the frame it reached (7.1d, F11).
  const mode = playbackMode(useReducedMotion());
  // The landing hero opens on its final frame (the whole run drawn); the story starts at the beginning.
  const [displayS, setDisplayS] = useState(startAtEnd ? model.totalDisplayS : 0);
  const [playing, setPlaying] = useState(autoplay && mode === 'animate');
  if (playing && mode === 'step') setPlaying(false);
  const position = useRef(startAtEnd ? model.totalDisplayS : 0);
  const end = model.totalDisplayS;

  const seek = useCallback((s: number) => {
    position.current = Math.min(Math.max(0, s), end);
    setDisplayS(position.current);
  }, [end]);

  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    let frame = 0;
    const tick = (t: number) => {
      const dt = last === null ? 0 : (t - last) / 1000;
      last = t;
      const next = Math.min(end, position.current + dt);
      position.current = next;
      setDisplayS(next);
      if (next >= end) setPlaying(false);
      else frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, end]);

  const atEnd = displayS >= end - 1e-6;
  return {
    mode,
    displayS,
    playing,
    atEnd,
    play: () => {
      if (mode !== 'animate') return;
      if (atEnd) seek(0);
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    next: () => {
      setPlaying(false);
      seek(nextStop(model, position.current));
    },
    prev: () => {
      setPlaying(false);
      seek(prevStop(model, position.current));
    },
    restart: () => {
      seek(0);
      setPlaying(mode === 'animate');
    },
    seek: (s: number) => {
      setPlaying(false);
      seek(s);
    },
  };
}
