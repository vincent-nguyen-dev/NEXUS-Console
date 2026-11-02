# NEXUS — design spec + step sequence (draft for review)

## Context
NEXUS is portfolio demo #2: React + TS + Tailwind, in its own repo.
It is an interactive operations console over Northstar's **real** workflow data, and it shows UI/UX range.
Northstar already demonstrates the backend work.
This plan merges ChatGPT's "Living Signal" proposal 0.2 with Northstar's actual data model and the user's answers.
No NEXUS code is written until the user approves this spec (and the visual-language pass in D0).

**User decisions (2026-10-22):**
- Audience: both technical and nontechnical.
- Direction: C. Living Signal, dark only.
- Experience: live by default, with a one-click guided investigation.
- Scope: full ChatGPT P0+P1, with no fixed deadline (the old Oct 23 target is dropped).
- Data: real Northstar events plus a labeled guided/demo scenario.
- AI usage: Northstar starts **storing chat metrics**, and the panel ships in P1.
- Topology: the honest job workflow (no intake instrumentation).
- Typography: decided in the frontend-design pass.
- Tooling approved: Node LTS + Vite, frontend-design skill, UI UX Pro Max skill (read fully before installing; it's third-party), Recharts.

## Convergence with ChatGPT 0.2
| ChatGPT idea | Outcome |
|---|---|
| Topology as interactive hero, filters everything, URL state | **Adopted** |
| Request → Validate → Price → Persist stages | **Changed**: they are unrecorded (one sync request). Map = `Lead saved` → `notify_team` / `confirm_visitor` / `purge_pii` lanes with attempt branches (`backend/app/migrations/002_workflow.sql`) |
| Live vs Guided, DEMO label | **Adopted**; guided = one anonymized real Northstar run (its reference is kept out of the repo; 2 fails, retries at 10 s/30 s, sent on attempt 3), fixture in repo |
| "Was an email sent twice?" | **Answerable** from `UNIQUE(lead_id, kind)` + exactly one `succeeded` event; no extra idempotency field claimed |
| p95, recovery rate | **Adopted with guards**: exact formulas + n shown; "not enough data" below thresholds |
| "Signal travels on new event" | **Adopted as per-poll**, never called streaming |
| Midnight + cyan/green/amber/coral | Starting hypothesis; frontend-design pass must give it a non-generic identity (type + map drawing style) |
| Replay, explain-every-number, retry analysis, shareable URLs | P1 (adopted) |
| Command palette, incident reports, NL query | P2 / out of this plan |

## Northstar backend change (N0: one commit in this repo, deployed before NEXUS needs it)
- `GET /api/ops/runs?since=<iso>&limit=<=500`: runs = leads in the window, newest first.
  Each run: `run_id` (opaque, an HMAC of the lead id with new env `OPS_ID_SECRET`, **never** the `NS-` reference),
  `created_at`, `simulated_outage`, plus steps (kind, status, attempts, max_attempts, run_after, result, last_error, updated_at)
  and events (kind, event, attempt, detail, at). No names, emails, messages or quote amounts.
- New table `chat_metrics` (migration 003): `at, model, tokens_in, tokens_out, latency_ms, outcome` (ok/error code).
  No message text and no IP. Written in `/api/chat` where `request.state.tokens_in` is set today (`backend/app/main.py:284`).
  Retention is 90 days, purged by the existing tick.
- `GET /api/ops/ai?since=`: the chat metric rows (capped).
- Both endpoints: read-only, rate-limited (reuse `app/limits.py`), `Cache-Control: max-age=15`. Add the NEXUS Netlify origin to `ALLOWED_ORIGINS`.
- Tests in `backend/tests`: no PII keys anywhere in the payload, opaque ID is stable and not reversible to the reference,
  memory and pg stores agree, and chat metrics are recorded on both success and error.
- Update `backend/app/knowledge.md` only if the assistant's answers change (they shouldn't).

## Decisions of 2026-10-23 (after reading the live feed; these override the spec below where they differ)
- **Live data is sparse.** At step 01 the feed held 1 run and 1 AI call. Task S: the user seeds real traffic through
  Northstar, about 25 leads over ≥ 3 days (the contact limit is 10/day per IP), about half with the outage switch,
  plus a few dozen chats.
  - This is the owner's test traffic through the real system. The README says so, and the UI never calls it
    "customers".
- **Default window is 30d** (24h / 7d / 30d / All remain).
- **Replay is folded into the run drawer**: step controls on the drawer's timeline, not a separate view.
- **Polling:** 30 s; 2 min after 5 min idle; **paused after 30 min idle** ("Paused · resume"). Visible tab only.
  Only the active view's endpoint is polled.
