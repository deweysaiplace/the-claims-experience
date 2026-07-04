import { NextRequest, NextResponse } from 'next/server'
import { getGenAI, flashModel } from '@/lib/gemini'

const POLICY_CHAT_SYSTEM = `You are an expert insurance claims analyst and senior adjuster with deep knowledge of State Farm policies, Xactimate estimating, and claim investigation procedures. You analyze claims holistically — policy coverage, estimate validation, scope verification, and documentation requirements.

Your role is to provide comprehensive claims analysis based on the policy document(s) and any additional context provided. Follow these rules:

1. **Policy Analysis**: Answer coverage questions based ONLY on the provided policy text. Quote specific sections when possible.
2. **Estimate Review**: When discussing estimates or Xactimate codes, evaluate:
   - Are the codes appropriate for the described damage?
   - Are quantities and pricing reasonable for the scope?
   - Are there missing line items or overages?
3. **Scope Validation**: Assess whether the described damage matches the claimed repairs
4. **Documentation Requirements**: Specify what evidence supports each type of claim
5. **Coverage Application**: Explain what triggers coverage, limitations, and exclusions

STRUCTURE YOUR RESPONSES:
- **Coverage Analysis**: What applies and why
- **Estimate Review**: Reasonableness and appropriateness
- **Documentation Needed**: What evidence to collect
- **Potential Issues**: Red flags or gaps to investigate
- **Next Steps**: Recommended actions

COVERAGE CONSIDERATIONS:
- Per occurrence vs aggregate limits
- Applicable deductibles
- Sub-limits for specific coverages
- Conditions and requirements
- Notice requirements and time limits
- Exclusions that may apply

ESTIMATE VALIDATION:
- Xactimate code appropriateness
- Unit pricing reasonableness
- Quantity justification
- Missing or excessive line items
- Upgrade/betterment considerations
- Code compliance requirements

CLAIM SCENARIOS:
When analyzing specific loss scenarios, explain:
- Coverage triggers under this policy
- Estimate reasonableness for the damage
- Scope consistency checks
- Documentation gaps
- Investigation recommendations

Be thorough but focused. Provide actionable insights that help with claim validation and proper settlement.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { policyText, question, history } = body

    if (!policyText?.trim() || !question?.trim()) {
      return NextResponse.json({ error: 'Policy text and question are required' }, { status: 400 })
    }

    const contents = [
      {
        role: 'user' as const,
        parts: [{ text: POLICY_CHAT_SYSTEM }],
      },
      {
        role: 'model' as const,
        parts: [{ text: 'I understand. I will analyze the provided policy document and answer questions based only on the text contained within it. Please provide the policy document and your first question.' }],
      },
      {
        role: 'user' as const,
        parts: [{ text: `POLICY DOCUMENT:\n\n${policyText}` }],
      },
      {
        role: 'model' as const,
        parts: [{ text: 'I have reviewed the policy document. I am ready to answer questions about coverage, limits, exclusions, deductibles, and any other policy details based solely on the text provided.' }],
      },
      ...(history ?? []).map((h: any) => ({
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
