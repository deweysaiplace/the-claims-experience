export interface ScrubResult {
  scrubbed: string
  map: Record<string, string>
}

export function scrubPii(input: string): ScrubResult {
  let text = input
  const map: Record<string, string> = {}
  let counter = 0

  const replace = (pattern: RegExp, label: string) => {
    text = text.replace(pattern, (match) => {
      const key = `[${label}_${++counter}]`
      map[key] = match
      return key
    })
  }

  // Phone numbers
  replace(/(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g, 'PHONE')

  // Email addresses
  replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, 'EMAIL')

  // Full policy numbers (keep last 4: e.g. 12-BC3456-7 → ****-7)
  replace(/\b[A-Z0-9]{2,4}-[A-Z0-9]{4,8}-[A-Z0-9]{1,4}\b/g, 'POLICY')

  // SSN
  replace(/\b\d{3}-\d{2}-\d{4}\b/g, 'SSN')

  // Full dates of birth (keep inspection dates — only redact if labeled DOB)
  replace(/\bDOB[:\s]+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi, 'DOB')

  // First names only (standalone capitalized words preceded by common first-name indicators)
  text = text.replace(/\b(Insured|Named Insured|Claimant|Owner|Policyholder)[:\s]+([A-Z][a-z]+)\s+/gi, (m) => {
    const parts = m.trim().split(/\s+/)
    const firstName = parts[parts.length - 1] ?? ''
    const key = `[FIRST_${++counter}]`
    map[key] = firstName
    return m.replace(firstName, key)
  })

  return { scrubbed: text, map }
}

export function restorePii(text: string, map: Record<string, string>): string {
  let result = text
  for (const [token, original] of Object.entries(map)) {
    result = result.replaceAll(token, original)
  }
  return result
}
