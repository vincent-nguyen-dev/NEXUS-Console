// Where the console's data comes from: Northstar's live feed, the frozen recording, or a file the visitor
// loaded. Sentences that name the source come from here, so a file never reads as Northstar's data.
import type { Mode } from './urlState';

export type DataSource = 'live' | 'recording' | 'file';

/** The URL's `mode` as a source (`guided` is the recording's key since step 06). */
export const sourceOf = (mode: Mode): DataSource => (mode === 'guided' ? 'recording' : mode);

/** Static sources: nothing is polled, nothing is "right now", times are shown as they are. */
export const isStatic = (source: DataSource): boolean => source !== 'live';

export interface SourceText {
  /** "Northstar returned only the newest 500 runs", "Your file holds only the newest 500 runs". */
  onlyNewest: (n: number) => string;
  /** The end of "this window holds more runs than …". */
  thanReturned: string;
  /** "Every event Northstar recorded for these runs", "Every event in your file for these runs". */
  everyEvent: string;
  /** The drawer's raw events caption. */
  rawEvents: string;
}

export function sourceText(source: DataSource): SourceText {
  if (source === 'file') {
    return {
      onlyNewest: (n) => `Your file holds only the newest ${n} runs`,
      thanReturned: 'your file holds',
      everyEvent: 'Every event in your file for these runs',
      rawEvents: 'Raw events as your file has them',
    };
  }
  return {
    onlyNewest: (n) => `Northstar returned only the newest ${n} runs`,
    thanReturned: 'Northstar returned',
    everyEvent: 'Every event Northstar recorded for these runs',
    rawEvents: 'Raw events as Northstar recorded them',
  };
}
