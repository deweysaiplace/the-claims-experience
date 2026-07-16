import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'
import { XACTIMATE_CODES } from '@/data/xactimate-codes'

const FIELD_SCOPE_PROMPT = `You are an elite property insurance field adjuster AI assistant. You are analyzing inspection photos and field notes from a property damage claim.

Your job is to produce THREE outputs from the provided photos and/or voice transcript:

## 1. DAMAGE ASSESSMENT
For each photo, describe:
- Location in property (roof, interior, exterior, etc.)
- Type of damage observed (wind, hail, water, fire, impact, etc.)
- Severity (minor, moderate, severe)
- Materials affected (shingles, drywall, siding, flooring, etc.)

## 2. XACTIMATE LINE ITEMS
Using the Xactimate code reference below, generate a scoping table:
| # | Xactimate Code | Description | Qty | Unit | Category | Notes |
For each damaged item you identify:
- Match to the EXACT Xactimate code from the reference
- Estimate reasonable quantities based on what's visible
- If you cannot determine an exact code, use the closest match and flag with ⚠️
- Group by category (Roofing, Drywall, Painting, etc.)

## 3. FIELD NARRATIVE
Write a professional claim file narrative suitable for direct entry into the claim system. Include:
- Date of inspection (use today's date if not provided)
- Property description
- Damage observations room-by-room or area-by-area
- Cause of loss assessment
- Recommended scope of repairs
- Any concerns or items requiring follow-up

XACTIMATE CODE REFERENCE:
`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const photos = formData.getAll('photos') as File[]
    const transcript = formData.get('transcript') as string || ''
    const claimRef = formData.get('claimRef') as string || ''
    const address = formData.get('address') as string || ''
    const adjusterName = formData.get('adjusterName') as string || ''
    const causeOfLoss = formData.get('causeOfLoss') as string || ''

    if (photos.length === 0 && !transcript.trim()) {
      return NextResponse.json(
        { error: 'Please provide at least one photo or voice transcript.' },
        { status: 400 }
      )
    }

    const xactCodes = XACTIMATE_CODES

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    const contextLines = [
      `Date of Inspection: ${today}`,
      claimRef ? `Claim Reference: ${claimRef}` : null,
      address ? `Property Address: ${address}` : null,
      adjusterName ? `Adjuster: ${adjusterName}` : null,
      causeOfLoss ? `Cause of Loss: ${causeOfLoss}` : null,
      transcript ? `\nFIELD NOTES TRANSCRIPT:\n${transcript}` : null,
    ].filter(Boolean).join('\n')

    const fullPrompt = `${FIELD_SCOPE_PROMPT}${xactCodes}\n\nCLAIM CONTEXT:\n${contextLines}`

    let result = ''
    let provider = 'gemini'

    try {
      console.log(`Field Scope: Analyzing ${photos.length} photos + transcript...`)
      
      const base64Images = await Promise.all(
        photos.map(async (photo) => {
          const bytes = await photo.arrayBuffer()
          return Buffer.from(bytes).toString('base64')
        })
      )

      const response = await generateWithFallback(fullPrompt, undefined, base64Images)
      result = response.text
      provider = response.provider
      console.log(`Field Scope: Analysis successful via ${provider}!`)
    } catch (err: any) {
      throw new Error(err.message)
    }

    return NextResponse.json({ success: true, result, provider })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
