import docsData from '@/data/policy-docs.json'

export interface PolicyDocChunk {
  id: string
  docId: string
  docTitle: string
  /** Heading trail, e.g. "SECTION I – LOSSES NOT INSURED > Item 1 — Perils excluded" */
  headingPath: string
  heading: string
  text: string
  /** True when the transcription of this section contains [ILLEGIBLE]/[CAPTURE GAP]. */
  hasGaps: boolean
  keywords: string[]
}

const ALL_CHUNKS: PolicyDocChunk[] = (docsData as { chunks: PolicyDocChunk[] }).chunks ?? []

// Mirrors scripts/build-policy-docs.js's STOPWORDS list (kept in sync manually --
// both are short, stable lists). Without this, heading-match scoring below is
// vulnerable to coincidental matches on generic connector words and insurance
// boilerplate: a long, sentence-like heading like "...Insured took Reasonable
// Steps to Mitigate and Arrange for Repairs" contains "for", "roof" and "claim"
// purely as prose, and those alone out-scored the one section that actually
// answered a real "test square" question once OG 75-160's longer headings
// entered the corpus. Filtering here (applied to both the query and every
// heading via the same tokenize() call) fixes that without touching the
// keyword-based scoring, which already filters these via the build script.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'any', 'that', 'this', 'not', 'will', 'with', 'from',
  'you', 'your', 'our', 'their', 'been', 'have', 'has', 'was', 'were', 'are',
  'under', 'other', 'than', 'which', 'when', 'where', 'them', 'they', 'its',
  'section', 'policy', 'coverage', 'covered', 'loss', 'losses', 'insured',
  'claim', 'claims', 'property', 'damage', 'damages',
])

// Light suffix stripping, not a real stemmer -- just enough that a naturally
// phrased question ("cupboards collapsed under the weight of stored items")
// still lands on source text that says "cupboards fall due to the weight of
// heavy contents" and a heading that says "Collapse" (not "collapsed"). Without
// this, exact-string matching missed a section that verbatim answers the
// question as "Covered" with a matching example, because no word in the query
// exactly matched the source's word forms. Must stay identical to the copy in
// scripts/build-policy-docs.js, which stems `keywords` at build time -- query
// words are stemmed the same way here so the two line up.
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
    (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map(stem)
  )
}

/**
 * Picks the policy/Operation Guide sections relevant to one question, out of
 * the full transcribed corpus (src/data/source-docs -> policy-docs.json).
 *
 * Deliberately mirrors getFocusedCodes rather than getRelevantCodes: it returns
 * ONLY sections that actually scored a match, and returns nothing when nothing
 * matches. Padding the prompt with unrelated contract text is worse than
 * sending none -- an adjuster asking about roof wear should not get the sewer
 * back-up provision in front of the model, because a plausible-looking but
 * inapplicable exclusion is exactly the failure mode that produces a bad
 * denial. "No section matched" is a useful, honest answer here.
 *
 * Scoring favors heading matches over body matches: a question about
 * "deductible" should surface the DEDUCTIBLE section itself, not every section
 * that happens to mention the word in passing.
 */
export function getRelevantPolicySections(queryText: string, maxChunks = 6): PolicyDocChunk[] {
  const queryWords = tokenize(queryText)
  if (queryWords.size === 0) return []

  const scored = ALL_CHUNKS.map((chunk) => {
    let score = 0
    for (const word of tokenize(chunk.headingPath)) if (queryWords.has(word)) score += 5
    for (const kw of chunk.keywords) if (queryWords.has(kw)) score += 1
    return { chunk, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .map((s) => s.chunk)
}

/**
 * Caps total characters as well as chunk count -- a single section of this
 * policy (Losses Not Insured item 1 runs a. through m.) can be several
 * thousand characters on its own, so a chunk-count-only cap can still blow
 * past a sane prompt budget.
 */
function withinBudget(chunks: PolicyDocChunk[], maxChars: number): PolicyDocChunk[] {
  const kept: PolicyDocChunk[] = []
  let used = 0
  for (const chunk of chunks) {
    if (used + chunk.text.length > maxChars && kept.length > 0) break
    kept.push(chunk)
    used += chunk.text.length
  }
  return kept
}

export function formatPolicyDocsForPrompt(chunks: PolicyDocChunk[]): string {
  if (chunks.length === 0) return ''

  const byDoc = new Map<string, PolicyDocChunk[]>()
  for (const c of chunks) {
    if (!byDoc.has(c.docTitle)) byDoc.set(c.docTitle, [])
    byDoc.get(c.docTitle)!.push(c)
  }

  const sections = [...byDoc.entries()].map(([docTitle, docChunks]) => {
    const body = docChunks
      .map((c) => {
        const gapWarning = c.hasGaps
          ? `\n\n> INCOMPLETE TRANSCRIPTION: this section contains [ILLEGIBLE] or [CAPTURE GAP] markers. Say so if the answer depends on the missing part -- do not fill the gap in yourself.`
          : ''
        return `#### ${c.headingPath}${gapWarning}\n\n${c.text}`
      })
      .join('\n\n')
    return `### ${docTitle}\n\n${body}`
  })

  return [
    `# POLICY AND CLAIM MANUAL SOURCE TEXT`,
    ``,
    `The following is verbatim text from the insured's policy form and/or State`,
    `Farm's Claim Manual Operation Guides. This is the controlling authority --`,
    `it outranks your general insurance knowledge. Rules for using it:`,
    ``,
    `- Quote it exactly when stating what a provision says. Do not paraphrase a`,
    `  provision into something that sounds equivalent.`,
    `- Cite the heading trail shown above each excerpt so the adjuster can find it.`,
    `- Only apply a provision whose actual terms fit the facts described. Do not`,
    `  reach for an exclusion because its subject matter sounds adjacent -- an`,
    `  exclusion cited against facts it does not cover is a bad-faith risk.`,
    `- Watch sub-item scope: a sentence at the end of a lettered exclusion usually`,
    `  belongs to that exclusion, not to the section at large.`,
    `- If none of the text below actually addresses the question, say so plainly`,
    `  rather than stretching what is here.`,
    ``,
    sections.join('\n\n---\n\n'),
  ].join('\n')
}

export function getPolicyDocsText(queryText: string, maxChunks = 6, maxChars = 24_000): string {
  const relevant = withinBudget(getRelevantPolicySections(queryText, maxChunks), maxChars)
  return formatPolicyDocsForPrompt(relevant)
}

/** Used by the route to decide whether to mention the corpus in the system prompt at all. */
export function policyDocsAvailable(): boolean {
  return ALL_CHUNKS.length > 0
}
