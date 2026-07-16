import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

// The reports table has RLS enabled with no policy for the public anon key, so
// writes must go through the service role. This route is server-only and gated
// by middleware, so the key never reaches the browser.
const NOT_CONFIGURED = {
  error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on this deployment',
}

export async function GET() {
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json(NOT_CONFIGURED, { status: 500 })

  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ success: true, reports: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json(NOT_CONFIGURED, { status: 500 })

  try {
    const body = await request.json()
    const { claimRef, address, adjusterName, content, type } = body

    if (!content || !type) {
      return NextResponse.json({ error: 'Content and type are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('reports')
      .insert([
        {
          claim_ref: claimRef || null,
          address: address || null,
          adjuster_name: adjusterName || null,
          content: content,
          type: type, // 'field-note', 'field-scope', 'reconciliation'
        }
      ])
      .select()

    if (error) throw error
    return NextResponse.json({ success: true, report: data?.[0] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
