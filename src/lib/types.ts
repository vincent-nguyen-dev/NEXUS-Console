// The shapes of a connected system's ops feed (Northstar's README "Ops feed", backend/app/ops.py).
// The feed describes its own workflow (`Workflow`), so NEXUS knows no job by name: a job's kind is
// whatever the description lists. Statuses and event types are NEXUS's own contract.

/** A job's id in the feed, e.g. the description's `steps[].kind`. */
export type StepKind = string;

export const JOB_STATUSES = ['queued', 'running', 'retrying', 'succeeded', 'dead'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const EVENT_TYPES = ['queued', 'started', 'failed', 'retry_scheduled', 'succeeded', 'dead'] as const;
export type EventType = (typeof EVENT_TYPES)[number];


/** What a successful job's result code means. Anything the description doesn't list is `unknown`. */
export const RESULT_OUTCOMES = ['delivered', 'simulated', 'skipped', 'done'] as const;
export type ResultOutcome = (typeof RESULT_OUTCOMES)[number] | 'unknown';

export interface ResultSpec {
  code: string;
  outcome: (typeof RESULT_OUTCOMES)[number];
  /** Short and lowercase, e.g. "email sent". */
  label: string;
}

/** One job of the workflow, as the feed describes it. */
export interface StepSpec {
  kind: StepKind;
  /** e.g. "Team notification" */
  label: string;
  /** One sentence, e.g. "Emails the agency about the new enquiry." */
  purpose: string;
  /** What it delivers to a person ("email"), or null for a job that delivers nothing. */
  delivers: string | null;
  /** True when it never really delivers (a demo stand-in). */
  always_simulated: boolean;
  /** Seconds after the run starts that the job is due: 0 runs at once, more is scheduled. */
  starts_after_s: number;
  max_attempts: number;
  /** The planned wait after each failed try, in order. */
  backoff_s: number[];
  results: ResultSpec[];
}

export interface ErrorSpec {
  code: string;
  label: string;
  /** True when a try that failed this way never reached the outside service, so it sent nothing. */
  sends_nothing: boolean;
}

/** A switch a run can carry, e.g. a test outage. */
export interface FlagSpec {
  key: string;
  label: string;
  /** What it does, lowercase, e.g. "fails team notification tries 1 and 2 on purpose". */
  effect: string;
}

export interface Workflow {
  version: 1;
  /** What starts a run, e.g. { one: "enquiry", many: "enquiries" }. */
  trigger: { one: string; many: string };
  steps: StepSpec[];
  errors: ErrorSpec[];
  flags: FlagSpec[];
}

/** One job of a run (Northstar's `jobs` row). Times are ISO 8601 strings with microseconds. */
export interface Step {
  kind: StepKind;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_after: string;
  /** A result code the description explains (`StepSpec.results`), or one it doesn't. */
  result: string | null;
  last_error: string | null;
  updated_at: string;
}

/** One recorded event. `detail` is the result, the error code, the retry delay in seconds, or `lease_expired`. */
export interface RunEvent {
  kind: StepKind;
  event: EventType;
  attempt: number;
  detail: string | null;
  at: string;
}

/** One run of the workflow. `run_id` is opaque (`r_` + 12 hex): never a lead reference. */
export interface Run {
  run_id: string;
  created_at: string;
  /** Keys of `Workflow.flags` that were on for this run. */
  flags: string[];
  steps: Step[];
  events: RunEvent[];
}

export interface RunsPage {
  now: string;
  truncated: boolean;
  workflow: Workflow;
  runs: Run[];
}

/** One outcome code an AI call can record, as the feed's description explains it. */
export interface AiOutcomeSpec {
  code: string;
  /** Short and lowercase, e.g. "answered". */
  label: string;
  /** True for an outcome where the model answered; only those calls are timed. */
  answered: boolean;
}

/** One model's list price, per 1M tokens, as the feed states it. */
export interface ModelPrice {
  name: string;
  usd_per_m_in: number;
  usd_per_m_out: number;
  /** The day the price was read (YYYY-MM-DD), or null for a model that costs nothing. */
  priced_on: string | null;
  /** Where the price comes from: a link, or a few words. */
  source: string;
}

/** The AI feed described by the system that serves it (version 1), as `Workflow` is for runs. */
export interface AiDescription {
  version: 1;
  /** The noun for one call and for many ("chat", "chats"). */
  call: { one: string; many: string };
  outcomes: AiOutcomeSpec[];
  /** How long a call may take before it's recorded as failed, in seconds. */
  timeout_s: number;
  /** How many days rows are kept. */
  retention_days: number;
  models: ModelPrice[];
}

export interface AiCall {
  at: string;
  model: string;
  /** Null when the call failed before the model answered. */
  tokens_in: number | null;
  tokens_out: number | null;
  /** For an answered call, the model's time; for a failed one, the time until it failed. */
  latency_ms: number;
  /** One of the description's outcome codes. */
  outcome: string;
}

export interface AiPage {
  now: string;
  truncated: boolean;
  ai: AiDescription;
  calls: AiCall[];
}
