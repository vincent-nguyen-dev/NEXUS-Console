# Accessibility and Lighthouse: findings (step 7.1)

Roadmap L11. Until now, "full keyboard use" and "reduced motion shows still frames" rested on code reading and the
owner's spot checks. Step 7.1a (this document, no app code) measures them: Lighthouse on every page, a screen-reader
run with NVDA, keyboard walks, reflow and text spacing. Fixes go in 7.1b–7.1d. Production can't be measured until
Netlify deploys again (about 21 Nov); its Lighthouse run is on A.2's list (docs/checkpoint-a.md).

**Status (1 Nov 2026): audit done, including the owner's settings runs. 7.1a–7.1d done (below). Production's Lighthouse run is on A.2's list (docs/checkpoint-a.md).**

## Summary
- **Lighthouse accessibility: 100 on all 26 reports** (13 pages × mobile and desktop). Lighthouse runs axe-core, so
  there are no missing names, broken ARIA or contrast failures that axe can see. Best practices 96–100, SEO 92
  (a preview artefact), performance 83–100.
- **The screen reader finds what Lighthouse can't.** Lighthouse checks how the page *is*, not what happens when it
  *changes*. Four of NVDA's findings are about changes: the story's evidence is never read out, focus falls to the
  top of the page after Check, the replay never says that try 1 failed, and words run together.
- **Keyboard:** every control has a visible focus ring and is scrolled into view (143 Tab stops: 39 on Home, 44 on /how,
  60 on the console). No traps. The map costs 9 Tab stops where it needs 1.
- **Reflow at 320 px:** one page scrolls sideways (Retries, by 25 px, from its hidden data tables).

## How it was measured
| What | How | Where |
|---|---|---|
| Lighthouse 13.6.0 | `npx --yes lighthouse@13.6.0`, headless Chrome 156, mobile and desktop presets, nothing added to package.json | preview build (`vite preview`): `/`, `/how`, `/work`, `/story?beat=1`, `/story?beat=4`, `/connect`, console on the recording, the sample file and Retries on the recording. Dev server (live data): console overview, events, AI usage, Retries (accessibility and best practices only: an unbundled dev build has no meaningful performance) |
| NVDA 2026.2 | a portable copy (no install), silent voice, its log at Input/output; Claude drove Chrome with Tab, Enter, Esc and arrows from the browser tool; every quote below is NVDA's log, verbatim | dev server, live data, 1 Nov 22:36–22:40 local time |
| Keyboard walk | real Tab presses; on each stop, the focus ring's computed style and whether the element is on screen | `/`, `/how`, `/console` |
| Reflow | each page in a 320 px frame: sideways scroll, elements wider than the frame outside their own scroll box, targets under 24 × 24 px, `aria-labelledby` pointing at a missing id, duplicate ids | all six pages and every console view |
| Text spacing | WCAG 1.4.12's spacing (line 1.5, letters 0.12 em, words 0.16 em, paragraphs 2 em) injected at 1280 px; text pushed outside its box | all six pages |

**What the numbers are not.** The preview has no Netlify brotli, CDN or headers, so its performance scores are a
point of comparison, not production's. And `vite preview` calls Render directly, which Northstar's CORS refuses on
localhost, exactly as on a deploy preview (7.2), so the landing pages show "unavailable" and log a CORS error there.

**NVDA's limits here.** Keys sent by the browser tool reach Chrome but not NVDA's keyboard hook (the log records none
of them as input), so NVDA's own reading keys (H for headings, D for landmarks, the elements list) weren't used. What
was tested is what a Tab, Enter and arrow user hears: focus, names, roles, states and live announcements. The heading
and landmark outline was read from the accessibility tree instead, which is what NVDA's browse mode is built from.
The phone layout wasn't tested with NVDA: the window couldn't be resized below the desktop breakpoint. One tester
driving for five minutes is a check, not an audit by a daily screen-reader user. JAWS, VoiceOver and braille weren't tested.

