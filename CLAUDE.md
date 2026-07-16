# The Claims Experience — Project Context for AI Agents

## What This Is
A Next.js web app for insurance adjusters. Uploads MP4/MOV videos of scrolling insurance documents (Xactimate estimates, policy declarations) and uses AI to extract ALL visible text, then organizes it into structured sections.

**Time savings:** 2-3 hours manual review → 2-3 minutes per video.

> **Read `PROGRESS.md` first.** It documents the current state, the traps that will
> waste your time, and the agreed next steps. This file is the short version.

## Tech Stack
- Next.js 15, App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Grok (`grok-4.5`) is the primary AI** — the only funded provider. Gemini is a free
  tier capped at 20 requests/day; the Anthropic account has no credit.
- Supabase (reports), Gmail SMTP (file notes)
- **Deployed to Vercel via CLI only** (`npx vercel --prod`). Pushing to GitHub does not deploy.

## Key Files
- `src/app/api/parse-video/route.ts` — main AI extraction endpoint
- `src/app/api/upload-video/route.ts` — uploads to Google Files API
- `src/app/api/policy-chat/route.ts` — chat about extracted policy data
- `src/app/(dashboard)/site-walkthroughs/page.tsx` — main upload UI
- `src/app/(dashboard)/reconciler/page.tsx` — claim line item reconciler
- `src/app/api/field-scope/route.ts` — field-level scope analysis
- `src/lib/gemini.ts` — Gemini client
- `src/lib/claude.ts` — Claude fallback client
- `.env.local` — API keys (GEMINI_API_KEY, ANTHROPIC_API_KEY)

## Output Sections (5 structured categories)
1. POLICY INFORMATION (policy numbers, limits, deductibles)
2. COVERAGE ANALYSIS (Coverage A-D, perils, exclusions)
3. STRUCTURED LINE ITEMS (Xactimate codes, descriptions, amounts)
4. FINANCIAL SUMMARY (subtotals, taxes, O&P, totals)
5. RAW TEXT DUMP (complete verbatim extraction)

## Current Status (2026-07-16)
- Auth, report saving, email, and the AI fallback chain all work and are verified in production.
- `src/lib/ai-fallback.ts` tries **Grok → Gemini → Claude**. Six of seven live routes use it.
- Still Gemini-direct: `transcribe` (audio — needs a decision) and `xact-analyze`.
- **Not built:** GPS/timestamp on photo capture. This is the biggest gap.

## Next Up
Collapse to five screens — a merged **Field** tool, **Code Reference**, **Policy Chat**,
**Reconciler**, **Portal**. Delete Site Walkthroughs, Feedback, the duplicate video routes,
and the dead `components/auth/` pair. See `PROGRESS.md` for the full plan.

**Do not add features.** The bar: does it make *photo → location → Xactimate codes → file
note → email* work in a driveway?

## Reference Docs
- `PROGRESS.md` — **start here.** Current state, traps, next steps.
- `DETAILED_PROMPT_FOR_BROTHER.md` — original 374-line brief. Note: contains a dead
  Gemini key on line 97, and predates everything above.
- `TROUBLESHOOTING.md` — diagnostic steps
- `XACTIMATE_CODES.md` — Xactimate line item reference
