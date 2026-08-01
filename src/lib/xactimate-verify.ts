import codesData from '@/data/xactimate-codes.json'

interface XactimateCodeEntry {
  code: string
  description: string
  category: string
  unit: string
  keywords: string[]
}

const ALL_CODES: XactimateCodeEntry[] = codesData.codes as XactimateCodeEntry[]
const CODE_LOOKUP = new Map(ALL_CODES.map((c) => [c.code.toUpperCase(), c]))

export interface CodeVerification {
  code: string
  found: boolean
  description?: string
  unit?: string
}

/**
 * Checks a list of Xactimate codes the AI says it used against Jason's own
 * extracted price list (src/data/xactimate-codes.json — codes pulled from
 * his own photographed price sheets, not a generic Xactimate database).
 * This is the only place in the reconciler that grounds the AI's output
 * against real data instead of trusting the model's own "knowledge" of
 * Xactimate codes, which can be outdated, generic, or wrong for a code
 * specific to this price list.
 */
export function verifyCodes(codes: string[]): CodeVerification[] {
  const seen = new Set<string>()
  const results: CodeVerification[] = []
  for (const raw of codes) {
    const code = raw.trim().toUpperCase()
    if (!code || seen.has(code)) continue
    seen.add(code)
    const match = CODE_LOOKUP.get(code)
    results.push(
      match
        ? { code, found: true, description: match.description, unit: match.unit }
        : { code, found: false }
    )
  }
  return results
}

export function getPriceListInfo(): { count: number; generatedAt: string } {
  const meta = codesData as unknown as { generatedAt?: string }
  return { count: ALL_CODES.length, generatedAt: meta.generatedAt ?? 'unknown date' }
}

/**
 * Pulls the "## CODES REFERENCED" section out of the model's markdown
 * response (a bare code per line, per the prompt's instructions) and
 * replaces it with a verification block checked against the real price
 * list. If the model didn't include that section — e.g. it ignored the
 * instruction, which models occasionally do — the report is returned
 * unchanged rather than broken.
 */
export function verifyAndReplaceCodeSection(text: string): string {
  const sectionRegex = /##\s*CODES REFERENCED\s*\n([\s\S]*?)(?=\n##\s|$)/i
  const match = text.match(sectionRegex)
  if (!match) return text

  const rawCodes = match[1]
    .split('\n')
    .map((line) => line.replace(/^[-*\s]+/, '').replace(/`/g, '').trim())
    .filter(Boolean)

  if (rawCodes.length === 0) return text

  const results = verifyCodes(rawCodes)
  const { count } = getPriceListInfo()
  const unmatched = results.filter((r) => !r.found)

  // One paragraph per code, repeating the same boilerplate sentence, reads as
  // a wall of noise at the bottom of the report. A single scannable line
  // says the same thing: everything matched, or here's exactly what to check.
  const replacement = unmatched.length === 0
    ? `## CODE CHECK\n✅ All codes matched your ${count}-code price list.\n`
    : `## CODE CHECK\n⚠️ Not in your ${count}-code extract -- may be real under a different list, confirm before filing: ${unmatched.map((r) => `**${r.code}**`).join(', ')}\n`

  return text.replace(sectionRegex, replacement)
}
