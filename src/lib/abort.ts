// A request signal that also gives up after a timeout. AbortSignal.any is checked at runtime, not
// trusted from the TypeScript types: browsers before 2024 (Safari < 17.4) don't have it.

type AnyFn = (signals: AbortSignal[]) => AbortSignal;

const nativeAny: AnyFn | null =
  typeof AbortSignal.any === 'function' ? (signals) => AbortSignal.any(signals) : null;

/** `signal`, but also aborted with a TimeoutError after `ms`. */
export function withTimeout(signal: AbortSignal, ms: number, any: AnyFn | null = nativeAny): AbortSignal {
  if (any && typeof AbortSignal.timeout === 'function') return any([signal, AbortSignal.timeout(ms)]);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('the request timed out', 'TimeoutError')), ms);
  const follow = () => {
    clearTimeout(timer);
    controller.abort(signal.reason);
  };
  if (signal.aborted) follow();
  else signal.addEventListener('abort', follow, { once: true });
  return controller.signal;
}