## Lighthouse (before)
| Page | Mobile perf · a11y · bp · seo | Desktop perf · a11y · bp · seo |
|---|---|---|
| `/` | 98 · 100 · 96 · 92 | 100 · 100 · 96 · 92 |
| `/how` | **83** · 100 · 96 · 92 | 100 · 100 · 96 · 92 |
| `/work` | **88** · 100 · 96 · 92 | 100 · 100 · 96 · 92 |
| `/story?beat=1` | 100 · 100 · 100 · 92 | 100 · 100 · 100 · 92 |
| `/story?beat=4` | 100 · 100 · 100 · 92 | 100 · 100 · 100 · 92 |
| `/connect` | 100 · 100 · 100 · 92 | 100 · 100 · 100 · 92 |
| console, recording | 98 · 100 · 100 · 92 | 100 · 100 · 100 · 92 |
| console, sample file | 90 · 100 · 100 · 92 | **86** · 100 · 100 · 92 |
| Retries, recording | 100 · 100 · 100 · 92 | 100 · 100 · 100 · 92 |
| console, live (dev): overview, events, AI usage, Retries | – · 100 · 100 · – | – · 100 · 100 · – |

What lowers them:
- **`/how` mobile, TBT 660 ms.** Long tasks of 245, 190 and 187 ms in the React bundle about 2.2–3.0 s after load,
  under Lighthouse's 4× CPU slowdown, plus 142 and 137 ms in the landing chunk. Main-thread work 3.0 s. The cause
  isn't measured yet (the terminal's typing and the bento's real console pieces mount then): 7.1d profiles it first.
- **`/work` mobile, LCP 3.9 s.** The largest element is the Northstar screenshot, which is `loading="lazy"` (a lazy
  image is fetched late) and 1280 px wide on a 390 px screen (Lighthouse estimates 38 KiB saved on mobile).
- **Console on the sample file, desktop, CLS 0.267.** The footer jumps down when the file's runs arrive (one shift of
  0.267). Live data likely does the same on a slow first poll.
- **SEO 92 and best practices 96 are preview artefacts.** `robots.txt` is "invalid" because the preview's fallback
  serves index.html for it (Netlify answers 404, which passes). The console errors on `/`, `/how`, `/work` are the CORS
  refusal above. Lighthouse 13's new "agentic browsing" checks (llms.txt, an ARD manifest) fail for the same fallback
  reason; NEXUS doesn't aim at them.
- **Render-blocking CSS, about 150 ms on mobile.** One stylesheet. Inlining it would need `'unsafe-inline'` in the
  CSP's `style-src`, so it stays.
- **Lighthouse's "label in name" check** (WCAG 2.5.3; it doesn't count towards the score) flags three kinds of buttons
  whose name doesn't contain their visible text: the map's "New enquiry" station, the phone map's stations, and the
  events table's run ids ("Open run r_96c6bd695d54" for a button showing "96c6").

## What NVDA said
Quotes are NVDA's log, joined with " · " where NVDA spoke several pieces in a row.

**Story, beat 3: pick both answers, then Check (F2).**
> Yes · radio button · checked · 1 of 2
> 10 s to 1 min · radio button · checked · 2 of 4
> Step 3 of 5 · Did it recover? · NEXUS · document

The last line is the page itself: the Check button was removed, focus fell to the document, and the evidence that
appeared was never read. The next Tab went to "Story · navigation landmark · Back · button", the top of the page.

**Console, events view, 68 s without input (F3, F4).**
> Northstar API waking up
> Live

Right: one state change each, then silence through two polls. No new event arrived in that minute, so the events
count's announcement on every poll (F3) wasn't triggered; it's confirmed in the code (`EventTable.tsx:117`).

**Console, the map (F8).** Arrow keys move along the map and Enter selects:
> Team notification, try 1: 10 sent · 10 failed. · toggle button · not pressed
> Selected: Team notification · try 1
> Team notification, try 2: 10 failed. · toggle button · not pressed
> Team notification, try 3: 10 sent. · toggle button · not pressed

The last line came from **Tab**, not an arrow: every one of the 9 stations is its own Tab stop.

**Console, Latest runs and the drawer.** Opening and closing work (focus starts on Close; Esc returns to the row):
> Run 96c6 · Team notification sent on try 3 after 2 failed triesoutage switch on · 14 h 19 min ago · . Opens the run's details. · button
> Run r_96c6bd695d54 · dialog · One enquiry's three jobs, from the first try to the result. …

"triesoutage" is two pieces of text with no space between them (F16). The logo reads the same way: "NEXUSWorkflow
operations console".

**Home, on load (F18).** Before anything else, NVDA read the whole numbers row as one run-on string:
> Runs20one per enquiry · n = 20 Team email recorded as sent once20 of 20finished team notifications Failed tries20all from the outage test switch · 10 of 10 jobs recovered Gave up0no job stopped without succeeding

