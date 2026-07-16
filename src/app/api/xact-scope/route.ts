import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'

const XACTIMATE_SYSTEM = `You are an expert Xactimate estimator with comprehensive knowledge of all Xactimate category codes, item codes, and unit of measurement standards. When given a property damage photo, you identify the damaged material and suggest the correct Xactimate line items.

Common category codes reference:
- RFG: Roofing (shingles, underlayment, flashing, vents)
- DRY: Drywall (walls, ceilings, finishing)
- FLR: Flooring (hardwood, carpet, tile, LVP)
- FNC: Fencing (wood, chain link, vinyl)
- CLN: Cleaning (content cleaning, structure cleaning)
- WTR: Water damage (extraction, drying)
- STR: Structural (framing, sheathing)
- PLM: Plumbing
- ELC: Electrical
- HVC: HVAC
- INT: Interior (doors, trim, windows)
- EXT: Exterior (siding, soffit, fascia)
- MSN: Masonry (brick, concrete, stucco)
- INS: Insulation
- PTG: Painting`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('photo') as File | null

    if (!image) {
      return NextResponse.json({ error: 'Photo is required' }, { status: 400 })
    }

    const bytes = await image.arrayBuffer()
    const b64 = Buffer.from(bytes).toString('base64')

    const prompt = `${XACTIMATE_SYSTEM}

Analyze this property damage photo carefully. Return a JSON array of suggested Xactimate line items. Each item must have these exact fields:
- material_type: What the damaged material is (e.g., "3-tab asphalt shingles", "1/2\" drywall")
- damage_description: Brief description of visible damage
- suggested_category_code: Xactimate category (e.g., "RFG")
- suggested_item_code: Specific Xactimate item code if known (e.g., "RFG LAY" for lay roofing, "DRY REM" for remove drywall)
- unit_of_measurement: Standard unit (SQ, SF, LF, EA, HR)
- estimated_quantity: Your best estimate of quantity from the photo (or "Measure required")
- confidence: "High", "Medium", or "Low"
- notes: Any caveats, hidden damage indicators, or measurement guidance

Return ONLY valid JSON array, no markdown, no explanation.`

    const { text: raw, provider } = await generateWithFallback(prompt, undefined, [b64])
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let items: unknown[] = []
    try {
      items = JSON.parse(cleaned)
    } catch {
      console.error(`xact-scope: ${provider} returned unparseable JSON:`, raw.slice(0, 500))
      return NextResponse.json(
        { error: 'The AI response was not valid JSON. Check the server logs.', raw },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, items, provider })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'Unknown error'
    console.error('xact-scope failed:', detail)

    const friendly = detail.includes('All AI providers failed')
      ? 'No AI provider is available right now. Check the server logs for details.'
      : 'Something went wrong analyzing that photo. Check the server logs for details.'

    return NextResponse.json({ error: friendly, detail }, { status: 500 })
  }
}
