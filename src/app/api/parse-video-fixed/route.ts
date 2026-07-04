import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'

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
    const { fileUri, mimeType, claimRef, address, docType } = await request.json() as {
      fileUri: string
      mimeType: string
      claimRef?: string
      address?: string
      docType?: string
    }

    if (!fileUri) {
      return NextResponse.json({ error: 'fileUri is required' }, { status: 400 })
    }

    const contextNote = [
      claimRef ? `Claim Reference (last 4): ${claimRef}` : null,
      address ? `Property Address: ${address}` : null,
      docType ? `Document Type: ${docType}` : null,
    ].filter(Boolean).join('\n')

    const fullPrompt = contextNote
      ? `Context:\n${contextNote}\n\n${PARSE_PROMPT}`
      : PARSE_PROMPT

    console.log('Processing video with FIXED API:', fileUri)
    console.log('MimeType:', mimeType)

    // STRATEGY 1: Try Google Gemini with PAID API KEY
    try {
      console.log('Attempting Gemini API...')
      
      // Initialize Gemini with explicit API key
      const geminiKey = process.env.GEMINI_API_KEY
      if (!geminiKey) throw new Error('GEMINI_API_KEY not configured')
      const genai = new GoogleGenAI({ apiKey: geminiKey })
      
      console.log('Gemini client initialized successfully')
      
      // Try with gemini-1.5-flash (most reliable for paid accounts)
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: fullPrompt },
              {
                fileData: {
                  mimeType: mimeType,
                  fileUri: fileUri,
                },
              },
            ],
          },
        ],
      })

      const result = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      
      if (result && result.length > 100) {
        console.log('✅ Gemini SUCCESS - extracted', result.length, 'characters')
        return NextResponse.json({ 
          success: true, 
          result,
          source: 'gemini-2.5-flash',
          length: result.length
        })
      }
      
      throw new Error('Gemini returned empty or short result')
      
    } catch (geminiError: any) {
      console.log('❌ Gemini failed:', geminiError.message)
      
      // Check if it's a quota error
      if (geminiError.message?.includes('quota') || geminiError.message?.includes('429')) {
        console.log('Quota error detected, trying OpenAI fallback...')
      }
      
      // STRATEGY 2: OpenAI Fallback
      try {
        console.log('Attempting OpenAI API...')
        
        const openaiKey = process.env.OPENAI_API_KEY
        if (!openaiKey) {
          throw new Error('OpenAI API key not configured')
        }
        
        const openai = new OpenAI({ apiKey: openaiKey })
        
        // For OpenAI, we need to handle video differently
        // They don't support direct video, so we'll use vision capabilities
        // with a note that video processing might be limited
        
        const openaiResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: fullPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: fileUri, // Note: OpenAI might not support Google Files URIs directly
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 4000
        })
        
        const openaiResult = openaiResponse.choices[0]?.message?.content ?? ''
        
        if (openaiResult && openaiResult.length > 100) {
          console.log('✅ OpenAI SUCCESS - extracted', openaiResult.length, 'characters')
          return NextResponse.json({ 
            success: true, 
            result: openaiResult,
            source: 'openai-gpt4-vision',
            length: openaiResult.length
          })
        }
        
        throw new Error('OpenAI returned empty result')
        
      } catch (openaiError: any) {
        console.log('❌ OpenAI also failed:', openaiError.message)
        
        // STRATEGY 3: Return error with helpful info
        return NextResponse.json({ 
          error: 'Both AI providers failed',
          geminiError: geminiError.message,
          openaiError: openaiError.message,
          suggestion: 'Please verify your API keys and quotas. If using paid Gemini, ensure billing is enabled at https://console.cloud.google.com/billing'
        }, { status: 500 })
      }
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Parse video error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
