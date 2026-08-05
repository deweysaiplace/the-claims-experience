# Progress & Handoff — 2026-08-01 (updated)

Written for the next agent (Antigravity, a fresh Claude chat, or otherwise) picking up
`my-next-claim`. Read this before touching anything. Several things in this repo are not
what they look like. **The owner is now actively using this app in the field, daily** — bugs
found tonight came from real claim work, not testing.

---

## TL;DR

Before today this app could not answer a single AI request, could not save a report,
could not send an email, had no working login, and had 12 days of work existing only on
one laptop. All of that is fixed. Nothing was rewritten — almost every failure was
configuration, not code.

---

## Traps that will waste your time if you don't read this

**1. PowerShell `>>` and `Out-File` write UTF-16. They will silently corrupt `.env.local`.**
This is what broke this project for an unknown length of time. Appending API keys with `>>`
produced a file that was UTF-8 up to the append point and UTF-16 after it. Next.js parses as
UTF-8, so every variable after that point loaded as garbage — **no error, just `undefined`**.
All three AI keys were dead locally because of this.
Always use: `Add-Content -Path .env.local -Value "KEY=value" -Encoding utf8`
To detect: if `grep` calls the file "binary" or `file` says "data", it has NUL bytes.

**2. Deploys are CLI-only. Pushing to GitHub does NOT deploy.**
`npx vercel --prod` uploads the working directory. There is no Git integration. For ~12 days
the laptop, GitHub, and production were each running a different version of this app. Always
check all three before believing any one of them.

**3. Three different names for one project.**
Folder: `my-next-claim` · Vercel project: `my-next-claim` · GitHub repo: `deweysaiplace/the-claims-experience`
A stale sibling folder `CascadeProjects/the-claims-experience` also exists. It is not the live app.

**4. `vercel env pull` returns `KEY=""` for every secret.**
Vercel marks env vars Sensitive by default; they cannot be decrypted back out. Vercel is **not**
a backup of the keys. Non-secret vars pull fine, which makes the file look successful. Back up
`.env.local` before touching it, and verify a pull by checking value *lengths*, not key names.

**5. Never commit the one-off setup scripts.**
`execute-sql.js` and `setup-reports-table.js` embed a Supabase **personal access token** (account-level,
not project-scoped) on line 10. GitHub push protection blocks them. They are gitignored — leave them that way.

---

## Current state

### AI providers (this is the important table)

| Provider | Status | Notes |
|---|---|---|
| **Grok** | ✅ **Paid and working** | `grok-4.5`. Text **and** vision both confirmed live. This is the only funded provider. |
| Gemini | ⚠️ Free tier | **20 requests/day**, routinely exhausted. Was the sole provider for everything. |
| Anthropic | ❌ **No credit** | Key is valid but the account balance is empty — every call 400s. |

**Model IDs matter and the old ones were wrong:**
- `grok-2-vision-latest` → **does not exist**. Correct: `grok-4.5` (or `grok-4.3`).
- `claude-3-5-sonnet-20241022` → **retired by Anthropic Oct 2025**. Correct: `claude-opus-4-8`.

`src/lib/ai-fallback.ts` now tries **Grok → Gemini → Claude**, in that order, deliberately: Grok is
the only one that works, so the old Gemini-first order burned two failing round-trips per request.
It also detects image mime type from base64 magic bytes (it used to hardcode `image/jpeg` for
every image on every provider).

### AI routing per route

| On the fallback ✅ | Still Gemini-direct ⚠️ |
|---|---|
| `code-reference` | `transcribe` (audio — Grok has no speech model; needs a decision) |
| `policy-chat` | `xact-analyze` (unverified whether any page calls it) |
| `xact-scope` | `parse-video`, `parse-video-fixed`, `parse-video-smart` — **on the delete list, ignore** |
| `reconcile`, `field-note`, `field-scope` | |

### Auth — read this before you change anything about it

The login was **never functional**, on any machine, ever. `APP_PIN` did not exist in any
environment, so `pin !== process.env.APP_PIN` was always true and every PIN was rejected.
Nobody noticed because nothing enforced the cookie.

