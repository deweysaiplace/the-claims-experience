// ARCHIVED 8/19/2026 -- superseded by scripts/build-xactimate-codes.js, which
// rebuilds xactimate-codes.json from scratch out of every reviewed batch file
// in src/data/xact-codes-source/, the same clean regenerate-don't-mutate
// pattern as build-policy-docs.js. This script's incremental in-place-mutation
// approach (and its hardcoded default filename from one specific past merge)
// is no longer how codes get added. Kept for reference only.
//
// Merges a reviewed/approved batch of extracted Xactimate codes into the
// live src/data/xactimate-codes.json. Adds new codes, updates existing ones
// (the reviewed data is trusted over whatever the original 94-photo
// extraction produced for the same code), generates the `keywords` field
// every entry needs (xactimate-codes-search.ts iterates it directly --
// missing it would crash retrieval at runtime), and strips the review-only
// `lowConfidence` flag before it reaches the live file.
const fs = require('fs');
const path = require('path');

const mergedFile = process.argv[2] || 'xact-merged-2026-08-05.json';
const mergedPath = path.join(__dirname, '../src/data/', mergedFile);
const prodPath = path.join(__dirname, '../src/data/xactimate-codes.json');

const batch = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
const prod = JSON.parse(fs.readFileSync(prodPath, 'utf8'));

function tokenize(text) {
  const words = (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2);
  return [...new Set(words)];
}

const byCode = new Map(prod.codes.map((c) => [c.code, c]));
let added = 0;
let updated = 0;

for (const item of batch) {
  const entry = {
    code: item.code,
    description: item.description,
    category: item.category,
    unit: item.unit,
    keywords: tokenize(item.description),
  };
  if (byCode.has(item.code)) {
    updated++;
  } else {
    added++;
  }
  byCode.set(item.code, entry);
}

const allCodes = Array.from(byCode.values());
prod.codes = allCodes;
const nextMinor = Math.round((parseFloat(prod.version) + 0.1) * 10) / 10;
prod.version = String(nextMinor);
prod.description = `Xactimate price list -- extracted from 94 field photos plus multiple 2026-08 batches of Jason's own price-sheet spreadsheet photos, deduplicated. ${allCodes.length} codes.`;
prod.generatedAt = '2026-08-06';

fs.writeFileSync(prodPath, JSON.stringify(prod, null, 2));
console.log(`Added ${added} new codes, updated ${updated} existing codes.`);
console.log(`Production dataset now has ${allCodes.length} total codes.`);
