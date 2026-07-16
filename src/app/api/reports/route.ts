import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET() {
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
