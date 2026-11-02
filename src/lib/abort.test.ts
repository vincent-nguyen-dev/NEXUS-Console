import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './abort';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

// The fallback path, as in a browser without AbortSignal.any.
describe('withTimeout without AbortSignal.any', () => {
  it('times out with a TimeoutError', () => {
    const s = withTimeout(new AbortController().signal, 1000, null);
    vi.advanceTimersByTime(999);
    expect(s.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(s.aborted).toBe(true);
    expect((s.reason as DOMException).name).toBe('TimeoutError');
  });

  it('follows the caller abort, with its reason', () => {
    const c = new AbortController();
    const s = withTimeout(c.signal, 1000, null);
    c.abort();
    expect(s.aborted).toBe(true);
    expect((s.reason as DOMException).name).toBe('AbortError');
  });

  it('is aborted at once when the caller signal already is', () => {
    const c = new AbortController();
    c.abort();
    expect(withTimeout(c.signal, 1000, null).aborted).toBe(true);
  });
});

describe('withTimeout with AbortSignal.any', () => {
  it('follows the caller abort', () => {
    const c = new AbortController();
    const s = withTimeout(c.signal, 1000);
    c.abort();
    expect(s.aborted).toBe(true);
  });
});
