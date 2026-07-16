import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, isValidSession } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/api/auth']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  if (await isValidSession(request.cookies.get(COOKIE_NAME)?.value)) {
    return NextResponse.next()
  }

  // API callers get a status they can act on; a redirect would hand them an HTML login page.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest)$).*)'],
}
