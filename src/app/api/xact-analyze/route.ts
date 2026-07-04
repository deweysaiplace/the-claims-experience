import { NextRequest, NextResponse } from 'next/server'
import { getGenAI, flashModel } from '@/lib/gemini'
import { getGrok, grokModel } from '@/lib/grok'
import { matchLabelsToCode } from '@/lib/code-matcher'

const SYSTEM_PROMPT = `You are an expert insurance property damage adjuster assistant.
Analyze the provided property damage photo(s) and/or adjuster notes. 

Identify:
1. All materials present (e.g., drywall, laminate flooring, asphalt shingles, vinyl siding, carpet, tile)
2. All types of damage visible or mentioned (e.g., water damage, impact, cracking, mold, staining, missing, torn)
3. Affected areas (e.g., ceiling, wall, floor, roof, exterior)

Return a JSON object with this exact structure:
{
  "materials": ["list of identified materials"],
  "damageTypes": ["list of damage types observed"],
  "affectedAreas": ["list of affected areas"],
  "labels": ["flat list of combined descriptive labels like 'water damaged drywall', 'missing asphalt shingles'"],
  "observations": "one paragraph describing what you see or what is noted in plain language"
}

Be specific and conservative. Return ONLY the JSON object, no markdown formatting.`

const SUMMARY_PROMPT = `You are an expert insurance property damage adjuster assistant.
Based on this analysis, write a professional 2-3 sentence summary suitable for an estimate narrative:
Materials identified: {MATERIALS}
Damage types: {DAMAGE_TYPES}
Matched Xactimate line items: {LINE_ITEMS}
Adjuster notes: {NOTES}

Write only the summary paragraph, no headers or bullets.`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const images = formData.getAll('images') as File[]
    const notes = (formData.get('notes') as string) || ''
    const transcription = (formData.get('transcription') as string) || ''

    const allNotes = [notes, transcription].filter(Boolean).join('\n')

    if (images.length === 0 && !allNotes.trim()) {
      return NextResponse.json({ error: 'Please provide images or notes' }, { status: 400 })
    }

    // Convert photos to base64
    const photoParts = await Promise.all(
      images.slice(0, 5).map(async (photo) => {
        const bytes = await photo.arrayBuffer()
        const b64 = Buffer.from(bytes).toString('base64')
        return {
          inlineData: {
            mimeType: (photo.type as any) || 'image/jpeg',
            data: b64,
          },
        }
      })
    )

    let allLabels: string[] = []
    let observations = ''
    let materials: string[] = []
    let damageTypes: string[] = []

    const userPromptText = `Adjuster Notes: ${allNotes || 'None provided.'}`

    try {
      console.log(`Xact Analyze: Analyzing with Gemini...`)
      const genai = getGenAI()
      const response = await genai.models.generateContent({
        model: flashModel,
        contents: [
          {
            role: 'user',
            parts: [
              { text: SYSTEM_PROMPT + '\n\n' + userPromptText },
              ...photoParts,
            ],
          },
        ],
      })
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim()
      const data = JSON.parse(cleanText)
      
      allLabels = data.labels || []
      observations = data.observations || ''
      materials = data.materials || []
      damageTypes = data.damageTypes || []
      
    } catch (geminiErr: any) {
      console.warn('Xact Analyze: Gemini failed, falling back to Grok...', geminiErr.message)
      try {
        const grok = getGrok()
        const imageContents: any[] = []
        for (const photo of images.slice(0, 5)) {
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
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPromptText },
                ...imageContents,
              ],
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1000,
        })
        const text = message.choices[0]?.message?.content ?? '{}'
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim()
        const data = JSON.parse(cleanText)
        allLabels = data.labels || []
        observations = data.observations || ''
        materials = data.materials || []
        damageTypes = data.damageTypes || []
      } catch (grokErr: any) {
         throw new Error(`Both AI providers failed. Gemini: ${geminiErr.message}. Grok: ${grokErr.message}`)
      }
    }

    const matchResult = matchLabelsToCode(allLabels)

    let summary = ''
    if (matchResult.matched.length > 0 || materials.length > 0) {
      const summaryPromptText = SUMMARY_PROMPT
        .replace('{MATERIALS}', materials.join(', ') || 'not specified')
        .replace('{DAMAGE_TYPES}', damageTypes.join(', ') || 'not specified')
        .replace('{LINE_ITEMS}', matchResult.matched.map((m) => `${m.code} - ${m.description}`).join('; ') || 'none matched')
        .replace('{NOTES}', allNotes || 'none')
        
      try {
        const genai = getGenAI()
        const summaryResponse = await genai.models.generateContent({
          model: flashModel,
          contents: [{ role: 'user', parts: [{ text: summaryPromptText }] }],
        })
        summary = summaryResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
      } catch (e: any) {
        summary = 'Summary generation failed.'
      }
    }

    return NextResponse.json({
      observations,
      materials,
      damageTypes,
      labels: allLabels,
      matchResult,
      summary,
    })
  } catch (error: unknown) {
    console.error('Xact analyze error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 })
  }
}