**Home, "Play the 43 seconds" (F5).** Each moment is spoken once, in order, which is the replay working as an audio
description:
> An enquiry is saved. Three jobs are queued.1 of 9
> Team notification, try 1 starts.2 of 9
> Northstar waits before try 2 (real wait 10.2 s · shown in 3.1 s).3 of 9
> Northstar waits before try 2 (real wait 10.2 s · shown in 3.1 s).4 of 9
> Northstar waits before try 2 (real wait 10.2 s · shown in 3.1 s).5 of 9
> Waited 10.2 s, as planned (10 s). Try 2 starts.6 of 9
> Northstar waits before try 3 (real wait 30.2 s · shown in 2.5 s).7 of 9
> Waited 30.2 s, as planned (30 s). Try 3 starts.8 of 9
> Try 3 sent the email. It's the only "sent" result recorded.9 of 9

**The failures are never said.** During a wait the caption is the wait (`captionAt`, `heroReplay.ts:66`), and both
failed tries happen right before a wait, so moments 4 and 5 repeat moment 3 and nobody hears "try 1 failed". A sighted
visitor sees the failure on the figure; a screen-reader user hears a run that only waited. The count also runs into
the sentence ("queued.1 of 9"). Stepping with the slider reads the value, then the caption again.

## Findings
Severity: **major** = a screen-reader or keyboard user misses content or loses their place; **minor** = friction or
a guideline missed with no content lost. "Code" = confirmed by reading the code, not observed.

| # | Severity | Finding | Evidence | Fix | Step |
|---|---|---|---|---|---|
| F5 | major | The replay never says a try failed; moments 4–5 repeat the wait; "queued.1 of 9" | NVDA, above | during a wait, the caption starts with the failure it follows ("Try 1 failed: nothing was sent. Northstar waits …"); the count is spoken as its own sentence; the slider's value text carries the caption and the caption region stays quiet while the slider has focus | 7.1b |
| F2 | major | Story beats 3 and 4: after Check the evidence isn't read and focus falls to the document | NVDA, above; `BeatRecovery.tsx:52`, `BeatSentOnce.tsx:50` | on Check, focus the evidence heading | 7.1b |
| F16 | major | Words run together: "triesoutage", "NEXUSWorkflow", "Runs20one", "sent once20 of 20finished" | NVDA, above | a space or a hidden separator between the pieces | 7.1b |
| F18 | major | The numbers row is one live region, read as a run-on string on every load | NVDA; `Numbers.tsx:34` | only the row's state note (waiting, unavailable) is live; each tile reads as "Runs: 20, one per enquiry, n = 20" | 7.1b |
| F1 | major | `/connect`: the four job-library guides have no name (their ids contain spaces) | reflow scan: `lib-Celery (Python)` etc. point at no id; `ConnectPage.tsx:371` | slug the ids | 7.1b |
| F6 | major | Focus is lost when the focused control disappears or greys out (~15 places) | F2 observed; the rest code (list in the plan) | each gets a named successor; `aria-disabled` where a button only greys out | 7.1c |
| F8 | minor | The map has 9 Tab stops (more once a job needs a 4th try) though arrows move between stations; stations are disabled while data is partial | NVDA, above | one Tab stop (roving tabindex), `aria-disabled` | 7.1c |
| F7 | minor | Phone menu: no Esc, and a link click hides the focused link. The View fold has no Esc either | code (`Rail.tsx:85-110`; not testable with NVDA here, see limits) | Esc closes and returns focus to the toggle; a view link focuses `#main` | 7.1c |
| F9 | minor | `aria-pressed` used for things that aren't toggles: "Trace on the map" → "Traced" changes its label too; the map's "New enquiry" only clears; the source, window and filter choices and the story's answer cards are one-of-many | code | Trace keeps one label; "New enquiry" a plain button; one-of-many → radio groups | 7.1c |
| F10 | minor | Pressed and focused look the same (the same 2 px outline) on stations, run chips, answer cards | code | the focus ring moves 4 px out; the selection keeps its outline and label (a visible change, shown before commit) | 7.1c |
| F13 | minor | Names that don't contain the visible text: the map's "New enquiry" station, the phone map's stations, the events table's run ids | Lighthouse "label in name" | names start with what's shown ("Open run 96c6") | 7.1b |
| F3 | minor | The events count is announced on every poll that brings an event | code | announce on a filter change only | 7.1b |
| F4 | minor | A poll slower than 5 s announces "Reconnecting", then "Live" | code (not seen: no slow poll in the run) | the pill's live region skips "reconnecting"; still shown | 7.1b |
| F12 | minor | The console's header and footer sit inside `<main>`; the error page's main has no `id="main"`, so its skip link goes nowhere | code | footer outside main; id on the error main | 7.1c |
| F11 | minor | Reduced motion: delays aren't reset (rise-in, the late route, the map siding and lamp sit invisible, then pop in); two components read the setting once; two loops keep running doing nothing; "Pause the moving text" shows when nothing moves | code; the owner saw no late pop-in (below) | reset delays (a safeguard); one `useReducedMotion` hook that follows changes; no loop under reduced motion; no pause button | 7.1d |
| F19 | minor | Retries at 320 px scrolls sideways by 25 px: hidden data tables keep their width | reflow scan (tables 293 and 229 px wide inside `sr-only`) | wrap each hidden table in a hidden box instead of hiding the table | 7.1d |
| F20 | minor | `/how`, the bento's "How sure is a number?" card cuts off its text under WCAG text spacing | text-spacing scan: 4 lines pushed outside the card | the card grows with its text | 7.1d |
| P1 | minor | `/how` mobile TBT 660 ms (performance 83) | Lighthouse | profile, then fix the cause | 7.1d |
| P2 | minor | `/work` mobile LCP 3.9 s: the screenshot is lazy and 1280 px wide | Lighthouse | eager + a 640 px version for phones | 7.1d |
| P3 | minor | The console's footer jumps when the runs arrive (CLS 0.267 on the sample file) | Lighthouse | reserve the content's height so the footer starts below the fold | 7.1d |
| F15 | minor | No long cache for the hashed `/assets/*` files | netlify.toml | `Cache-Control: public, max-age=31536000, immutable`; checked in A.2 | 7.1d |
| F14 | minor | Every page declares the homepage as its canonical; Lighthouse passes it, but search engines read it as "/how is a copy of /" | index.html | drop the canonical (og:url stays) | 7.1d |
| T2 | minor | The first-try tile says "10 of 20 finished", read as "10 didn't finish" | checkpoint B | "10 of 20 succeeded on try 1" | 7.1d |

