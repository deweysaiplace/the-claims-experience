/**
 * Rebuilds src/data/xactimate-codes.json from scratch out of the reviewed
 * code batches in src/data/xact-codes-source/ -- the same shape as
 * build-policy-docs.js/source-docs/: a directory of source files is the
 * single source of truth, and this script's only job is a full, deterministic
 * regeneration from them. No incremental mutation of the live JSON.
 *
 * Adding a new batch of codes: extract candidates (adapt scripts/extract-xact.js
 * for a new photo/price-sheet batch if useful, or build the list any other way),
 * review each entry for accuracy -- this is a human step, there is no
 * "lowConfidence" flag or partial-trust mechanism here, a code that hasn't
 * actually been verified against its source shouldn't be in this directory at
 * all -- then save the reviewed list as a new dated `.json` file directly in
 * xact-codes-source/, each entry shaped { code, description, category, unit }.
 * Re-run this script. No other code changes needed.
 *
 * Files are processed in filename order, so date-prefixed filenames
 * (YYYY-MM-DD-description.json) keep later corrections/batches replacing
 * earlier ones for the same code, mirroring the old merge-xact-batch.js
 * behavior ("reviewed data is trusted over whatever an earlier batch had").
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src/data/xact-codes-source');
const OUT_PATH = path.join(__dirname, '../src/data/xactimate-codes.json');

// Must stay identical to the copy in src/lib/xactimate-codes-search.ts -- query
// words are stemmed the same way at search time, so they need to land on the
// same stems stored here in `keywords`. Fixes cases like a query for "framing"
// not matching a description tokenized to "frame".
function stem(word) {
  if (word.length > 5 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function tokenize(text) {
  const words = (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2).map(stem);
  return [...new Set(words)];
}

function run() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`No source directory at ${SRC_DIR}`);
    process.exit(1);
  }

  // Leading underscore marks a file as bookkeeping (e.g. a README), not a
  // batch of codes -- same convention as source-docs/_RESUME.md.
  const files = fs.readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort();
  if (files.length === 0) {
    console.error(`No .json batch files in ${SRC_DIR}.`);
    process.exit(1);
  }

  const byCode = new Map();
  const perFile = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
    let batch;
    try {
      batch = JSON.parse(raw);
    } catch (e) {
      console.error(`Failed to parse ${file}: ${e.message}`);
      process.exit(1);
    }
    if (!Array.isArray(batch)) {
      console.error(`${file} must contain a JSON array of code entries.`);
      process.exit(1);
    }

    let added = 0;
    let updated = 0;
    for (const item of batch) {
      if (!item.code || !item.description || !item.category || !item.unit) {
        console.error(`${file} has an entry missing code/description/category/unit: ${JSON.stringify(item)}`);
        process.exit(1);
      }
      const entry = {
        code: item.code,
        description: item.description,
        category: item.category,
        unit: item.unit,
        keywords: tokenize(item.description),
      };
      if (byCode.has(item.code)) updated++;
      else added++;
      byCode.set(item.code, entry);
    }
    perFile.push({ file, count: batch.length, added, updated });
  }

  const allCodes = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));

  const output = {
    version: '4.0',
    description: `Xactimate price list -- rebuilt from ${files.length} reviewed source batch(es) in xact-codes-source/. ${allCodes.length} codes.`,
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'src/data/xact-codes-source/',
    codes: allCodes,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log(`Wrote ${allCodes.length} codes from ${files.length} batch file(s) to ${OUT_PATH}\n`);
  for (const f of perFile) {
    console.log(`  ${f.file.padEnd(40)} ${String(f.count).padStart(6)} entries  (${f.added} new, ${f.updated} overridden by a later batch)`);
  }
}

run();
