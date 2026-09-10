/**
 * Chunks the transcribed policy + Operation Guide markdown in
 * src/data/source-docs/ into a searchable JSON index.
 *
 * These documents are the contract and the procedure manual -- when the app
 * quotes them it is quoting the authority a coverage decision rests on. Two
 * consequences shape this script:
 *
 * 1. Chunks are split on headings, never mid-section, so a returned chunk is
 *    always a complete provision rather than a fragment that reads differently
 *    out of context. (The HW2130 condensation sentence is the cautionary case:
 *    it lives inside exclusion 1.f about plumbing seepage, and quoted alone it
 *    looks like a free-standing exclusion.)
 * 2. Chunks carry a `hasGaps` flag when the transcription contains [ILLEGIBLE]
 *    or [CAPTURE GAP]. The prompt layer surfaces that so the AI hedges on a
 *    section it can't fully see, instead of answering confidently off a hole.
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src/data/source-docs');
const OUT_PATH = path.join(__dirname, '../src/data/policy-docs.json');

// Words too common in insurance prose to discriminate between sections --
// nearly every chunk contains them, so scoring on them just adds noise.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'any', 'that', 'this', 'not', 'will', 'with', 'from',
  'you', 'your', 'our', 'their', 'been', 'have', 'has', 'was', 'were', 'are',
  'under', 'other', 'than', 'which', 'when', 'where', 'them', 'they', 'its',
  'section', 'policy', 'coverage', 'covered', 'loss', 'losses', 'insured',
  'claim', 'claims', 'property', 'damage', 'damages',
]);

// Light suffix stripping, not a real stemmer -- just enough to stop plain word-form
// mismatches (query "collapsed" vs. heading "Collapse", "stored" vs. "stores",
// "squares" vs. "square") from silently losing an exact-string match against
// otherwise on-point content. Must stay identical to the copy in
// src/lib/policy-docs-search.ts, since query words are stemmed the same way at
// search time and need to land on the same stems stored here in `keywords`.
function stem(word) {
  if (word.length > 5 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => w.length > 2 && !STOPWORDS.has(w)
  ).map(stem);
}

/** Pulls the document title from the file's first `# ` heading. */
function readDocTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

/**
 * Splits on `##`/`###` headings and keeps the heading trail (e.g.
 * "SECTION I – LOSSES NOT INSURED > Item 1 — Perils excluded as to Coverage A")
 * so a retrieved chunk can cite where in the document it came from.
 */
function chunkByHeading(markdown, docId, docTitle) {
  const lines = markdown.split(/\r?\n/);
  const chunks = [];

  let h2 = null;
  let h3 = null;
  let buffer = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    buffer = [];
    if (!text || !h2) return;
    // The notes block is transcription bookkeeping (filenames, gap lists), not
    // document content -- indexing it would match queries against filenames.
    if (/^transcription notes$/i.test(h2)) return;

    const headingPath = h3 ? `${h2} > ${h3}` : h2;
    chunks.push({
      id: `${docId}#${chunks.length}`,
      docId,
      docTitle,
      headingPath,
      heading: h3 ?? h2,
      text,
      hasGaps: /\[ILLEGIBLE\]|\[CAPTURE GAP/.test(text),
      keywords: [...new Set([...tokenize(headingPath), ...tokenize(text)])],
    });
  };

  for (const line of lines) {
    const m2 = line.match(/^##\s+(?!#)(.+)$/);
    const m3 = line.match(/^###\s+(.+)$/);
    if (m2) {
      flush();
      h2 = m2[1].trim();
      h3 = null;
    } else if (m3) {
      flush();
      h3 = m3[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return chunks;
}

function run() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`No source-docs directory at ${SRC_DIR}`);
    process.exit(1);
  }

  // A leading underscore marks a file as bookkeeping (e.g. _RESUME.md), not a
  // transcribed document -- without this it would get chunked and indexed as
  // if its own prose (audit notes, TODOs, gap lists) were policy text.
  const files = fs.readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort();
  if (files.length === 0) {
    console.error(`No .md files in ${SRC_DIR} -- run the transcription first.`);
    process.exit(1);
  }

  const allChunks = [];
  const perDoc = [];

  for (const file of files) {
    const markdown = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
    const docId = file.replace(/\.md$/, '');
    const docTitle = readDocTitle(markdown, docId);
    const chunks = chunkByHeading(markdown, docId, docTitle);
    allChunks.push(...chunks);
    perDoc.push({ file, docTitle, chunks: chunks.length, gaps: chunks.filter((c) => c.hasGaps).length });
  }

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify({ builtAt: new Date().toISOString(), chunks: allChunks }, null, 2)
  );

  console.log(`Wrote ${allChunks.length} chunks from ${files.length} document(s) to ${OUT_PATH}\n`);
  for (const d of perDoc) {
    const gapNote = d.gaps > 0 ? `  <-- ${d.gaps} chunk(s) contain transcription gaps` : '';
    console.log(`  ${d.file.padEnd(40)} ${String(d.chunks).padStart(4)} chunks${gapNote}`);
  }

  const totalGaps = perDoc.reduce((sum, d) => sum + d.gaps, 0);
  if (totalGaps > 0) {
    console.log(
      `\n${totalGaps} chunk(s) have [ILLEGIBLE] or [CAPTURE GAP] markers. These are ` +
      `flagged to the AI at query time so it hedges rather than answering off a hole.`
    );
  }
}

run();
