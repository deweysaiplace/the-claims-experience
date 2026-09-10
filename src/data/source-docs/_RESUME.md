# RESUME — Policy + Claim Manual ingestion

Last updated: 8/18/2026. Read this first if you are picking this up cold.

## 8/18 AUDIT — the transcription work was never actually wired in

Jason used the live app today and asked whether Policy Chat was using the
updated policy. It was not. Audited the running code start to finish:

- **Policy Chat's live data source is `src/data/extracted-policy.ts` +
  `extracted-guidelines.ts`, dated June 27** — nearly two months before this
  transcription project existed. `extracted-policy.ts` is not even real
  policy text: it is a table-of-contents outline. Its own content literally
  says *"the full text for each section is not visible; this is a list of
  the sections themselves."* Policy Chat has been answering coverage
  questions off a section list, not contract language.
- `src/lib/policy-docs-search.ts` (`getPolicyDocsText`/`policyDocsAvailable`)
  — the search/formatting layer built for exactly this purpose, well-designed,
  query-scored, gap-aware, budget-capped — **is imported nowhere in the app.**
  Confirmed via `grep -rl "policy-docs-search" src/`: zero results. Built,
  never connected.
- `src/app/api/code-reference/route.ts` (the Xactimate code-lookup feature)
  *is* correctly wired to its own live corpus via `getFocusedCodesText` —
  that part works as designed. Policy Chat is the actual gap.
- `policy-chat/route.ts` takes `policyText` from the client per-request, and
  `policy-chat/load-docs/route.ts` is what supplies it — currently straight
  from the stale `EXTRACTED_POLICY`/`EXTRACTED_GUIDELINES` constants.

**Architecture note for the rewire:** `getPolicyDocsText(queryText, maxChunks,
maxChars)` does per-question relevant-section retrieval, not "load the whole
corpus once." That's the right shape for an expandable corpus — a full-text
blob approach gets worse (slower, costlier, eventually blows the context
window) every time a new document is added; query-time retrieval stays flat
no matter how large the corpus grows. **The rewire should call
`getPolicyDocsText` server-side, per-question, inside the actual chat route**
— not extend the existing "fetch full text once, client holds it" pattern.

**The ingestion pipeline itself is already properly expandable — do not
redesign it.** `scripts/build-policy-docs.js` auto-discovers every `.md` in
`src/data/source-docs/` (`fs.readdirSync(...).filter(f => f.endsWith('.md'))`
— no hardcoded file list) and chunks by heading with gap-flagging built in.
Adding a new document going forward is: transcribe it into a new `.md` file
in that directory following the existing house style (verbatim, `[CAPTURE
GAP]`/`[ILLEGIBLE]` for anything not actually read, a `## TRANSCRIPTION
NOTES` section listing photos processed), then re-run the build script. No
code changes required for a new document. The same should be confirmed/built
for Xactimate codes (`src/lib/xactimate-codes-search.ts` and its data
source) if it isn't already this clean — check before assuming.

## Goal

Get State Farm's HW2130 policy form and three Claim Manual Operation Guides into
the Claims Experience app as the authoritative source the AI reasons from —
so Claim Consult / Quick Lookup answer coverage questions off the actual
contract and procedure text instead of general knowledge.

Jason's framing: **this should be the gospel for claim handling decisions.**
Accuracy over speed. Never let the AI fill a transcription hole with a guess.

## Source photos

`C:\Users\Dewey\Desktop\docs` — ~250 phone photos of a monitor (Word doc for the
policy, ServiceNow browser for the Operation Guides). Images are rotated 90°/180°,
some glare, many show two pages side by side.

| Photo range | Document |
|---|---|
| `20260815_143150` – `143559` | HW2130 Homeowners Policy |
| `20260815_143918` – `144017` | Op Guide **75-20 Water Damage Losses** (KI460567, 02-26-2025) |
| `20260815_144104` – `144139` | Op Guide **75-101 Section I – Additional Coverages** (KI460543, 06-19-2024) |
| `20260815_144234` – `144404` | Op Guide **75-160 Wind/Hail Roofing Guidelines** (KI460565) |

Note: `144259(0).jpg` and `144303(0).jpg` have parenthetical suffixes — don't skip them.

## Output files (this directory)

| File | Photo range | Written by |
|---|---|---|
| `hw2130-policy.md` | 143150–143222, 143326–143401 | main session (done for that range) |
| `hw2130-policy-part2.md` | 143225–143334 | subagent |
| `hw2130-policy-part3.md` | 143403–143457 | subagent |
| `hw2130-policy-part4.md` | 143504–143559 | subagent |
| `og-75-20-water-damage.md` | 143918–144017 | subagent |
| `og-75-101-additional-coverages.md` | 144104–144139 | subagent |
| `og-75-160-wind-hail-part1.md` | 144234–144311 | subagent |
| `og-75-160-wind-hail-part2.md` | 144313–144404 | subagent |

Seven subagents were launched in parallel on 8/15 and instructed to write
incrementally, so whatever is on disk is real work even if a session died.

**To check what's actually complete:** each file should end with a
`## TRANSCRIPTION NOTES` section listing every photo processed. A file without
that section was interrupted — check its last heading and relaunch a subagent
for the remaining photos in that range.

## What's already built (code)

- `scripts/build-policy-docs.js` — chunks these .md files into
  `src/data/policy-docs.json`. Splits on headings only (never mid-provision).
  Flags any chunk containing `[ILLEGIBLE]` / `[CAPTURE GAP]`.
  Run: `node scripts/build-policy-docs.js`
- `src/lib/policy-docs-search.ts` — scores sections against a question, returns
  only genuine matches (never pads with filler), formats them for the prompt
  with instructions to quote verbatim, cite the heading trail, and refuse to
  stretch an inapplicable exclusion.
- `src/data/policy-docs.json` — generated index. Safe to delete/regenerate.

Both typecheck clean. Nothing existing was modified.

## Adding a new document

Confirmed still true as of 8/18, after Phase 1's rewire: **adding a document
requires zero code changes.** `policy-chat/route.ts` calls
`getPolicyDocsText(question)` fresh on every request — it never hardcodes a
document list, chunk count, or filename anywhere. The only thing that changes
when a document is added is the content of `policy-docs.json`, which is
entirely regenerated from whatever `.md` files are sitting in `source-docs/`.