Now:
- `src/middleware.ts` gates every route except `/login` and `/api/auth`. Pages 307 to `/login`; API routes get a 401 JSON body.
- The `claims_auth` cookie holds a **SHA-256 of `APP_PIN`**, not the literal string `"true"`. The old value was forgeable by hand in DevTools.
- `APP_PIN` **must be 6 digits** — `src/app/login/page.tsx` has six inputs and only submits when all six are filled. A 4-digit PIN locks you out of your own app.
- `src/lib/session.ts` uses Web Crypto so the same code runs in both the Edge middleware and the Node route handler.
- Dead code: `src/components/auth/AuthProvider.tsx` and `PinLogin.tsx` are unreferenced and implement a **third** auth system (Supabase auth). Delete them during cleanup.

### Supabase

The `reports` table has **RLS enabled with no policy**, so the public anon key gets
`42501: new row violates row-level security policy` on every insert. This is why the portal was
empty — every "Save" the user ever clicked failed at the database.

Do **not** fix this by opening an RLS policy to the anon key: that key is `NEXT_PUBLIC_` and ships
inside the browser bundle. `/api/reports` now uses `src/lib/supabaseAdmin.ts` (service role,
server-only, behind middleware). Never import `supabaseAdmin` into a client component.

### Email

Works. Gmail SMTP via nodemailer. Sends to both `REPORT_EMAIL_WORK` and `REPORT_EMAIL_PERSONAL`.
Gotcha: **Gmail app passwords must have their spaces stripped** — Google displays them as
`xxxx xxxx xxxx xxxx`, but SMTP wants the bare 16 characters.

### PWA

`layout.tsx` and `manifest.json` referenced icons that did not exist — and referenced *two different
paths* (`/icon-192.png` vs `/icons/icon-192.png`). Both icons now exist in `public/` and the manifest
matches `layout.tsx`. The phone (Samsung S26+) is the primary target device.

---

## Required environment variables

All 11 are set in both `.env.local` and Vercel production.

| Var | Purpose |
|---|---|
| `APP_PIN` | 6-digit login PIN. Without it, nobody can log in. |
| `GROK_API_KEY` | The working AI provider. |
| `GEMINI_API_KEY` | Free tier, 20/day. |
| `ANTHROPIC_API_KEY` | Present but the account has no credit. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public — reads only; RLS blocks writes. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Bypasses RLS. Never expose. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | SMTP. Password must be 16 chars, no spaces. |
| `REPORT_EMAIL_WORK` / `REPORT_EMAIL_PERSONAL` | File-note recipients. |

---

## Since the last handoff (2026-08-01 session)

**Since fixed and deployed, in order:** reports never saved (RLS blocked the anon key silently —
now auto-saves via `supabaseAdmin` the moment analysis completes, no manual click needed), email
never sent (Vercel still had the pre-space-stripped Gmail app password), GPS capture added to
Field Scope (`src/lib/geolocation.ts` — this was "not yet built" in the last handoff, now live),
login extended from 12 hours to 30 days, Field Scope fabricating Xactimate codes (`GUT5K`,
`GTTRGD` — its prompt had been edited, uncommitted, to drop the real code reference and say "use
your own knowledge"; restored `XACTIMATE_CODES` grounding in `field-scope/route.ts`), reconciler
report readability (led with an 8-column table + a wall of repeated warning paragraphs; now leads
with a plain-English "KEY DIFFERENCES" summary, a 5-column table, and one-line code check),
Antigravity's ~2-day-uncommitted work reviewed and committed (Xactimate code verifier against a
2728-code price-sheet extract, an Engineer Scope / EagleView-OCR page, R2 config guards — was
already live in prod via CLI deploy despite being uncommitted, i.e. one drive failure from gone,
same class of risk this project started with).

**Found, not yet fixed — the two Xactimate code lists don't match.** The model is grounded
against `src/data/xactimate-codes.ts` (13.6KB, cheap enough for every prompt). The verifier in
`src/lib/xactimate-verify.ts` checks against `src/data/xactimate-codes.json` (2728 codes, ~750KB,
too large to put in a prompt). These are two different extracts of the owner's own photographed
price sheets and only partially overlap (gutters are `SDGGNNI` in one, `SFGGRD` in the other), so
real, correctly-grounded codes get flagged as "not found" on nearly every report. Confirmed live:
tested 10 flagged codes from a real report, all 10 were genuinely real (present in the grounding
list). The warning is currently **suppressed entirely** (only shows a positive "all matched"
confirmation) until this gets a real fix — unifying onto one dataset, most likely a smart
category/keyword-filtered subset of the 2728-code JSON so it's both authoritative and small
enough to send. Do not just re-enable the warning without fixing the underlying mismatch first.

