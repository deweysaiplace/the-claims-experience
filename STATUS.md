## Current Status
Last Updated: 2026-08-04

### Completed This Session
- Fixed reliability across the board: AI provider timeouts rebalanced (Claude primary), camera capture switched to real high-res photos (was silently producing blurry images), mobile viewport bugs (100vh→100dvh) fixed in 7+ places, elapsed-time feedback added to every AI wait
- Reconciler accuracy overhaul: grounded on the real 2,728-code price list, fixed line-item matching/unit-normalization/direction-clarity gaps, added researched double-billing patterns, fixed fake example codes, removed dead double-encoding code
- PII scrubbing closed across every live generation route (Field Scope, Field Note, Code Reference, Reconcile, Policy Chat, Xact Analyze) — was a real, confirmed leak before tonight
- Unified naming: folder, GitHub repo, and Vercel project all now "the-claims-experience" (live URL unchanged, zero disruption)
- Added Claim Consult mode to Code Reference (talk through a live claim scenario, not just code lookups) plus voice dictation
- Removed the Adjuster Name field entirely (always the same person, not worth a UI field)
- Archived stale root scripts to scripts/archived/ (not deleted)
- Everything committed and pushed to GitHub — local and origin are in sync

### Active Issues / Blockers
None known. One item worth double-checking, not currently blocking: the Field Scope "dead gap" viewport fix (100vh→100dvh) is deployed but has never been confirmed against a live repro of the original bug.

### Next Action on Resume
Field-test the app on real claims in the field tomorrow and report back what breaks or feels off — more valuable right now than further speculative fixes.

**Also:** check the Anthropic (console.anthropic.com) and x.ai (console.x.ai) billing dashboards.
Claude is now the primary AI provider for every action in the app (changed 2026-08-04), so it's
the main real cost driver going forward. Jason noticed token usage was already lower than the
previous week on one dashboard as of 2026-08-04 and wants to understand why before it becomes a
bigger bill. Also worth a spending cap on both consoles while there — 2 minutes, real safety net.
