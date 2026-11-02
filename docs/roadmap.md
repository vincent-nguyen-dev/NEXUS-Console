# NEXUS roadmap v2 (2026-10-24)

## Why a new roadmap
Steps 01–06 proved the engineering, and that stays the foundation:
- honest data from a real system;
- hand-checked metrics (283 tests);
- every data state (loading, waking, stale, empty, error);
- a map, signals, an events explorer, a run drawer and a guided investigation.

The user's review of 06 ("a little confusing, especially for a new user or client") showed what's missing. It isn't engineering. It's the **story and the presentation** for someone who stumbles onto the site.
- v1 was built feature-first: P0 and then P1, as in docs/plan.md.
- v2 is built visitor-first. First: who arrives, what do they understand in 10 seconds, and what makes them stay or get in touch? Then the realism that makes the product believable. Then depth.

**Unchanged rules** (CLAUDE.md):
- Data honesty: no faked systems or customers, and every sample is labeled.
- One roadmap step = one reviewable commit.
- Each step starts with "scheme step X" (plan mode, then your and ChatGPT's review).
- Pure logic gets tests before UI, and no dependency is added "just in case".

## Where things stand
- `main` (production) = a2c1c3d, steps 01–05. `dev` = c503174, step 06.
- **Step 06 ships to `main` as an interim with 1.1** (user, 2026-10-24). Its engine stays: `tour.ts` (computed findings, the quiz checked against the data, evidence detected from the URL) and `useTourHighlight`. Its presentation, a card over the full console, is replaced in step 3.2.
- Old P1 steps are folded in:
  - 07 Explain-every-number → 3.3;
  - 07 Retries view → 6.2;
  - 08 Replay → 3.2 (it becomes the heart of the guided story);
  - 09 AI usage → 6.1;
  - 10 Polish → 7.

## The limitations this roadmap answers
| # | Limitation | Answered by |
|---|---|---|
| L1 | No story for a newcomer: they land on a working dashboard, not a problem they recognize | 3.1, 3.2 |
| L2 | Not tailored to who arrives (a client wants "what does this do for me", an engineer wants "how is it built") | 3.1, 4.2 |
| L3 | The UI/UX is correct but not distinctive ("more interesting and unique") | 2, 5 |
| L4 | The guided investigation is confusing and not engaging: a card over the full console sends people hunting for highlights | 3.2 |
| L5 | It doesn't say who built it; a client who likes it has nowhere to go | 1.1 |
| L6 | The first seconds can look broken: Render sleeps, and waking takes about 1 min | 3.1 (the landing page needs no API and wakes Northstar in the background) |
| L7 | Live data is thin (6 runs, so most numbers say "No rate yet") and quiet ("22 h ago") | 1.3, 3.3, 4.5 |
| L8 | Vocabulary is inconsistent ("attempt" vs "try") and leaks engineering terms | 1.2 |
| L9 | Hard-wired to Northstar: the three jobs and the map geometry live in the code | 4.1, 4.2, 4.3 |
| L10 | The guided investigation is one fixed recording | 4.3 (your own file), 4.5 (watch your own enquiry) |
| L11 | Accessibility and performance are untested (no screen-reader pass, no Lighthouse) | 7.1 |
| L12 | No way to know whether visitors understand it | Checkpoints A and B (watch 2 people for 5 minutes; no tracking) |
| L13 | Two free tiers hold it up (Render sleeps, Neon has 100 CU-h a month) | 1.3 (budget), 7.2 |
| L14 | Deploy previews always show "Offline" (CORS allows only production) | 7.2 |

## Phases at a glance
| Phase | Steps | Outcome | Size |
|---|---|---|---|
| 1 First impressions | 1.1 credits · 1.2 vocabulary · 1.3 keep the data alive | Safe to show to someone | S |
| 2 Visual direction v2 | 2 mockup canvas (no app code) | An approved look for everything that follows | M |
| 3 The story | 3.1 landing · 3.2 guided investigation v2 · 3.3 console explainers | A stranger understands NEXUS in 10 s and enjoys the walkthrough | L |
| ✓ Checkpoint A | | merge to `main`, watch 2 people, your + ChatGPT review | |
| 4 Realism | 4.1 generic workflow model · 4.2 connect-your-system page · 4.3 your own file · 4.4 (optional) second system · 4.5 watch your own enquiry | NEXUS is clearly a product, not a Northstar page | L |
| 5 Console visual upgrade | 5.1 map upgrade · 5.2 console polish | The console matches the new look | M |
| ✓ Checkpoint B | | your + ChatGPT review | |
| 6 Depth | 6.1 AI usage · 6.2 retries | Shows AI-integration skill and retry analysis | M |
| 7 Prove and ship | 7.1 accessibility + Lighthouse · 7.2 operations · 7.3 README + portfolio brief | Claims verified, ready to share widely | M |

## Phase 1: First impressions (small, before showing anyone)
**1.1 Credits and contact (L5).**
- A visible "Built by …" line with a link to your portfolio and contact, in the rail and on the landing page later.
- Also the page `<meta>` description and an Open Graph image for link previews. (Is an OG image allowed under the CSP? Check in the scheme.)
- **Decided (user, 2026-10-24):** "Vincent Nguyen"; the email vincent.cao.nguyen.work@gmail.com and the GitHub profile
  (it has no public repos yet; 7.3 revisits that); the tone is "portfolio project, available for freelance work".
- Done when: every page says who built it, and the link works.

**1.2 One vocabulary (L8).**
- A short glossary in `src/lib/` (job, try, retry, run → "lead", …) decides one plain word per idea. A test then forbids the losing words in UI strings.
- Today: "attempt" in signals vs "try" on the map; "run" vs "lead"; "purge" vs "personal data deletion".
- Done when: one word per idea everywhere, and the test holds it.

**1.3 Keep the data alive (L7, L13).**
- Finish task S (about 25 leads over ≥ 3 days, half with the outage switch).
- Add a **small daily scheduled lead**: real traffic through Northstar's real form, labeled "owner test traffic", so the console is never days stale.
  - It might be a GitHub Actions cron in the Northstar repo.
  - Check Northstar's form protections, the 10/day/IP limit and the email cap.
  - Count the cost: one lead a day = one team email a day, plus brief Render/Neon use. Write the budget down.
- **Needs from you:** OK to schedule a daily test lead, and whether its team email should really send.
- Done when: the 30-day window always has recent runs and the KPIs have enough data to show values.
- **Built (2026-10-25):** Northstar's `demo-traffic.yml`, one labeled enquiry (outage switch on even days) and one
  chat a day at 09:18 UTC (the user chose daily, in the Northstar repo, with a chat). After the first manual run (8
  runs), the recovery rate gets its 5th failure from the 09:18 UTC run the same day, and the 95th percentile its 20
  runs around 5 Nov. The budget
  is in docs/operations.md.

## Phase 2: Visual direction v2 (design only, like D0)
**2 Mockup canvas (L3).** One review canvas before any new UI is built, covering:
- **Landing page:** hero, the problem in one sentence, the "how it connects" diagram, two audience paths, credits.
- **Guided investigation v2:** the story layout, the replay, the chapter visuals, the verdict.
- **Console refresh:** the hierarchy, cards, the map-upgrade concepts, and how thin data is shown.

It extends the D0 tokens rather than replacing them: the signal-box metaphor, AA contrast, a shape for every status, reduced motion.

The "later layer" ideas get decided here: gradients, borders, hero. **Needs from you:** what "clients" and "hooks" meant in that list (still unasked since 2026-10-22).

Done when: you (and ChatGPT) approve the canvas.

**Done 2026-10-26.** Canvas: https://claude.ai/artifact/DS9jrA6xcKGiUsHVSEmtKK. Direction A × C (A's route as the
identity, C's composition, B's event tape for the story); the rules are "Visual language v2" in CLAUDE.md. "Clients"
meant both who NEXUS is for and the builder's own pitch; "hooks" meant both attention hooks and the integration story.
The usability gate (two strangers, three questions) runs alongside 3.1.

