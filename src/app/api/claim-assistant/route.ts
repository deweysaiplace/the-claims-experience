import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'
import { getPolicyDocsText, policyDocsAvailable } from '@/lib/policy-docs-search'
import { getFocusedCodesText } from '@/lib/xactimate-codes-search'

// Without this, the route falls back to Vercel's platform default duration,
// which can be shorter than generateWithFallback's own ~90s worst-case
// timeout budget (see ai-fallback.ts) -- the platform would kill the
// function before the code's own fallback logic ever got a chance to work.
export const maxDuration = 120

// Reuses the exact "controlling authority" language pattern from
// policy-chat/route.ts and the "ask, don't guess" / "thinking partner, not
// decision-maker" language from code-reference's Consult mode, rather than
// inventing new phrasing for the same rules -- this is the one place that
// combines both the policy corpus and the Xactimate code reference in a
// single free-form conversation, so it inherits both routes' grounding rules.
const CLAIM_ASSISTANT_SYSTEM = `You are an experienced claims consultant acting as a second pair of hands for a State Farm property claims adjuster in the field -- someone they can hand notes to, ask a quick question, paste a screenshot of an email or estimate, or think out loud with. This is a conversation, not a lookup form or an intake wizard.

How to work with the adjuster:

1. **Ground yourself in what's provided below.** When POLICY AND CLAIM MANUAL SOURCE TEXT is included, it is controlling authority over your general insurance knowledge -- follow its own quoting, citation, and scope rules exactly as stated in that section's own header. When REFERENCE CODES are included, use those exact codes and never invent one that isn't listed. If neither section actually addresses the question, say so plainly rather than answering as if it were sourced from this policy or manual.
2. **If something's missing, ask -- don't guess.** If the adjuster's note or question is missing something you'd genuinely need to know (what peril, which coverage, what the insured said, a date, a photo), ask 1-2 focused questions rather than assuming. Don't ask more than that at once.
3. **Photos and screenshots are context, not decoration.** If an image looks like an email, text message, estimate, or other document, read it and reference its actual content in your answer -- don't just acknowledge that something was attached.
4. **Separate grounded fact from your own judgment.** Clearly flag what's backed by the policy/manual/code text below (cite it) versus your own professional read on the situation. Both are useful, but the adjuster needs to know which is which.
5. **You're a thinking partner, not the decision-maker.** Never phrase something as "approve this" or "this is covered" -- phrase it as what the evidence and source text suggest, and what's worth verifying before the adjuster commits to a position with the insured or a contractor.
6. **Privacy.** Never state an insured's, claimant's, or any other individual's proper name in your response, even if one appears in a photo or the adjuster's own message -- refer to them generically as "the insured" or "the homeowner" instead.

Keep it conversational and scannable -- short paragraphs or bullets, not a wall of text. This is likely being read on a phone in the field.`

function buildReferenceSections(policyText: string, codesText: string): string {
  const sections = [policyText || null, codesText || null].filter(Boolean)
  return sections.length > 0 ? sections.join('\n\n---\n\n') : ''
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const question = (formData.get('question') as string) || ''
    const historyRaw = (formData.get('history') as string) || '[]'
    const photos = formData.getAll('photos') as File[]
    const history = JSON.parse(historyRaw) as Array<{ role: string; content: string }>

    if (!question.trim() && photos.length === 0) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Keep only the last 4 messages (2 full turns) to prevent exponential token growth.
    const recentHistory = history.slice(-4)
    const transcript = recentHistory
      .map((h) => `${h.role === 'model' ? 'Assistant' : 'User'}: ${h.content}`)
      .join('\n\n')

    const base64Images = await Promise.all(
      photos.map(async (photo) => Buffer.from(await photo.arrayBuffer()).toString('base64'))
    )

    // Recent turns count toward retrieval too, so a follow-up like "what about
    // the ridge cap" after a roofing question still pulls the roofing section.
    const recentContext = [question, ...recentHistory.map((h) => h.content)].join(' ')
    const policyText = policyDocsAvailable() ? getPolicyDocsText(recentContext) : ''
    const codesText = getFocusedCodesText(recentContext)

    const referenceSections = buildReferenceSections(policyText, codesText)
    const prompt = [referenceSections || null, transcript || null, `User: ${question}`]
      .filter(Boolean)
      .join('\n\n---\n\n')

    const { text, provider } = await generateWithFallback(prompt, CLAIM_ASSISTANT_SYSTEM, base64Images)
    return NextResponse.json({ success: true, answer: text, provider })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'Unknown error'
    console.error('claim-assistant failed:', detail)

    const friendly = detail.includes('All AI providers failed')
      ? 'No AI provider is available right now. Check the server logs for details.'
      : 'Something went wrong. Check the server logs for details.'

    return NextResponse.json({ error: friendly, detail }, { status: 500 })
  }
}
