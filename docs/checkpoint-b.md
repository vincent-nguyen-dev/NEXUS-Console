# Checkpoint B: findings

The gate between phase 5 and phase 6 (docs/roadmap.md). Claude audits the whole site first, then the owner's review
and ChatGPT's, then two viewers: viewer 2 from checkpoint A (the technical reviewer, still owed a session) and one new
nontechnical viewer (owner, 30 Oct). The script and the pass criteria (P1–P8) below are fixed before any session.
Fixes go in step B.1.

**Status: everything is in (31 Oct): Claude's audit, the owner's and ChatGPT's reviews, the owner's four checks, and
both sessions. Next: the B.1 scheme.**

## What changed since checkpoint A
Viewer 1 saw 1e1f8de (27 Oct). Since then: A.1 (the checkpoint fixes), 4.1–4.5 (any workflow, /connect, your own file,
watch your own enquiry), 5.1–5.4 (the map, console polish, the hero that plays, three landing pages with the spine).
`main` is still 1e1f8de; it gets everything at the end of B.0. Production serves an older build until Netlify's
credits return (about 21 Nov), so **viewers use the local dev server, never the production link.**

| Page | What a viewer meets now |
|---|---|
| `/` Home | the hero plays the recorded run (scrubber, "Play the 43 seconds"), the moving band, the problem, the live numbers row, three doors (story · console · break it yourself), the CTA band |
| `/how` | the same run three ways (terminal: raw feed, timeline, numbers), how it connects, a bento of real console pieces, questions, CTA |
| `/work` | built by, the proof, three services (no prices), who it's for, CTA |
| `/story` | five beats; beat 4 now asks "How many times was the team's email sent?" and answers it plainly (A.1) |
| `/console` | the status pill, KPI tiles with "How it's counted", the redrawn map, Latest runs, the watch panel, three sources |
| `/connect` | two paths ("Just curious?" / "Building an adapter?"), the sample, the full contract |

## Claude's audit (31 Oct, before anyone else looks)
Six pages and the console's three sources, at 1536, 1280 and 390 px, against the code. Live feed at 06:07 UTC: 19
runs in 30 days, 19 of 19 team emails sent exactly once, 18 failed tries (all from the outage switch), 9 of 9
recovered, 0 gave up. Home's row and the console agree on every one.

### Findings
| # | Severity | Surface | What, and the evidence | Proposed owner |
|---|---|---|---|---|
| C1 | major (honesty) | /work services | "Retries that can't send twice" (`Services.tsx:7`) is a guarantee the site can't back. A try that never reports back is started again; if it had sent, the email goes twice. The story's beat 4 is careful to call duplicate protection "by design; not exercised here" | B.1 |
| C2 | major (coherence) | /connect, /story, console | The three landing pages share one header (How it works · Live console · Work with me). /connect still has its pre-5.4 header (The story · Live console, `ConnectPage.tsx:107`), /story has only "Leave the story", and the console's rail links only to `/`. The shared footer (`SiteFooter`) has neither /how nor /work. From four of six pages, Work with me is unreachable except through Home | B.1 |
| C3 | minor (honesty) | /how questions | "The email failures are on purpose" (`Faq.tsx:15`) is true of today's feed, but written as a rule. A real provider error would make it false; the numbers row computes the same fact live ("all from the outage test switch") | B.1 |
| C4 | minor (copy) | /work | The proof says "NEXUS, the console you're looking at" (`Builder.tsx:30`), but on /work nobody is looking at the console | B.1 |
| C5 | minor (vocabulary) | console rail | "Guided investigation" (`Rail.tsx:139`), the story's name before 3.2. Everywhere else it's "the story" | B.1, plus a vocabulary.test entry |
| C6 | minor (repo hygiene) | tests, docs | The recording's Northstar reference appears in 4 tracked files: `CLAUDE.md`, `docs/plan.md`, `src/lib/api.test.ts:44`, `src/lib/urlState.test.ts:21`. The tests only need a value of that shape, so a made-up one works; the docs can describe it without the code. (Earlier commits still contain it.) | B.1 |
| C7 | question for the owner | Home | Two metal-edged buttons on one page: the hero's and the CTA band's. The visual rule says "the one primary button". They're never on screen together, so either the rule becomes "one per screen", or the band's button loses its sheen | owner |
| C8 | note | console | The 95th-percentile tile stands at 19 of the 20 complete runs needed. Today's 09:18 UTC scheduled enquiry should make it show a value for the first time, live. Tests cover it; nobody has seen it on real data | B.1 (check, not fix) |

