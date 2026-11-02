// How each track state is drawn. Lit tracks are 4 px; dark ones 3 px in `track`, which only ever
// sits on the panel (3.11:1), never on a raised surface.
import type { TrackState } from '../../lib/map';

export interface Stroke {
  color: string;
  width: number;
  dash?: string;
}

export const STROKE: Record<TrackState, Stroke> = {
  unlit: { color: 'var(--color-track)', width: 3 },
  scheduled: { color: 'var(--color-track)', width: 3, dash: '8 6' },
  route: { color: 'var(--color-route)', width: 4 },
  ok: { color: 'var(--color-ok)', width: 4 },
  retry: { color: 'var(--color-retry)', width: 4, dash: '10 7' },
  dead: { color: 'var(--color-dead)', width: 4 },
};

/** A lane that isn't the selected one goes dark, so the selection stands out without fading any text. */
export const dim = (state: TrackState, dimmed: boolean): TrackState =>
  dimmed && state !== 'scheduled' ? 'unlit' : state;
