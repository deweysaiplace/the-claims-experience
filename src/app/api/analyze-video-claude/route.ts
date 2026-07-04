import { NextRequest, NextResponse } from 'next/server'
import { getClaude, claudeModel } from '@/lib/claude'

const CLAUDE_ANALYSIS_PROMPT = `You are an expert insurance claims analyst and senior adjuster. You are analyzing a video recording of insurance documents, policies, or estimates scrolling on a screen.

Your task is to extract and analyze ALL visible text content from this video. Focus on:

1. **Complete Text Extraction**: Capture every word, number, and detail visible on screen
2. **Policy Analysis**: Identify coverage limits, deductibles, exclusions, conditions
3. **Estimate Review**: Extract line items, codes, quantities, pricing
4. **Claims Context**: Note any claim numbers, dates, addresses, loss descriptions

Please structure your response with these sections:

## COMPLETE TEXT EXTRACTED
[Provide the full text content visible in the video, organized by page/section]

## POLICY ANALYSIS
- Coverage limits and deductibles
- Key exclusions or limitations
- Applicable conditions or requirements
- Notice requirements and time limits

## ESTIMATE/CLAIM DETAILS
- Line items with codes and descriptions
- Quantities and pricing
- Total amounts
- Any unusual or questionable items

## CLAIMS ASSESSMENT
- What type of loss this appears to be
- Coverage considerations
- Documentation requirements
- Potential issues or red flags

Be thorough and precise. This analysis will be used for claims validation and settlement decisions.`

export async function POST(request: NextRequest) {
  try {
    const { fileUri, mimeType, claimRef, address, docType } = await request.json()

    if (!fileUri || !mimeType) {
      return NextResponse.json({ error: 'fileUri and mimeType are required' }, { status: 400 })
    }

    // Use Claude to analyze the video
    const claude = getClaude()
    
    const message = await claude.messages.create({
      model: claudeModel,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: CLAUDE_ANALYSIS_PROMPT
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: fileUri // Note: This would need to be base64 encoded video data
              }
            }
          ]
        }
      ]
    })

    const analysis = message.content[0]?.type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ 
      success: true, 
      result: analysis,
      metadata: {
        claimRef,
        address,
        docType,
        analyzedAt: new Date().toISOString()
      }
    })

  } catch (err: unknown) {
    console.error('Claude video analysis error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
