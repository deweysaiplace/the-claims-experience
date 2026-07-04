import { NextRequest, NextResponse } from 'next/server'
import { getGenAI, flashModel } from '@/lib/gemini'
import { XACTIMATE_CODES } from '@/data/xactimate-codes'
import { EXTRACTED_XACTIMATE_CODES } from '@/data/extracted-xactimate-codes'

const SYSTEM_PROMPT = `You are an elite Xactimate estimating consultant and property insurance claims expert with 20+ years of experience. You have comprehensive knowledge of:

- All Xactimate category codes (RFG, DRY, FLR, FNC, CLN, WTR, STR, PLM, ELC, HVC, INT, EXT, MSN, INS, PTG, and all others)
- Xactimate item codes and selector codes (e.g., RFG LAY, RFG TRN, DRY REM, DRY REP, CLN CONT, etc.)
- Unit of measurement standards (SQ=100 SF, SF, LF, EA, HR, DY)
- State Farm claim scoping guidelines and estimating best practices
- O&P (Overhead & Profit) applicability rules
- Depreciation principles for ACV vs RCV
- Building code upgrade requirements (Ordinance & Law coverage)
- IICRC standards for water/fire/mold claims
- Matching rules for insurance purposes
- Common contractor upsell tactics and how to address them professionally
- Regional price list variations
- Supplemental claim documentation standards

When answering:
1. Always check the REFERENCE CODES DATABASE below for the exact codes, descriptions, and units.
2. Always provide the exact Xactimate code(s) if applicable
3. Specify the correct unit of measurement
4. Note any common mistakes or contractor disputes around this item
5. If the question involves O&P, depreciation, or coverage interpretation, explain both the adjuster and contractor perspectives
6. Be direct and practical — this is a working tool for an active adjuster in the field

Keep answers concise but complete. Use bullet points for multiple codes or options.

REFERENCE CODES DATABASE:
${XACTIMATE_CODES}

=========================================

ADDITIONAL ADJUSTER EXTRACTED CODES:
${EXTRACTED_XACTIMATE_CODES}
`

export async function POST(request: NextRequest) {
  try {
    const { question, history } = await request.json() as {
      question: string
      history?: Array<{ role: string; content: string }>
    }

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    const contents = [
      {
        role: 'user' as const,
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: 'model' as const,
        parts: [{ text: 'Understood. I am ready to assist with Xactimate codes, scoping questions, coverage interpretations, and claims estimating guidance. What do you need?' }],
      },
      ...(history ?? []).map((h) => ({
        role: h.role as 'user' | 'model',
        parts: [{ text: h.content }],
      })),
      {
        role: 'user' as const,
        parts: [{ text: question }],
      },
    ]

    const genai = getGenAI()
    const response = await genai.models.generateContent({
      model: flashModel,
      contents,
    })

    const answer = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return NextResponse.json({ success: true, answer })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