## Phase 3: The story
**3.1 Landing page (L1, L2, L6).** The new front door. The console moves one click inside; the URL rules are decided in the scheme.
1. **Hero:** "Background jobs fail quietly. NEXUS shows what ran, what retried, and proves nothing was sent twice." A small live replay of the recorded failure plays beside it (still frames when reduced motion is on).
2. **"How it connects":** your app → its background jobs → one read-only feed → NEXUS, with Northstar named as the connected example.
3. **Two doors, so it fits the audience (L2):**
   - *"See it solve a real failure"* (3.2) for clients and newcomers;
   - *"Open the live console"* and *"How it's built"* (4.2 and the README) for engineers.
4. **Live status chip** ("Northstar: 6 runs in 30 days · updated 4 min ago"). The landing page sends **one** request to wake Render while the visitor reads, so the console is ready when they click (L6). It renders fully without that answer.
5. **Credits** (1.1).

Done when: a stranger can say what NEXUS does after 10 seconds (tested at checkpoint A).

**Built 2026-10-26 (on `dev`).** The usability gate ran with one technical reviewer (the nontechnical one couldn't
come, so checkpoint A must include a nontechnical person). Their answers changed the boards: a NEXUS lockup above the
headline (the headline made NEXUS look like a supplementary site), a one-sentence definition of a background job,
the figure's labels in plain words with the cause of each failure and a key, a "What's real here" block, and a
builder section that says NEXUS is a portfolio project and the offer is building this for you. URLs: `/` is the
landing page, `/console` the console, and old `/?view=…` links move there. The story door opens the console's
guided investigation until 3.2.

