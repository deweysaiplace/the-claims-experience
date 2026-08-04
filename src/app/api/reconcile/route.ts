import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120 // seconds — image encoding + Gemini can be slow
import { generateWithFallback } from '@/lib/ai-fallback'
import { scrubPii } from '@/utils/sanitizer'
import { verifyAndReplaceCodeSection } from '@/lib/xactimate-verify'
import { getRelevantCodesText } from '@/lib/xactimate-codes-search'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    // Support multi-page: getAll returns array of files
    const filesA = formData.getAll('estimateA') as File[]
    const filesB = formData.getAll('estimateB') as File[]
    const claimRef = (formData.get('claimRef') as string) ?? ''
    const address = (formData.get('address') as string) ?? ''

    if (filesA.length === 0 || filesB.length === 0) {
      return NextResponse.json({ error: 'Both estimate images are required' }, { status: 400 })
    }

    const { scrubbed: scrubRef } = scrubPii(claimRef)
    const { scrubbed: scrubAddr } = scrubPii(address)

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    const toBase64 = async (file: File) => {
      const bytes = await file.arrayBuffer()
      return Buffer.from(bytes).toString('base64')
    }

    // No notes/cause-of-loss text signal available here (unlike Field Scope),
    // so an empty query falls back to a broad, category-balanced sample --
    // the right default when the claim type isn't known in advance. See
    // xactimate-codes-search.ts's round-robin fallback for why this doesn't
    // just dump the single biggest category.
    const codeReference = getRelevantCodesText('')

    const systemPrompt = `You are an elite property insurance claims estimating expert with deep knowledge of Xactimate line item codes, CSI divisions, and standard scoping methodology. You are analyzing two field-photographed estimates to identify discrepancies.

Date of Review: ${today}
Claim Reference: ${scrubRef || 'N/A'}
Property Address: ${scrubAddr || 'N/A'}

IMPORTANT: Estimate A has ${filesA.length} page(s) and Estimate B has ${filesB.length} page(s). Read ALL pages of each estimate and combine the line items from all pages before comparing.

IMPORTANT RULES:
- Be precise and professional. Use insurance industry terminology.
- Match line items between the two estimates by SCOPE AND DESCRIPTION, not
  by exact wording or code alone. "Remove & replace 3-tab shingles" and "R&R
  comp shingles - 3 tab" are very likely the same scope item described
  differently by two different people/software -- treat them as the same
  line item for comparison, not as one estimate missing an item the other
  has. Only list something under MISSING ITEMS if it genuinely has no
  reasonable counterpart in the other estimate, not just different phrasing.
- Before flagging a quantity as a variance, check the units match. 100 SF
  and 100 SQ are NOT the same quantity (1 SQ = 100 SF) -- normalize to the
  same unit before comparing, and if the two estimates measure the same
  scope in different units, say so explicitly rather than reporting a
  variance that's actually just a unit mismatch.
- Flag every line item that differs in quantity, unit price, or code, using
  the matching and unit rules above.
- Flag potential double-billing (e.g., setup/cleanup charged per room AND as a whole).
- All amounts should be compared as numeric values.
- The codes you cite in the CODES REFERENCED section must be transcribed
  EXACTLY as printed on the photographed estimate -- you are reading real
  codes off a real document, not recalling one from memory. Never
  substitute, "correct", or omit a code just because it doesn't appear in
  the REFERENCE CODES list below; that list is a sanity aid for you, not a
  restriction on what you're allowed to transcribe from what you can
  actually see on the page.
- Respond with PLAIN MARKDOWN ONLY. Do not wrap the response in an HTML document, a <!DOCTYPE> declaration, or <html>/<head>/<body> tags, and do not use markdown code fences around the whole answer. The response is rendered directly as Markdown — any HTML wrapper will display as broken, unreadable text to the adjuster instead of a formatted report.

${codeReference}`

    const userPrompt = `Please analyze these two property damage estimates.
The first ${filesA.length} image(s) are Estimate A (Carrier Estimate).
The next ${filesB.length} image(s) are Estimate B (Contractor Estimate).

Generate a structured response with EXACTLY these sections:

## KEY DIFFERENCES
Before the detailed matrix, list the 3-6 differences that matter most by
dollar impact, in plain adjuster language -- one sentence each, no table.
E.g. "Contractor included 2 more squares of shingles than the carrier
estimate (+$340) -- likely a measurement discrepancy, verify roof area."
This is what gets read on a phone screen in the field; the matrix below
is for the detailed follow-up, not the first thing scanned.

## VARIANCE MATRIX
An 8-column table is unreadable on a phone. Use only: | Line Item | Est A $ | Est B $ | Variance | Flag |
Put the Xactimate code in parentheses after the line item name, not its own column.
Use 🔴 for major variance (>20%), 🟡 for moderate (5-20%), 🟢 for match.

## CODES REFERENCED
List every distinct Xactimate code you used in the matrix above, one bare code per line with a leading dash and nothing else on the line (no description, no quantity) — e.g.:
- RFGCSFRN
- WTREXTA
This section is parsed by code, not read by the adjuster, so it must contain ONLY the codes, exactly as written in the matrix above, one per line.

## MISSING ITEMS
List items present in Contractor estimate (B) but absent from Carrier estimate (A), and vice versa.

## DOUBLE-BILLING FLAGS
Any items that appear to charge twice for the same scope.

## SUMMARY
- Total Est A: $X,XXX
- Total Est B: $X,XXX
- Net Discrepancy: $X,XXX (Est B minus Est A -- positive means the contractor estimate is higher, negative means the carrier estimate is higher; state which direction it is)
- Suggested Starting Point for Negotiation: $X,XXX (with brief justification)
This is a draft starting point based on what's visible in the photos, not
an approval decision -- the adjuster verifies against policy and field
observations before anything gets approved.

## CONTRACTOR EMAIL DRAFT
Professional email to contractor explaining the scope differences, what can be approved per policy guidelines, and requesting clarification on flagged items.

## FILE NOTE
Internal claim file note documenting the estimate review, suitable for direct entry into the claim system.`

    let text = ''
    // Always reassigned from response.provider before being read (the catch
    // block re-throws without touching it) -- no meaningful default exists.
    let provider = ''

    try {
      console.log(`Attempting reconciliation: ${filesA.length} vs ${filesB.length} pages...`)
      console.log('Incoming file sizes (KB):', [...filesA, ...filesB].map((f) => (f.size / 1024).toFixed(0)).join(', '))

      const allFiles = [...filesA, ...filesB]
      const base64Images = await Promise.all(
        allFiles.map(async (f) => await toBase64(f))
      )
      console.log('Base64 payload sizes (KB):', base64Images.map((b) => (b.length / 1024).toFixed(0)).join(', '),
        '— total', (base64Images.reduce((sum, b) => sum + b.length, 0) / 1024).toFixed(0), 'KB')

      const genStart = Date.now()
      const response = await generateWithFallback(userPrompt, systemPrompt, base64Images)
      console.log(`generateWithFallback took ${Date.now() - genStart}ms, provider: ${response.provider}`)
      text = response.text
      provider = response.provider

      // Safety net: if a model ignores the "markdown only" instruction and
      // wraps its answer in a full HTML document anyway, don't show that raw
      // markup to the adjuster — pull the readable text back out of it.
      if (/^\s*<!DOCTYPE html/i.test(text) || /^\s*<html[\s>]/i.test(text)) {
        const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i)
        text = (bodyMatch ? bodyMatch[1] : text)
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      }

      // Ground the AI's Xactimate codes against the real price list instead
      // of trusting the model's own knowledge of what a code means.
      text = verifyAndReplaceCodeSection(text)

      console.log(`Reconciliation successful via ${provider}!`)
    } catch (err: any) {
      throw new Error(err.message)
    }

    return NextResponse.json({ success: true, result: text, provider })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
