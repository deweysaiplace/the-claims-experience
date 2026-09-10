import { NextRequest, NextResponse } from 'next/server'

// Three staged AI calls now replace the old single mega-call (2 parallel
// extractions + 1 diff/draft). Each stage can race up to ~110s worst case
// (see ai-fallback.ts's CLAUDE_TIMEOUT_MS + BACKUP_TIMEOUT_MS), so the old
// 120s budget wasn't enough headroom for the extraction stages plus the
// diff/draft stage after them.
export const maxDuration = 180
import { generateWithFallback } from '@/lib/ai-fallback'
import { scrubPii } from '@/utils/sanitizer'
import { verifyAndReplaceCodeSection } from '@/lib/xactimate-verify'
import { getRelevantCodesText } from '@/lib/xactimate-codes-search'

// Safety net: if a model ignores the "markdown only" instruction and wraps
// its answer in a full HTML document anyway, pull the readable text back out
// instead of feeding broken markup into the next stage (or showing it raw).
function stripHtmlWrapper(text: string): string {
  if (!/^\s*<!DOCTYPE html/i.test(text) && !/^\s*<html[\s>]/i.test(text)) return text
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  return (bodyMatch ? bodyMatch[1] : text)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function filesToBase64(files: File[]) {
  const images = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(f.name))
  const pdfs = files.filter((f) => (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) && !images.includes(f))
  const [base64Images, base64Pdfs] = await Promise.all([
    Promise.all(images.map(async (f) => Buffer.from(await f.arrayBuffer()).toString('base64'))),
    Promise.all(pdfs.map(async (f) => Buffer.from(await f.arrayBuffer()).toString('base64'))),
  ])
  return { base64Images, base64Pdfs }
}

/**
 * Stage 1/2: extract one estimate's line items in isolation. Each call only
 * ever sees one side's photos, so a blurry/illegible page on Estimate A
 * can't degrade the read on Estimate B, and the caller learns exactly which
 * side to blame if something comes back thin.
 */
async function extractEstimate(
  label: 'A (Carrier)' | 'B (Contractor)',
  files: File[],
  codeReference: string
): Promise<{ text: string; provider: string }> {
  const { base64Images, base64Pdfs } = await filesToBase64(files)

  const systemPrompt = `You are an elite property insurance claims estimating expert with deep knowledge of Xactimate line item codes, CSI divisions, and standard scoping methodology. You are reading ${files.length} photographed page(s) of a single property damage estimate (Estimate ${label}) and extracting its line items -- you are not comparing it to anything yet.

IMPORTANT RULES:
- Read ALL ${files.length} page(s) and combine the line items into ONE list.
- Real Xactimate estimates almost always print the insured's name in the
  header. Never state that name, or any other individual's proper name,
  anywhere in your response -- refer to them generically as "the insured"
  or "the homeowner" instead.
- If any page is too blurry, low-resolution, glare-affected, or cut off to
  read reliably, say so explicitly under UNREADABLE PAGES -- name the page
  number -- rather than silently working around it or omitting its line
  items. Do not guess at a line item you can't actually read.
- The codes you list must be transcribed EXACTLY as printed on the
  photographed estimate -- you are reading real codes off a real document,
  not recalling one from memory. Never substitute, "correct", or omit a
  code just because it doesn't appear in the REFERENCE CODES list below;
  that list is a sanity aid, not a restriction on what you're allowed to
  transcribe from what you can actually see on the page.
- Flag potential double-billing WITHIN THIS ESTIMATE. Specifically check for:
  - A removal/tear-out line item that already includes disposal, with a
    separate "haul debris" or disposal line charged on top of it for the
    same material.
  - A flooring or roofing removal line that already includes underlayment
    removal (per its own line item description), with a separate
    underlayment removal line charged for the same area.
  - Setup/cleanup or mobilization charged per room AND again as a whole-job
    line item.
  - O&P (overhead and profit) applied to job-related fixed costs --
    dumpster rental, temporary fencing, portable restroom, temporary power
    -- instead of only to labor and materials. These should be flat line
    items, not O&P-bearing ones.
- Respond with PLAIN MARKDOWN ONLY. Do not wrap the response in an HTML
  document or code fence.

${codeReference}`

  const userPrompt = `Extract every line item from these ${files.length} page(s) of Estimate ${label}.

Respond with EXACTLY these sections:

## LINE ITEMS
| Description | Code | Qty | Unit | Unit $ | Total $ |
One row per line item, in the order they appear.

## UNREADABLE PAGES
List which page(s), if any, were too illegible to read reliably. "None" if all pages were readable.

## DOUBLE-BILLING FLAGS
Any within-estimate double-billing found per the rules above. "None" if none found.

## ESTIMATE TOTAL
$X,XXX -- the estimate's stated total, or your sum of the line items above if no total is printed.`

  const response = await generateWithFallback(userPrompt, systemPrompt, base64Images, base64Pdfs)
  return { text: stripHtmlWrapper(response.text), provider: response.provider }
}

