import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'
import { getPolicyDocsText, policyDocsAvailable } from '@/lib/policy-docs-search'

// Without this, the route falls back to Vercel's platform default duration,
// which can be shorter than generateWithFallback's own ~90s worst-case
// timeout budget (see ai-fallback.ts) -- the platform would kill the
// function before the code's own fallback logic ever got a chance to work.
export const maxDuration = 120

const POLICY_CHAT_SYSTEM = `You are an expert insurance claims analyst and senior adjuster with deep knowledge of State Farm policies, Xactimate estimating, and claim investigation procedures. You analyze claims holistically — policy coverage, estimate validation, scope verification, and documentation requirements.

Your role is to provide comprehensive claims analysis based on the policy/claim-manual text and any additional context provided below. Follow these rules:

1. **Policy Analysis**: Answer coverage questions from the source text provided below (a PER-CLAIM DOCUMENT section, a POLICY AND CLAIM MANUAL SOURCE TEXT section, or both). Quote specific provisions verbatim, and cite the heading or section they came from. If neither section below actually addresses the question, say so plainly rather than answering from general insurance knowledge as if it were this policy's language.
2. **Controlling authority**: Retrieved POLICY AND CLAIM MANUAL SOURCE TEXT outranks your general insurance knowledge -- follow its own quoting, citation, and scope rules exactly as stated in that section's header below.
3. **Estimate Review**: When discussing estimates or Xactimate codes, evaluate appropriateness and missing items.
4. **Scope Validation**: Assess whether the described damage matches the claimed repairs
5. **Documentation**: Specify what evidence supports each type of claim
6. **Coverage**: Explain what triggers coverage, limitations, and exclusions
7. **Privacy**: A PER-CLAIM DOCUMENT may contain the insured's real name and address on its declarations page. Never state that name, or any other individual's proper name, anywhere in your response -- refer to them generically as "the insured" or "the homeowner" instead.

Be thorough but concise. Provide actionable insights that help with claim validation and proper settlement.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { policyText, question, history } = body

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Keep only the last 4 messages (2 full turns) to prevent exponential token growth
    const recentHistory = (history || []).slice(-4)

    const transcript = recentHistory
      .map((h: any) => `${h.role === 'model' ? 'Assistant' : 'User'}: ${h.content}`)
      .join('\n\n')

    // Recent turns count toward retrieval too, so a follow-up like "what about
    // the ridge cap" after a roofing question still pulls the roofing section.
    const recentContext = [question, ...recentHistory.map((h: any) => h.content)].join(' ')
    const masterCorpusText = policyDocsAvailable() ? getPolicyDocsText(recentContext) : ''

    // policyText is a separate, real need from the master HW2130/Claim Manual
    // corpus above: it's whatever per-claim document the adjuster loaded (an
    // uploaded declarations page, endorsements, or extracted photos/PDF for
    // THIS claim). Both are included together when present -- neither
    // replaces the other.
    const sourceSections = [
      policyText?.trim()
        ? `PER-CLAIM DOCUMENT (uploaded for this specific claim -- e.g. declarations, endorsements):\n\n${policyText.trim()}`
        : null,
      masterCorpusText || null,
    ].filter(Boolean)

    // generateWithFallback takes one prompt string, so the source text and
    // prior turns are folded into it rather than sent as a Gemini message array.
    const prompt = [
      ...sourceSections,
      transcript,
      `User: ${question}`,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n')

    const { text, provider } = await generateWithFallback(prompt, POLICY_CHAT_SYSTEM)
    return NextResponse.json({ success: true, answer: text, provider })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'Unknown error'
    console.error('policy-chat failed:', detail)

    const friendly = detail.includes('All AI providers failed')
      ? 'No AI provider is available right now. Check the server logs for details.'
      : 'Something went wrong analyzing that policy. Check the server logs for details.'

    return NextResponse.json({ error: friendly, detail }, { status: 500 })
  }
}