**Withdrawn or not a defect:**
- *The drawer* (expected fine, confirmed): focus starts on Close, Esc returns to the row that opened it.
- *The status pill on load*: "Northstar API waking up", then "Live" is the right amount of speech.
- *CountUp*: never read mid-count (the digits are hidden, the final value is in hidden text).
- *A raw timestamp in a row's name*: the browser tool's element search showed one, but NVDA read "14 h 19 min ago"; the
  timestamp is a tooltip, not part of the name.
- *Many region landmarks*: every titled section is a region. The list is long but each entry has a name.
- *Small targets*: none under 24 px except the skip links (1 px until focused, by design) and one inline link on /how.

## The owner's settings runs (1 Nov)
Claude can't change Windows settings, and DevTools' emulation applies only to the tab it's open on.
- **Reduced motion** (Windows: Animation effects off; `/`, `/how`, `/console`): **pass.** Everything is still, and
  nothing appears late. F11 predicted that the delayed rise-ins and the map's sidings would pop in after up to 0.5 s;
  the owner didn't see it. The delay reset stays in 7.1d as a safeguard; the rest of F11 (a hook that follows a
  change of the setting, no idle loops, no pause button) is unaffected.
- **Forced colours** (DevTools rendering emulation, `forced-colors: active`; `/`, `/console`): **pass.** The focus
  ring is visible, every status keeps its shape, the map's line and its sidings stay apart. Cards and the map card
  become plain outlined boxes: forced colours drops backgrounds, gradients and glows, which is what it's for, and the
  content inside stays readable.

## After 7.1b (1 Nov, NVDA again, 23:42–23:43)
**Story, beat 3, Check (F2):** focus moves to the evidence.
> 10 s to 1 min · radio button · checked · 2 of 4
> The evidence · region · The evidence · heading · level 2

**Home, on load (F18):** one sentence instead of the four tiles run together.
> Northstar's numbers for the last 30 days are in.

**Home, "Play the 43 seconds" (F5):** every moment is said once, the failures included, and nothing repeats.
> Team notification, try 1 starts.
> Try 1 failed: the email service is down (simulated), so nothing was sent. Northstar plans a retry in 10 s. Northstar waits before try 2 (real wait 10.2 s · shown in 3.1 s).
> Visitor confirmation, try 1 starts. Northstar waits before try 2 (real wait 10.2 s · shown in 3.1 s).
> Visitor confirmation worked on try 1 (simulated: no email goes out). Northstar waits before try 2 (real wait 10.2 s · shown in 3.1 s).
> Waited 10.2 s, as planned (10 s). Try 2 starts.
> Try 2 failed: still down, so nothing was sent. Northstar plans a retry in 30 s. Northstar waits before try 3 (real wait 30.2 s · shown in 2.5 s).