- **Honesty rules found in Northstar's code:**
  - `confirm_visitor` always returns `mock`, so it is "simulated, never sent".
  - `notify_team` returns `sent`, `mock` or `skipped_cap`.
  - "Sent once" = exactly one `succeeded` event **and** result `sent`.
  - A lease expiry retries without a `failed` event, and can end in `dead` with detail `lease_expired`.
- **Metric definitions (exact):**
  - Jobs = `notify_team` + `confirm_visitor`; finished = `succeeded` or `dead`.
  - First-attempt success = finished jobs whose `succeeded` event is attempt 1 ÷ finished jobs (n ≥ 5).
  - Recovered = finished jobs with ≥ 1 `failed` event that succeeded ÷ finished jobs with ≥ 1 `failed` event
    (n ≥ 5, "too few qualifying failures").
  - Completion p95 = runs where both jobs succeeded; time = latest `succeeded.at` − `created_at`; nearest rank
    `ceil(95·n/100)` in integer math (n ≥ 20, "too few runs"). Runs left out are counted.
  - Wait: planned = `retry_scheduled` detail (s); actual = next `started.at` − `failed.at`.
  - **Shown per step (2026-10-24, step 03 review):** the KPI strip reports first-attempt success and recovered for
    `notify_team` only. `confirm_visitor` is always simulated and would flatter the real rate, so it gets counts
    only ("6 of 6 finished on try 1 · simulated"). The first-try note counts outage-switch runs, which fail tries
    1–2 on purpose (only `notify_team` fails; `confirm_visitor` succeeds on try 1). `notify_team` results are
    split into sent / simulated (`mock`) / skipped at the cap. A truncated feed withholds window metrics
    unless the window starts after the oldest returned run.
- **Guided run (real numbers):** retries 10 s → 10.2 s and 30 s → 30.2 s; completion 42.7 s; team email sent once,
  on attempt 3.
- **Checkpoint after step 06** (P0): deploy, Lighthouse, review with the user and ChatGPT before P1.

## Exact display spec
**Shell (all views)**
- Left rail: Overview · Events · Retries (P1) · AI usage (P1) · Guided investigation.
- Top bar:
  - Mode switch: `Live` or `Guided — DEMO DATA`. In guided mode, a persistent banner and the label sit on every panel.
  - Time window: 24h / 7d / 30d / All.
  - Freshness badge: `Live · updated 12 s ago` | `Waking API…` | `Stale` | `Offline`.
- All view state lives in the URL query: `?view=&mode=&win=&step=&run=&attempt=`.

**Data states (every data panel)**
- Loading: skeletons.
- Waking: no response after 5 s, then a banner: "Northstar API is waking (free hosting sleeps after 15 min idle, ~1 min)".
- Empty window: suggest a wider window or the guided mode.
- Error: a retry button.
- Stale: last success is older than 2 poll intervals. Motion stops and the badge explains why.
- Not enough data: shown per metric.

**Polling:** every 30 s, only while the tab is visible. Back off to 2 min after 5 min of no input, so NEXUS doesn't hold Render and Neon awake (Neon free tier is 100 CU-h/mo).

**Overview**
1. KPI strip, each with an explain control (P1):
   - Runs: leads in the window.
   - First-attempt success: notify_team and confirm_visitor jobs that succeeded on attempt 1 ÷ those jobs that are finished (succeeded or dead).
   - Recovered: jobs that succeeded with attempts > 1 ÷ jobs with at least 1 failure.
   - Completion p95: from lead `created_at` to the last of notify/confirm `succeeded`, nearest-rank method, shown only when n ≥ 20.
   - Ratios are shown only when the denominator is ≥ 5.
   - `purge_pii` is excluded from completion metrics (it runs at 7 days). It shows as "scheduled / done".
2. Topology hero (custom SVG, no React Flow):
   - `Lead saved` node fans out to 3 lane nodes. Each node shows status counts for the window.
   - The edge weight is the run count.
   - Lanes with failures draw an attempt chain (1 ✕ → 2 ✕ → 3 ✓) for the selected run, or aggregate attempt counts.
   - Hover previews a node. Click or Enter sets `step=` or `attempt=`, and the KPIs, the feed and the explorer all filter to it.
   - Selection is shown by an outline and a label, never by color alone.
   - Nodes are buttons in tab order; arrow keys move between nodes.
   - Below 720px, the map becomes a vertical stacked list.
3. Latest signals feed: the 8 newest events, in plain language ("Team notification recovered on attempt 3"). Clicking one opens the detail panel.

**Events explorer:** a table with time, run_id (short), step, event, attempt, detail and wait-since-previous. It filters by step, event and window and sorts by time. Clicking a row opens the detail panel.