To add a new policy or Claim Manual document:

1. **Transcribe it into a new `.md` file directly in `source-docs/`** (not a
   subfolder — the build script only scans this one directory, non-recursively).
   Follow the house style established by the four documents already here:
   - Verbatim only. Never paraphrase, summarize, or "clean up" source wording
     — an adjuster or the AI may need to quote it exactly.
   - Mark anything not actually legible/captured with `[ILLEGIBLE]` inline or
     a `> **[CAPTURE GAP — ...]**` blockquote explaining what's missing and
     why. Never fill a gap with something that sounds plausible — a visible
     gap is safer than invented policy language. See `getRelevantPolicySections`'s
     own comment in `policy-docs-search.ts` for why this matters to the AI
     layer specifically.
   - Split content with `##` (major section) and `###` (subsection) Markdown
     headings only — the build script chunks on those boundaries and nothing
     else, so a chunk is always a complete provision, never a fragment that
     reads differently out of context.
   - **Keep headings short and specific**, closer to `## SECTION I – LOSSES
     NOT INSURED` than to a full sentence. The retrieval bugs fixed in Phase 5
     both trace back to OG 75-160 having long, prose-like subsection headings
     ("...Insured took Reasonable Steps to Mitigate and Arrange for
     Repairs") — those still work now that stopwords/stemming are handled,
     but a short, keyword-dense heading scores more precisely and predictably
     than a full sentence does. Not a hard rule (75-160 couldn't have been
     transcribed any other way — those are State Farm's actual heading texts),
     just a preference where you have latitude (e.g. your own subheadings
     within a document that doesn't literally dictate the wording).
   - End with a `## TRANSCRIPTION NOTES` section listing exactly which
     photos/pages were processed and any gaps found. The build script
     specifically excludes this heading's content from the searchable index
     (it's bookkeeping, not policy text) — see `chunkByHeading`'s
     `transcription notes` check in `build-policy-docs.js`.
2. **A file that's a draft-in-progress, not yet verified, should NOT sit
   directly in `source-docs/`** — put it in `source-docs/pending-verification/`
   (any subfolder name works; the build script's `readdirSync` is
   non-recursive so subfolders are invisible to it) until it's actually
   trustworthy. This is the mistake Phase 1 had to clean up after the fact —
   don't repeat it.
3. **A filename starting with `_` is treated as non-content** (e.g. this file,
   `_RESUME.md`) and excluded from discovery even though it ends in `.md` —
   use that prefix for any bookkeeping file you want to keep alongside the
   real documents without it being ingested as if it were policy text.
4. Re-run `node scripts/build-policy-docs.js` and read its own output — it
   reports chunk counts per document and flags how many chunks contain
   `[ILLEGIBLE]`/`[CAPTURE GAP]`. A wildly unexpected chunk count for a
   document (way more or fewer than its length would suggest) usually means
   a heading-level mistake (e.g. `##` used where `###` was meant).
5. **Before trusting it, ask it a handful of naturally-phrased questions** —
   not just a chunk-count check. Phase 5 found two real retrieval bugs this
   way that a structural sanity check alone would never have caught (see the
   Phase 5 section above for exactly what happened and why). This step is
   not optional busywork; it's the only thing that actually catches a
   document whose wording doesn't score well against natural questions.
6. `npm run build`, `npx vercel --prod`, verify live — same deploy flow as
   every other phase, same explicit-yes-first expectation.

## Progress as of 8/15 evening session (direct sequential read, no agents)

`hw2130-policy.md` now contains, verified verbatim from direct photo reads:
- Full TOC, Agreement, Definitions 1–24 (one real gap: defs 8–9 never photographed)
- Deductible
- Section I Property Coverages: Coverage A (Dwelling, Other Structures, Property
  Not Covered) — complete. Coverage B (Property Covered, Special Limits a–l,
  Property Not Covered) — complete. Coverage C (Loss of Use: ALE, Fair Rental
  Value, Prohibited Use) — complete.
- Section I Additional Coverages, all 15 items — complete (one small internal
  gap: a short clause at the end of item 8 Refrigerated Products, marked
  [ILLEGIBLE], not guessed).
- Inflation Coverage — complete.
- Section I Losses Insured: Coverage A intro — complete. Coverage B named
  perils 3 through 17 — complete, EXCEPT:
  - perils 1–2 (almost certainly Fire/Lightning, Windstorm/Hail — NOT confirmed, marked as capture gap)
  - the body of peril 13 (steam/hot water system tearing asunder) — marked as capture gap, only its opening clause and closing exclusion-list tail were captured
- Section I Losses Not Insured — complete (transcribed earlier, high confidence).
- Section I Loss Settlement — only A1.a started, stops at "(3) to receive any
  additional payments..." — NOT complete, this is the next thing to resume.

Photos used directly so far (original filenames): 143150, 143158(?), 143203,
143213, 143222, 143225, 143228, 143231, 143234, 143237, 143242, 143249, 143253,
143257, 143300, 143303, 143307, 143310, 143313, 143316, 143321, 143326, 143329,
143334, 143337, 143345, 143348, 143355, 143401.

Remaining unread in the 01-hw2130-policy range: everything from ~143403 onward
EXCEPT what `hw2130-policy-part3.md` already covers (143403–143457, verified
complete/trustworthy) and `hw2130-policy-part4.md`'s partial coverage of
143504–143559 (NOT verified — treat as reference only, re-verify before
trusting, same as the rest of part2/part4).

**Killed-agent files status:** `hw2130-policy-part3.md` = trustworthy, complete.
`og-75-20-water-damage.md` = trustworthy, complete. `hw2130-policy-part2.md`,
`hw2130-policy-part4.md`, `og-75-101-additional-coverages.md`,
`og-75-160-wind-hail-part1.md`, `og-75-160-wind-hail-part2.md` = reference only,
unverified, do not merge blindly — re-derive from photos directly as this
session did for the policy front half.

**Sorted/rotated photos exist** at `C:\Users\Dewey\Desktop\docs\sorted\` (see
`manifest.csv`) but **the duplicate flags in `duplicates.csv` are WRONG** —
verified false positive: two photos flagged as 99% duplicate showed genuinely
different TOC content (one scrolled further than the other). The similarity
tool matches on visual layout, not text content. Do not skip any photo based on
the duplicate flag. The sort-into-folders and rotation are still fine to use.

## MILESTONE: hw2130-policy.md now covers the FULL policy, front to back (8/15 evening)

Transcribed sequentially, directly from photos, start to finish: Agreement,
Definitions, Deductible, all Property Coverages (A/B/C), all Additional
Coverages, Inflation Coverage, Losses Insured (A+B), Losses Not Insured, Loss
Settlement (A1/A2 partial — see gap below, B1/B2 complete), all of Section I
Conditions, Section II (Coverage L/M, Additional Coverages, Exclusions,
Conditions), Section I&II shared Conditions, and all Optional Policy Provisions
(AI, BP, BU, FA, ID, IO, JF, OL, SG — SG is the last item in the TOC, confirmed
end of document reached on photo 20260815_143559).

**Real capture gaps remaining (photos never taken, not guessable — each is
explicitly marked `[CAPTURE GAP]` in the file, search for that string to find
all of them):**
- Definitions 8 and 9
- Named perils 1–2 of Losses Insured Coverage B (almost certainly Fire/Lightning, Windstorm/Hail — not confirmed)
- Body of Losses Insured peril 13 (steam/hot water system tearing asunder)
- Rest of Loss Settlement A1 + all of A2 (Common Construction)
- A sub-item or two in "Your Duties After Loss" (2.d)
- Opening of Section II Exclusions (items 1–2, before item 3)
- Section I Conditions item 6 opening (Suit Against Us) — tail only captured
- Item 7 (Assignment of Policy) body
- Remainder of Death (9.b) + Conformity to State Law + Premium (items 10-11)
- Liberalization Clause (Section I&II Conditions item 3)
- Option BP's specific limit figures, Option BU's opening definition
- Option OL items 2 and 3

**One section flagged lower-confidence (not a gap, but numbering uncertain):**
Option ID / Option IO boundary (dense multi-column source) — substance likely
right, exact item numbers need re-verification against 20260815_143544.jpg.

**Every gap/low-confidence spot is findable by searching the file for
`[CAPTURE GAP]` or `LOWER CONFIDENCE`.** None of them were guessed at — each
has an explicit marker rather than invented text standing in as if it were real
policy language.

**What's NOT done yet:** the three Operation Guides (75-20, 75-101, 75-160).
The killed-agent files for those (`og-75-20-water-damage.md` — trustworthy,
complete; `og-75-101-additional-coverages.md`, `og-75-160-wind-hail-part1/2.md`
— unverified, reference only) are the next thing to work through, same
direct-read method as this session used for the policy.

## Remaining work — phased, execute and check off in order

Jason's standard for this: **100% correct, no guessing, works every time.**
A plausible-sounding invented provision is worse than a visible gap marker.
Each phase below should be a self-contained chunk of work — finish and
verify one before starting the next, update this file's checkboxes and add
a dated note under "Session log" below as each phase closes, so a fresh
session (or a fresh context window mid-session) can always see exactly what
state this is in without re-deriving it.

### Phase 1 — Wire in what's already verified (HW2130 + Op Guide 75-20) — ✅ DONE 8/18

- [x] Re-run `node scripts/build-policy-docs.js`, confirm it reports the
      expected chunk counts for `hw2130-policy.md` and
      `og-75-20-water-damage.md` with no unexpected gap spike.
- [x] Read `src/app/api/policy-chat/route.ts` and
      `src/app/api/policy-chat/load-docs/route.ts` fully before changing
      anything — confirm the current request/response shape between them
      and the frontend component that calls them (find it: grep the
      frontend for `/api/policy-chat`).
- [x] Rewire `policy-chat/route.ts` to call
      `getPolicyDocsText(question, maxChunks, maxChars)` from
      `@/lib/policy-docs-search` **server-side, per-question** — not by
      extending the client-supplied `policyText` blob pattern. Decide
      deliberately what happens to the existing `policyText` param (used
      today for a specific claim's declarations/endorsements, which is a
      real, separate need from the master HW2130 form): most likely both
      should be in play together — the per-claim document the adjuster is
      actively working, plus the relevant master policy/manual sections for
      the question — not one replacing the other. Get this distinction
      right; it matters.
- [x] Add a rule to `POLICY_CHAT_SYSTEM` stating the retrieved policy/manual
      text is controlling authority (mirror the language already in
      `formatPolicyDocsForPrompt`'s own header block in policy-docs-search.ts
      — don't duplicate/diverge, reuse what's already written there).
- [x] Update `load-docs/route.ts` (or retire it, if the new per-question
      retrieval makes the old "fetch full text once" step obsolete for the
      master corpus — but don't drop it if the frontend still needs it for
      the per-claim document flow).
- [x] `npx tsc --noEmit` clean.

**What actually shipped (see Session log for full detail):** two problems
not called out above turned up during Phase 1 and were fixed as part of it:
the source-docs directory mixes verified and unverified/superseded .md files
(auto-discovery would have ingested all of them), and `_RESUME.md` itself
matches the `.md` discovery filter. Both fixed — see session log entry
below for exactly what and why.

### Phase 2 — Test Phase 1 before trusting it — ✅ DONE 8/18

Real questions, check the actual answer against the actual transcribed text
(not against general insurance knowledge):
- [x] "is wear and tear excluded" → should cite HW2130 Section I – Losses Not
  Insured 1.g verbatim, not a paraphrase. **Passed** — cited 1.g verbatim,
  correctly distinguished it from the resulting-loss carve-back.
- [x] "sump pump backup covered?" → should land on item 2.c(7), NOT misapply 1.f.
  **Passed** — grounded in Op Guide 75-20 §VI.C (sump pump inoperative) and
  the HW2130 2.c anti-concurrent-causation water exclusion, quoted the OG's
  own citation verbatim, correctly flagged that OG 75-156 (endorsements) and
  declarations aren't in front of it rather than guessing.
- [x] "when do I need a test square" → should pull from Op Guide 75-20 (Water
  Damage) or correctly say Op Guide 75-160 covers it once Phase 4 lands —
  confirm which. **Passed** — correctly said the provided text (DEFINITIONS
  + Coverage C excerpts, nothing on roofing) doesn't address it, named
  Op Guide 75-160 as the likely right source without pretending to have it.
- [x] Ask something the corpus genuinely doesn't cover — confirm it says so
  plainly instead of inventing an answer. **Passed** (boat trailer at a
  marina 50 miles away) — explicitly listed what WAS retrieved (Optional
  Provisions, OG 75-20), said none of it addresses the question, and named
  what it would actually need (Coverage B Special Limits, off-premises
  terms) rather than answering from general homeowners-policy knowledge.
- [x] Ask something touching a `[CAPTURE GAP]` section (e.g. Definitions 8-9,
  Loss Settlement A2) — confirm the response visibly hedges rather than
  filling the hole. **Passed** — quoted the gap marker, offered a
  caution-flagged inference for def. 9 from the surviving tail fragment
  ("likely *dwelling*... but I only have the tail end"), stated flatly it
  has zero basis to guess def. 8, and told the adjuster not to rely on
  either until re-photographed.

All 5 Phase 2 tests passed on first try, tested both via direct API calls
(curl, with a session cookie from `/api/auth`) and end-to-end through the
actual UI on both `/policy-chat` and `/xact-scope` (Policy Chat tab) — see
session log for the full transcript-level detail.

### Phase 3 — Deploy Phase 1 — ✅ DONE 8/18 (mostly — see note)

- [x] `npm run build` clean. 31 routes, no errors.
- [x] `npx vercel --prod` — deployed. CLI output confirmed
      `"target": "production"`, `"readyState": "READY"`, and
      `▲ Aliased https://my-next-claim.vercel.app` — the production alias
      was actually updated, not left on a preview URL.
- [ ] Confirm live, not just locally. **Not independently verified by the
      agent** — both a direct `curl` to the production domain (with the PIN)
      and a Browser-pane navigation to the live URL were blocked by the
      permission classifier (external-domain caution in auto mode), and
      attempts weren't forced past that. Jason: please open
      `my-next-claim.vercel.app/policy-chat` yourself and confirm a question
      like "is wear and tear excluded" comes back with a specific HW2130
      citation (not a generic answer) before treating this as fully closed.

### Phase 4 — Verify the two unverified Operation Guides — ✅ DONE 8/18

`og-75-101-additional-coverages.md` and `og-75-160-wind-hail-part1/2.md`
were written by subagents that were killed mid-session and never
re-verified — treat as reference only until this phase, per the explicit
warning earlier in this file. Same direct-read-from-photos method used for
the HW2130 policy front half:
- [x] Re-read `og-75-101-additional-coverages.md` against source photos
      `20260815_144104`–`144139`, correcting/confirming line by line.
      **Done 8/18.** All 30 photos read directly. Sections I–IV (Purpose
      through Credit Card/Forgery/Counterfeit) matched the killed subagent's
      draft exactly, verbatim — no corrections needed. Sections V
      (remainder), VI (Refrigerated Products), VII (Collapse), and VIII
      (Locks and Remote Devices) did not exist in the draft at all (the
      original subagent was killed before reaching them) and were
      transcribed fresh from the photos. Document is complete front to
      back, ends cleanly at VIII.B matching the TOC, zero `[CAPTURE GAP]`/
      `[ILLEGIBLE]` markers needed anywhere — every photo was fully
      legible. One verbatim-preserved source quirk flagged inline in the
      file: VII.C.5's own OG 75-20 cross-reference cites "FP-7955 Series"
      where an HW-2100-specific citation would be expected — that's in
      State Farm's own guide, not a transcription error, not corrected.
      File moved from `pending-verification/` back into `source-docs/`.
      **Not yet wired into the live/deployed app** — see note below.
- [x] Re-read `og-75-160-wind-hail-part1.md` + `part2.md` against
      `20260815_144234`–`144404`. **Done 8/18.** All 79 photos read
      directly across two sessions (63 photos, paused mid-work at Jason's
      "stop," then resumed through photo 79). Everything the two killed-
      subagent drafts already covered (Sections I through the middle of
      III.A, then III's remainder/IV/V/VI, plus VII's bare heading with no
      body) matched the source photos exactly, verbatim — no corrections
      needed. Sections VII's body through XVII (VIII Subrogation, IX
      Coding, X Prior Damage-Roof with all 7 sub-scenarios and worked
      examples, XI Matching, XII Limited Availability, XIII Warranties,
      XIV Building Code/Ordinance, XV Policyholder Communication, XVI
      Additional Inspection, XVII Appraisal/ADR/Arbitration) did not exist
      in either draft at all and were transcribed fresh. Zero
      `[CAPTURE GAP]`/`[ILLEGIBLE]` markers needed — every one of the 79
      photos was fully legible, including several with visible glare or a
      desk object partially in frame. One duplicate photo pair identified
      (066/067, same scroll position) and noted, not double-transcribed.
      **Consolidated the two-part draft into a single
      `og-75-160-wind-hail.md`** rather than keeping the part1/part2 split
      — that split was an artifact of the original parallel-subagent
      transcription, not a real document boundary (mirrors how
      `hw2130-policy.md` was already a single merged file). Old part1/part2
      drafts moved to `pending-verification/` for reference.
- [x] Mark every actual gap with `[CAPTURE GAP]`/`[ILLEGIBLE]` — do not
      silently "clean up" the subagent text into confident prose if the
      source wasn't actually legible. **N/A this pass** — no gaps existed
      to mark; both remaining documents were fully legible front to back.
- [x] Add/confirm a `## TRANSCRIPTION NOTES` section on both files. Done
      for both `og-75-101-additional-coverages.md` and
      `og-75-160-wind-hail.md`.

### Phase 5 — Wire in the now-complete 4-document set — IN PROGRESS 8/18

- [x] Re-run `node scripts/build-policy-docs.js`. 139 chunks, all 4 docs,
      0 unexpected gaps.
- [x] Re-run the Phase 2 test list plus new questions specific to 75-101 and
      75-160. **Found and fixed two real retrieval bugs in the process** —
      see below. All tests pass after the fix.
- [x] `npm run build`, `npx vercel --prod`. **Deployed 8/18.** Build clean
      (31 routes), CLI output confirmed `"target": "production"` and
      `▲ Aliased https://my-next-claim.vercel.app`.
- [ ] Verify live. **Not independently verified by the agent this time
      either** — attempted via Browser-pane navigation to the production
      URL (worked this time, unlike Phase 3) and tried to log in to test
      a live question, but production has its own `APP_PIN` separate from
      the local `.env.local` value, which the agent doesn't have and did
      not attempt to guess/brute-force. Jason: please open
      `my-next-claim.vercel.app/policy-chat` yourself and ask something
      like "when do I need a test square for a roof claim" — it should
      cite OG 75-160 Section II.F specifically (this is the exact
      retrieval-bug fix from this session, so it's a meaningful live
      check, not just a repeat of the Phase 3 spot check).

**Two retrieval scoring bugs found and fixed in `src/lib/policy-docs-search.ts`
(mirrored in `scripts/build-policy-docs.js`) — this is exactly why re-running
the test list before deploying mattered:**

1. **No stopword filtering on heading-match scoring.** `getRelevantPolicySections`
   scores a chunk partly by matching query words against its heading path, but
   that scoring had zero stopword filtering (unlike the pre-built `keywords`,
   which already filter common words). Once OG 75-160 entered the corpus with
   long, sentence-style subsection headings (e.g. "...Insured took Reasonable
   Steps to Mitigate and **Arrange for** Repairs"), a query like "test square
   **for** a roof claim" scored a coincidental heading match on the word "for"
   — worth as much as a genuinely relevant match — and that, stacked with
   "roof"/"claim" being generic across many headings, buried the one section
   that actually answers "when do I need a test square" (II.F) under a pile of
   irrelevant Prior-Damage-Roof subsections. **Fix:** added the same STOPWORDS
   list already used in the build script to `policy-docs-search.ts`'s
   `tokenize()`, so it filters generic/boilerplate words in both the query and
   every heading it's compared against.
2. **No stemming, so word-form mismatches lost otherwise-exact matches.**
   "collapsed" (query) never matched "Collapse" (heading); "square" (query)
   never matched "Squares" (heading); "stored" never matched "stores." Worse
   than the stopword issue: a real test question — *"kitchen cupboards
   collapsed under the weight of stored items, is that covered?"* — got
   **"nothing in the provided text addresses this,"** even though OG 75-101
   Section VII.E contains an exact worked example: *"Kitchen cupboards fall
   due to the weight of heavy contents. Covered..."* The retrieval scored a
   different document's chunks higher purely because "weight" appeared
   literally in *their* shared parent heading ("...WEIGHT OF ICE, SNOW OR
   SLEET"), while the actually-correct chunk scored zero heading credit
   because "collapsed" ≠ "Collapse" as exact strings. **Fix:** added a small
   suffix-stripping `stem()` function (not a real stemmer — just strips
   `-ies`/`-ing`/`-ed`/`-es`/`-s`) applied after stopword filtering, in both
   files, so `keywords` (baked into `policy-docs.json` at build time) and
   live query tokenization land on the same stems. Regenerated
   `policy-docs.json` after the change.
   - This second bug is the more important one to internalize: it wasn't a
     hedge or a wrong citation, it was the system asserting **"nothing here
     covers this"** when the corpus had a verbatim, on-point "Covered" answer.
     That's the exact failure mode Jason's standard is built to prevent, and
     it only surfaced because the actual Phase 2 test list was re-run with
     genuinely-phrased questions instead of trusting that new docs "just work"
     once wired in. **Take this as a standing signal for Phase 6 and beyond:
     any new document added to the corpus should get a few naturally-phrased
     test questions before being trusted, not just a chunk-count sanity
     check** — word-form and heading-length mismatches are corpus-composition-
     dependent and can't be fully predicted in advance.
   - Known remaining limitation, not fixed here (would need a larger
     scoring-architecture change, out of scope for this pass): a chunk's
     `headingPath` includes its full parent (h2) heading text, so a
     distinctive word appearing once in a long parent heading gets counted
     as a heading-match bonus for *every* subsection under it, not just the
     one it actually describes. This didn't need fixing to resolve either
     bug found today, but could still cause a section with many subsections
     under a keyword-rich parent heading to crowd out a more specific match
     elsewhere. Worth watching as more documents (and more subsection-heavy
     Operation Guides) are added.

**Retest results after the fix (all passed):**
- Original 5 Phase 2 questions — all still correct, several noticeably more
  precise (sump pump answer now cites 2.c.(7) by number explicitly; the boat
  trailer question — previously an honest "not addressed" — now correctly
  finds and cites the real Coverage B Special Limits (e) and (f) and
  correctly identifies which one applies, since a boat trailer is "used with
  watercraft").
- "When do I need a test square" → now correctly cites OG 75-160 II.F
  verbatim.
- "Kitchen cupboards collapsed under weight of stored items, covered?" → now
  correctly cites OG 75-101 VII.E Example 1 verbatim ("Covered").
- "Prior hail claim never repaired, new hail damage same roof" → correctly
  pulls OG 75-160 Section X, walks through which sub-scenario (A vs. C vs. D
  vs. E) applies and why, with the worked-example math.
- A genuinely unrelated question ("price of eggs") → still correctly
  declines rather than over-triggering now that stemming is more permissive.

### Phase 6 — Make "more docs coming" actually easy going forward — ✅ DONE 8/19

- [x] Write a short `## Adding a new document` section in this file spelling
      out the exact house style. **Done** — see `## Adding a new document`
      section above (placed right after "What's already built (code)").
      Confirmed zero-code-change is still true after Phase 1's rewire:
      `policy-chat/route.ts` calls `getPolicyDocsText(question)` fresh per
      request, never hardcodes a document list or count.
- [x] Check whether Xactimate codes have the same expandability, and fix it
      if Jason wants that. **Checked 8/18, found they didn't. Jason
      confirmed 8/19: "yes fix it - make sure its set up like prior items."
      Fixed 8/19** — see below for what changed, and the findings this was
      built on top of:

      **The policy docs pipeline** (`source-docs/*.md` →
      `build-policy-docs.js` → `policy-docs.json`) is a clean, one-directional,
      fully-reproducible regeneration: drop a verbatim-transcribed `.md` file
      in one directory, re-run one script, done. The script rebuilds the
      entire index from scratch every time — there's no accumulated,
      hand-edited state anywhere.

      **The Xactimate codes pipeline is a different shape entirely** and
      genuinely more fragile:
      - `src/lib/xactimate-codes-search.ts` reads directly from
        `src/data/xactimate-codes.json` (3.4MB, ~2,728+ codes as of
        2026-08-06) — there is no source-of-truth directory of raw files this
        gets rebuilt from. The JSON file itself *is* the source of truth,
        mutated incrementally over time rather than regenerated fresh.
      - `scripts/extract-xact.js` / `extract-xact-retry.js` are one-time,
        throwaway scripts from a specific past extraction run — hardcoded to
        a specific local photo directory
        (`C:\Users\Dewey\Desktop\stuff\xact`), hardcoded batch indices to
        retry (`extract-xact-retry.js`'s `BATCHES_TO_RETRY = [9, 12, 13]`),
        and they call the Gemini API directly to OCR-extract codes from
        photos with only a prompt-level "Do not hallucinate" instruction —
        there's no `[CAPTURE GAP]`/`[ILLEGIBLE]`-style verbatim/gap-marking
        discipline anywhere in this path, unlike the policy docs' human
        direct-photo-read process.
      - `scripts/merge-xact-batch.js` is the actual "add codes" step, and it
        expects a pre-built, presumably human-reviewed batch JSON file
        (its own comment calls the input a "reviewed/approved batch" and
        strips a `lowConfidence` flag before merging) — but there's no
        script or documented process anywhere for producing that reviewed
        batch file from the raw AI extraction. That review step, whatever it
        was, happened manually and isn't reproducible from what's in the
        repo. The script's default filename argument is also hardcoded to
        one specific past date (`xact-merged-2026-08-05.json`), a sign this
        was written for a single one-time merge, not designed as a repeatable
        tool.
      - Net effect: **"drop a file, rerun a script" does not work for
        Xactimate codes today.** Adding codes currently means: photograph a
        price sheet, run (or write a new version of) an extraction script
        pointed at a hardcoded local path, manually review the AI's OCR
        output for accuracy (no tooling support for this step), hand-produce
        a batch JSON in the exact shape `merge-xact-batch.js` expects, then
        run that merge script with the right filename argument.

      **Fixed 8/19 — now mirrors the policy docs pipeline exactly:**
      - New `src/data/xact-codes-source/` directory is now the source of
        truth, same role as `source-docs/`. It holds reviewed batch files
        (flat JSON arrays of `{ code, description, category, unit }`,
        `keywords` generated at build time, not stored). A `README.md`
        inside spells out the same house-style discipline as the policy
        docs — review every entry before it lands here, no
        `lowConfidence`/partial-trust flag, no code changes needed to add a
        batch.
      - New `scripts/build-xactimate-codes.js` mirrors
        `build-policy-docs.js`: reads every `.json` file in
        `xact-codes-source/` (non-recursive, skips `_`-prefixed files, same
        convention as `_RESUME.md`), rebuilds `xactimate-codes.json` from
        scratch every run (no incremental mutation), files processed in
        filename order so a later dated batch overrides an earlier one for
        the same code, prints a per-file summary the same way the policy
        build script does.
      - **Migrated the existing 12,413 production codes** into
        `xact-codes-source/2026-08-06-baseline.json` (the original 94-photo
        extraction plus the 2026-08 batches, previously merged incrementally)
        so nothing had to be re-extracted or re-reviewed from scratch.
        Verified field-by-field against the pre-migration file: 0 missing
        codes, 0 description/category/unit differences. ~5% of entries got
        very slightly different `keywords` (the old ad-hoc process had let a
        handful of short numeric fragments like `"3x"`/`"12"`/`"26"` through
        inconsistently; the new build script's `tokenize()` now filters
        those the same way for every entry) — a consistency improvement, not
        data loss. Full detail in `xact-codes-source/README.md`'s History
        section.
      - **Retired `scripts/merge-xact-batch.js`** (fully superseded by the
        new build script) to `scripts/archived/`, following the project's
        existing convention for retired one-off scripts — added a note at
        the top of the file explaining why and pointing at its replacement.
        Left `extract-xact.js`/`extract-xact-retry.js` in place as-is
        (adaptable templates for a future extraction run, same as before —
        that step stays manual/reviewed either way, mirroring how the
        policy docs' own photo-reading is manual work too).
      - Functionally verified both consumers of the regenerated file after
        the change: `/api/xact-codes` (Browse Codes, via
        `code-matcher.ts`) and `/api/code-reference` (Claim Consult/Lookup
        chat, via `xactimate-codes-search.ts`) both returned correct results
        against real queries. `npx tsc --noEmit` clean.
      - **Not yet deployed** — this is local-only pending Jason's review and
        go-ahead, same gate as every other deploy so far.
      - **Noticed but not touched, flagging rather than fixing unasked (same
        discipline as everything else in this file):**
        `xactimate-codes-search.ts`'s `tokenize()` has the same shape the
        policy-docs one had *before* the Phase 5 fix — no stopword
        filtering, no stemming. It may have the same class of retrieval
        misses (a plural/verb-tense mismatch losing an otherwise-exact
        match) that Phase 5 found and fixed for policy docs. This wasn't
        part of what was asked ("set up like prior items" was about the
        pipeline/expandability, not the search scoring), so it wasn't
        changed — but if Jason wants it looked at, the fix would very
        likely be the same shape as `policy-docs-search.ts`'s.

## Session log

- 8/15: HW2130 full policy transcribed front-to-back (gaps marked). Op Guide
  75-20 transcribed and verified. Search/build pipeline built. Never wired in.
- 8/18: Audited live app — confirmed none of the above had reached
  production; wrote the phased plan above. (Nothing executed yet as of this
  entry — a fresh session should pick up at Phase 1.)
- 8/18 (later same night): Executed Phase 1 and Phase 2.
  - **Found and fixed two problems not in the original plan**, both required
    to make Phase 1 actually correct rather than just "wired in":
    1. `source-docs/` mixed the 2 verified files (`hw2130-policy.md`,
       `og-75-20-water-damage.md`) with 6 unverified/superseded ones
       (`hw2130-policy-part2/3/4.md`, `og-75-101-additional-coverages.md`,
       `og-75-160-wind-hail-part1/2.md`). Since the build script
       auto-discovers every `.md` in that directory, running it as-written
       would have put unverified subagent transcription into the "gospel"
       corpus right alongside the verified text, indistinguishable to the
       AI or the adjuster. Fixed by moving all 6 into a new
       `source-docs/pending-verification/` subfolder (non-recursive
       `readdirSync` means the build script never sees it) with a README
       explaining what's there and why. Nothing deleted — Phase 4 moves the
       verified versions back in when it's their turn.
    2. `_RESUME.md` itself matches the `.md` discovery filter and would
       have been chunked and indexed as if its own audit notes and gap
       lists were policy text. Fixed in `scripts/build-policy-docs.js` by
       excluding filenames starting with `_` from discovery — a real bug,
       not scope creep, and it preserves the zero-code-change-for-new-docs
       property (no real transcribed document would start with `_`).
  - Ran `node scripts/build-policy-docs.js`: 53 chunks from exactly 2
    documents (26 from `hw2130-policy.md`, 27 from `og-75-20-water-damage.md`),
    7 gap-flagged chunks whose headings matched the known gap list exactly
    (Definitions, Losses Insured Coverage B, Loss Settlement Coverage A,
    Section I Conditions, Section II Exclusions, Section I&II Conditions,
    Optional Policy Provisions) — no surprises.
  - Rewired `src/app/api/policy-chat/route.ts`: calls
    `getPolicyDocsText(recentContext)` server-side per-question (recent
    history folded into the retrieval query too, so follow-ups like "what
    about X" still retrieve on-topic). `policyText` (the per-claim
    declarations/endorsements document) is now optional and additive, not
    required — both sources are included together when present, neither
    replaces the other. Added a "controlling authority" rule to
    `POLICY_CHAT_SYSTEM` that points at (rather than duplicates)
    `formatPolicyDocsForPrompt`'s own header rules in policy-docs-search.ts.
  - `load-docs/route.ts` — the old "fetch stale EXTRACTED_POLICY once"
    endpoint — is dead now that retrieval is server-side and per-question.
    Jason asked to keep it on disk instead of deleting it (review later);
    renamed its folder to `_deprecated-load-docs` with a comment explaining
    why. The leading underscore also opts it out of Next.js App Router
    routing entirely, so it's genuinely inert, not just unused. Follow-up
    task exists to actually delete it once the rewire's been trusted a
    while.
  - Updated both frontend callers (`policy-chat/page.tsx` and
    `xact-scope/page.tsx`'s Policy tab) to stop calling `load-docs` and stop
    gating the whole chat UI on `policyText` being non-empty — the master
    corpus is always available server-side now regardless of whether a
    per-claim document is loaded. Updated the "no document loaded" copy in
    both to make clear the per-claim upload is now optional.
  - `npx tsc --noEmit` clean (after clearing a stale `.next` build-cache
    type reference to the old `load-docs` path — build artifact, safe to
    clear, not a real code error).
  - Phase 2: ran all 5 test questions from the plan above, both via direct
    `curl` against `/api/policy-chat` (session cookie from `/api/auth`) and
    end-to-end through the actual browser UI on both `/policy-chat` and
    `/xact-scope`. All 5 passed on the first try — verbatim citations where
    expected, correct hedging on gaps and out-of-corpus questions, no
    invented provisions anywhere. Full detail inline under each Phase 2
    bullet above.
  - **Stopped here per Jason's instruction** — Phase 3 (deploy) needs his
    review first. Local dev only; nothing has been pushed to Vercel.
- 8/18 (continued, later same session): Jason confirmed the live site
  himself (asked Policy Chat "is wear and tear excluded," got a grounded
  answer with specific policy detail) — Phase 3 fully closed. Then ran
  `npm run build` again as an extra local check (clean, 31 routes) before
  proceeding.
  - Deployed via `npx vercel --prod` on Jason's explicit go-ahead. CLI
    output confirmed `"target": "production"` and
    `▲ Aliased https://my-next-claim.vercel.app` — the production alias
    actually moved, not left on a preview URL. Agent's own attempts to
    independently verify the live URL (direct `curl` with the PIN, and a
    Browser-pane navigation to the production domain) were both blocked by
    the permission classifier's external-domain caution; Jason verified
    manually instead rather than the agent forcing a workaround.
  - Moved to Phase 4. Given the size difference between the two remaining
    docs (75-101: 30 photos: 75-160: 79 photos, one section already
    flagged lower-confidence) and an explicit ask to keep sessions from
    running for hours, agreed a scoped plan with Jason: verify 75-101 only
    this session, stop, check in before starting the much bigger 75-160.
  - Verified `og-75-101-additional-coverages.md` — see Phase 4 checklist
    above for full detail. Ran `node scripts/build-policy-docs.js` locally
    afterward as a structural sanity check only (confirms the new markdown
    chunks cleanly, no heading-level mistakes) — 78 chunks from 3
    documents, 25 from the newly-verified 75-101, 0 gap-flagged (correct,
    since none were found). **This was NOT deployed** — the local
    `policy-docs.json` now reflects 3 documents, but the live site still
    only serves HW2130 + og-75-20 until Phase 5's deliberate rebuild +
    redeploy, which per the original plan waits until 75-160 is verified
    too. Stopped here per the agreed scope — 75-160 is next.
- 8/18 (continued): Started Op Guide 75-160 verification (79 photos) at
  Jason's go-ahead ("go ahead and start... may pause you gracefully... no
  rush"). Read photos 1–63 directly (through Section IV item O), everything
  matching the existing drafts verbatim with zero corrections needed, then
  Jason said "stop" mid-session — stopped immediately, nothing written or
  moved at that point, reported exact progress (63/79 photos, what section,
  zero issues found so far) so it could resume cold.
  - Session paused for a Claude Code update question (answered: no need to
    update mid-session) and to note two unrelated ideas Jason wants to
    discuss later when not mid-task — a "2nd hands" open-ended intake chat
    that can ask clarifying questions, and eventually drafting a Google
    Gemini Gem from the finished policy/process corpus. Both explicitly
    deferred by Jason ("when we have tokens") — not acted on, just logged
    so they aren't lost. [[Future ideas — see note in memory or ask Jason
    if this needs its own tracking doc]]
  - User hit their usage limit mid-session (unrelated to token cost of this
    task specifically) and it reset; resumed from photo 64 on request.
  - Finished all 79 photos. Full detail in the Phase 4 checklist above.
    Consolidated into a single `og-75-160-wind-hail.md` (see checklist for
    why), moved the superseded two-part draft to `pending-verification/`.
  - Ran `node scripts/build-policy-docs.js` locally as a structural
    sanity check: 139 chunks from all 4 documents, 61 from the new
    75-160, 0 gap-flagged. **Still not deployed** — same as 75-101, this
    is local-only pending Phase 5's deliberate rebuild + redeploy, which
    needs Jason's go-ahead the same way Phase 3's did.
  - **Phase 4 is now fully complete.** All 4 source documents (HW2130,
    og-75-20, og-75-101, og-75-160) are verified and sitting in
    `source-docs/`, none of the unverified/superseded files remain in the
    live discovery path. Next up: Phase 5 (rebuild, extended test pass,
    deploy) — awaiting Jason's go-ahead, same gate as every deploy so far.
- 8/18 (continued): Jason gave the go-ahead for Phase 5 and stepped out for
  an inspection, asking the agent to keep working autonomously as far as
  session tokens allowed.
  - Rebuilt the corpus (139 chunks, 4 docs) and re-ran the Phase 2 test list
    plus new 75-101/75-160-specific questions against the local dev server
    (authenticated via `/api/auth` with the local `APP_PIN`, same method as
    Phase 2). **This surfaced two real retrieval bugs** — full root-cause
    and fix detail is in the Phase 5 section above, not repeated here. Short
    version: (1) heading-match scoring had no stopword filtering, so a
    coincidental match on a word like "for" in a long, sentence-style OG
    75-160 heading could outscore genuinely relevant content; (2) no
    stemming, so "collapsed" never matched "Collapse" and a real question
    ("kitchen cupboards collapsed under weight of stored items, covered?")
    got a false "nothing here addresses this" even though OG 75-101 has a
    verbatim on-point "Covered" example. Both fixed in
    `policy-docs-search.ts` (mirrored in `build-policy-docs.js`),
    `policy-docs.json` regenerated, full retest passed including a check
    that the fix didn't cause over-triggering on a genuinely unrelated
    question.
  - `npm run build` clean, `npx vercel --prod` deployed — CLI confirmed
    `"target": "production"` and the alias updated. Attempted live
    verification via the Browser pane (worked this time, unlike the Phase 3
    attempt) but production has its own `APP_PIN`, separate from the local
    dev one, which the agent doesn't have — did not attempt to guess it.
    Jason needs to do the live spot-check himself; specific question
    suggested in the Phase 5 checklist above.
  - Continued into Phase 6 since it didn't require Jason's real-time input:
    wrote the `## Adding a new document` house-style section (above,
    after "What's already built (code)"), and did the requested check on
    whether Xactimate codes have the same drop-a-file expandability as the
    policy docs. They don't — full findings in the Phase 6 section above.
    Per the original instruction, this was flagged rather than fixed
    without being asked.
  - **All phases from the original plan are now either done or flagged
    for Jason's decision.** Nothing further to do autonomously without his
    input: Phase 5's live verification and Phase 6's Xactimate-pipeline
    fix (if he wants it) both need him specifically.
- 8/19: Jason confirmed the Phase 5 live spot-check passed (asked the test
  square question against production himself, worked correctly) — Phase 5
  is now fully closed. He then said yes to the Xactimate pipeline fix
  ("make sure its set up like prior items").
  - Rebuilt the Xactimate codes pipeline to mirror the policy docs one —
    `xact-codes-source/` + `build-xactimate-codes.js`, migrated the existing
    12,413 codes in, retired `merge-xact-batch.js` to `scripts/archived/`.
    Full detail in the Phase 6 section above, including the one thing
    noticed-but-not-fixed (xactimate-codes-search.ts likely has the same
    stopword/stemming gap Phase 5 fixed for policy docs — flagged, not
    touched, wasn't what was asked).
  - Verified with a real before/after data comparison (0 missing codes, 0
    field mismatches) and functional tests against both consumer routes,
    not just a typecheck. **Not deployed yet** — awaiting Jason's review.

## Known transcription gaps

- **HW2130 definitions 8 and 9 were never photographed.** The capture jumps from
  definition 7 (*Declarations*) to the tail of definition 9. Marked in
  `hw2130-policy.md` as `[CAPTURE GAP]`. Needs one re-photograph.
- Subagent reports will list any further gaps — fold them into this list.

## Findings that came out of this work (claim 30-0C9F-286)

These affected a live denial letter and are worth not re-deriving:

- **1.g is the correct exclusion** for age/wear roof denial, verbatim:
  "wear, tear, decay, marring, scratching, deterioration, inherent vice, latent
  defect, or mechanical breakdown".
- **The condensation/humidity sentence is NOT a standalone exclusion.** It is the
  closing sentence of exclusion **1.f**, which is entirely about seepage/leakage
  from a plumbing, heating, A/C, sprinkler system or household appliance.
  Quoting it alone in a roof denial misstates its scope.
- **3.b(2) is a construction-defect exclusion** (design/specifications/workmanship/
  construction). It does not fit an age-and-wear finding.
- 3.b(4) is "maintenance" — closer to the facts, but implies a failure-to-maintain
  finding that the claim file does not actually support. 1.g alone is cleanest.
