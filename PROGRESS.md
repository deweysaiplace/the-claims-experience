# Progress & Handoff — 2026-07-16

Written for the next agent (Antigravity or otherwise) picking up `my-next-claim`.
Read this before touching anything. Several things in this repo are not what they look like.

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

## What's next (agreed with the owner)

**1. `transcribe` decision.** It's audio; Grok is text+vision only. Options: OpenAI Whisper
(the `openai` package is already installed, ~$0.006/min), leave it on Gemini and accept the
20/day cap, or cut it if voice notes go unused.

**2. Cleanup — collapse to five screens.** Keep: a merged **Field** tool (Field Scope + Xact Code
Finder + Field Narratives combined into one photo+voice capture flow), **Code Reference**
(Xactimate search, stays standalone), **Policy Chat** (works well — don't touch), **Reconciler**,
and **Portal**. Delete: Site Walkthroughs, Feedback, the duplicate video routes
(`parse-video-fixed`, `parse-video-smart`, `analyze-video-claude`, `test-new-api`), the dead
`components/auth/` pair, and any AI SDKs left unused.

**3. Not yet built:** GPS/timestamp on capture. The owner's stated goal is
*photo → document the location → Xactimate options → clean file note → email it to myself.*
Nothing captures location today. This is the gap that matters most.

---

## Context you won't get from the code

The owner is a State Farm claim adjuster, currently deployed for weather claims, working from a
Samsung S26+ in the field. **He has never once used this app on an actual job.** Every feature in
here is a guess at a workflow that has not been run. That is the root cause of the bloat — ten
dashboard pages, four AI SDKs, three auth systems, and a Go MCP server that duplicates
capabilities the tooling already has.

The app **never touches real claim data** — it's a personal assist tool, so sending images to AI
providers is not a compliance question.

**Do not add features.** The bar for new work is: does it make the sentence above
(photo → location → codes → file note → email) work in a driveway? If not, it's why this app got heavy.
