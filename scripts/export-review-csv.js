const fs = require('fs');
const path = require('path');

const merged = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/xact-merged-2026-08-05.json'), 'utf8'));
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
const outPath = 'C:\\Users\\Dewey\\Desktop\\x\\xact_review_batch1-10.csv';
fs.writeFileSync(outPath, csv);
console.log(`Wrote ${rows.length - 1} rows to ${outPath}`);
