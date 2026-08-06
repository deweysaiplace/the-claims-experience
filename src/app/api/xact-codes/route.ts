import { NextRequest, NextResponse } from 'next/server'
import { getAllCategories, getCodesByCategory, getTotalCodeCount } from '@/lib/code-matcher'

// Serves the Xact Scope "Browse Codes" tab. Filtering/slicing happens here,
// server-side, so the client never has to load the full code-matcher dataset
// (12,000+ entries) just to render a 200-row list.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'All'
  const q = (searchParams.get('q') || '').trim().toLowerCase()

  const categories = getAllCategories()
  const pool = category === 'All' ? categories.flatMap((c) => getCodesByCategory(c)) : getCodesByCategory(category)

  const matches = q
    ? pool.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.keywords.some((k) => k.includes(q))
      )
    : pool

  return NextResponse.json({
    totalCount: getTotalCodeCount(),
    categories,
    matchCount: matches.length,
    codes: matches.slice(0, 200),
  })
}
