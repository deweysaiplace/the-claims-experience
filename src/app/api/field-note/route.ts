import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'
import { scrubPii } from '@/utils/sanitizer'

export async function POST(request: NextRequest) {
  try {
    const { locations, claimRef, address, adjusterName } = await request.json() as {
      locations: { name: string, transcript: string }[]
      claimRef?: string
      address?: string
      adjusterName?: string
    }

    if (!locations || locations.length === 0) {
      return NextResponse.json({ error: 'At least one location transcript is required' }, { status: 400 })
    }

    const scrubbedLocations = locations.map(loc => ({
      name: scrubPii(loc.name).scrubbed,
      transcript: scrubPii(loc.transcript).scrubbed
    }))
    const { scrubbed: scrubRef } = scrubPii(claimRef ?? '')
    const { scrubbed: scrubAddr } = scrubPii(address ?? '')
    
    const rawLocationsText = scrubbedLocations.map(loc => `[LOCATION: ${loc.name}]\n${loc.transcript}\n`).join('\n')

    const prompt = `You are a professional insurance claims file note writer. Convert the following raw field inspection transcript(s) into a polished, professional Field Inspection Narrative formatted for direct entry into a claim file system.

Claim Reference: ${scrubRef || 'N/A'}
Property Address: ${scrubAddr || 'N/A'}
Adjuster: ${adjusterName || 'N/A'}
Inspection Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

RAW TRANSCRIPTS BY LOCATION:
"""
${rawLocationsText}
"""

FORMATTING REQUIREMENTS:
1. Header with claim reference, property address, inspection date, adjuster name
2. Organize by the specific locations provided in the transcripts
3. Convert casual language to professional insurance terminology
4. For each damage item noted, suggest the likely Xactimate category code in brackets [e.g., RFG, DRY, FLR]
5. Note any items requiring additional investigation or measurement
6. Closing paragraph summarizing overall scope and recommended next steps
7. Use standard insurance nomenclature throughout
8. Flag any coverage questions or potential disputes

The output should be ready to copy-paste directly into Xactanalysis or a claim file note system.`

    let note = ''
    try {
      const response = await generateWithFallback(prompt)
      note = response.text
    } catch (err: any) {
      throw new Error(err.message)
    }

    return NextResponse.json({ success: true, note })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