The same caption is on screen, so sighted visitors now see both failures and the visitor confirmation too: before,
each happened right before a wait and the wait's caption covered it (moments 3, 4, 5 and 7 of 9 were never shown).

**Console, Latest runs (F16):** the pieces are separated.
> Run 96c6 · , Team notification sent on try 3 after 2 failed tries, outage switch on, · 15 h 23 min ago · . Opens the run's details. · button

**Lighthouse, accessibility only, after 7.1b:** 100 on the console (live, recording, sample file), events, Home
and /connect, mobile and desktop, and the "label in name" check (F13) now passes everywhere. It reads only visible
text, so the separator (`Sep`) carries a plain space as well as the hidden comma. The run-together scan (adjacent
pieces with no space inside a name, a live region or an inline line) finds nothing on any page.

F1, F3 and F4 are confirmed in the DOM, not by ear: the four guides on /connect now have names; the events count's
live text changes only with the filters; the status pill's live text skips "reconnecting" (`announcedKind`, tested).

## After 7.1c (1 Nov, checked in the browser with real key presses)
| Finding | What happens now |
|---|---|
| F8 the map | one Tab stop (9 nodes, 1 with tabIndex 0): Tab enters on the enquiry, the arrows move, Tab leaves to the run strip, Shift+Tab comes back to the station left. While the data loads the stations are `aria-disabled`, so focus stays |
| F6 lost focus | Show all → the Latest runs card; Clear filters → the first filter; Show 100 more → the first added row's run (row 100); story beat 1 Skip → the answer; beat 2's Pause → Replay at the end (same place, same focus); Next at the end stays focused (`aria-disabled`); the intro's two buttons hand focus to each other; Stop watching → the watch panel; the pill's Resume → its state; the error panel and the file loader → main when they go; Load another file → the loader's title. Panels a poll can change keep focus inside (`useKeepFocus`) |
| F7 Esc | the phone menu closes on Esc and focus returns to its button; a view link from the menu lands on main; the View fold closes on Esc the same way (checked at 390 px in a frame) |
| F9 roles | data source, time window and test switch are radio groups (one Tab stop, arrows choose); the map's "New enquiry" is a plain button; "Trace on the map" becomes "Stop tracing" instead of a pressed state; the story's answer cards say "(your guess)" instead of a pressed state |
| F10 selected vs focused | a selection is an inset ring, focus the 2 px outline outside it, so a selected station with focus shows both; forced colours (which drop rings) get an inset outline for the selection |
| F12 structure | the console's footer is outside main (a contentinfo landmark); the error page's main has `id="main"` |

Not exercised: the hero replay's Walk through (reduced motion only) moves focus to Next; the code is the same pattern
as the story's Skip.

## After 7.1d (1 Nov)
**Lighthouse, after** (same 13 pages and presets, the preview build of 7.1d; the dev server for the live views):

| Page | Mobile perf · a11y · bp · seo | Desktop perf · a11y · bp · seo | What moved |
|---|---|---|---|
| `/` | 96 · 100 · 96 · 91 | 100 · 100 · 96 · 91 | TBT 160 → 220 ms mobile: main-thread work fell (2.21 → 2.05 s) and the longest task shrank (170 → 163 ms), but the tasks split differently (4 → 5 over 50 ms); within run-to-run variation, not a regression found in the code |
| `/how` | **91** · 100 · 96 · 91 | 100 · 100 · 96 · 91 | TBT 660 → 370 ms mobile (P1) |
| `/work` | 89 · 100 · 96 · 92 | 100 · 100 · 96 · 92 | LCP 3.9 → 3.8 s mobile (P2, below) |
| `/story?beat=1`, `?beat=4` | 100 · 100 · 100 · 91 | 100 · 100 · 100 · 91 | |
| `/connect` | 100 · 100 · 100 · 91 | 100 · 100 · 100 · 91 | |
| console, recording | 98 · 100 · 100 · 91 | 100 · 100 · 100 · 91 | |
| console, sample file | **97** · 100 · 100 · 91 | **99** · 100 · 100 · 91 | LCP 3.3 → 0.8 s mobile; CLS 0.267 → 0.074 desktop (P3) |
| Retries, recording | 100 · 100 · 100 · 91 | 100 · 100 · 100 · 91 | |
| console, live (dev): overview, events, AI usage, Retries | – · 100 · 100 · – | – · 100 · 100 · – | |