**Detail panel (run):** a side drawer that never navigates away.
- Level 1: a plain summary, e.g. "Recovered after 2 failed attempts · 1 email sent · 41 s end-to-end".
- Level 2: a per-step attempt timeline showing actual timestamps against scheduled `run_after`, error codes, and raw events.

**Guided investigation (P0):** the question is "Email delivery failed twice: did it recover, how long did it take, was it sent twice?"
- The user works through 4–5 steps, each highlighting the relevant map, panel or row. The user clicks the evidence, and a conclusion is checked against the data.
- Data comes from a fixture: an anonymized recording of one real Northstar run, labeled "Recorded run, anonymized". A synthetic fallback is labeled DEMO DATA.

**P1 views**
- Explain every number: a popover with formula, numerator/denominator, n, window, source and last refresh.
- Retries: the attempt distribution, and actual waits compared with the configured backoff.
- Replay: scrub or step through a recorded run's events. Long gaps are compressed and labeled. With reduced motion, it uses step buttons only.
- AI usage (Recharts):
  - chats per day, tokens in/out, latency p50/p95 (with n guards), and error rate;
  - estimated cost = tokens × gpt-4o-mini list price, labeled as an estimate with the formula shown.

**Motion:** a signal travels along an edge only for an event that is new since the last poll. Failures shift to the attention state, with a text label. Selection fades out unrelated paths. Nothing loops, there are no particle fields and no counting-up numbers. `prefers-reduced-motion` makes changes immediate.

**Accessibility:** visible focus, full keyboard use, non-color status cues, and AA contrast for every token pair (checked by script).

## NEXUS architecture
- Vite + React + TS (strict) + Tailwind. Exact versions are pinned when scaffolding. Vitest for tests, Recharts only in the AI and Retries views.
- No router: URL query state goes through a small `useUrlState` hook. No data library: a `usePoll` hook.
- `src/lib/` is pure and DOM-free (tests first):
  - `types.ts`
  - `api.ts`: fetch plus hand-written type guards for responses
  - `metrics.ts`: every formula above plus edge cases (empty, n below guard, dead jobs, in-flight runs)
  - `topology.ts`: runs → node/edge model
  - `filters.ts`, `urlState.ts`, `format.ts`, `replay.ts`
- `src/components/`, one per file: `TopologyMap`, `KpiStrip`, `ExplainMetric`, `EventTable`, `DetailPanel`, `TimeWindow`, `ModeSwitch`, `FreshnessBadge`, `GuidedTour`, `ReplayTimeline`, `RetryView`, `AiUsageView`.
- `src/fixtures/guided-run.json`.
- The repo gets its own `CLAUDE.md`, carrying over the facts from memory. Hosting: Netlify, with CI in GitHub Actions (typecheck, lint, Vitest, build).

## Step sequence (one reviewable commit each)
- **D0 Visual language** (no app code):
  - Review the UI UX Pro Max source, then install both skills into the nexus repo's `.claude/skills`.
  - Propose 2–3 type pairings, the palette as tokens with contrast ratios, and the map's drawing style.
  - Build one static overview mockup, published as a private artifact, for review with ChatGPT.
- **N0** Northstar: ops endpoints + `chat_metrics` (above). Deploy and check live.
- **01** Install Node LTS (winget). Scaffold, tokens from D0, CI, Netlify deploy of an empty shell.
- **02** Pure data layer + fixture + Vitest suite (metrics test cases written first, with hand-checked numbers).
- **03** App shell, URL state, polling, all data states.
- **04** Topology map + linked selection.
- **05** Events explorer + detail panel.
- **06** Guided investigation. **P0 complete.**
- **07** Explain-every-number + Retries view.
- **08** Replay.
- **09** AI usage view.
- **10** Polish: accessibility pass, Lighthouse (Incognito), README with screenshots, sync "04 Two demos" in the brief artifact.

## Verification
- Northstar: `pytest backend/tests` (new PII-absence and opaque-ID tests); a live `curl` of `/api/ops/runs`, inspected for no references or PII.
- NEXUS: `npm run typecheck && npm test && npm run build` locally and in CI. Metric tests use hand-computed expected values.
- Manual checks:
  - keyboard-only walkthrough;
  - reduced motion;
  - 720px and 960px widths;
  - a cold Render start (the waking state);
  - an empty window.
- Lighthouse in Incognito on the Netlify URL.

## Immediately after approval
1. Update memory: decisions, the new deadline policy, and the ChatGPT convergence.
2. Run D0 and return the mockup and tokens for the user's and ChatGPT's review before step N0 or 01.
