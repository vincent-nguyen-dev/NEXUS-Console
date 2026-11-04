# Checkpoint A: findings

Two newcomers use the built site without help, then the owner's review and ChatGPT's. The script and the pass
criteria (P1–P7) were fixed before any session, in the approved plan of 2026-10-27.

**Status: 1 of 2 sessions done.** Viewer 2 isn't available yet.

## Sessions
| | Viewer 1 | Viewer 2 |
|---|---|---|
| Who | nontechnical | pending |
| When | 27 Oct 2026, evening (UTC about 21:30) | |
| Where | in person, owner's PC, local dev server at 1e1f8de (production was still a pre-3.1 build) | |
| Feed then | 11 runs in 30 days, 6 with the outage switch | |
| Quotes | consent given by a parent or guardian | |

Viewer 1 isn't a prospective client, so P7 and D4 don't apply, and answers in their own words
count. Their reactions still count where they match the earlier technical reviewer's (the usability gate of
2026-10-26, on static boards). Those points are marked **(+ gate)**: two different people hit them.

## What viewer 1 said
- **A1** (after 10 s): "I think it tracks a task when something goes wrong and tells me where and when it happened"
- **A2**: "I think it's for people like me who want to know where and when something goes wrong after completing a
  form or something on a website"
- **Round 2:** first click on the hero diagram ("the first thing that caught their eye"). They liked the animation but
  didn't read what the diagram showed. They scrolled the whole landing page, mostly looking for animations and things
  to interact with, and clicked through to the story and the console. They got "the general gist of where and when it
  failed" but said they didn't understand it in detail.
- **B1:** "Team notification". They didn't understand the visitor confirmation: they saw "done" and couldn't tell
  whether that job had a problem or succeeded.
- **B2:** "I think on try 3 it worked"
- **B3:** added the two waits, 10.2 + 30.2 = 40.4 s, and only then noticed the 42.7 s total, without thinking much
  about the difference.
- **B4:** "I think it was sent 3 times, and failed twice and got it right on the third time"
- **C1:** "I think 3 represents the amount of tries and the seconds show how much time passed until the next try or
  next send". The owner's impression: they understood the rest roughly but couldn't describe it.
- **C2:** "I don't think so, I think it happened earlier and Nexus recorded it and made this table/diagram for me, but
  it says it keeps updating so I don't really know"
- **D1:** "A website that can be used to track when and where background tasks fail"
- **D2:** "I think it's both, the stimulated outages are fake, but I think it connects to a real website called Northstar"
- **D3:** "Vincent Nguyen and its a demo for his resume I think"
- **D4:** "I think I would, but I don't know if I would hire them because why can't I troubleshoot it myself, if I was a
  regular customer I think I would, but as a business I don't think so"
- **D5:** "I feel like there's a lot to take in, and it can be overwhelming at first, the guided investigation I don't
  really get either but the vocab is okay, the context is enough but I still felt overwhelmed at times"
- **D6:** "The Diagram and the animations and the cool interactions I had"

## Pass table
| # | Claim | Viewer 1 | Evidence |
|---|---|---|---|
| P1 | 10-second test | **pass** | A1 names a task, something going wrong, and being told where and when; A2 adds "after completing a form" |
| P2 | Story finished alone | **pass, with stalls** | reached beat 5 ("Your verdict") without help, but stalled about 30 s on average and couldn't work out some of the answers (owner, follow-up) |
| P3 | The answers | **fail** | B2 right; B3 partly right (40.4 s from the waits; 42.7 s seen only afterwards, within "about 40 s to a minute"); B4 wrong |
| P4 | Sent once lands | **fail (+ gate)** | B4: "sent 3 times". The gate reviewer never mentioned it |
| P5 | Numbers explain themselves | **partial** | C1 explains tries and waits correctly; nothing else described |
| P6 | Real vs simulated | **pass** | D2: the outages are fake, Northstar is a real connected site |
| P7 | The pitch | n/a (not a prospective client) | D3 names the builder ("a demo for his resume"); D4 doubts the value for a business (stumble S3) |

## Gate themes revisited
| Gate theme (2026-10-26) | What 3.x changed | Viewer 1 | Status |
|---|---|---|---|
| 1 Context before mechanics | a one-sentence definition of a background job, plain labels | A1 and D1 get the idea; D1 uses "background tasks" | improved |
| 2 Cause and consequence | the cause of each failure shown; the outage is named as simulated | knew the outage was simulated, but a failure's cost to a business didn't land (D4) | partly |
| 3 The diagram is the magnet but unreadable | plain labels, a key, less noise | first click again, but for the animation; the content wasn't read | open (+ gate) |
| 4 Real vs simulated | "What's real here" | D2 right | resolved for viewer 1 |
| 5 The pitch sells a tool, not the builder | the builder section: "portfolio project, I build this for you" | names the builder, but "why can't I troubleshoot it myself" (gate Q11 said the same) | open (+ gate) |
| 6 The trust path runs through the repos | (repo still private) | not tested | open |

