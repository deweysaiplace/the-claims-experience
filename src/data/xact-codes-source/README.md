# Xactimate code source files

This directory is the source of truth for `src/data/xactimate-codes.json`,
the same way `src/data/source-docs/` is the source of truth for the policy
and Claim Manual corpus. `xactimate-codes.json` is a generated build
artifact — safe to delete and regenerate, never hand-edited directly.

## Adding a new batch of codes

1. **Extract candidates.** `scripts/extract-xact.js` is a one-off tool from
   the original 94-photo extraction — it's hardcoded to a specific local
   photo directory and can be copied/adapted (change the `dir` constant) for
   a new batch of photographed price-sheet pages. Any other extraction
   method works too; this directory doesn't care how a batch was produced,
   only that it's been reviewed before landing here.
2. **Review every entry for accuracy.** There is no `lowConfidence` flag or
   partial-trust mechanism in this pipeline — a code, description, category,
   or unit that hasn't actually been verified against its source shouldn't
   be in a file in this directory at all. This mirrors the policy docs'
   verbatim-only rule: a wrong Xactimate code an adjuster acts on is the
   same class of problem as an invented policy provision.
3. **Save the reviewed batch as a new `.json` file directly in this
   directory** (not a subfolder — the build script only scans this one
   directory, non-recursively). Name it `YYYY-MM-DD-short-description.json`
   so file order sorts chronologically. Shape: a flat JSON array, each entry
   `{ "code": "...", "description": "...", "category": "...", "unit": "..." }`.
   Don't include a `keywords` field — the build script generates that.
4. **Re-run `node scripts/build-xactimate-codes.js`.** It rebuilds
   `xactimate-codes.json` from every batch file here, in filename order. If
   the same `code` appears in more than one file, the later file (by
   filename sort) wins — so a correction to an existing code just needs a
   new dated file with the corrected entry, not an edit to the old batch.
5. `npm run build`, `npx vercel --prod`, verify live — same deploy flow as
   the policy docs pipeline.

No code changes are needed to add a batch. `xactimate-codes-search.ts` reads
whatever is in `xactimate-codes.json` at request time; it has no hardcoded
knowledge of individual batches or codes.

## History

`2026-08-06-baseline.json` is every code that existed in production as of
2026-08-06 (12,413 codes) — the original 94-photo extraction plus several
2026-08 batches of price-sheet photos, previously merged incrementally via
the now-retired `scripts/archived/merge-xact-batch.js`. Migrated into this
directory 2026-08-19 so the whole dataset could be regenerated from a clean,
inspectable source the same way the policy docs already were. Field-by-field
verified against the pre-migration production file: 0 missing codes, 0
description/category/unit differences. ~5% of entries got very slightly
different `keywords` lists after the migration — the old ad-hoc keyword
generation had let a handful of short numeric fragments (`"3x"`, `"12"`,
`"26"`) through inconsistently; the new build script's `tokenize()` filters
those the same way for every entry now. Not a data loss, a consistency fix.
