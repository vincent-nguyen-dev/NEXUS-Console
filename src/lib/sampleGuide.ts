// "Change the sample in three edits": the guide on /connect. Each edit names a line of
// public/sample-feed.json exactly as it is, what to change it to, and what the console then shows.
// sample.test.ts applies every edit to the real file, so the guide can't point at a line that isn't there.

export interface LineChange {
  /** The line as it is in the file, trimmed (the first match is the one to change). */
  find: string;
  replace: string;
}

export interface SampleEdit {
  id: string;
  title: string;
  /** Where to look, in words. */
  where: string;
  changes: LineChange[];
  /** What the console shows after loading the edited file. */
  result: string;
}

export const SAMPLE_EDITS: SampleEdit[] = [
  {
    id: 'rename',
    title: 'Rename a job',
    where: 'Near the top, the first job.',
    changes: [{ find: '"label": "Card payment",', replace: '"label": "Payment",' }],
    result: 'The map\'s first lane, the numbers and the run details all say "Payment".',
  },
  {
    id: 'trigger',
    title: 'Rename what starts a run',
    where: 'The first lines, under "trigger".',
    changes: [
      { find: '"one": "order",', replace: '"one": "booking",' },
      { find: '"many": "orders"', replace: '"many": "bookings"' },
    ],
    result: 'The map starts at "New booking", and the numbers count "one per booking".',
  },
  {
    id: 'break',
    title: 'Break it on purpose',
    where: 'The first job again, a few lines below its name.',
    changes: [{ find: '"max_attempts": 3,', replace: '"max_attempts": 11,' }],
    result: 'NEXUS refuses the file and names the line that broke the rules: a job may have at most 10 tries. Change it back and it loads again.',
  },
];

/** The file with one edit applied (each change replaces the first match), or null when a line isn't there. */
export function applyEdit(text: string, edit: SampleEdit): string | null {
  let out = text;
  for (const c of edit.changes) {
    if (!out.includes(c.find)) return null;
    out = out.replace(c.find, c.replace);
  }
  return out;
}
