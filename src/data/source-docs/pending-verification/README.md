Files here are excluded from ingestion (this subfolder is not scanned by
`scripts/build-policy-docs.js`, which only reads `.md` files directly in
`source-docs/`).

- `hw2130-policy-part2.md`, `part3.md`, `part4.md` — raw subagent output from
  8/15, superseded by `hw2130-policy.md`, which now covers the full policy
  front-to-back via direct sequential photo reads. Kept for reference only.
- `og-75-101-additional-coverages.md`, `og-75-160-wind-hail-part1.md`,
  `part2.md` — subagent output, never re-verified against source photos. Per
  `_RESUME.md` Phase 4, these need a direct-read verification pass before
  they're trustworthy enough to go live as gospel source text.

When a file here is verified (or superseded by a from-scratch transcription),
move the trustworthy version back into `source-docs/` and re-run the build
script.
