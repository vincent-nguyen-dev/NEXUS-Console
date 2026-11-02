// Pixel geometry of the redrawn wide map (step 5.1, Round C). It fills the width it is given: text never scales,
// only the space between tries stretches (150–260 px). Below its minimum the page shows the narrow composition.
// Tries 2+ sit on a siding above the line; the line itself is the path of runs that finished on try 1.
import type { MapModel } from './map';
import type { StepKind } from './types';

/** x where the lanes' lines start, and of try 1. */
const LANE_X = 140;
const TRY1_X = 330;
const GAP_MIN = 150;
const GAP_MAX = 260;
/** From the last try on the siding back down to the line. */
const REJOIN = 110;
/** The end label (two lines at most) right of the end station, and the right margin. */
const END_W = 150;
const PAD_R = 16;
/** Wait labels fit on one line from this gap; below it they take two. */
const ONE_LINE_GAP = 200;
const SIDING_RISE = 80;
const WAITS_ONE = 50;
const WAITS_TWO = 68;
const TITLE_ROOM = 34;
const BELOW = 52;
const ROW_GAP = 30;
const TOP = 20;
const BOTTOM = 20;
/** Room for this many tries is always kept, so the map has the same shape with or without data. */
const MIN_TRIES = 3;

export interface WideLane {
  kind: StepKind;
  lineY: number;
  /** y of the siding when this lane has (or keeps room for) one, else null. */
  sidingY: number | null;
  stations: { attempt: number; x: number; y: number }[];
  /** Above the siding, midway between the try that failed and the next. */
  waits: { attempt: number; x: number; y: number }[];
  try1X: number;
  /** Where the siding comes back down to the line, when it was used. */
  rejoin: { from: number; to: number } | null;
  endX: number;
}

export interface WideLayout {
  width: number;
  height: number;
  gap: number;
  twoLineWaits: boolean;
  laneX: number;
  /** The enquiry's dot, and where its branches start. */
  leadX: number;
  leadY: number;
  branchX: number;
  lanes: WideLane[];
}

const maxTry = (model: MapModel) => Math.max(MIN_TRIES, ...model.lanes.flatMap((l) => l.stations.map((s) => s.attempt)));

/** The narrowest width the wide map can be drawn at. */
export function minWideWidth(model: MapModel): number {
  return TRY1_X + (maxTry(model) - 1) * GAP_MIN + REJOIN + END_W + PAD_R;
}

/**
 * `reserve`: lanes that keep their siding's room even without a retry in these runs (App passes the lanes that
 * retried in the unfiltered window), so turning the filter on never moves the page.
 */
export function wideLayout(model: MapModel, available: number, reserve: ReadonlySet<StepKind>): WideLayout {
  const width = Math.max(Math.floor(available), minWideWidth(model));
  const tries = maxTry(model);
  const endX = width - END_W - PAD_R;
  const gap = Math.min(GAP_MAX, Math.max(GAP_MIN, (endX - REJOIN - TRY1_X) / (tries - 1)));
  const twoLineWaits = gap < ONE_LINE_GAP;
  const xOf = (attempt: number) => TRY1_X + (attempt - 1) * gap;

  let y = TOP;
  const lanes = model.lanes.map((lane): WideLane => {
    const retried = lane.stations.some((s) => s.attempt >= 2);
    const room = retried || reserve.has(lane.kind);
    const lineY = y + (room ? SIDING_RISE + (twoLineWaits ? WAITS_TWO : WAITS_ONE) : TITLE_ROOM);
    const sidingY = room ? lineY - SIDING_RISE : null;
    y = lineY + BELOW + ROW_GAP;
    const last = Math.max(1, ...lane.stations.map((s) => s.attempt));
    return {
      kind: lane.kind,
      lineY,
      sidingY,
      stations: lane.stations.map((s) => ({ attempt: s.attempt, x: xOf(s.attempt), y: s.attempt === 1 ? lineY : (sidingY ?? lineY) })),
      waits: lane.waits.map((w) => ({ attempt: w.attempt, x: (xOf(w.attempt) + xOf(w.attempt + 1)) / 2, y: (sidingY ?? lineY) - 16 })),
      try1X: TRY1_X,
      rejoin: retried ? { from: xOf(last), to: xOf(last) + REJOIN } : null,
      endX,
    };
  });
  const first = lanes[0]?.lineY ?? TOP;
  const lastLine = lanes.at(-1)?.lineY ?? TOP;
  return {
    width, height: y - ROW_GAP + BOTTOM, gap, twoLineWaits, laneX: LANE_X, leadX: 14, leadY: (first + lastLine) / 2, branchX: 84, lanes,
  };
}

// ----- the vertical route (phones and narrow panels, step 5.1c, board C5) -----
// Each job reads down the screen: try 1 on the line (x 20), tries 2+ on a siding beside it (x 52), the waits
// labelled between them, the end below. Labels start at x 84. Its own composition, never the wide map scaled.

const V_LINE_X = 20;
const V_SIDING_X = 52;
const V_TOP = 22;
const V_FIRST_GAP = 92;
const V_STEP = 108;
const V_END_AFTER = 118;
const V_REJOIN = 86;
const V_SHORT_END = 64;
const V_BOTTOM = 30;

export interface VerticalLane {
  stations: { attempt: number; x: number; y: number }[];
  /** Midway between the try that failed and the next (+14 below try 1, where the siding curves away). */
  waits: { attempt: number; y: number }[];
  /** Where the siding curves back to the line, when it was used. */
  rejoin: { fromY: number; toY: number } | null;
  end: { x: number; y: number };
  height: number;
}

export function verticalLane(lane: MapModel['lanes'][number], reserve: ReadonlySet<StepKind>): VerticalLane {
  const yOf = (attempt: number) => (attempt === 1 ? V_TOP : V_TOP + V_FIRST_GAP + (attempt - 2) * V_STEP);
  const stations = lane.stations.map((s) => ({ attempt: s.attempt, x: s.attempt === 1 ? V_LINE_X : V_SIDING_X, y: yOf(s.attempt) }));
  const last = Math.max(1, ...lane.stations.map((s) => s.attempt));
  const room = last >= 2 || reserve.has(lane.kind);
  let endY = V_TOP;
  if (lane.stations.length > 0) endY = room ? yOf(Math.max(last, MIN_TRIES)) + V_END_AFTER : V_TOP + V_SHORT_END;
  return {
    stations,
    waits: lane.waits.map((w) => ({ attempt: w.attempt, y: (yOf(w.attempt) + yOf(w.attempt + 1)) / 2 + (w.attempt === 1 ? 14 : 0) })),
    rejoin: last >= 2 ? { fromY: yOf(last), toY: yOf(last) + V_REJOIN } : null,
    end: { x: V_LINE_X, y: endY },
    height: endY + V_BOTTOM,
  };
}