### Checked and holding
- **Numbers agree** across Home's row and the console (same window, same moment).
- **Phone (390 px, iframe):** no page scrolls sideways; the only wide elements are the terminal, code blocks and the
  events table, each scrolling in its own box. No visible text below 14 px on any page.
- **Structure:** one h1 per page; a skip link first on every page; every link and button has a name (the /work image
  link takes its alt).
- **Motion:** Home runs three canvases (each stops off screen), two GPU rotations, no blur filters. A global rule stops
  every CSS animation under reduced motion (`index.css:35`); the JS-driven ones (mesh, band, spine, magnet, replay)
  each check the setting.
- **Cleanup:** in every file changed since `main`, each listener, observer and animation frame has its matching removal
  (a scan of `main..dev`, plus a read of the 5.4 hooks; there are no lifecycle tests).
- **Nothing personal or secret** in the repo or the built files: the only addresses are the builder's contact and the
  watch panel's `you@example.com` hint; no keys, tokens or env files.
- typecheck, lint, 632 tests and the build pass. Gzip: landing 22.0 kB, console 19.2 kB, story 7.7 kB, connect 9.3 kB.

### Not checked by Claude (the owner's four checks: **all four pass**, owner, 31 Oct)
1. **Smoothness:** scroll Home top to bottom with the Performance panel recording (the browser tool runs at about 1 fps).
2. **Reduced motion** on each page in a real browser (Windows: Settings → Accessibility → Visual effects → Animation
   effects off).