SEO 92 → 91 is a scoring artefact: with no canonical, Lighthouse skips that check, and the preview-only robots.txt
failure (see "before") weighs more. Netlify answers `/robots.txt` with a 404, which passes.

- **P1** (`/how`): each landing page holds the wake request's state at its root, so every change (checking, waking,
  the answer) re-rendered the whole page: the terminal, the bento's real console pieces, the questions, the meshes.
  The content that doesn't depend on it is now memoized (`useMemo` in `Landing.tsx`); on Home, the replay's moments
  no longer re-render everything below the band either.
- **P2** (`/work`): the screenshot is no longer lazy, has `fetchpriority="high"`, a 640 px copy for 1× screens
  (`northstar-640.webp`, 21 KB instead of 52 KB; desktop now loads it), and a preload from the entry script, so
  Lighthouse now finds it "discoverable in the initial document". Mobile stays at 89: Lighthouse's phone (412 px at
  1.75×) needs the 1280 px file, as a real phone (3×) does, and its 3.8 s is that file over the simulated slow
  connection; the measured LCP subparts add up to about 0.3 s.
- **P3** (console): main is at least a screen tall, so the footer starts below the fold. The 0.074 left is the
  heading moving when the file's name and "Load another file" appear above it, under the 0.1 that Lighthouse calls good.
- **F11** (reduced motion), checked with Chrome forcing the setting (`--force-prefers-reduced-motion`): the band
  rests at 0 px and its pause button is gone; `/how` renders the terminal fully typed (its DOM 52 KB against 41 KB
  mid-typing). The global rule now zeroes delays too (`staticRules.test`). `useReducedMotion` follows a change of
  the setting in the replay and the terminal; the band and the mesh run no loop while it's on and start again when
  it's turned off. CountUp, the spine, the cursor light and the magnet already read the setting at each use.
- **F19**: Retries and AI usage at 320 px scroll sideways by 0 px (was 25): the hidden box holds the table.
- **F20 withdrawn**: the text the scan found outside the card is the closed "How it's counted" disclosure's;
  everything visible stays inside the card with WCAG text spacing.
- **F14, F15, T2**: no canonical (`credits.test`); `/assets/*` cached for a year (`staticRules.test`; it can only be
  seen on production, A.2); the first-try tile says "10 of 20 succeeded on try 1".

## Production (A.2, 4 Nov)
Lighthouse 13.6.0, the same presets, on https://nexus-democonsole.netlify.app with the machine idle. (A first run that
overlapped with browser checks gave blocking times of 480–1,120 ms; an idle re-run brought them back to the preview's.)

| Page | Mobile perf · a11y · bp · seo | Desktop | Note |
|---|---|---|---|
| `/` | 95 · 100 · 100 · 100 | 100 · 100 · 100 · 100 | |
| `/how` | 94 · 100 · 100 · 100 | 100 · 100 · 100 · 100 | |
| `/work` | 95 · 100 · 100 · 100 | 100 · 100 · 100 · 100 | mobile LCP 2.6 s |
| `/console`, live | 94 · 100 · 100 · 100 | 100 · 100 · 100 · 100 | after A.2c; desktop CLS 0.179 before |

SEO is 100 (91–92 on the preview: production has no preview-only issues). The live console was never measured on the
preview (it can't reach Northstar). Its desktop CLS of 0.179 came from the header: each view's headline arrived with the
data (A.2b holds its line while loading), and at laptop widths the live pill and the feed's filter no longer fit beside
each other, so the controls dropped a row (A.2c: stacked below 1500 px from the first frame). Now 0.042, from the web
fonts swapping in (left as it is). On the dev server: 1350 and 1440 px 0.005, 1536 and 1600 px 0, 800 px 0.044, 390 px 0.022.

## Fix steps
- **7.1b Announcements and names:** F5, F2, F16, F18, F1, F13, F3, F4. Pure parts first, with tests (the replay's
  captions in `heroReplay.ts`, what the pill announces).
- **7.1c Focus and keyboard:** F6, F8, F7, F9, F10, F12. F10 is shown as before/after screenshots first.
- **7.1d Motion, layout, performance, copy:** F11, F19, F20, P1–P3, F15, F14, T2; then every Lighthouse URL again,
  and a short NVDA re-run of F2, F5, F16 and F18. This document gets the "after" columns.
