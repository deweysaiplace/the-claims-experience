import { NextRequest, NextResponse } from 'next/server'
import { verifyAndReplaceCodeSection } from '@/lib/xactimate-verify'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    if (!text) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 })
    }
    const verifiedText = verifyAndReplaceCodeSection(text)
    return NextResponse.json({ success: true, result: verifiedText })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
