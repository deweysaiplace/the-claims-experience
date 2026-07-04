import codesData from '@/data/xactimate-codes.json'

export interface XactimateCode {
  code: string
  description: string
  category: string
  unit: string
  keywords: string[]
}

export interface MatchedLineItem {
  code: string
  description: string
  category: string
  unit: string
  confidence: 'high' | 'medium' | 'low'
  matchedOn: string[]
  suggestedQuantity?: string
}

export interface UnmatchedItem {
  label: string
  reason: string
}

export interface MatchResult {
  matched: MatchedLineItem[]
  unmatched: UnmatchedItem[]
}

const ALL_CODES: XactimateCode[] = codesData.codes as XactimateCode[]

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim()
}

function tokenize(text: string): string[] {
  return normalizeText(text).split(/\s+/).filter(Boolean)
}

function scoreCode(code: XactimateCode, searchTokens: string[]): { score: number; matchedKeywords: string[] } {
  const allKeywordsNorm = code.keywords.map(normalizeText)
  const descTokens = tokenize(code.description)
  const codeTokens = tokenize(code.code)
  const categoryTokens = tokenize(code.category)

  const matchedKeywords: string[] = []
  let score = 0

  for (const token of searchTokens) {
    if (token.length < 3) continue

    for (const kw of code.keywords) {
      const kwNorm = normalizeText(kw)
      if (kwNorm.includes(token) || token.includes(kwNorm)) {
        if (!matchedKeywords.includes(kw)) {
          matchedKeywords.push(kw)
        }
        score += kwNorm === token ? 3 : 2
        break
      }
    }

    for (const dt of descTokens) {
      if (dt === token) { score += 1; break }
    }

    for (const ct of codeTokens) {
      if (ct === token) { score += 2; break }
    }

    for (const cat of categoryTokens) {
      if (cat === token) { score += 1; break }
    }
  }

  const bigram = (arr: string[]) =>
    arr.map((t, i) => i < arr.length - 1 ? t + ' ' + arr[i + 1] : null).filter(Boolean) as string[]
  const searchBigrams = bigram(searchTokens)

  for (const bg of searchBigrams) {
    for (const kw of allKeywordsNorm) {
      if (kw.includes(bg)) { score += 2; break }
    }
  }

  return { score, matchedKeywords }
}

function confidenceLevel(score: number, tokenCount: number): 'high' | 'medium' | 'low' {
  const normalized = tokenCount > 0 ? score / tokenCount : 0
  if (normalized >= 1.5 || score >= 6) return 'high'
  if (normalized >= 0.5 || score >= 3) return 'medium'
  return 'low'
}

export function matchLabelsToCode(labels: string[]): MatchResult {
  const matched: MatchedLineItem[] = []
  const unmatched: UnmatchedItem[] = []
  const usedCodes = new Set<string>()

  for (const label of labels) {
    const tokens = tokenize(label)
    if (tokens.length === 0) continue

    const scores = ALL_CODES.map((code) => ({
      code,
      ...scoreCode(code, tokens),
    })).filter((r) => r.score > 0).sort((a, b) => b.score - a.score)

    const topCandidates = scores.slice(0, 3)

    if (topCandidates.length === 0 || topCandidates[0].score < 2) {
      unmatched.push({ label, reason: 'No close match found in your code list' })
      continue
    }

    const best = topCandidates[0]
    const codeKey = best.code.code

    if (usedCodes.has(codeKey)) {
      const existing = matched.find((m) => m.code === codeKey)
      if (existing && best.matchedKeywords.length > 0) {
        for (const kw of best.matchedKeywords) {
          if (!existing.matchedOn.includes(kw)) existing.matchedOn.push(kw)
        }
      }
      continue
    }

    usedCodes.add(codeKey)
    matched.push({
      code: codeKey,
      description: best.code.description,
      category: best.code.category,
      unit: best.code.unit,
      confidence: confidenceLevel(best.score, tokens.length),
      matchedOn: best.matchedKeywords,
    })
  }

  return { matched, unmatched }
}

export function getAllCategories(): string[] {
  return [...new Set(ALL_CODES.map((c) => c.category))].sort()
}

export function getCodesByCategory(category: string): XactimateCode[] {
  return ALL_CODES.filter((c) => c.category === category)
}

export function getTotalCodeCount(): number {
  return ALL_CODES.length
}
