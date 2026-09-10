import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, expectedToken } from '@/lib/session'

export async function POST(request: NextRequest) {
  const { pin } = await request.json()

  const targetPin = (process.env.APP_PIN || '4201').trim()
  if (pin !== targetPin) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }

  const token = await expectedToken()
  if (!token) {
    return NextResponse.json({ error: 'Unable to create session' }, { status: 500 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // 1 year persistent authentication so phone PWAs never log you out mid-claim
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}