**Voice dictation bug had two layers, not one.** First symptom was cutting off on any pause
(browser's own silence timer, no code exposes it) — fixed by auto-restarting recognition on
`onend` unless the user pressed stop. That fix introduced a second bug: on this device,
`isFinal` results aren't disjoint chunks — the same result index keeps getting re-finalized with
the sentence-so-far each time a new word lands ("there" → "there once" → "there once was"...),
each marked final. A tail-match dedup couldn't catch it (each new chunk is longer and different,
not a repeat). Real fix, in both `field-scope/page.tsx` and `field-notes/page.tsx`: never append
incrementally — every `onresult` rebuilds the session's final text from scratch (index 0 up) and
*replaces* what the session has contributed so far, with a `preSessionTranscriptRef` baseline
carried across restarts. Verified against the exact growing-sequence from a real screenshot.
**Owner reported once more after this fix; unconfirmed whether that was pre-deploy staleness or
a second bug — re-verify first before touching this code again.**

---

## Open issues, in priority order (as of 2026-08-02, end of session)

**Done and deployed tonight (2026-08-02 session), not yet re-verified live by owner except where noted:**
- ~~Voice duplicating~~ — real cause found: growing-prefix finals treated as separate chunks, not the
  same index being revised. Fixed in field-notes, field-scope, and policy-chat.
- ~~Camera opens file picker~~ — replaced `<input capture>` everywhere (Field Scope, Xact Scope,
  Reconciler, Engineer Scope, Code Reference, /upload) with a real `getUserMedia`-driven
  `src/components/CameraCapture.tsx`. Owner confirmed only Field Scope worked before this rollout;
  Code Reference used identical code to Field Scope even before the rollout, so if it's still not
  working there after retest, suspect a per-origin camera permission prompt, not code.
- Dead vertical gap in Scope Results — swapped `100vh`→`100dvh` (mobile address-bar viewport quirk).
  **Unconfirmed** — needs a live repro to verify.
- ~~Photo upload on Code Reference~~ — done, camera + gallery attach in the chat.
- ~~Unify the two Xactimate datasets~~ — turned out worse than described: the prompt-grounding file
  (`xactimate-codes.ts`) was ~97% fabricated, not a partial-overlap real extract. Both deleted;
  `src/lib/xactimate-codes-search.ts` now grounds every prompt on the real 2,728-code
  `xactimate-codes.json` via keyword/category retrieval. Verifier's unmatched-code warning
  re-enabled.
- ~~Wire Code Reference to State Farm guidelines~~ — done.
- ~~transcribe decision~~ — owner didn't need it (uses live dictation everywhere). Cut entirely:
  `/api/transcribe`, `VoiceRecorder.tsx`, and the dead `transcription` field threading gone.

