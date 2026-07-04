import { NextResponse } from 'next/server'
import { EXTRACTED_POLICY } from '@/data/extracted-policy'
import { EXTRACTED_GUIDELINES } from '@/data/extracted-guidelines'

export async function GET() {
  try {
    const policyText = EXTRACTED_POLICY || ''
    const guidelinesText = EXTRACTED_GUIDELINES || ''
    
    return NextResponse.json({
      success: true,
      policyText,
      guidelinesText,
      combinedText: `${policyText}\n\n=========================================\n\n${guidelinesText}`
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