## Stumbles
| # | Severity | Who hit it | Surface | What happened, and the cause found in the code | Owner |
|---|---|---|---|---|---|
| S1 | **blocker** | viewer 1 (+ gate) | story beat 4, and the tries everywhere | Each try was read as a send ("sent 3 times"). Nothing says plainly that a failed try sends nothing. The evidence says `1 success event for the team notification (result: sent): the only "sent" result recorded.` (`sentOnce`, src/lib/story.ts:76), which is engineering wording, and the replay says "Team notification failed: the email service is down (simulated)" without "nothing was sent" | A.1 |
| S2 | major | viewer 1 | story beat 1 | "done, simulated" on the visitor confirmation (`Outcome`, src/components/story/BeatScene.tsx:81) didn't read as "worked, no problem". The ring icon isn't the ✓ success shape, and "simulated" needs explaining | A.1 |
| S3 | major | viewer 1 (+ gate) | landing page: builder section, problem section | "Why can't I troubleshoot it myself": the page doesn't say what a business loses without this (failures nobody notices until a customer complains) or what the builder does that a business can't do alone | A.1 (copy) |
| S4a | major | viewer 1 | story beats 3–4 | Stalled about 30 s per question and couldn't work out some answers. The page asks first ("Answer if you like, or skip straight to the evidence."), and they searched the screen for an answer that only comes after. Nothing says a guess is the point, and beat 4's lead ("Two tries failed and a third worked. Could the team have received the email more than once?") leans on the same tries-as-sends gap as S1 | A.1 |
| S4b | major | viewer 1 | console, Latest activity | Opening Latest activity is where they "got overwhelmed and lost" (owner, follow-up): eight rows of failures, retries and results, with job, try and cause in each | A.1 for a plain lead line if copy only; the panel's density → 5.2 |
| S5 | minor | viewer 1 | console status chip | "Live · updated 20 s ago" next to runs from hours earlier read as "new things keep happening". The chip says when NEXUS last checked, not when the newest enquiry arrived (`feedStatus.ts:57`) | A.1 if copy only, otherwise 5.2; more live activity is 4.5 |
| S6 | minor | viewer 1 (+ gate) | landing hero figure | The diagram pulls the first click but isn't read. It already leads to the story, which is where viewer 1 went | 5.1 |

**Worked well:** the diagram, the animations and the interactions (D6); the 10-second test (P1); real vs. simulated
(P6); the builder's name (D3); "the vocab is okay" (D5).

## ChatGPT's review of the A.1 proposal (27 Oct)
| Point | Verdict | Why |
|---|---|---|
| S1 is the blocker: plain rule first, then the evidence | holds | matches the notes, and beat 4's rule sat below its evidence |
| "The first two tries failed before the email service was called" | holds, for the outage switch | Northstar `backend/app/workflow.py:108` raises `simulated_outage` before `notifier.send`; every "nothing was sent" is conditional on that code |
| Avoid "only try 3 delivered" as a universal line | holds | every sentence is computed from the run, and says "sent" (a recorded result), never "delivered" or "received" |
| Beat 4: "Did the team receive the email more than once?" | partly | less leading, but "receive" claims an inbox nobody observes; used "How many times was the team's email sent?" |
| Landing line "Retries aren't duplicate emails…" | doesn't hold | false in general (a careless retry can duplicate, which is the landing page's own problem card), and "attempts" is a forbidden word |
| S2: "✓ Form submission succeeded" | doesn't hold | the visitor confirmation isn't the form submission; the success-then-caveat split was adopted |
| S2: a genuine success icon | not adopted (owner) | ✓ keeps meaning "an email was really sent", which S1 teaches; the ring stays and the hero key explains both |
| S3: don't imply NEXUS alerts; S5: two separate facts | holds | the alert stays in the builder's offer; the strip says "checked" and the newest enquiry apart |
| S4a, S4b copy only; S6 deferred; viewer 2 on the fixed site | holds | as built |

## A.1 built: what changed between viewer 1 and viewer 2
Viewer 1 saw 1e1f8de. Viewer 2 sees the A.1 commit. The script and P1–P7 are unchanged.
- **S1:** the replay says "…, so nothing was sent" on each failed outage try, and the hero note says the same
  ("Why tries 1 and 2 failed: email service down (simulated), so nothing was sent").
  - Beat 4 asks "How many times was the team's email sent?" (Once · More than once · Not at all).
  - After the reveal it says "Once. Try 3 sent the email. Tries 1 and 2 failed before Northstar contacted the email
    service (the outage switch stops there), so they sent nothing.", then "3 tries · 2 failed · 1 sent", then the
    timeline.
