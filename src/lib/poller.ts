// A feed's polling loop (the runs feed, and since 6.1 the AI feed), kept free of React and the DOM so fake timers can
// test it.
// The page tells it about visibility and input; it decides when to ask Northstar.
import { ApiError } from './api';
import type { FeedSnapshot } from './feedStatus';
import type { WindowKey } from './filters';
import {
  IDLE_AFTER_MS, PAUSE_AFTER_MS, POLL_MS, coversFrom, nextDelay, reachesWindow, sinceFor,
} from './pollPolicy';
import { parseInstant } from './time';
import type { RunsPage } from './types';

/** What the loop needs of any page: the server's clock and whether the answer was cut at its limit. */
export interface FeedPage { now: string; truncated: boolean }

export interface PollerDeps<P extends FeedPage = RunsPage> {
  load: (since: string | null, signal: AbortSignal) => Promise<P>;
  /** The page's oldest row (ms), or null for none: a cut-off page still answers any window that starts after it. */
  oldestMs: (page: P) => number | null;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export interface PollSnapshot<P extends FeedPage = RunsPage> extends FeedSnapshot {
  win: WindowKey;
  /** The last page that answers `win`, or null. */
  page: P | null;
  lastError: ApiError | null;
}

export class Poller<P extends FeedPage = RunsPage> {
  private readonly deps: PollerDeps<P>;
  private win: WindowKey;
  private visible: boolean;
  private page: P | null = null;
  /** The `since` the held page was requested with (server clock), null for All. */
  private requestedSinceMs: number | null = null;
  private receivedAt: number | null = null;
  /** Server clock minus client clock, learned from each response. */
  private offsetMs = 0;
  private controller: AbortController | null = null;
  private inFlightSince: number | null = null;
  private lastError: ApiError | null = null;
  private errors = 0;
  private paused = false;
  private lastActivity: number;
  private nextAt: number | null = null;
  private pollTimer: unknown = null;
  private pauseTimer: unknown = null;
  /** Set while a clock correction is open, so a skewed clock costs one extra request, not a loop. */
  private correcting = false;
  private stopped = false;
  private snapshot: PollSnapshot<P>;
  private readonly listeners = new Set<() => void>();

  constructor(deps: PollerDeps<P>, win: WindowKey, visible: boolean) {
    this.deps = deps;
    this.win = win;
    this.visible = visible;
    this.lastActivity = deps.now();
    this.snapshot = this.build();
  }

  // ----- for useSyncExternalStore -----

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PollSnapshot<P> => this.snapshot;

  // ----- inputs -----

  /** Starts, or restarts after `stop()`: asks at once unless the held data is under 30 s old. */
  start(): void {
    this.stopped = false;
    this.paused = false;
    this.lastActivity = this.deps.now();
    this.armPause();
    this.resume();
  }

  /** Stops all requests and timers (guided mode, unmount). Subscribers stay attached. */
  stop(): void {
    this.stopped = true;
    this.abortOpen();
    this.clearPoll();
    if (this.pauseTimer !== null) this.deps.clearTimer(this.pauseTimer);
    this.pauseTimer = null;
    this.emit();
  }

  setWindow(win: WindowKey): void {
    if (win === this.win) return;
    this.win = win;
    const wasOpen = this.abortOpen();
    if (this.page !== null && coversFrom(this.page.truncated, this.deps.oldestMs(this.page), this.requestedSinceMs, win, this.serverNow())) {
      // A narrower window is already in hand: re-filter, no request.
      if (wasOpen) this.schedule();
      this.emit();
      return;
    }
    // Never show a narrower window's data under a wider label: drop it and load.
    this.page = null;
    this.requestedSinceMs = null;
    this.lastError = null;
    this.errors = 0;
    this.emit();
    void this.fetchNow();
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    if (!visible) {
      this.clearPoll();
      this.emit();
      return;
    }
    this.noteActivity(true);
  }

  /** Any input. `force` resumes even when the visitor wasn't idle (used when the tab becomes visible). */
  noteActivity(force = false): void {
    const now = this.deps.now();
    const wasIdle = now - this.lastActivity >= IDLE_AFTER_MS;
    this.lastActivity = now;
    this.armPause();
    if (this.paused || wasIdle || force) {
      this.paused = false;
      this.resume();
    }
  }

  /** The Retry button. Respects a 429's wait. */
  retryNow(): void {
    if (this.inFlightSince !== null) return;
    if (this.lastError?.kind === 'rate_limited' && this.nextAt !== null && this.nextAt > this.deps.now()) return;
    void this.fetchNow();
  }