**3.2 Guided investigation v2: a story, not a scavenger hunt (L4, L1).**
It's a focused, full-width story layout, not a card on top of the console. One idea per screen, large visuals, plain words first, with "Show the evidence" opening the technical detail.
1. **The scene.** "22 Oct, 03:07 UTC. Someone sends the contact form on Northstar's site. Northstar must email the agency, but the email service is down (simulated outage)." It includes a simple illustration of the three jobs a lead starts.
2. **Watch it happen.** The replay (old step 08, now `src/lib/replay.ts`, pure and tested):
   - the run plays along a single-run track: try 1 ✕, a 10 s wait, try 2 ✕, a 30 s wait, try 3 ✓;
   - a clock counts +0.0 → +42.7 s, and long waits are compressed with a label;
   - play, pause and step controls; reduced motion gives step buttons only.
3. **Did it recover?** The visitor clicks the deciding moment on the replay track. The finding comes from `tour.ts`.
4. **How long?** Planned vs actual waits as bars (10 s → 10.2 s, 30 s → 30.2 s), and the total, 42.7 s, of which 40.4 s was waiting.
5. **Was it sent twice?** The single success event, plus a plain picture of the safety rule (one job per lead, and Northstar can't queue it twice).
6. **Your verdict.** The quiz checked against the data (kept from 06).
7. **Now see it live.** A hand-off into the console, with "what to look for" pointers.

Kept from 06: computed findings, evidence detected from state, the quiz, the dashed highlight.
Dropped: the card stacked over the full console.
Done when: two newcomers finish it without help and can say the three answers (checkpoint A).

**Built 2026-10-26 (on `dev`), in 5 beats (user's choice), not 7:** which job failed · watch it happen · did it
recover (with how long) · was it sent twice · your verdict (with the hand-off). The landing page already sets the
scene. Changed from the list above: "evidence detected from state" and the dashed highlight are dropped; each beat
asks first and shows the evidence after an answer or a skip, and Next is never locked (that hunt was what confused).
The quiz's three questions are spread over beats 3–4 and checked on beat 5. Beat 4 separates what the recording shows
from what Northstar's design guards against (ChatGPT review). The story lives at `/story`; the console keeps the
recording as a data source.

**3.3 Console explainers (L1, L7; old step 07 "explain every number").**
- Every number gets "How is this counted?": formula, numerator and denominator, n, window, source.
- Thin data is shown as progress, not absence: "Recovery rate: 3 of the 5 failures needed".
- Each panel gets a one-line "What am I looking at?"
- Done when: no number or panel on the console needs outside explanation.

**Built 2026-10-27 (on `dev`).** Progress shows facts only (the count, the latest arrival, a window hint); the pace
forecast was dropped because it predicted the owner's schedule rather than describing recorded data.

**✓ Checkpoint A:** merge to `main`. Watch 2 people (ideally one non-technical) use the site for 5 minutes, without helping (L12). Then your review and ChatGPT's. Fix what they stumble on before Phase 4.

**Viewer 1 done 2026-10-27** (nontechnical, on the local dev server: production still served a pre-3.1
build because Netlify's credits ran out). The script, the pass criteria P1–P7 and the findings are in
`docs/checkpoint-a.md`. It passed the 10-second test and real vs. simulated. It failed "sent once" (each try read as a
send), which the gate reviewer had also missed. **A.1** fixes the six stumbles with copy and success wording only.
Viewer 2 tests the fixed site, and the production check waits until Netlify deploys again.

## Phase 4: Realism (a product, not a Northstar page)
**4.1 Generic workflow model (L9).**
- The feed describes its own workflow: steps, a plain purpose for each, the retry policy, and flags like "simulated, never sends".
- NEXUS draws any workflow from that description: lanes and labels stop being hard-coded (`STEP_KINDS`, `format.ts` labels, `mapLayout.ts` with its 3 lanes).
- **Cross-repo:** step N2 in Northstar adds the description to its ops feed. Northstar keeps working as connected system #1.
- Done when: NEXUS has no Northstar-specific step names in its code, only in Northstar's feed.

**Built 2026-10-28** in three commits: N2 (Northstar f37d33e, the feed's `workflow`, version 1), 4.1a (NEXUS reads it
everywhere: roles in `src/lib/workflow.ts`, `generic.test`, a made-up shop workflow through the same code) and 4.1b
(the trigger noun and one purpose per job). Correction to the list above: `mapLayout.ts` already drew any number of
lanes; the three were fixed in `buildTopology`, which iterated `STEP_KINDS`.

**4.2 "Connect your system" page (L2, L9).**
- The feed contract, as an annotated JSON example.
- What an adapter does (read your job table, leave personal data out), with Northstar's real adapter as the worked example.
- Which job systems map cleanly: Celery, BullMQ, Sidekiq, a jobs table.
- It's the engineer's door from 3.1. Done when: a developer could write an adapter from this page alone.

**Built 2026-10-28** at `/connect`. The field reference and its limits are tested against the parser both ways, the
example is the real recording, the adapter excerpts are Northstar's own code, and the job-library guide is labelled as
untested. "How it's built" and every footer link to it; repo links are hidden while the repo is private. Reviewed by
ChatGPT (two-way contract test, the 10-try limit as a compatibility rule, the security boundary, one try traced end to
end, no dead repo links, local vs. production checks), all adopted.

**4.3 Try it with your own file (L9, L10).**
- A visitor drops in a JSON file in the contract's shape, or downloads a sample to edit, and NEXUS renders it.
- It stays entirely in the browser: nothing is uploaded or stored.
- It's labeled "Your file" everywhere, and it goes through the same field checks as live data.
- Done when: the sample file and an edited one both render, and broken files get clear errors.

**Built 2026-10-28** as a third data source in the console ("Your file", `mode=file`), loaded from the console or
`/connect`. The file is held in memory only, and the sample is a made-up shop (user's choices). It's checked by the same
parser as the live feed, plus a 5 MB and 500-run limit. In the browser, loading a file made no request except a font
the page's CSS asked for, and nothing about the file was stored.

**4.3b Approachability (2026-10-28, after the user's review of /connect and "Your file").** A non-technical visitor
landing on /connect was overwhelmed, and editing the sample wasn't explained. /connect now opens with two paths: "Just
curious?" leads to a one-click sample and three explained edits; "Building an adapter?" leads to the full contract,
folded below a divider. Plain glosses were added for the developer terms.

**4.4 (Optional) A second real connected system.** *Deferred by the user (2026-10-28); available for a revisit.*
- A small system you own (for example, a scheduled script with a few jobs), so the system switcher shows two real entries.
- Only if 4.1–4.3 leave the product still feeling single-purpose.

**4.5 Watch your own enquiry arrive (L7, L10).**
- On the landing page or the console: "Send a test lead on Northstar (outage switch optional) and watch it appear here within 30 s." It's real, engaging, and proves the live link.
- It uses Northstar's real form, so the visitor enters their own details there. Northstar deletes them after 7 days, and NEXUS never sees them.
- Done when: the round trip works and the new run is highlighted when it arrives.

**Built 2026-10-29** as a watch panel in the live console. The visitor opens Northstar's form from it, and every run
created since then is listed with its state at the last update, and tagged in Latest activity. NEXUS can't tell whose
enquiry it is, and says so. It adds no requests, the watch is kept in the tab only, and the traffic labels now include
visitors. Verified with one real enquiry (outage switch on): it was listed 21.0 s after the watch started and finished
"recovered after 2 failed tries", 42.8 s after the enquiry.

## Phase 5: Console visual upgrade (L3)
- **5.1 Map upgrade:** more features and a more innovative look, from the Phase 2 concepts (planned since the 04 review).
  Round C mockups and an effects lab were approved on 29 Oct (plan, decisions and both reviews: the 5.1 plan file). It ships in
  three commits: 5.1a the test-switch filter and data-truth fixes (split main line, the simulated ring everywhere, tries
  1–10 in URLs), 5.1b the wide map redraw, 5.1c the vertical route for phones. **Done 29 Oct** (c5b1366, 496e383, 30e3ed8).
- **5.2 Console polish:** apply the v2 look across the overview, events and drawer, and refine hierarchy and density.
  Schemed 29 Oct with your 21st.dev references and ChatGPT's review: Round D boards and a lab first, then 5.2a overview
  (status pill, KPI row, Latest runs, one row per run, for S4b), 5.2b events and drawer, 5.2c rail and phone.
  Round D and the lab were published on 30 Oct (numbers from the feed of 06:14 UTC); 5.2a, 5.2b and 5.2c are built. **Done 30 Oct** (8cde070, 74f39fb, c850823, 2f0df51).
- **5.3 Landing hero S6 + a scroll-velocity band:** split off 5.1. **Done 30 Oct** (95aa19f, a994ec1, 85c53a0): the hero
  plays the recording with a scrubber, a scroll band of the three promises, a workflow mesh and pathways.
- **5.4 Landing sections + the page spine:** real numbers, the same run three ways, a bento of console pieces, break it
  yourself, services, FAQ, final CTA, a lit route down the page.
- **✓ Checkpoint B:** your review and ChatGPT's.

## Phase 6: Depth (the old P1 features)
- **6.1 AI usage view:** chats per day, tokens, latency p50/p95 with n guards, and the error rate. Cost is labeled as an estimate, with its formula. This shows the AI-integration side of your freelance offer.
- **6.2 Retries view:** the distribution of tries, and actual waits vs the configured backoff.
- **Done 31 Oct** (scheme, Round G boards and lab, N3 in Northstar, 6.1a/b, 6.2a/b): two console views as four-card
  bentos in hand-drawn SVG. AI usage reads the AI feed with its own description (the call noun, outcomes, and each
  model's list price, so NEXUS names no model); Retries adds tries per job, waits as lateness, failures by day and
  the retry paths the data hasn't exercised.

## Phase 7: Prove and ship
- **7.1 Accessibility and performance (L11):**
  - a real screen-reader pass (NVDA on Windows);
  - keyboard-only and reduced-motion runs;
  - Lighthouse in Incognito on production;
  - fix whatever they find.
- **7.2 Operations (L13, L14):**
  - review the free-tier budget (Render hours, Neon CU-h against the polling and daily-lead numbers);
  - make deploy previews honest: detect the CORS refusal and say "Previews can't reach Northstar; production can. Try the guided story," instead of plain "Offline".
- **7.3 Ship:** README with screenshots, sync the portfolio brief (https://claude.ai/artifact/KUUEgHPA9N2i4jMDaE5adr, "04 Two demos"), final review.

## Order and dependencies
```
1.1 ─ 1.2 ─ 1.3 (S runs in parallel)
        └─ 2 (canvas) ─ 3.1 ─ 3.2 ─ 3.3 ─ ✓A ─ 4.1 ─ 4.2 ─ 4.3 ─ (4.4) ─ 4.5 ─ 5.1 ─ 5.2 ─ ✓B ─ 6.1 ─ 6.2 ─ 7.1 ─ 7.2 ─ 7.3
```
- 1.2 comes before the canvas, so the mockups use the final words.
- The canvas comes before 3.x, so the new surfaces are built once, in the new look.
- 4.1 comes after checkpoint A, so the story is validated before the architecture change. The story also doesn't depend on 4.1: it uses the recording.

## Open questions (asked in the step that needs them)
1. ~~Your name and links for the credits (1.1).~~ Decided; see 1.1.
2. A daily scheduled test lead: OK? Should its email really send (1.3)?
3. What "clients" and "hooks" meant in the later layer (2).
4. ~~The landing page at `/` and the console behind it: OK to change the default URL (3.1)?~~ Decided (user,
   2026-10-26): `/` is the landing page, `/console` the console; links with console keys are moved there.
5. ~~Merge 06's current presentation to `main` now as an interim, or wait for 3.2?~~ Decided (user, 2026-10-24):
   06 ships as an interim, together with 1.1 (one branch, `dev` → `main`), and 3.2 replaces its presentation.
