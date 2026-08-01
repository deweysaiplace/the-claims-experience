import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120 // seconds — image encoding + Gemini can be slow
import { generateWithFallback } from '@/lib/ai-fallback'
import { scrubPii } from '@/utils/sanitizer'
import { verifyAndReplaceCodeSection } from '@/lib/xactimate-verify'

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

    // Convert all pages to base64 parts
    const partsA = await Promise.all(
      filesA.map(async (f) => ({
        inlineData: { mimeType: f.type as any, data: await toBase64(f) },
      }))
    )
    const partsB = await Promise.all(
      filesB.map(async (f) => ({
        inlineData: { mimeType: f.type as any, data: await toBase64(f) },
      }))
    )

    const systemPrompt = `You are an elite property insurance claims estimating expert with deep knowledge of Xactimate line item codes, CSI divisions, and standard scoping methodology. You are analyzing two field-photographed estimates to identify discrepancies.

Date of Review: ${today}
Claim Reference: ${scrubRef || 'N/A'}
Property Address: ${scrubAddr || 'N/A'}

IMPORTANT: Estimate A has ${filesA.length} page(s) and Estimate B has ${filesB.length} page(s). Read ALL pages of each estimate and combine the line items from all pages before comparing.

IMPORTANT RULES:
- Be precise and professional. Use insurance industry terminology.
- Flag every line item that differs in quantity, unit price, or code.
- Identify items present in one estimate but missing in the other.
- Flag potential double-billing (e.g., setup/cleanup charged per room AND as a whole).
- All amounts should be compared as numeric values.
- Respond with PLAIN MARKDOWN ONLY. Do not wrap the response in an HTML document, a <!DOCTYPE> declaration, or <html>/<head>/<body> tags, and do not use markdown code fences around the whole answer. The response is rendered directly as Markdown — any HTML wrapper will display as broken, unreadable text to the adjuster instead of a formatted report.`

    const userPrompt = `Please analyze these two property damage estimates.
The first ${filesA.length} image(s) are Estimate A (Carrier Estimate).
The next ${filesB.length} image(s) are Estimate B (Contractor Estimate).

Generate a structured response with EXACTLY these sections:

## VARIANCE MATRIX
A markdown table with columns: | Line Item | Xactimate Code | Est A Qty | Est B Qty | Est A Unit $ | Est B Unit $ | Variance $ | Flag |
Use 🔴 for major variance (>20%), 🟡 for moderate (5-20%), 🟢 for match.

## CODES REFERENCED
List every distinct Xactimate code you used in the matrix above, one bare code per line with a leading dash and nothing else on the line (no description, no quantity) — e.g.:
- WTRDRYLF
- PNTP
This section is parsed by code, not read by the adjuster, so it must contain ONLY the codes, exactly as written in the matrix above, one per line.

## MISSING ITEMS
List items present in Contractor estimate (B) but absent from Carrier estimate (A), and vice versa.

## DOUBLE-BILLING FLAGS
Any items that appear to charge twice for the same scope.

## SUMMARY
- Total Est A: $X,XXX
- Total Est B: $X,XXX
- Net Discrepancy: $X,XXX
- Recommended Approved Amount: $X,XXX (with brief justification)

## CONTRACTOR EMAIL DRAFT
Professional email to contractor explaining the scope differences, what can be approved per policy guidelines, and requesting clarification on flagged items.

## FILE NOTE
Internal claim file note documenting the estimate review, suitable for direct entry into the claim system.`

    let text = ''
    let provider = 'gemini'

    try {
      console.log(`Attempting reconciliation: ${filesA.length} vs ${filesB.length} pages...`)
      
      const allFiles = [...filesA, ...filesB]
      const base64Images = await Promise.all(
        allFiles.map(async (f) => await toBase64(f))
      )

      const response = await generateWithFallback(userPrompt, systemPrompt, base64Images)
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
