const fs = require('fs');
const path = require('path');

const mergedFile = process.argv[2] || 'xact-merged-batch2.json';
const outName = process.argv[3] || 'xact_review_batch11-20.csv';

const merged = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/', mergedFile), 'utf8'));
const existing = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/xactimate-codes.json'), 'utf8')).codes;
const existingCodes = new Set(existing.map((c) => c.code));

function csvEsc(s) {
  s = String(s ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const rows = [['code', 'description', 'unit', 'category', 'status', 'flag']];
for (const m of merged) {
  const status = existingCodes.has(m.code) ? 'already in app' : 'new';
  rows.push([m.code, m.description, m.unit, m.category, status, m.lowConfidence ? 'LOW CONFIDENCE - CHECK' : '']);
}
const csv = rows.map((r) => r.map(csvEsc).join(',')).join('\r\n');
const outPath = 'C:\\Users\\Dewey\\Desktop\\x\\' + outName;
fs.writeFileSync(outPath, csv);
console.log(`Wrote ${rows.length - 1} rows to ${outPath}`);
