/**
 * Read a fetch Response that might not be JSON.
 *
 * Failures don't always come from our own route handlers. Vercel rejects bodies
 * over ~4.5MB itself, with a plain-text 413 — so calling res.json() on it throws
 * "Unexpected token 'R', "Request En"... is not valid JSON", which tells the user
 * nothing about the actual problem (photos too big).
 */
export async function readJsonOrThrow(res: Response): Promise<any> {
  if (res.ok) return res.json()

  if (res.status === 413) {
    throw new Error('Those photos are too large to upload. Try fewer photos at once.')
  }

  const body = await res.text()
  let message = body.slice(0, 120) || `Request failed (${res.status})`
  try {
    const parsed = JSON.parse(body)
    if (parsed?.error) message = parsed.error
  } catch {
    // Not JSON — keep the raw snippet, which is still better than a parse error.
  }
  throw new Error(message)
}
