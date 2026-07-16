import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'

const POLICY_CHAT_SYSTEM = `You are an expert insurance claims analyst and senior adjuster with deep knowledge of State Farm policies, Xactimate estimating, and claim investigation procedures. You analyze claims holistically — policy coverage, estimate validation, scope verification, and documentation requirements.

Your role is to provide comprehensive claims analysis based on the policy document(s) and any additional context provided. Follow these rules:

1. **Policy Analysis**: Answer coverage questions based ONLY on the provided policy text. Quote specific sections when possible.
2. **Estimate Review**: When discussing estimates or Xactimate codes, evaluate appropriateness and missing items.
3. **Scope Validation**: Assess whether the described damage matches the claimed repairs
4. **Documentation**: Specify what evidence supports each type of claim
5. **Coverage**: Explain what triggers coverage, limitations, and exclusions

Be thorough but concise. Provide actionable insights that help with claim validation and proper settlement.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { policyText, question, history } = body

    if (!policyText?.trim() || !question?.trim()) {
      return NextResponse.json({ error: 'Policy text and question are required' }, { status: 400 })
    }

    // Keep only the last 4 messages (2 full turns) to prevent exponential token growth
    const recentHistory = (history || []).slice(-4)

    const transcript = recentHistory
      .map((h: any) => `${h.role === 'model' ? 'Assistant' : 'User'}: ${h.content}`)
      .join('\n\n')

    // generateWithFallback takes one prompt string, so the policy document and
    // prior turns are folded into it rather than sent as a Gemini message array.
    const prompt = [
      `Here is the POLICY DOCUMENT for reference:\n\n${policyText}`,
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
