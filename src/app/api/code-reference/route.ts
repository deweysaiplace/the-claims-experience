import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'
import { getFocusedCodesText } from '@/lib/xactimate-codes-search'
import { EXTRACTED_GUIDELINES } from '@/data/extracted-guidelines'

// The guidelines doc (~11k tokens) is procedure-specific -- SOPs, inspection
// triggers, material matching, moisture mapping, approvals/escalation,
// documentation standards. Most Claim Consult/Lookup turns are plain code
// or scope questions that don't touch any of this, so only pay for it when
// the question actually looks procedural. Deliberately excludes generic
// domain words (water, wind, roof, damage) that would match almost every
// message regardless of whether procedure guidance is actually needed.
const GUIDELINE_SIGNAL_WORDS = new Set([
  'sop', 'procedure', 'procedures', 'inspection', 'inspect', 'trigger', 'triggers',
  'matching', 'match', 'repair', 'replacement', 'threshold', 'thresholds',
  'approval', 'approve', 'approvals', 'escalate', 'escalation', 'subrogation',
  'documentation', 'document', 'photo', 'photos', 'moisture', 'mapping',
  'dryout', 'dry-out', 'drying', 'equipment',
  'coverage', 'exclusion', 'exclusions', 'policy', 'endorsement',
  'ordinance', 'depreciation', 'acv', 'rcv', 'op', 'overhead', 'tearout', 'tear-out',
  'sewer', 'drain', 'sump', 'freeze', 'freezing', 'flood', 'subsurface',
])

function isGuidelinesRelevant(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? []
  return words.some((w) => GUIDELINE_SIGNAL_WORDS.has(w))
}

// Without this, the route falls back to Vercel's platform default duration,
// which can be shorter than generateWithFallback's own ~90s worst-case
// timeout budget (see ai-fallback.ts) -- the platform would kill the
// function before the code's own fallback logic ever got a chance to work.
export const maxDuration = 120

const SHARED_KNOWLEDGE = `- All Xactimate category codes (RFG, DRY, FLR, FNC, CLN, WTR, STR, PLM, ELC, HVC, INT, EXT, MSN, INS, PTG, and all others)
- Unit of measurement standards (SQ=100 SF, SF, LF, EA, HR, DY)
- State Farm claim scoping guidelines and estimating best practices
- O&P (Overhead & Profit) applicability rules
- Depreciation principles for ACV vs RCV
- Building code upgrade requirements (Ordinance & Law coverage)
- IICRC standards for water/fire/mold claims
- Matching rules for insurance purposes
- Common contractor upsell tactics and how to address them professionally
- Regional price list variations
- Supplemental claim documentation standards`

function buildSharedRules(hasCodeReference: boolean, hasGuidelines: boolean): string {
  const rules = [
    hasCodeReference
      ? `- Always check the REFERENCE CODES below for the exact codes, descriptions, and units. Do not invent a code that isn't in it -- an adjuster will act on this.`
      : `- No reference codes matched this question specifically -- answer from general Xactimate/estimating knowledge, and say so plainly rather than inventing a code number.`,
    hasGuidelines
      ? `- If the question touches claim handling procedure (inspection triggers, documentation, SOPs), check the STATE FARM GUIDELINES below first -- it's the adjuster's own extracted procedure docs, more authoritative here than general industry knowledge`
      : null,
    `- Never state an insured's, claimant's, or any other individual's proper name in your response, even if one appears in the adjuster's message -- refer to them generically as "the insured" or "the homeowner" instead.`,
  ]
  return rules.filter(Boolean).join('\n')
}

function buildReferenceSections(codeReference: string, includeGuidelines: boolean): string {
  const sections = [codeReference || null, includeGuidelines ? `STATE FARM GUIDELINES:\n${EXTRACTED_GUIDELINES}` : null]
    .filter(Boolean)
  return sections.length > 0 ? sections.join('\n\n=========================================\n\n') : ''
}