/**
 * Stage 3: diff the two already-extracted line-item lists and draft the
 * adjuster-facing report. Text-only -- no photos -- so it's fast and has
 * nothing left to misread; every code, quantity, and unreadable-page note
 * came from the extraction stages above.
 */
async function diffAndDraft(
  extractA: { text: string },
  extractB: { text: string },
  claimRef: string,
  address: string
): Promise<{ text: string; provider: string }> {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const systemPrompt = `You are an elite property insurance claims estimating expert reconciling two already-extracted estimate line-item lists to identify discrepancies. Someone else already read the source photos and produced the two extracts below -- trust their line items and codes as given, you are comparing and drafting, not re-reading source documents.

Date of Review: ${today}
Claim Reference: ${claimRef || 'N/A'}
Property Address: ${address || 'N/A'}

IMPORTANT RULES:
- Never state the insured's or claimant's proper name anywhere in your
  response, including the contractor email draft and file note -- refer to
  them generically as "the insured" or "the homeowner."
- If either extract below flagged unreadable pages, state this explicitly
  in your response (which estimate, which page) rather than silently
  ignoring it -- the adjuster needs to know to retake that specific page.
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
- A larger quantity/scope on one side is not automatically an overcharge.
  If a contractor estimate scopes a full elevation or a whole roof slope
  where the carrier estimate only scopes a partial repair, note that this
  is consistent with a legitimate matching requirement (many policies and
  building codes require replacing an entire visible section when the
  original material can no longer be matched) rather than assuming it's
  padding -- flag it as "possible matching issue, verify" instead of a
  straightforward overcharge.
- Flag every line item that differs in quantity, unit price, or code, using
  the matching and unit rules above.
- Carry forward every within-estimate double-billing flag from each extract
  below into your DOUBLE-BILLING FLAGS section, plus any new ones you spot
  by comparing the two (e.g. the same scope billed under two different
  descriptions on one side).
- All amounts should be compared as numeric values.
- Respond with PLAIN MARKDOWN ONLY. Do not wrap the response in an HTML
  document, a <!DOCTYPE> declaration, or <html>/<head>/<body> tags, and do
  not use markdown code fences around the whole answer. The response is
  rendered directly as Markdown -- any HTML wrapper will display as broken,
  unreadable text to the adjuster instead of a formatted report.`

  const userPrompt = `## ESTIMATE A EXTRACT (Carrier Estimate)
${extractA.text}

## ESTIMATE B EXTRACT (Contractor Estimate)
${extractB.text}

---

Compare these two estimates. Generate a structured response with EXACTLY these sections:

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
Use 🔴 for major variance (>20%), 🟡 for moderate (5-20%), 🟢 for match (0-5%, not just exact) -- every row gets exactly one of these three, no gap between the ranges.

## CODES REFERENCED
List every distinct Xactimate code you used in the matrix above, one bare code per line with a leading dash and nothing else on the line (no description, no quantity) — e.g.:
- RFGCSFRN
- WTREXTA
This section is parsed by code, not read by the adjuster, so it must contain ONLY the codes, exactly as written in the matrix above, one per line.

## MISSING ITEMS
List items present in Contractor estimate (B) but absent from Carrier estimate (A), and vice versa.

## DOUBLE-BILLING FLAGS
Any items that appear to charge twice for the same scope -- check each
estimate individually as well as against each other. Say which estimate
(A, B, or both) each flag applies to.

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

  const response = await generateWithFallback(userPrompt, systemPrompt)
  return { text: stripHtmlWrapper(response.text), provider: response.provider }
}

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

    // No notes/cause-of-loss text signal available here (unlike Field Scope),
    // so an empty query falls back to a broad, category-balanced sample --
    // the right default when the claim type isn't known in advance. See
    // xactimate-codes-search.ts's round-robin fallback for why this doesn't
    // just dump the single biggest category.
    const codeReference = getRelevantCodesText('')

    console.log(`Reconciling: Estimate A (${filesA.length} pages) vs Estimate B (${filesB.length} pages)`)

    const [extractA, extractB] = await Promise.all([
      extractEstimate('A (Carrier)', filesA, codeReference),
      extractEstimate('B (Contractor)', filesB, codeReference),
    ])
    console.log(`Extraction done -- A via ${extractA.provider}, B via ${extractB.provider}`)

    const draft = await diffAndDraft(extractA, extractB, scrubRef, scrubAddr)
    console.log(`Diff/draft done via ${draft.provider}`)

    // Ground the AI's Xactimate codes against the real price list instead of
    // trusting the model's own knowledge of what a code means.
    const text = verifyAndReplaceCodeSection(draft.text)

    return NextResponse.json({ success: true, result: text, provider: draft.provider })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
