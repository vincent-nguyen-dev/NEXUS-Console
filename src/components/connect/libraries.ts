// How common job systems map onto the feed. A guide from each library's own documentation (checked
// 28 Oct 2026), not tested against NEXUS: Northstar is the only system connected today. Where the docs
// didn't say something exactly, this says less.
import type { Seg } from './parts';

export interface LibraryGuide {
  name: string;
  rows: { aspect: string; how: readonly Seg[] }[];
}

const ASPECT = {
  start: 'Queued and started',
  retry: 'A failure and its retry',
  gaveUp: 'Gave up',
  lost: 'Never reported back',
  number: 'The try number',
  fits: 'Fits NEXUS when',
  decide: 'Your adapter decides',
} as const;

export const LIBRARIES: LibraryGuide[] = [
  {
    name: 'Celery (Python)',
    rows: [
      { aspect: ASPECT.start, how: [{ c: 'before_task_publish' }, ' when it\'s queued, ', { c: 'task_prerun' }, ' when a try starts.'] },
      { aspect: ASPECT.retry, how: [{ c: 'task_retry' }, ': record the failure, then the retry plan with the wait you passed to ', { c: 'self.retry(countdown=…)' }, '.'] },
      { aspect: ASPECT.gaveUp, how: [{ c: 'task_failure' }, ' after the last retry: the failure, then the give-up.'] },
      { aspect: ASPECT.lost, how: ['A crashed try runs again only with ', { c: 'acks_late' }, ' and ', { c: 'task_reject_on_worker_lost' }, '. Record a new start for the next try, with no failure before it.'] },
      { aspect: ASPECT.number, how: [{ c: 'request.retries' }, ' + 1 (it counts retries from 0).'] },
      { aspect: ASPECT.fits, how: [{ c: 'max_retries' }, ' of 9 or fewer. It counts retries, so the default of 3 is 4 tries.'] },
      { aspect: ASPECT.decide, how: [{ c: 'task_retry' }, ' is only guaranteed its ', { c: 'request' }, ', so keep the countdown yourself. Map what a task returns to your result codes.'] },
    ],
  },
  {
    name: 'BullMQ (Node.js)',
    rows: [
      { aspect: ASPECT.start, how: [{ c: 'waiting' }, ' and ', { c: 'active' }, ', listened to on ', { c: 'QueueEvents' }, ', which sees every process.'] },
      { aspect: ASPECT.retry, how: [{ c: 'failed' }, ' with tries left: the failure, then the retry plan with your ', { c: 'backoff' }, ' delay (fixed, or exponential: 2^(tries − 1) × delay).'] },
      { aspect: ASPECT.gaveUp, how: ['The last ', { c: 'failed' }, ': the failure, then the give-up.'] },
      { aspect: ASPECT.lost, how: ['A stalled job (its lock wasn\'t renewed) goes back to waiting. Record a new start for the next try.'] },
      { aspect: ASPECT.number, how: ['Count the starts per job id as you record them.'] },
      { aspect: ASPECT.fits, how: [{ c: 'attempts' }, ' of 10 or fewer. It counts every try.'] },
      { aspect: ASPECT.decide, how: ['The event stream is trimmed (about 10,000 events by default), so store events as they arrive. Map ', { c: 'returnvalue' }, ' to your result codes.'] },
    ],
  },
  {
    name: 'Sidekiq (Ruby)',
    rows: [
      { aspect: ASPECT.start, how: ['A server middleware around each run: the start before ', { c: 'yield' }, ', the success after it.'] },
      { aspect: ASPECT.retry, how: ['An exception through the middleware: the failure, then the retry plan. The default wait is ', { c: '(retry_count ** 4) + 15 + rand(10) * (retry_count + 1)' }, ' seconds, or yours from ', { c: 'sidekiq_retry_in' }, '.'] },
      { aspect: ASPECT.gaveUp, how: [{ c: 'death_handlers' }, ' or ', { c: 'sidekiq_retries_exhausted' }, ', when the job moves to ', { c: 'Sidekiq::DeadSet' }, '.'] },
      { aspect: ASPECT.lost, how: ['Depends on how your setup fetches jobs. Not covered here.'] },
      { aspect: ASPECT.number, how: ['Count the starts per job id as you record them.'] },
      { aspect: ASPECT.fits, how: [{ c: 'retry: 9' }, ' or fewer. Sidekiq retries 25 times by default, which is 26 tries, and is refused.'] },
      { aspect: ASPECT.decide, how: ['Record the planned wait yourself, and map results to your codes. Check retry counting in your Sidekiq version.'] },
    ],
  },
  {
    name: 'A jobs table (Northstar)',
    rows: [
      { aspect: ASPECT.start, how: ['Insert the jobs with the run, in one transaction. A try starts when a job is picked up.'] },
      { aspect: ASPECT.retry, how: ['Write the job\'s new state and its events in the same transaction (', { c: '_finish_events' }, ', above).'] },
      { aspect: ASPECT.gaveUp, how: ['When the tries run out: the failure, then the give-up.'] },
      { aspect: ASPECT.lost, how: ['A lock with an expiry: a job whose lock ran out is picked up again; with no tries left it gives up with ', { c: 'lease_expired' }, '.'] },
      { aspect: ASPECT.number, how: ['A counter on the job row, raised each time it\'s picked up.'] },
      { aspect: ASPECT.fits, how: [{ c: 'max_attempts' }, ' of 10 or fewer (Northstar allows 4).'] },
      { aspect: ASPECT.decide, how: ['Nothing extra: the feed was designed from this.'] },
    ],
  },
];