  // ----- internals -----

  private serverNow(): number {
    if (this.page === null || this.receivedAt === null) return this.deps.now() + this.offsetMs;
    return parseInstant(this.page.now) + (this.deps.now() - this.receivedAt);
  }

  private resume(): void {
    if (this.stopped || !this.visible || this.inFlightSince !== null) {
      this.emit();
      return;
    }
    const now = this.deps.now();
    let due = this.receivedAt === null || this.page === null ? now : this.receivedAt + POLL_MS;
    if (this.lastError?.kind === 'rate_limited' && this.nextAt !== null) due = Math.max(due, this.nextAt);
    if (due <= now) {
      void this.fetchNow();
    } else {
      this.setPoll(due - now);
      this.emit();
    }
  }

  private armPause(): void {
    if (this.pauseTimer !== null) this.deps.clearTimer(this.pauseTimer);
    this.pauseTimer = this.deps.setTimer(() => {
      this.pauseTimer = null;
      this.paused = true;
      this.clearPoll();
      this.emit();
    }, PAUSE_AFTER_MS);
  }

  private abortOpen(): boolean {
    if (this.controller === null) return false;
    this.controller.abort();
    this.controller = null;
    this.inFlightSince = null;
    this.correcting = false;
    return true;
  }

  private clearPoll(): void {
    if (this.pollTimer !== null) this.deps.clearTimer(this.pollTimer);
    this.pollTimer = null;
    this.nextAt = null;
  }

  private setPoll(ms: number): void {
    this.clearPoll();
    this.nextAt = this.deps.now() + ms;
    this.pollTimer = this.deps.setTimer(() => {
      this.pollTimer = null;
      this.nextAt = null;
      void this.fetchNow();
    }, ms);
  }

  private schedule(): void {
    // A refused origin (a preview) will be refused again: no retries, nothing sent (7.2a).
    if (this.stopped || !this.visible || this.paused || this.lastError?.kind === 'refused') {
      this.clearPoll();
      return;
    }
    const idle = this.deps.now() - this.lastActivity >= IDLE_AFTER_MS;
    const rateLimited = this.lastError?.kind === 'rate_limited';
    this.setPoll(nextDelay({
      idle, errors: this.errors, rateLimited, retryAfterS: rateLimited ? (this.lastError?.retryAfterS ?? null) : null,
    }));
  }

  private async fetchNow(): Promise<void> {
    if (this.stopped || !this.visible || this.paused || this.inFlightSince !== null) return;
    this.clearPoll();
    const win = this.win;
    const since = sinceFor(win, this.deps.now(), this.offsetMs);
    const controller = new AbortController();
    this.controller = controller;
    this.inFlightSince = this.deps.now();
    this.emit();

    let page: P;
    try {
      page = await this.deps.load(since, controller.signal);
    } catch (e) {
      if (controller !== this.controller) return; // superseded by a window change or stop
      this.controller = null;
      this.inFlightSince = null;
      this.correcting = false;
      this.lastError = e instanceof ApiError ? e : new ApiError('network', 'the Northstar API could not be reached');
      this.errors++;
      this.schedule();
      this.emit();
      return;
    }
    if (controller !== this.controller) return;
    this.controller = null;
    this.inFlightSince = null;

    const received = this.deps.now();
    const serverNow = parseInstant(page.now);
    const requestedSinceMs = since === null ? null : parseInstant(since);
    this.offsetMs = serverNow - received;
    this.page = page;
    this.requestedSinceMs = requestedSinceMs;
    this.receivedAt = received;
    this.lastError = null;
    this.errors = 0;

    // The client clock ran fast beyond the margin: this request started too late. Ask once more
    // with the offset just learned.
    if (!reachesWindow(requestedSinceMs, win, serverNow) && !this.correcting) {
      this.correcting = true;
      this.emit();
      void this.fetchNow();
      return;
    }
    this.correcting = false;
    this.schedule();
    this.emit();
  }

  private build(): PollSnapshot<P> {
    return {
      win: this.win,
      page: this.page,
      hasData: this.page !== null,
      lastSuccessAt: this.receivedAt,
      inFlightSince: this.inFlightSince,
      lastError: this.lastError,
      paused: this.paused,
      nextAt: this.nextAt,
    };
  }

  private emit(): void {
    this.snapshot = this.build();
    for (const l of this.listeners) l();
  }
}
