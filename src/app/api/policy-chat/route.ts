import { NextRequest, NextResponse } from 'next/server'
import { getGenAI, flashModel } from '@/lib/gemini'

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

    const contents = [
      {
        role: 'user' as const,
        parts: [{ text: `Here is the POLICY DOCUMENT for reference:\n\n${policyText}` }],
      },
      {
        role: 'model' as const,
        parts: [{ text: 'I have reviewed the policy document and will use it to answer your questions.' }],
      },
      ...recentHistory.map((h: any) => ({
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
      config: {
        systemInstruction: POLICY_CHAT_SYSTEM,
      }
    })

    const answer = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return NextResponse.json({ success: true, answer })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
