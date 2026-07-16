import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, expectedToken } from '@/lib/session'

export async function POST(request: NextRequest) {
  const { pin } = await request.json()

  // Without this guard an unset APP_PIN makes every PIN fail as "Invalid",
  // which reads as a wrong PIN rather than a misconfigured deployment.
  if (!process.env.APP_PIN) {
    return NextResponse.json(
      { error: 'APP_PIN is not configured on this deployment' },
      { status: 500 }
    )
  }

  if (pin !== process.env.APP_PIN) {
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
    sameSite: 'strict',
    maxAge: 60 * 60 * 12,
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}
