import { NextRequest, NextResponse } from 'next/server'
import { getGenAI, flashModel } from '@/lib/gemini'
import { getGrok, grokModel } from '@/lib/grok'
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

    // Convert photos to base64
    const photoParts = await Promise.all(
      photos.map(async (photo) => {
        const bytes = await photo.arrayBuffer()
        const b64 = Buffer.from(bytes).toString('base64')
        return {
          inlineData: {
            mimeType: photo.type as 'image/jpeg' | 'image/png' | 'image/webp',
            data: b64,
          },
        }
      })
    )

    let result = ''
    let provider = 'gemini'

    try {
      console.log(`Field Scope: Analyzing ${photos.length} photos + transcript with Gemini...`)
      const genai = getGenAI()
      const response = await genai.models.generateContent({
        model: flashModel,
        contents: [
          {
            role: 'user',
            parts: [
              { text: fullPrompt },
              ...photoParts,
            ],
          },
        ],
      })
      result = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      console.log('Field Scope: Gemini analysis successful!')
    } catch (geminiErr: any) {
      console.warn('Field Scope: Gemini failed, falling back to Grok...', geminiErr.message)

      try {
        const grok = getGrok()
        const imageContents: any[] = []
        for (const photo of photos.slice(0, 20)) {
          const bytes = await photo.arrayBuffer()
          const b64 = Buffer.from(bytes).toString('base64')
          imageContents.push({
            type: 'image_url' as const,
            image_url: {
              url: `data:${(photo.type as any) || 'image/jpeg'};base64,${b64}`,
              detail: 'high' as const,
            },
          })
        }

        const message = await grok.chat.completions.create({
          model: grokModel,
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: fullPrompt },
                ...imageContents,
              ],
            },
          ],
        })
        result = message.choices[0]?.message?.content ?? ''
        provider = 'grok'
        console.log('Field Scope: Grok fallback successful!')
      } catch (grokErr: any) {
        throw new Error(`Both AI providers failed. Gemini: ${geminiErr.message}. Grok: ${grokErr.message}`)
      }
    }

    return NextResponse.json({ success: true, result, provider })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
