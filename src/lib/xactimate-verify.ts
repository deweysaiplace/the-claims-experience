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

  // The prompt (src/lib/xactimate-codes-search.ts) and this verifier now both
  // ground on the same real price list, so an unmatched code here is a real
  // signal -- either a genuine fabrication or a code outside the relevant
  // subset sent to the model -- not the systemic noise it used to be when
  // the prompt was grounded on a different, largely fabricated reference.
  if (unmatched.length === 0) {
    return text.replace(sectionRegex, `## CODE CHECK\n✅ All codes matched your ${count}-code price list.\n`)
  }
  const unmatchedList = unmatched.map((r) => `**${r.code}**`).join(', ')
  return text.replace(
    sectionRegex,
    `## CODE CHECK\n⚠️ Not in your ${count}-code price list -- confirm before filing: ${unmatchedList}\n`
  )
}