- **S2:** the visitor confirmation "worked on try 1 · simulated", with "no email goes to visitors" after it (hero,
  beat 1, replay, console events). The hero key adds "✓ An email was really sent" and "○ Finished, nothing sent
  (simulated)".
- **S3:** the builder section answers "Why not just fix it yourself?".
- **S4a:** beats 3 and 4 say a guess is the point. The answers are in plain words (beat 5 shows the same ones).
- **S4b:** Latest activity opens with what one row is.
- **S5:** "Live · checked 20 s ago" plus "Newest enquiry 17 h 29 min ago" on the console (on the server's clock). The
  landing chip says "checked … · newest enquiry …".

**Found while building (→ 5.2):** the console's event tones predate the v2 ring. Latest activity, the events table and
the drawer still give ✓ to any success, simulated ones included, so there ✓ means "the job succeeded". The hero key
only describes the hero figure, where ✓ is the real send, so it stays true. Making the console use the ring for
simulated results belongs to the console polish step.

## Open
- **Viewer 2, deferred (owner, 28 Oct):** the technical reviewer is away for a few days, so phase 4 goes ahead
  rather than waiting. When they're back: the A.1 site (or whatever `dev` is then, with the changes since A.1
  noted here), the same script and P1–P7. They confirm or refute S1–S4 and answer D7–D8. Their findings get their
  own fix step.

## A.2 production check (once Netlify deploys again, about 21 Nov)
Only the owner can see the Netlify dashboard. After the credits reset (21 Nov), trigger the deploy of `main` by hand
(nothing new was pushed, so Netlify won't start it; docs/operations.md). When it goes through, check:
- `/`, `/how`, `/work`, `/console`, `/story` and `/connect` (and their trailing-slash forms) return 200 from netlify.toml's
  rewrites, and `/#builder` lands on `/work` (5.4a);
- `/og.png` exists;
- the CSP headers are unchanged, and the console shows no CSP errors;
- the landing page's wake request reaches Render (CORS allows the production origin), the story replays, and the console
  goes live;
- `/connect`: its links resolve, and the live feed's `workflow` still equals the description in the page's example.
- `/sample-feed.json` downloads, and `/console?mode=file` loads it with no request beyond NEXUS's own files.
- 7.2a: a Netlify deploy preview (or branch deploy) shows "Preview · no live data" and sends no request to
  onrender.com (the browser's request list), while production goes live.
- 7.1: Lighthouse (mobile and desktop) on `/`, `/how`, `/work` and `/console`, compared with the preview numbers in
  docs/accessibility.md; `/assets/*` answers with `Cache-Control: public, max-age=31536000, immutable`.
- 4.5: "How it works" → "Open Northstar Digital's form" opens Northstar in a new tab; an enquiry sent there is listed in
  the console's watch panel at the first check after coming back, and its Latest activity rows carry the tag.

A local build doesn't prove any of this.

### A.2 results (4 Nov 2026: production deploys of 96565f3, then a99f7c9 and d28566f)
The owner bought Netlify credits (3 Nov) and triggered the deploy by hand. Every check passes:
- **HTTP (26 of 27):** every page and its trailing-slash form 200 (a query survives the rewrite); `/og.png`, the favicon and
  `/sample-feed.json` (8 runs); an unknown path 404s; the CSP matches netlify.toml exactly on `/`, `/console` and
  `/connect`; the four security headers; `/assets/*` `public,max-age=31536000,immutable` (Netlify drops the spaces).
  The 27th, the entry file's name against a local build, differs only because a Windows checkout gives the three
  adapter excerpts CRLF line endings (the repo and Netlify have LF): stripped of hashed names, every chunk is
  byte-identical except `/connect`'s, whose difference is exactly those 60 `\r`.
- **Northstar (2 Nov, again 4 Nov):** CORS answers the production origin on health, runs and AI (a preflight too); other
  origins get no allow header. The live `workflow` equals the recording's description. /connect's AI example is labelled
  "Frozen on 31 Oct 2026" and predates N4's second model: honest, left as it is.
- **Browser:** `/#builder` lands on `/work`; Home goes live with 1 request to Northstar; the story plays by itself
  (beat 2 reached try 2 with "real wait 10.2 s · shown in 3.1 s"); the console is live and each view polls only its own
  feed (overview runs, AI usage ai, both models priced); `/connect` has 13 in-page links, none dead; the sample file
  loads with no request outside NEXUS; no console errors or CSP refusals on any page.
- **4.5:** the owner started the watch and sent an enquiry (run dec2, 4 Nov 09:14 UTC, outage off): the panel listed it
  and its Latest activity rows carried the tag.
- **7.2a:** deploy preview 2 (`dev` with A.2b) says "Preview · no live data" on Home, the console and AI usage, and the
  browser's resource list holds no request to onrender.com.
- **Lighthouse:** docs/accessibility.md, "Production (A.2)". It found one issue: the live console's desktop CLS was 0.179
  (A.2b and A.2c fixed it, now 0.042).

