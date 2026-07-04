import { NextRequest, NextResponse } from 'next/server'
import { getGenAI, flashModel } from '@/lib/gemini'
import { getGrok, grokModel } from '@/lib/grok'
import { scrubPii } from '@/utils/sanitizer'

export async function POST(request: NextRequest) {
  try {
    const { transcript, claimRef, address, adjusterName } = await request.json() as {
      transcript: string
      claimRef?: string
      address?: string
      adjusterName?: string
    }

    if (!transcript?.trim()) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 })
    }

    const { scrubbed: scrubTranscript } = scrubPii(transcript)
    const { scrubbed: scrubRef } = scrubPii(claimRef ?? '')
    const { scrubbed: scrubAddr } = scrubPii(address ?? '')

    const prompt = `You are a professional insurance claims file note writer. Convert the following raw field inspection transcript into a polished, professional Field Inspection Narrative formatted for direct entry into a claim file system.

Claim Reference: ${scrubRef || 'N/A'}
Property Address: ${scrubAddr || 'N/A'}
Adjuster: ${adjusterName || 'N/A'}
Inspection Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

RAW TRANSCRIPT:
"""
${scrubTranscript}
"""

FORMATTING REQUIREMENTS:
1. Header with claim reference, property address, inspection date, adjuster name
2. Organize by area/room in chronological inspection order
3. Convert casual language to professional insurance terminology
4. For each damage item noted, suggest the likely Xactimate category code in brackets [e.g., RFG, DRY, FLR]
5. Note any items requiring additional investigation or measurement
6. Closing paragraph summarizing overall scope and recommended next steps
7. Use standard insurance nomenclature throughout
8. Flag any coverage questions or potential disputes

The output should be ready to copy-paste directly into Xactanalysis or a claim file note system.`

    let note = ''
    try {
      const genai = getGenAI()
      const response = await genai.models.generateContent({
        model: flashModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })
      note = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    } catch (geminiErr: any) {
      console.warn('Field Note: Gemini failed, falling back to Grok...', geminiErr.message)
      try {
        const grok = getGrok()
        const message = await grok.chat.completions.create({
          model: grokModel,
          messages: [{ role: 'user', content: prompt }],
        })
        note = message.choices[0]?.message?.content ?? ''
      } catch (grokErr: any) {
        throw new Error(`Both AI providers failed. Gemini: ${geminiErr.message}. Grok: ${grokErr.message}`)
      }
    }

    return NextResponse.json({ success: true, note })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
