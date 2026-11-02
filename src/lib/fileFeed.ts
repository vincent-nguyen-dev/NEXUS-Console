// A visitor's own file, read in the browser: nothing is uploaded or kept. It goes through the same checks
// as Northstar's live feed (parseRunsPage), with two more limits so a huge file can't freeze the tab.
import { ApiError, RUNS_MAX_LIMIT, parseRunsPage } from './api';
import type { RunsPage } from './types';

/** A 500-run Northstar answer is about 1.1 MB compact, so 5 MB leaves room for indentation and more. */
export const FILE_MAX_BYTES = 5 * 1024 * 1024;

export interface FileMeta {
  name: string;
  /** Bytes, from `File.size`, checked before the file is read. */
  size: number;
}

export type FileRead =
  | { ok: true; page: RunsPage; name: string }
  | { ok: false; error: string; /** True when /connect's field reference would help. */ shape: boolean };

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

/** Whether a file is worth reading at all: a .json name and at most 5 MB. Null when it is. */
export function checkFile(meta: FileMeta): string | null {
  if (!/\.json$/i.test(meta.name)) return 'Choose a .json file.';
  if (meta.size > FILE_MAX_BYTES) return `This file is ${mb(meta.size)} MB; NEXUS reads files up to ${mb(FILE_MAX_BYTES)} MB.`;
  return null;
}

export function readFeedFile(text: string, meta: FileMeta): FileRead {
  const early = checkFile(meta);
  if (early !== null) return { ok: false, error: early, shape: false };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `This isn't valid JSON: ${(e as Error).message}.`, shape: false };
  }
  const runs = (json as { runs?: unknown } | null)?.runs;
  if (Array.isArray(runs) && runs.length > RUNS_MAX_LIMIT) {
    return { ok: false, error: `This file holds ${runs.length} runs; NEXUS reads up to ${RUNS_MAX_LIMIT}.`, shape: false };
  }
  try {
    return { ok: true, page: parseRunsPage(json), name: meta.name };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: `NEXUS can't read this file: ${e.message}.`, shape: true };
    throw e;
  }
}
