import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'
import { getRelevantCodesText } from '@/lib/xactimate-codes-search'
import { EXTRACTED_GUIDELINES } from '@/data/extracted-guidelines'

// Without this, the route falls back to Vercel's platform default duration,
// which can be shorter than generateWithFallback's own ~90s worst-case
// timeout budget (see ai-fallback.ts) -- the platform would kill the
// function before the code's own fallback logic ever got a chance to work.
export const maxDuration = 120

function buildSystemPrompt(codeReference: string): string {
  return `You are an elite Xactimate estimating consultant and property insurance claims expert with 20+ years of experience. You have comprehensive knowledge of:

- All Xactimate category codes (RFG, DRY, FLR, FNC, CLN, WTR, STR, PLM, ELC, HVC, INT, EXT, MSN, INS, PTG, and all others)
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
1. Always check the REFERENCE CODES DATABASE below for the exact codes, descriptions, and units. Do not invent a code that isn't in it -- an adjuster will act on this.
2. Always provide the exact Xactimate code(s) if applicable
3. Specify the correct unit of measurement
4. If the question touches claim handling procedure (inspection triggers, documentation, SOPs), check the STATE FARM GUIDELINES below first -- it's the adjuster's own extracted procedure docs, more authoritative here than general industry knowledge
5. Note any common mistakes or contractor disputes around this item
6. If the question involves O&P, depreciation, or coverage interpretation, explain both the adjuster and contractor perspectives
7. Be direct and practical — this is a working tool for an active adjuster in the field
8. Never state an insured's, claimant's, or any other individual's proper name in your response, even if one appears in the adjuster's question -- refer to them generically as "the insured" or "the homeowner" instead.

Keep answers concise but complete. Use bullet points for multiple codes or options.

${codeReference}

=========================================

STATE FARM GUIDELINES:
${EXTRACTED_GUIDELINES}
`
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const question = formData.get('question') as string || ''
    const historyRaw = formData.get('history') as string || '[]'
    const photos = formData.getAll('photos') as File[]
    const history = JSON.parse(historyRaw) as Array<{ role: string; content: string }>

    if (!question.trim() && photos.length === 0) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // generateWithFallback takes a single prompt, so prior turns are flattened
    // into it rather than passed as a provider-specific message array.
    const transcript = history
      .map((h) => `${h.role === 'model' ? 'Assistant' : 'User'}: ${h.content}`)
      .join('\n\n')

    const prompt = transcript ? `${transcript}\n\nUser: ${question}` : question

    const base64Images = await Promise.all(
      photos.map(async (photo) => {
        const bytes = await photo.arrayBuffer()
        return Buffer.from(bytes).toString('base64')
      })
    )

    // Recent turns count toward relevance too, so a follow-up like "what about
    // the ridge cap" after a roofing question still pulls roofing codes.
    const recentContext = [question, ...history.slice(-4).map((h) => h.content)].join(' ')
    const systemPrompt = buildSystemPrompt(getRelevantCodesText(recentContext))

    const { text, provider } = await generateWithFallback(prompt, systemPrompt, base64Images)
    return NextResponse.json({ success: true, answer: text, provider })
  } catch (err: unknown) {
    // The provider errors are long JSON blobs that used to render verbatim in
    // the chat. Keep the detail in the logs and hand the UI a readable line.
    const detail = err instanceof Error ? err.message : 'Unknown error'
    console.error('code-reference failed:', detail)

    const friendly = detail.includes('All AI providers failed')
      ? 'No AI provider is available right now. Gemini may be over its daily free-tier limit, and the other providers are unavailable. Check the server logs for details.'
      : 'Something went wrong answering that. Check the server logs for details.'

    return NextResponse.json({ error: friendly, detail }, { status: 500 })
  }
}