**Found and fixed mid-session, from a real live production incident (2026-08-02):**
- Reconciler AI calls were timing out across all three providers on a real 8-photo run. Root cause
  was two-layered: (1) `ai-fallback.ts`'s 25s-per-provider timeout was sized for an old sequential
  fallback chain and never widened after it was refactored to race providers in parallel, and (2)
  `CameraCapture.tsx` (this session's own earlier fix for the file-picker bug) was taking a
  low-resolution video-stream snapshot instead of a real photo, producing genuinely illegible source
  images that made every provider struggle. Fixed: `CameraCapture` now uses Chrome's `ImageCapture`
  API for a real full-resolution still photo where available, with explicit high-res `getUserMedia`
  constraints as fallback. Provider order changed to Claude-primary (confirmed funded and reliable)
  with an 85s window, Grok/Gemini as a 25s backup race. Five of seven AI routes were also missing an
  explicit `maxDuration`, silently relying on Vercel's shorter platform default — all now declare 120s.
- Reconciler also got a pass on the three findings from that incident: grounded on the real
  2,728-code price list (was ungrounded — same fabricated-code risk Field Scope had before tonight's
  fix), an elapsed-time indicator during the up-to-110s wait, and a pre-flight warning when a
  compressed photo is suspiciously small (<40KB) — the same signal that flagged the blurry-camera bug.

**Still open:**

11. **Reconciler's single mega-prompt architecture is the deeper reliability risk, not fully
    addressed tonight.** One AI call reads both multi-page estimates, compares them, and drafts an
    email + file note, all at once — a blurry page anywhere in either estimate degrades the whole
    output, and there's no way to tell which side failed. A real fix would split this into stages:
    extract Estimate A to structured line items, extract Estimate B separately (could run in
    parallel, each call simpler/faster than today's combined one), then diff and draft as a final
    step. Would likely be both more reliable and more debuggable — if one side comes back garbled,
    the owner would know exactly which photos to retake instead of a blanket "not legible." This is
    a real rebuild, not a tonight-sized fix; deliberately not started.

7. **Add live web search to Code Reference.** Needs the owner to pick a search API (Tavily, Brave,
   Google Custom Search) and get a key — deferred, not a code task tonight.

8. **The Cloudflare Worker (`claims-worker.hijasond.workers.dev`) has no authentication.**
   Its URL is public (ships in the client JS bundle via `NEXT_PUBLIC_WORKER_API_URL`). CORS is set
   to only allow the app's own origin, but CORS does not stop a direct `curl`/script call — only
   browser-based cross-origin requests. Anyone who finds the URL can burn AI tokens on the owner's
   account with no login. Lives in a separate project, `CascadeProjects/claims-worker`, which is
   **also not a git repo** — same backup risk as everything else tonight. Owner's call on priority;
   not touched, since it's a different codebase from this one.

9. **Screen consolidation — explicitly parked by the owner (2026-08-02).** He's actively using all 8
   current screens (`code-reference`, `engineer-scope`, `field-notes`, `field-scope`, `policy-chat`,
   `portal`, `reconciler`, `xact-scope`) and has no fixed target list yet — floated grouping
   AI-lookup tools together (Code Reference + Policy Chat + Xact Code Finder) and Reconciler +
   Engineer Scope together, but contradicted himself on where Xact Code Finder belongs mid-thought.
   Do not merge or restructure screens without a fresh, explicit go-ahead — he doesn't want anything
   he actively uses changed without a clear reason.

10. ~~PII scrubbing gap~~ — **closed, 2026-08-02.** Every live generation route now has the explicit
    "never state the insured's/claimant's proper name" system-prompt instruction (the primary
    defense — regex alone doesn't hold against natural AI prose like "the insured, Ms. Carrying",
    which is what actually leaked in a real saved report before this fix): Field Scope, Field Note,
    Code Reference, Reconcile, Policy Chat, and Xact Analyze.

    Separately, a real and unrelated bug on Engineer Scope was also found and fixed: it was saving
    the insured's last name straight into the database, mislabeled as `adjuster_name` (removed
    entirely, wasn't even used by the worker for analysis). Engineer Scope's own AI prompt logic
    lives in the separate `claims-worker` repo and wasn't touched (see item 8).

    `generate-estimate` still has `scrubPii` but no prompt instruction — left as-is, it's dead code,
    unreachable from any page, not worth the effort.

---

## Feature ideas under review (not committed, not scoped — for discussion before building)

- **Weather Forensics / Cause-of-Loss Validator (owner idea, 2026-08-02).** Paste a claim address +
  date of loss, get back a "Storm Fingerprint" — peak wind gust, hail-size probability, rainfall
  intensity — sourced from public NOAA/NCEI data, as a one-page report to show the insured/contractor
  when their damage claim doesn't match what the sky actually did that day. Real friction: an insured
  says "hail" but the actual swath missed the property by miles, and right now that's manual research
  or a guess.

  Feasibility notes for whoever scopes this: NCEI's Storm Events Database is real and public but
  county-level, not exact lat/long — precise enough to confirm an event happened, not to prove it
  missed one specific house. For that precision, Iowa State's Mesonet (mesonet.agron.iastate.edu)
  hosts a public archive of NOAA's MRMS MESH (Maximum Estimated Size of Hail) gridded radar data,
  which is what most real hail-forensics tools actually use for address-level hail-size estimates.
  METAR archives (also on IEM) cover wind/rain at the nearest airport. All free/public, no vendor
  contract needed — but stitching gridded radar data to a lat/long and a specific timestamp is a real
  integration, not a quick API call. Worth a dedicated scoping pass before estimating effort.

- **Material ID from photo / "Auto-Scoper" (owner idea, 2026-08-02).** Structured-JSON vision prompt
  identifies roof material, siding profile, gutter type, and estimated age/wear from a photo, mapped
  straight to a filtered Xactimate code instead of the adjuster hunting through the list. Owner also
  wants a "is this product discontinued" flag, since a discontinued product is real leverage for
  matching arguments (can't match discontinued = stronger case for full replacement, not a patch).

  Feasibility notes: this is more "deepen existing" than "build new." `src/lib/code-matcher.ts`
  already does exactly the labels-to-Xactimate-code matching step described here (keyword/category
  scoring, confidence levels, used today by Xact Scope's Multi mode) — the photo-analysis prompt
  would need to go deeper on brand/profile specifics than it does now, but the matching pipeline
  already exists and works. The "discontinued" check is the real new piece, and it can't be a static
  dataset — product lines get discontinued continuously, so it needs live lookup (manufacturer sites,
  contractor forums), which is the same underlying capability as the web-search item above (#7).
  Worth building those two together rather than twice.

  One caution worth keeping from the owner's own prompt draft: exact brand/product-line ID from a
  single field photo is much less reliable than material-class ID ("architectural vs. 3-tab" a vision
  model can usually nail; "which specific GAF product line" often can't without a visible label or a
  very distinctive pattern most inspection photos don't capture). The "state 'Requires manual
  verification' if unsure" instinct in the draft prompt is the right call and should stay non-negotiable
  in the final version — this app's existing code-grounding prompts already follow that same principle
  (never present a guessed code as real), and this should too.

- **Editable draft estimate with a correction-memory loop (owner idea, 2026-08-04).** Take 3-5 photos
  (roof, exterior), AI drafts a full line-item estimate with codes, ready to copy or use as a
  reference. Owner's own framing was the right one: it has to either be close to accurate, or easy to
  fix when it's not -- and he explicitly wants his corrections to actually improve future drafts, not
  just be a one-off overwrite of whatever the AI produced.

  The base draft-generation part is largely already there: Field Scope already does photo →
  Xactimate line-item table today. What's missing is two separable pieces:

  1. **Editable output.** The line-item table is static markdown today -- can't add/remove/adjust a
     row without retyping the whole thing outside the app. Turning it into a real editable table
     (structured state, not a markdown blob) is a genuine but well-scoped build.

  2. **Corrections actually improving future drafts.** True model fine-tuning isn't realistically
     available on top of third-party APIs (Grok/Gemini/Claude) for a personal tool -- there's no
     practical way to "train" those models directly. The real equivalent: save each correction
     (what the AI drafted vs. what the owner actually changed it to) to Supabase, then feed a sample
     of relevant past corrections back into future prompts as few-shot examples ("here's how this
     adjuster has corrected similar drafts before"). Not true training, but the practical effect is
     similar -- the model sees the owner's actual patterns instead of starting cold every time. Real
     design questions before building: how many/which past corrections to surface per request
     (relevance matching, same as the Xactimate code retrieval already built), and whether corrections
     should be scoped per-category (roofing corrections shouldn't bias a siding draft) or global.

  No AI should be trusted as fully automated here regardless -- financial/liability stakes are real,
  so "close, and easy to fix" is the right target, not "always right." Worth scoping properly, not a
  quick add.

---

## Context you won't get from the code

The owner is a State Farm claim adjuster, deployed for weather claims, working from a Samsung
S26+ in the field, actively using this app on real claims as of this session (not just testing).
Every bug found tonight came from a real job. The historical bloat (ten dashboard pages, four AI
SDKs, three auth systems, a Go MCP server duplicating capabilities the tooling already has) came
from features being guessed at before ever being run in the field — that root cause is resolving
itself now that real usage is surfacing real, prioritized bugs instead.

The app is a personal assist tool, not connected to State Farm systems, so this isn't a formal
compliance requirement — but as of 2026-08-02 the owner wants PII (insured/claimant name, phone,
email, SSN, DOB) minimized out of both the AI pipeline and the saved database as a matter of good
practice. Property address and last-4 claim ref are fine to keep. See open issue 10.

**Do not add features beyond what's in the open-issues list above without asking first.** The
owner is actively working claims with this app; changes should fix what's broken or explicitly
requested, not speculative improvements.
