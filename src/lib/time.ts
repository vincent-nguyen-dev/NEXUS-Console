// Northstar sends ISO 8601 times with microseconds and an explicit offset (`...46.373512+00:00`).
// Times are kept as epoch milliseconds with a fractional part, so sub-millisecond waits survive.

const ISO = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

/** Epoch milliseconds (fractional) of an ISO 8601 time. A timezone is required. */
export function parseInstant(iso: string): number {
  const m = ISO.exec(iso);
  const base = m?.[1];
  const zone = m?.[3];
  if (!base || !zone) throw new Error(`not an ISO 8601 time with a timezone: ${iso}`);
  const ms = Date.parse(base + zone);
  if (Number.isNaN(ms)) throw new Error(`invalid time: ${iso}`);
  const fraction = m[2];
  return fraction ? ms + Number(`0.${fraction}`) * 1000 : ms;
}

/** Seconds from `from` to `to` (negative if `to` is earlier). */
export function secondsBetween(from: string, to: string): number {
  return (parseInstant(to) - parseInstant(from)) / 1000;
}
