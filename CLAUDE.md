# The Claims Experience — Project Context for AI Agents

## What This Is
A Next.js web app for insurance adjusters. Uploads MP4/MOV videos of scrolling insurance documents (Xactimate estimates, policy declarations) and uses AI to extract ALL visible text, then organizes it into structured sections.

**Time savings:** 2-3 hours manual review → 2-3 minutes per video.

## Tech Stack
- Next.js 16, App Router, TypeScript, Tailwind CSS, shadcn/ui
- Gemini API (primary) + Claude API (fallback)
- Google Files API (video hosting)
- Cloudflare Pages via OpenNext (wrangler.toml configured)

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

## Current Status (as of June 2026)
- App is 90% built
- Cloudflare wrangler.toml is configured: `name = "the-claims-experience"`, `pages_build_output_dir = ".open-next"`
- Main blocker: Gemini free-tier quota errors (429 RESOURCE_EXHAUSTED)
- Claude API key is in .env.local as fallback — needs to be activated in parse-video route

## Priority Fix Needed
In `src/app/api/parse-video/route.ts`: when Gemini returns a 429 error, automatically fall back to Claude API instead of returning the quota error to the user.

## Reference Docs
- `DETAILED_PROMPT_FOR_BROTHER.md` — 374-line comprehensive brief with full workflow details
- `TROUBLESHOOTING.md` — diagnostic steps
- `XACTIMATE_CODES.md` — Xactimate line item reference
