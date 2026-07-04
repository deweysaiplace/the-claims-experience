import { NextRequest, NextResponse } from 'next/server'
import { getGenAI, flashModel, proModel } from '@/lib/gemini'
import { getClaude, claudeModel } from '@/lib/claude'

const PARSE_PROMPT = `You are an expert insurance claims document analyst. You are watching a screen recording of an insurance policy or Xactimate estimate scrolling past on a computer screen.

Your task is to extract EVERY piece of text visible in this video and ORGANIZE it intelligently for claims analysis. Focus entirely on the text content on screen.

Please output your response in EXACTLY this format with these sections:

## POLICY INFORMATION (if applicable)
| Field | Value | Notes |
|-------|-------|-------|
| Policy Number | | |
| Policy Period | | |
| Named Insured | | |
| Property Address | | |
| Coverage Limits | | |
| Deductibles | | |

## COVERAGE ANALYSIS (if applicable)
- **Coverage A (Dwelling)**: 
- **Coverage B (Other Structures)**: 
- **Coverage C (Personal Property)**: 
- **Coverage D (Loss of Use)**: 
- **Perils Insured Against**: 
- **Key Exclusions**: 

## STRUCTURED LINE ITEMS

Extract all line items into a markdown table. For each item identified, provide:
| # | Code | Description | Quantity | Unit | Unit Price | Total | Category | Notes |

Rules for the table:
- Use the exact Xactimate code if visible (e.g., RFG LAY, DRY REM)
- If no code is visible, leave Code blank
- Deduplicate — if the same line appears in multiple frames, list it once
- If a field is not visible or not applicable, use "—"
- Sort by CATEGORY first, then by order they appear
- Add Category column (e.g., "Roofing", "Drywall", "Plumbing", "Electrical", etc.)
- Flag anything that looks unusual with ⚠️ in Notes

## FINANCIAL SUMMARY
| Item | Amount |
|------|--------|
| Subtotal | |
| Tax | |
| O&P (Overhead & Profit) | |
| Total | |

## RAW TEXT DUMP

Provide the complete verbatim text of everything visible in the video, organized by page/section as it appeared on screen. Include:
- All headers, section titles, policy numbers (partial), dates
- All line item text exactly as written
- All totals, subtotals, taxes, O&P lines
- Any notes, exclusions, or annotations visible

Format each page/section with a --- separator and a section label if one is visible.

Do not summarize. Do not paraphrase. Capture everything you can read.`

export async function POST(request: NextRequest) {
  try {
    const { fileUri, mimeType, claimRef, address, docType, frames, useClaude } = await request.json() as {
      fileUri?: string
      mimeType?: string
      claimRef?: string
      address?: string
      docType?: string
      frames?: { base64: string; mimeType: string }[]
      useClaude?: boolean
    }

    const contextNote = [
      claimRef ? `Claim Reference (last 4): ${claimRef}` : null,
      address ? `Property Address: ${address}` : null,
      docType ? `Document Type: ${docType}` : null,
    ].filter(Boolean).join('\n')

    const fullPrompt = contextNote
      ? `Context:\n${contextNote}\n\n${PARSE_PROMPT}`
      : PARSE_PROMPT

    // Handle Claude API Fallback (with image frames)
    if (useClaude || (frames && !fileUri)) {
      if (!frames || frames.length === 0) {
        return NextResponse.json({ error: 'Frames are required for Claude fallback' }, { status: 400 })
      }
      console.log(`Processing with Claude fallback using ${frames.length} frames...`)
      
      const claude = getClaude()
      const message = await claude.messages.create({
        model: claudeModel,
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: fullPrompt },
              ...frames.slice(0, 20).map(f => ({
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: f.mimeType as any,
                  data: f.base64
                }
              }))
            ]
          }
        ]
      })

      const result = message.content[0]?.type === 'text' ? message.content[0].text : ''
      return NextResponse.json({ success: true, result, provider: 'claude' })
    }

    if (!fileUri) {
      return NextResponse.json({ error: 'fileUri is required' }, { status: 400 })
    }

    // Create a cache key based on file URI and processing parameters
    const cacheKey = `extract_${fileUri}_${docType || 'default'}`
    console.log('Processing request for:', fileUri)
    console.log('Cache key:', cacheKey)

    // Simple in-memory cache (in production, use Redis or database)
    interface GlobalCache {
      extractionCache?: Map<string, any>
    }
    
    const globalCache = (globalThis as GlobalCache).extractionCache || new Map()
    ;(globalThis as GlobalCache).extractionCache = globalCache
    
    const cached = globalCache.get(cacheKey)
    if (cached) {
      console.log('Returning cached results for:', fileUri)
      return NextResponse.json({ success: true, result: cached.result, cached: true })
    }

    const genai = getGenAI()

    // Try Gemini Pro first, then Flash, then fall back to Claude if quota hit
    let response: any
    let geminiQuotaHit = false

    for (const modelToUse of [proModel, flashModel]) {
      try {
        console.log(`Trying Gemini model: ${modelToUse}`)
        response = await genai.models.generateContent({
          model: modelToUse,
          contents: [
            {
              role: 'user',
              parts: [
                { text: fullPrompt },
                { fileData: { mimeType: mimeType, fileUri: fileUri } },
              ],
            },
          ],
        })
        console.log(`Success with ${modelToUse}`)
        break
      } catch (error: any) {
        const isQuota = error.message?.includes('quota') ||
                        error.message?.includes('RESOURCE_EXHAUSTED') ||
                        error.message?.includes('rate limit')
        if (isQuota) {
          console.log(`${modelToUse} quota exceeded, trying next...`)
          geminiQuotaHit = true
        } else {
          throw error
        }
      }
    }

    // If both Gemini models hit quota and caller sent frames, use Claude
    if (!response && geminiQuotaHit) {
      if (frames && frames.length > 0) {
        console.log(`Gemini quota exhausted. Falling back to Claude with ${frames.length} frames...`)
        const claude = getClaude()
        const message = await claude.messages.create({
          model: claudeModel,
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: fullPrompt },
                ...frames.slice(0, 20).map(f => ({
                  type: 'image' as const,
                  source: { type: 'base64' as const, media_type: f.mimeType as any, data: f.base64 }
                }))
              ]
            }
          ]
        })
        const result = message.content[0]?.type === 'text' ? message.content[0].text : ''
        return NextResponse.json({ success: true, result, provider: 'claude-fallback' })
      }
      // No frames available — return quota error so UI can retry with frames
      return NextResponse.json(
        { error: 'RESOURCE_EXHAUSTED: Gemini quota exceeded. Retry with video frames for Claude fallback.' },
        { status: 429 }
      )
    }

    if (!response) {
      throw new Error('Failed to get response from Gemini API')
    }

    const result = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    
    // Cache the result to avoid repeated API calls
    const cacheEntry = {
      result,
      timestamp: Date.now(),
      fileUri,
      docType
    }
    globalCache.set(cacheKey, cacheEntry)
    console.log('Cached result for:', fileUri)
    
    return NextResponse.json({ success: true, result, cached: false })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
