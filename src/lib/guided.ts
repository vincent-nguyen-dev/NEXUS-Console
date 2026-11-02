// The guided investigation's data: a frozen recording of one real run (see src/fixtures/guided-run.json).
// It goes through the same shape checks as live data.
import raw from '../fixtures/guided-run.json';
import { parseRunsPage } from './api';
import type { Run } from './types';

export interface GuidedMeta {
  label: string;
  source: string;
  captured_at: string;
  note: string;
}

export const GUIDED_META: GuidedMeta = raw.meta;
export const GUIDED_PAGE = parseRunsPage(raw.page);
/** The page as recorded, before parsing (the /how terminal copies it as a file NEXUS can read). */
export const GUIDED_RAW_PAGE: unknown = raw.page;
/** The recording's own description of its workflow, frozen with it. */
export const GUIDED_WF = GUIDED_PAGE.workflow;

const first = GUIDED_PAGE.runs[0];
if (!first) throw new Error('the guided fixture holds no run');
export const GUIDED_RUN: Run = first;