function buildLookupSystemPrompt(codeReference: string, includeGuidelines: boolean): string {
  return `You are an elite Xactimate estimating consultant and property insurance claims expert with 20+ years of experience. You have comprehensive knowledge of:

${SHARED_KNOWLEDGE}

When answering:
${buildSharedRules(!!codeReference, includeGuidelines)}
- Always provide the exact Xactimate code(s) if applicable
- Specify the correct unit of measurement
- Note any common mistakes or contractor disputes around this item
- If the question involves O&P, depreciation, or coverage interpretation, explain both the adjuster and contractor perspectives
- Be direct and practical — this is a working tool for an active adjuster in the field

Keep answers concise but complete. Use bullet points for multiple codes or options.

${buildReferenceSections(codeReference, includeGuidelines)}
`
}

function buildConsultSystemPrompt(codeReference: string, includeGuidelines: boolean): string {
  return `You are an experienced claims consultant helping an adjuster think through a live claim, in the field, in real time. They're going to describe a situation -- what they're seeing at the property, what the insured said, what a contractor is claiming -- and you're working through it with them like a colleague they called for a second opinion, not a lookup tool.

You have the same knowledge base as a senior adjuster:

${SHARED_KNOWLEDGE}

How to work through a claim scenario:
${buildSharedRules(!!codeReference, includeGuidelines)}
- If the adjuster's description is missing something you'd actually need to know (age of the roof, what the policy says about matching, whether other trades are involved), ask -- don't guess and don't ask more than 1-2 questions at a time. This is a conversation, not an intake form.
- Reason through implications, not just facts: what does this likely mean for scope, coverage, cost, or the conversation they're about to have with the insured or a contractor. Walk through more than one angle if the situation genuinely has more than one (e.g. "if it's wind-driven, X; if it's wear and tear, Y -- which does the roof condition suggest?").
- Clearly separate what's grounded in the reference data below (cite the code or guideline) from what's your general professional judgment. Both are useful, but the adjuster needs to know which is which.
- You are a research and reasoning partner, not the decision-maker. Never phrase anything as "approve this" or "this is covered" -- phrase it as what the evidence and guidelines suggest, and what's worth verifying before the adjuster commits to a position. The adjuster makes the call; you help them get there with more information.
- Keep it conversational and scannable on a phone -- short paragraphs or bullets, not a wall of text.

${buildReferenceSections(codeReference, includeGuidelines)}
`
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const question = formData.get('question') as string || ''
    const historyRaw = formData.get('history') as string || '[]'
    const mode = (formData.get('mode') as string) === 'consult' ? 'consult' : 'lookup'
    const photos = formData.getAll('photos') as File[]
    const history = JSON.parse(historyRaw) as Array<{ role: string; content: string }>

    console.log(`[code-reference] received ${photos.length} photo(s), ${photos.reduce((sum, p) => sum + p.size, 0)}b total`)

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
    const codeReference = getFocusedCodesText(recentContext)
    const includeGuidelines = isGuidelinesRelevant(recentContext)
    const systemPrompt = mode === 'consult'
      ? buildConsultSystemPrompt(codeReference, includeGuidelines)
      : buildLookupSystemPrompt(codeReference, includeGuidelines)

    const { text, provider } = await generateWithFallback(prompt, systemPrompt, base64Images)
    return NextResponse.json({ success: true, answer: text, provider, photosReceived: photos.length })
  } catch (err: unknown) {
    // The provider errors are long JSON blobs that used to render verbatim in
    // the chat. Keep the detail in the logs and hand the UI a readable line.
    const detail = err instanceof Error ? err.message : 'Unknown error'
    console.error('code-reference failed:', detail)

    const friendly = detail.includes('All AI providers failed')
      ? 'No AI provider is available right now. Check the server logs for details.'
      : 'Something went wrong answering that. Check the server logs for details.'

    return NextResponse.json({ error: friendly, detail }, { status: 500 })
  }
}
