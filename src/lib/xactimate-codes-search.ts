import codesData from '@/data/xactimate-codes.json'

export interface XactimateCodeEntry {
  code: string
  description: string
  category: string
  unit: string
  keywords: string[]
}

const ALL_CODES: XactimateCodeEntry[] = (codesData as { codes: XactimateCodeEntry[] }).codes

// Same word-form fix applied to policy-docs-search.ts: without this, a query
// like "framing" doesn't match a description tokenized to "frame", and
// "shingles" doesn't match "shingle" -- an exact-string keyword match silently
// misses otherwise-correct codes purely on verb tense/pluralization. Must stay
// identical to the copy in scripts/build-xactimate-codes.js, which stems
// `keywords` at build time -- query words are stemmed the same way here so
// the two line up.
function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3)
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2)
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function tokenize(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2).map(stem)
  )
}

/**
 * Interleaves entries one-per-category per round (biggest category first each
 * round) instead of concatenating whole categories. A flat sort by category
 * size lets the single largest category (Framing, 629 of 2,728 codes) swamp
 * the entire budget before any other category gets a single entry -- this
 * gives every category an early, fair share while still letting bigger
 * categories contribute more over multiple rounds.
 */
function roundRobinByCategory(entries: XactimateCodeEntry[]): XactimateCodeEntry[] {
  const byCategory = new Map<string, XactimateCodeEntry[]>()
  for (const e of entries) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, [])
    byCategory.get(e.category)!.push(e)
  }
  const buckets = [...byCategory.values()].sort((a, b) => b.length - a.length)

  const result: XactimateCodeEntry[] = []
  let remaining = true
  while (remaining) {
    remaining = false
    for (const bucket of buckets) {
      const next = bucket.shift()
      if (next) {
        result.push(next)
        remaining = true
      }
    }
  }
  return result
}

/**
 * Picks a subset of the real 2,728-code price list (src/data/xactimate-codes.json,
 * extracted from Jason's own photographed price sheets) relevant to one request,
 * instead of sending the whole ~150KB/~38K-token list on every call.
 *
 * Each code scores on keyword/category word overlap with the query text (claim
 * notes, cause of loss, or the user's question). Codes with no overlap --
 * including the common case of a photo-only Field Scope run with no typed notes
 * -- still need to fill out the budget, so the zero-score tail is round-robined
 * across categories (see roundRobinByCategory) rather than left in arbitrary
 * JSON order or dominated by whichever category happens to be biggest.
 */
export function getRelevantCodes(queryText: string, maxCodes = 500): XactimateCodeEntry[] {
  const queryWords = tokenize(queryText)

  const scored = ALL_CODES.map((entry) => {
    let score = 0
    for (const kw of entry.keywords) if (queryWords.has(kw.toLowerCase())) score += 2
    for (const word of tokenize(entry.category)) if (queryWords.has(word)) score += 1
    return { entry, score }
  })

  const positive = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.entry)
  const zero = scored.filter((s) => s.score === 0).map((s) => s.entry)

  return [...positive, ...roundRobinByCategory(zero)].slice(0, maxCodes)
}

export function formatCodesForPrompt(entries: XactimateCodeEntry[]): string {
  const byCategory = new Map<string, XactimateCodeEntry[]>()
  for (const e of entries) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, [])
    byCategory.get(e.category)!.push(e)
  }

  const sections = [...byCategory.entries()].map(([category, codes]) => {
    const rows = codes.map((c) => `| \`${c.code}\` | ${c.description} | ${c.unit} |`).join('\n')
    return `### ${category}\n| Code | Description | Unit |\n|---|---|---|\n${rows}`
  })

  return `# Xactimate Code Reference (from your photographed price sheets)\n\n${sections.join('\n\n')}`
}

export function getRelevantCodesText(queryText: string, maxCodes = 500): string {
  return formatCodesForPrompt(getRelevantCodes(queryText, maxCodes))
}

/**
 * Unlike getRelevantCodes, this never pads with round-robin filler from
 * unrelated categories -- it returns only codes that actually scored a
 * keyword/category match, capped at maxCodes. Used by Claim Consult/Lookup,
 * where most turns (small talk, non-code questions) shouldn't ship any code
 * block at all rather than ~500 irrelevant codes on every message.
 */
export function getFocusedCodes(queryText: string, maxCodes = 120): XactimateCodeEntry[] {
  const queryWords = tokenize(queryText)

  const scored = ALL_CODES.map((entry) => {
    let score = 0
    for (const kw of entry.keywords) if (queryWords.has(kw.toLowerCase())) score += 2
    for (const word of tokenize(entry.category)) if (queryWords.has(word)) score += 1
    return { entry, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.entry)
    .slice(0, maxCodes)
}

/** Empty string when nothing matched -- callers should skip the code-reference section entirely rather than render an empty header. */
export function getFocusedCodesText(queryText: string, maxCodes = 120): string {
  const entries = getFocusedCodes(queryText, maxCodes)
  return entries.length > 0 ? formatCodesForPrompt(entries) : ''
}
