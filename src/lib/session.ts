const COOKIE_NAME = 'claims_auth'

/**
 * The cookie value is a hash of APP_PIN rather than a constant, so it cannot be
 * forged by anyone who guesses the cookie name. Uses Web Crypto so the same
 * function runs in both the Edge middleware and the Node route handler.
 */
async function sessionToken(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`claims-experience:v1:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Returns null when APP_PIN is unset, which must be treated as "nobody gets in". */
export async function expectedToken(): Promise<string | null> {
  const pin = process.env.APP_PIN
  if (!pin) return null
  return sessionToken(pin)
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false
  const expected = await expectedToken()
  if (!expected) return false
  return cookieValue === expected
}

export { COOKIE_NAME }
