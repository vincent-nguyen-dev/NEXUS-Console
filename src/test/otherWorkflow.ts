// A made-up second system for tests: a shop where each order charges a card at once and sends a receipt
// an hour later. Nothing in NEXUS's code knows it; if the console reads sensibly for it, it reads the
// description and not Northstar's names.
import { parseWorkflow } from '../lib/api';
import type { Run, RunEvent, Step } from '../lib/types';

export const SHOP_WF = parseWorkflow({
  version: 1,
  trigger: { one: 'order', many: 'orders' },
  steps: [
    {
      kind: 'charge_card', label: 'Card payment', purpose: 'Charges the card for the order.',
      delivers: 'payment', always_simulated: false, starts_after_s: 0, max_attempts: 3, backoff_s: [5, 60],
      results: [{ code: 'charged', outcome: 'delivered', label: 'payment taken' }, { code: 'declined', outcome: 'skipped', label: 'card declined' }],
    },
    {
      kind: 'send_receipt', label: 'Receipt', purpose: 'Mails the receipt an hour after the order.',
      delivers: null, always_simulated: false, starts_after_s: 3_600, max_attempts: 2, backoff_s: [30],
      results: [{ code: 'mailed', outcome: 'done', label: 'receipt mailed' }],
    },
  ],
  errors: [{ code: 'gateway_down', label: 'payment gateway down', sends_nothing: true }],
  flags: [{ key: 'test_card', label: 'Test card', effect: 'uses a card that fails its first try' }],
});

const iso = (ms: number) => new Date(ms).toISOString();

/** One order: the payment fails `fails` times (5 s, then 60 s waits), then is charged; the receipt is mailed an hour later. */
export function shopRun(id: string, created: string, fails: number, receipt: boolean): Run {
  const t0 = Date.parse(created);
  const events: RunEvent[] = [{ kind: 'charge_card', event: 'queued', attempt: 0, detail: null, at: iso(t0) }];
  let t = t0 + 200;
  const waits = [5, 60];
  for (let a = 1; a <= fails + 1; a++) {
    events.push({ kind: 'charge_card', event: 'started', attempt: a, detail: null, at: iso(t) });
    t += 300;
    if (a <= fails) {
      events.push({ kind: 'charge_card', event: 'failed', attempt: a, detail: 'gateway_down', at: iso(t) });
      events.push({ kind: 'charge_card', event: 'retry_scheduled', attempt: a, detail: String(waits[a - 1]), at: iso(t) });
      t += (waits[a - 1] ?? 60) * 1000 + 100;
    } else {
      events.push({ kind: 'charge_card', event: 'succeeded', attempt: a, detail: 'charged', at: iso(t) });
    }
  }
  const due = t0 + 3_600_000;
  events.push({ kind: 'send_receipt', event: 'queued', attempt: 0, detail: null, at: iso(t0) });
  if (receipt) {
    events.push({ kind: 'send_receipt', event: 'started', attempt: 1, detail: null, at: iso(due) });
    events.push({ kind: 'send_receipt', event: 'succeeded', attempt: 1, detail: 'mailed', at: iso(due + 100) });
  }
  const steps: Step[] = [
    { kind: 'charge_card', status: 'succeeded', attempts: fails + 1, max_attempts: 3, run_after: iso(t0), result: 'charged', last_error: fails > 0 ? 'gateway_down' : null, updated_at: iso(t) },
    { kind: 'send_receipt', status: receipt ? 'succeeded' : 'queued', attempts: receipt ? 1 : 0, max_attempts: 2, run_after: iso(due), result: receipt ? 'mailed' : null, last_error: null, updated_at: iso(receipt ? due + 100 : t0) },
  ];
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { run_id: id, created_at: created, flags: fails > 0 ? ['test_card'] : [], steps, events };
}
