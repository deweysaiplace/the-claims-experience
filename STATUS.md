## Current Status
Last Updated: 2026-08-13

### Completed Since Last Update (2026-08-04 → 2026-08-13)
- **Closed open issue 8:** Cloudflare Worker (`claims-worker`) now requires a shared secret — was
  publicly callable with no auth, burnable by anyone who found the URL.
- Xactimate dataset expanded by ~2,400 codes from photo batches 11-90, then cleaned up (fixed
  mislabeled categories, dropped unconfirmed codes).
- Xact Scope no longer ships the full Xactimate dataset to the browser.
- Cost cuts: Claude switched from Opus to Sonnet 5, per-message token overhead trimmed in Claim
  Consult/Lookup.
- Added photo/PDF upload to Policy Chat.
- **This session (2026-08-13):** fixed a real silent-failure bug — `tryClaude()` in
  `ai-fallback.ts` only checked `msg.content[0]` for a text block; if Claude returned a non-text
  block first, the whole call was treated as "no answer" and silently fell through to the next
  provider. Now searches all blocks for the first text one. Also dropped a stale error message
  still referencing Gemini's daily limit. Typechecked, built, deployed to prod, pushed to GitHub.

### Active Issues / Blockers
None known. Still unconfirmed (carried over, not touched this pass): the Field Scope 100vh→100dvh
viewport fix has never been verified against a live repro of the original bug.

### Next Action on Resume
Same as last time and still true: field-test beats speculative fixes. Remaining open items (see
PROGRESS.md) — Reconciler mega-prompt split (bigger rebuild, not started), web search for Code
Reference (needs Jason to pick an API/key), screen consolidation (parked, don't touch).

**Also still open:** check Anthropic/x.ai billing dashboards and consider a spending cap — this
was flagged 2026-08-04 and there's no record it got done.
