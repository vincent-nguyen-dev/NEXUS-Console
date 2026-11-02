// Northstar's workflow description for tests: the copy frozen with the recording
// (src/fixtures/guided-run.json), parsed like live data.
import raw from '../fixtures/guided-run.json';
import { parseWorkflow } from '../lib/api';

export const NORTHSTAR_WF = parseWorkflow(raw.page.workflow);