3. **The CTA band's Copy** on a real clipboard.
4. **CI:** the last run on GitHub Actions for `dev` (`gh` isn't installed here).

The code review was targeted (effects, cleanup, the 5.4 hooks), not a full read of all 28 commits; each step was
reviewed when it landed.

## The viewer script (fixed 31 Oct, before any session)
Checkpoint A's script, kept wherever it still applies so viewer 1's answers stay comparable. New: the notes for
Round 2, Round 5 and D9.

**Setup.** The local dev server (`npm run dev`, http://localhost:5174), on a fresh tab with no history of the site
(a private window clears the intro's dismissal and the session's watch). Note the time and the feed's run count.

**Say only:**
> "This is a website I'd like a fresh opinion on. I'm testing the site, not you, so there are no wrong answers.
> Please think out loud: what you're looking at, what you expect, what confuses you. I won't help, even if you ask.
> If you get stuck, do whatever you'd do if I weren't here, including leaving."

**Don't say:** "mock", "demo", "fake", "real", "portfolio", "I built it", "console", "background job", or anything
about Northstar. If they ask a question, reply "What do you think?" or "What would you do?" Explain only in the debrief.

### Round 1: 10 seconds (Home)
Show `/` for **10 seconds**, then switch away (Alt+Tab to a blank tab). Ask, and write the answers word for word:
- **A1** "What does this website do?"
- **A2** "Who do you think it's for?"

### Round 2: free exploration, 5 minutes, no help
"Now use it however you like, as if you'd found it yourself." Watch and note:
- their **first click**, and whether they press "Play the 43 seconds" (viewer 1 clicked the diagram but didn't read it);
- whether they use the header (How it works, Work with me) or only scroll;
- which door they take, if any;
- **stalls** over about 5 s, **misreadings**, **words** they stumble on, **dead ends**;
- whether they reach the story, the console, /how, /work.

### Round 3: the story
If they didn't finish it in Round 2: "Find out what happened in the failure this site talks about." Note answered or
skipped per question. Then, **with the screen off**:
- **B1** "Which job had the problem, and why?" (the team notification; a simulated email outage)
- **B2** "Did it recover?" (yes, on the 3rd try)
- **B3** "How long did it take in total?" (about 43 s; the recording says 42.7 s)
- **B4** "Was anything sent twice?" (no, sent once; tries 1 and 2 sent nothing). **The re-test of A's blocker S1.**

### Round 4: the console
"Now open the live part of the site." After 30 s without finding it, note that and point to "Open the live console".
- **C1** "Pick any number here and tell me what it means." Don't mention "How it's counted".
- **C2** "Is what you're seeing happening right now?"

### Round 5 (optional, only if they offer): break it yourself
If they find "Break it yourself" and want to try it, let them. They type on Northstar's form, not NEXUS; any name and
an example.com address work, and the owner gets the email. Note whether they find the switch, come back, and see their
run appear. Never ask them to type real details.

### Debrief (now you may explain)
- **D1** "In one sentence, what is NEXUS?"
- **D2** "Is the data real, simulated, or both? How can you tell?"
- **D3** "Who made this, and why does it exist?"
- **D4** "If you ran a business with a website, would you contact the person who made this? Why or why not?"
- **D5** "What was the most confusing moment? Which word didn't you know?"
- **D6** "What do you remember most?"
- **D9 (new)** "If you wanted to hire whoever made this, where would you go?" Let them look; note the time to /work or
  the CTA's "Get in touch".
- **Viewer 2 only (technical):** **D7** "Would you trust these numbers? What would you check first?" · **D8** "How would
  you connect your own system to this?" (now /connect exists: note whether they find it).

Last: **"Can I quote what you said, anonymously, in the project notes?"** Note yes or no.

**Notes format** (one line each, paste them to Claude afterwards):
`mm:ss · page · what they did / said (word for word if you can) · tag`
Tags: **missed** · **misread** · **word** · **stall** · **dead end** · **delight**. No screen or audio recording unless
they agree; a recording stays local, is never committed, and is deleted once the notes are written (L12).

## The short script (about 12 minutes per viewer; owner, 31 Oct)
Used for both B sessions instead of the full one. Every pass criterion is still tested; what's dropped is B1, B3, C2,
D4 and D6 (B1 and B3 never counted toward a pass, and D4/D6 only added colour). Setup, the opening words, the
"don't say" list and the notes format are unchanged.

| Min | Round | Do / ask | Tests |
|---|---|---|---|
| 0–1 | 10 seconds | Home for 10 s, switch away. **A1** "What does this website do?" **A2** "Who's it for?" | P1 |
| 1–4 | Explore, 3 min | "Use it however you like." Note first click, stalls, dead ends | (notes) |
| 4–7 | Story | If not done yet: "Find out what happened in the failure this site talks about." Screen off: **B2** "Did it recover?" **B4** "Was anything sent twice?" | P2, P3, P4 |
| 7–9 | Console | "Open the live part of the site." **C1** "Pick any number and tell me what it means." | P5 |
| 9–12 | Debrief | **D1** "In one sentence, what is NEXUS?" **D2** "Is the data real, simulated, or both?" **D3** "Who made this, and why?" **D9** "Where would you go to hire them?" (let them look, time it) **D5** "What confused you most?" Viewer 2 only: **D7** "Would you trust these numbers? What would you check first?" | P6, P7, P8 |

**P3 in the short script:** B2 and B4 right or partly right (B3 isn't asked). Last: ask for consent to quote.

**One at a time.** If both viewers are in the room, the second waits out of earshot (or writes their answers on paper
before anyone speaks), so neither hears the other's answers. Run viewer 3 (nontechnical) first; the technical
reviewer second.

## Pass criteria (fixed before the results)
| # | Claim | Passes when, for each viewer |
|---|---|---|
| P1 | 10-second test | A1 names both background work (tasks or jobs after the visitor leaves) and failures or retries being shown. "A dashboard" alone fails |
| P2 | Story finished alone | They reach beat 5 without help (skipping questions is fine; asking is not) |
| P3 | The answers | B2, B3 and B4 right or partly right (B3 within "about 40 s to a minute"). B1 is recorded, not counted |
| P4 | Sent once lands | B4 says "sent once" (or "no"), unprompted by the screen. **Failed in A (viewer 1: "sent 3 times")** |
| P5 | Numbers explain themselves | C1: they explain one number correctly without asking |
| P6 | Real vs simulated | D2: real runs from a real (demo) system, with a deliberately simulated outage |
| P7 | The pitch | D3 mentions a person who builds this (portfolio or freelance), not only a product. n/a for viewer 1 (not a prospective client) |
| P8 | The way to the builder (new) | D9: they reach /work or a "Get in touch" within 30 s, without help |

**Checkpoint B passes** when every criterion holds for both viewers, or every failure has a planned fix in B.1. One
viewer failing is a finding to look at, not proof on its own: a fix has to match a clear cause in the notes.

## After each session (Claude)
The notes become: the sessions table (viewers by number, never by name; quotes only with consent), the pass table
(P1–P8 with the evidence line), checkpoint A's stumbles S1–S6 revisited (fixed, better, or still open), and new
stumbles with a severity (blocker / major / minor), how many hit it, the surface, the cause in the code, and an
owner (B.1 or a later step). Blockers and majors on the landing pages or the story, and any failed P1–P8, go to B.1.

## Sessions
| | Viewer 3 (nontechnical) | Viewer 2 (technical) |
|---|---|---|
| When | 31 Oct, late evening (owner's time), first of the two | 31 Oct, after viewer 3 |
| Script | the short one, local dev server at 0165a18 | the same, plus D7 |
| Quotes | consent given | consent given |

### What viewer 3 said (as noted by the owner)
- **A1:** it checks whether background tasks fail, where, and at what time. **A2:** businesses, agencies, small teams.
- **Explore:** liked the interactive features and the grid; tried the diagrams; traced and replayed runs on the live
  console several times. Most impressed by the maps, and curious about the other pages.
- **B2:** yes, confidently, on try 3. **B4:** less confident, but no: it retried the send, it didn't send twice.
- **C1:** picked try 3 on the map: the third, successful try, about 30.2 to 31.5 s after try 2.
- **D1:** something that tracks where and when a background task fails, for the viewer to see.
- **D2:** both: the outages were simulated, the forms came from Northstar's real site.
- **D3:** Vincent Nguyen, a portfolio project. **D9:** gave the contact email address (time to find it not noted).
- **D5:** "I think the thing that confused me the most was that there was a lot to take in, and what even a workflow
  operations console actually was, but after the simplified defintion of just background tasks checks it all came
  easily after that"
- **Owner, after:** they explored every page on their own, eager for the interactive features; the amount of UI drew
  them into exploring by themselves.

### What viewer 2 said (as noted by the owner)
- **A1:** a workflow operations console that tracks when and where background tasks fail. **A2:** businesses, agencies,
  small teams, and probably solo developers who want a failure's root cause found before their product ships.
- **Explore:** went through every page in detail; noticed the map and console first; liked the bento and the spine.
  Said the site felt like one cohesive, rich, professional and clean whole, and that it made them want to explore
  rather than forcing them to.
- **B2:** yes, on the third try. **B4:** "No, nothing was sent twice. It was clear that it retried multiple times, not
  that the enquiry/form was sent multiple times."
- **C1:** of the 19, 10 were sent without a hitch and 9 were sent after retries (**right**). The owner's first note
  read "Out of the 19 simulated, 10 were sent and 9 failed"; the owner corrected it the same night: that was their own
  misreading of the viewer, not the viewer's.
- **D1:** a workflow operations console (a centralized dashboard) by Vincent Nguyen that tracks where automated
  processes fail. **D2:** "Both". Owner, after: they kept it short because the mix of real and simulated data seemed obvious to them. **D3:** Vincent Nguyen, a showcase for his portfolio.
- **D9 (under 30 s):** the contact email; they'd also check the repository behind the GitHub link.
- **D5:** understood everything; the hardest part is the learning curve at first, a visitor may see a lot and get
  overwhelmed. How it works intrigued them and confused them a little at first, but its layering cleared it up.
- **D7:** would trust the numbers; guessed the owner sent the enquiries himself; would audit Northstar's and NEXUS's
  repositories, and would look on How it works for answers first.

### Pass table
| # | Claim | Viewer 3 | Viewer 2 | Evidence |
|---|---|---|---|---|
| P1 | 10-second test | **pass** | **pass** | both A1s name background tasks and failures, with where and when |
| P2 | Story finished alone | **pass** | **pass** | both reached beat 5 without help (owner) |
| P3 | The answers | **pass** | **pass** | B2 and B4 right for both |
| P4 | Sent once lands | **pass** | **pass** | viewer 2: "It was clear that it retried multiple times, not that the enquiry/form was sent multiple times." Viewer 1 at A: "sent 3 times" |
| P5 | Numbers explain themselves | **pass** | **pass** | viewer 2: of the 19, 10 sent on the first try and 9 after retries (corrected note) |
| P6 | Real vs simulated | **pass** | **pass** | viewer 2: "Both", the mix being obvious to them (owner's follow-up); D7 names the enquiries as sent from Northstar's real site |
| P7 | The pitch | **pass** | **pass** | both name the builder and a portfolio |
| P8 | The way to the builder | **fail on time** | **pass** | viewer 3 over 30 s while exploring (owner); viewer 2 under 30 s |

**Result:** P1–P7 hold for both viewers. P8's single
failure has no cause in the notes, and viewer 2 passed it. **Checkpoint B passes:** no criterion failed with a cause
in the notes, and A's blocker (P4) holds for both.

### Checkpoint A's stumbles, revisited (viewer 3)
| A stumble | Then | Now |
|---|---|---|
| S1 each try read as a send (blocker) | viewer 1: "sent 3 times" | **fixed for viewer 3** (B4) |
| S3 "why can't I do it myself" | viewer 1 and the gate | not asked (D4 is out of the short script) |
| S4a stalls in the story | viewer 1: about 30 s per question | answered confidently (B2), hedged (B4) |
| S6 the diagram pulls clicks but isn't read | viewer 1 and the gate | **better:** C1 read a try and its wait off the map |

### New stumbles
| # | Severity | Who hit it | Surface | What, and the cause in the code | Owner |
|---|---|---|---|---|---|
| T1 | minor (friction) | all three viewers: 1 at A, 3 and 2 (D5: "a lot to take in", "a learning curve at first") | Home hero | "Workflow operations console" is the first line under NEXUS (the lockup, `Hero.tsx`) and meant nothing until the background-job definition two lines below landed. Two of two nontechnical viewers called the site a lot to take in | B.1 |
| T2 | withdrawn | — | console KPI row | Raised from the owner's first note of viewer 2's C1 ("10 were sent and 9 failed"); the owner corrected the note: the viewer read the tiles right. The first-try tile's "10 of 19 finished" (`kpis.ts:214`) still reads ambiguously on its own, but no viewer misread it | none (a candidate for 7.1's copy pass) |
| T3 | note | viewer 2 (D7's wording; the owner's follow-up says they saw the mix) | console | "the 19 sent/simulated": the word *simulated* sits on the visitor confirmation tile ("19 of 19 · simulated") next to the team's tiles, and the outage is simulated too, so the runs themselves can read as simulated. One ambiguous phrase, no wrong answer | watch |
| T4 | note | viewer 2 | footer | D7 and D9: they'd audit the repositories behind the GitHub link (gate theme 6: the trust path runs through the repos). The footer says "Source code: private for now" | 7.3, as planned |

## Reviews
### Owner (31 Oct), answering the pack's questions
1. Home still says what NEXUS is in 10 seconds: **yes**.
2. Motion: "The motion all together creates unity and is already fluid on its own, I'd keep everything." Nothing is cut.
3. /work reads as an offer from a person: **yes**.
4. Dead ends: "Everything leads somewhere, looks good." (C2 stands for /connect, /story and the console; see ChatGPT 11.)
5. Unbacked claims: agrees with the stricter reading (ChatGPT 1, 2 and 10).
6. **C7: keep both metal buttons.** The visual rule becomes "one metal-edged primary button per screen".

### ChatGPT (31 Oct), each point checked against the code
| # | Point | Verdict | Why (evidence) |
|---|---|---|---|
| 1 | "Retries that can't send twice" is unsupported | **holds** (= C1) | NEXUS sees recorded events, not the email service; a try that sent but never reported back is retried |
| 2 | "Team email sent exactly once" supports the observed runs, not a guarantee | **holds** | The tile counts one recorded `sent` result per job (`landing.ts:74`, `deliveryOf`). A send that never reported back can't appear in the feed, so the label claims more than NEXUS observes. The story already says "the only 'sent' result recorded" |
| 3 | "Home and the console agree" isn't shown to be reproducible | **partly** | Both count with the same functions (`jobFacts`, `recovered` in `metrics.ts`, imported by `landing.ts` and `kpis.ts`), but the agreement was read off two screens at one minute. A test that feeds one page to both and compares the numbers makes it a fact |
| 4 | "Every listener … cleaned up" is an absolute claim | **partly** | The evidence is a scan that every add has its remove in the same file, plus a read of the 5.4 hooks; no lifecycle tests exist (and adding a DOM test library is a dependency "just in case"). The audit's wording becomes "paired in every file (scan)" |
| 5 | /connect may lose a nontechnical visitor | **doesn't hold, beyond C2** | 4.3b gave it "Just curious?" with one-click "See the sample" and three explained edits (`sampleGuide.ts`), the contract folded below a divider. The missing exit to /how and /work is C2 |
| 6 | Live, Recording and Your file may read as three integrations | **doesn't hold** | Each source carries a persistent badge ("Recorded run, anonymized · … · not live", "Your file · name · not live", `FreshnessBadge.tsx:54`) and a strip line ("Read in this tab only: nothing was uploaded, and reloading clears it", `StatusStrip.tsx:14`) |
| 7 | The 43 s playback may delay understanding | **doesn't hold** | At rest the hero shows the whole run drawn plus one computed sentence ("…sent on try 3 after 2 failed tries, 42.7 s after the enquiry. Sent once."); the h1, sub-line and definition stand without pressing Play. P1 tests it with viewers |
| 8 | "Copy the feed" may be mistaken for live output | **doesn't hold** | The terminal is titled "northstar · /api/ops/runs · recorded 22 Oct", the line under it says what the copy is, and a loaded copy shows as "Your file · … · not live" with its own 22 Oct `now` |
| 9 | /work may leave a buyer without a concrete next step | **partly** | Every service and the CTA has "Get in touch" (mailto) and the email with Copy, but nothing says what happens after you write. That needs the owner's own words (no reply-time promise Claude can't back) |
| 10 | C1 needs fixing wherever send safety is discussed | **holds, wider than C1** | The same phrase is in the CTA band's line on Home and /how (`Landing.tsx:30`, `PITCH`), not only in Services. Elsewhere it's already careful: the hero and band ask "whether anything was sent twice", the story separates "what this recording shows" from "by design; not exercised here", /connect flags two successes as "a possible duplicate" |
| 11 | C2 is a journey problem, not two links | **holds** | The fix is the next destination from every page: /connect takes the landing header; the console rail and the shared footer (on every page, the story's included) list How it works and Work with me. The story keeps its focused header |
| 12 | A p95 from 20 runs is fragile | **partly** | The tile shows its n ("over 20 complete runs") and its window (the row's title); the disclosure shows "n = 20 → position 19". It doesn't say that one slow run moves it. A short "small sample" note while n < 40 does (CLAUDE.md: small samples say so) |

### Proposed for B.1 (with the sessions' findings, once both are in)
- **C1 + ChatGPT 1, 10:** in Services and `PITCH`, promise what NEXUS shows, not a guarantee (wording for the owner to approve).
- **ChatGPT 2:** the numbers row's label says "recorded" ("Team email recorded as sent once"), matching the story.
- **C2 + ChatGPT 11:** the landing header on /connect; How it works and Work with me in the console rail and the footer.
- **C3, C4, C5, C6** as in the audit.
- **ChatGPT 3:** a test that one page fed to `landingNumbers` and to the console's KPIs gives the same numbers.
- **ChatGPT 9:** one line on /work about what happens after you write (owner's words).
- **ChatGPT 12:** the p95 tile says it's a small sample while n < 40.
- **C7:** CLAUDE.md's rule becomes "one metal-edged primary button per screen".
- **C8:** look at the first live p95.

## B.1 built: what changed (31 Oct)
- **Send safety (C1, ChatGPT 1, 2, 10):** Services: "Retries designed not to send twice, a record that shows whether
  one did, and an alert when a job gives up." The CTA line on Home and /how: "retries designed not to send twice". Home's
  numbers row: "Team email recorded as sent once". /work's audience card: "See whether every enquiry's email went out,
  and only once, without checking an inbox." (found while checking every "twice / exactly once" in `src/`).
- **A next destination from every page (C2, ChatGPT 11):** /connect has the landing header (no status chip, so still no
  request); the footer on every page starts with a row of all six pages; the console rail lists The story, How it works
  and Work with me. The story keeps its own header.
- **Copy:** the FAQ says the failures *so far* come from the test switch, and that a real one would show as itself (C3);
  the proof reads "the console it feeds" (C4); the rail says "The story" (C5), and vocabulary.test bans "guided
  investigation"; /work's CTA adds "Write a few lines about your site. I'll reply with questions, then a short plan of what
  I'd build. No cost to ask." (ChatGPT 9, owner's choice).
- **T1:** the hero's plain definition of a background job now sits directly under "Background jobs fail quietly.", before
  the promise line.
- **Numbers:** `agreement.test.ts` feeds one page to Home's row and to the console's tiles (19 runs, 9 of 9 recovered)
  (ChatGPT 3). The p95 tile says "a small sample: the slowest one or two set it" while n < 40 (`SMALL_P95_RUNS`; ChatGPT 12).
- **Hygiene and rules:** the recording's real reference is gone from tracked files (the tests use a made-up `NS-TEST01`;
  CLAUDE.md and docs/plan.md describe the run without it); CLAUDE.md's rule is now one metal-edged button per screen (C7).
- **C8, not yet seen live:** at 31 Oct ~06:50 UTC the tile still read 19 of the 20 complete runs; the next scheduled
  enquiry (09:18 UTC) should cross it. The value and the small-sample note are covered by tests.

**Checkpoint B is done.** Left for later: the first-try tile's "10 of 19 finished" (7.1's copy pass), T3 (watch), the
repository link (7.3).
