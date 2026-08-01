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

## Open issues, in priority order (as of 2026-08-01, end of session)

1. **Voice still duplicating? Re-verify first.** Owner reported one more duplication instance on
   Field Scope after the rebuild-from-scratch fix (`b88ad67` era) was deployed. Before writing any
   new code: confirm which deploy was actually live on the phone at that moment (check
   `vercel ls`, compare timestamps) and get a fresh repro. Don't assume the fix failed without that.

2. **Camera opens the file browser (Explorer), not the camera, on Field Scope.** `capture="environment"`
   is correctly present in the committed source (verified). Owner confirmed this in a real Chrome
   tab, not an in-app/embedded browser, so that's ruled out as the cause. Also: Take Photo allows
   only 1 file, Upload allows 4 — that specific part is expected (intentional, no `multiple` on the
   camera input), not a bug. The camera-not-launching part is still unexplained. Likely needs
   device/Chrome-version-specific research; may be a real Android Chrome limitation with no pure
   HTML fix, in which case the honest answer is telling the owner "take photo first, then Upload" is
   the reliable path on this device, rather than continuing to chase it blind.

3. **Dead vertical gap in Field Scope's "Scope Results" panel.** Screenshot showed a large blank
   space right after "Photo 2 (Wider view of roof and gutter):" cut off mid-render. Not yet
   investigated — could be the AI response itself containing a blank run (stray newlines, an empty
   section) or a CSS/overflow artifact in the `max-h-[calc(100vh-200px)] overflow-y-auto` results
   container. Get the actual raw markdown for a real report that shows this before guessing at a fix.

4. **Add photo upload to Code Reference.** Owner wants to point the camera at damage and ask "what's
   the procedure for this" in the same request. Small, well-understood change — every other page's
   photo pipeline (`compressImages`, base64 into `generateWithFallback`) is the exact pattern to
   reuse. `src/app/api/code-reference/route.ts` and its page currently take text only.

5. **Unify the two Xactimate datasets** (see above) — the real fix behind the suppressed warning.

6. **Wire Code Reference to the owner's own extracted State Farm guidelines.** `src/data/extracted-guidelines.ts`
   (45.8KB, real SOP docs the owner photographed) is currently only used by `policy-chat/load-docs`.
   Lower priority than it looked earlier tonight — the owner tested a real procedural question
   against Code Reference's existing (ungrounded) prompt and got a good answer from the model's own
   knowledge, so this is a nice-to-have grounding improvement, not fixing something broken.

7. **Add live web search to Code Reference**, for contractor best-practices beyond what's been
   extracted. A real integration (search API, or a provider's built-in search), not a prompt tweak.
   Bigger and separate from item 6.

8. **The Cloudflare Worker (`claims-worker.hijasond.workers.dev`) has no authentication.**
   Its URL is public (ships in the client JS bundle via `NEXT_PUBLIC_WORKER_API_URL`). CORS is set
   to only allow the app's own origin, but CORS does not stop a direct `curl`/script call — only
   browser-based cross-origin requests. Anyone who finds the URL can burn AI tokens on the owner's
   account with no login. Lives in a separate project, `CascadeProjects/claims-worker`, which is
   **also not a git repo** — same backup risk as everything else tonight. Owner's call on priority;
   not touched, since it's a different codebase from this one.

9. **Cleanup — collapse to a smaller screen count.** Originally planned as 5 (merge Field Scope +
   Xact Code Finder + Field Narratives into one Field tool; keep Code Reference, Policy Chat,
   Reconciler, Portal; delete Site Walkthroughs, Feedback, duplicate video routes, dead
   `components/auth/` pair). Antigravity has since added a genuinely-used **Engineer Scope** page
   (EagleView OCR → Xactimate estimate) that wasn't part of that plan — re-confirm the target
   screen list with the owner before merging anything, since the plan predates that feature.

10. **`transcribe` decision**, still open. It's audio; Grok is text+vision only, so it can't absorb
    this route the way it did the others. Options unchanged: OpenAI Whisper (package already
    installed, ~$0.006/min), leave on Gemini's 20/day cap, or cut if unused.

---

## Context you won't get from the code

The owner is a State Farm claim adjuster, deployed for weather claims, working from a Samsung
S26+ in the field, actively using this app on real claims as of this session (not just testing).
Every bug found tonight came from a real job. The historical bloat (ten dashboard pages, four AI
SDKs, three auth systems, a Go MCP server duplicating capabilities the tooling already has) came
from features being guessed at before ever being run in the field — that root cause is resolving
itself now that real usage is surfacing real, prioritized bugs instead.

The app **never touches real claim data** — it's a personal assist tool, so sending images to AI
providers is not a compliance question.

**Do not add features beyond what's in the open-issues list above without asking first.** The
owner is actively working claims with this app; changes should fix what's broken or explicitly
requested, not speculative improvements.
