import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client. The service role key bypasses RLS, so this must
 * never be imported into a client component — it would ship the key to the
 * browser. Routes using it are gated by src/middleware.ts.
 *
 * Built lazily so a missing key surfaces as a handled error at request time
 * rather than throwing during the build.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
