import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'
import { verifyAndReplaceCodeSection } from '@/lib/xactimate-verify'
import { getRelevantCodesText } from '@/lib/xactimate-codes-search'

// Without this, the route falls back to Vercel's platform default duration,
// which can be shorter than generateWithFallback's own ~90s worst-case
// timeout budget (see ai-fallback.ts) -- the platform would kill the
// function before the code's own fallback logic ever got a chance to work.
export const maxDuration = 120

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
- Match to the EXACT Xactimate code from the reference. Do not invent a code
  that is not in the list below -- an adjuster will act on this.
- Estimate reasonable quantities based on what's visible
- If nothing in the reference is a good match, say so in the Notes column
  instead of guessing a code that looks plausible but isn't real
- Group by category (Roofing, Drywall, Painting, etc.)

## CODES REFERENCED
List every distinct Xactimate code you used in the table above, one bare code per line with a leading dash and nothing else — e.g.:
- RFGCSFRN
- WTREXTA
This section is parsed by code, not read by the adjuster, so it must contain ONLY the codes, exactly as written in the table above, one per line.

## 3. FIELD NARRATIVE
Write a professional claim file narrative suitable for direct entry into the claim system. Include:
- Date of inspection (use today's date if not provided)
- Property description
- Damage observations room-by-room or area-by-area
- Cause of loss assessment
- Recommended scope of repairs
- Any concerns or items requiring follow-up
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
    // GPS fix from the phone, captured where the photos were taken.
    const location = formData.get('location') as string || ''

    if (photos.length === 0 && !transcript.trim()) {
      return NextResponse.json(
        { error: 'Please provide at least one photo or voice transcript.' },
        { status: 400 }
      )
    }

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    const contextLines = [
      `Date of Inspection: ${today}`,
      claimRef ? `Claim Reference: ${claimRef}` : null,
      address ? `Property Address: ${address}` : null,
      location ? `GPS at Inspection: ${location}` : null,
      adjusterName ? `Adjuster: ${adjusterName}` : null,
      causeOfLoss ? `Cause of Loss: ${causeOfLoss}` : null,
      transcript ? `\nFIELD NOTES TRANSCRIPT:\n${transcript}` : null,
    ].filter(Boolean).join('\n')

    // The model must choose codes from a real reference, not its own training
    // data -- without this, it fabricates plausible-looking codes (e.g.
    // GUT5K, GTTRGD) that don't exist. verifyAndReplaceCodeSection below is a
    // second, independent check against the SAME real price list this prompt
    // is grounded on (src/data/xactimate-codes.json) -- previously the prompt
    // was grounded on a different, largely fabricated reference that barely
    // overlapped with the verifier's data, which is why the warning had to be
    // suppressed. Now both sides agree, so a real mismatch is a real signal.
    const codeReference = getRelevantCodesText(`${causeOfLoss} ${transcript}`)
    const fullPrompt = `${FIELD_SCOPE_PROMPT}\n${codeReference}\n\nCLAIM CONTEXT:\n${contextLines}`

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
      let text = response.text
      provider = response.provider

      // Same safety net as the reconciler: if a model wraps its answer in a
      // full HTML document instead of the requested markdown, don't show
      // that raw markup to the adjuster.
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

      result = verifyAndReplaceCodeSection(text)
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
