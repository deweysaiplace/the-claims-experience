import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120 // seconds — image encoding + Gemini can be slow
import { generateWithFallback } from '@/lib/ai-fallback'
import { scrubPii } from '@/utils/sanitizer'

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
- All amounts should be compared as numeric values.`

    const userPrompt = `Please analyze these two property damage estimates.
The first ${filesA.length} image(s) are Estimate A (Carrier Estimate).
The next ${filesB.length} image(s) are Estimate B (Contractor Estimate).

Generate a structured response with EXACTLY these sections:

## VARIANCE MATRIX
A markdown table with columns: | Line Item | Xactimate Code | Est A Qty | Est B Qty | Est A Unit $ | Est B Unit $ | Variance $ | Flag |
Use 🔴 for major variance (>20%), 🟡 for moderate (5-20%), 🟢 for match.

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
