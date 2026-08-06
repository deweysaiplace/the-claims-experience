import { NextRequest, NextResponse } from 'next/server'

// engineer-scope/page.tsx used to call the Cloudflare Worker directly from
// the browser, which meant the Worker's URL shipped in the client JS bundle
// (via NEXT_PUBLIC_WORKER_API_URL) with no way to attach a real secret --
// anything embedded in client code is public. Proxying through this
// server route keeps the Worker URL and its shared secret server-side only,
// and puts the call behind this app's own PIN-auth middleware.
export const maxDuration = 120

const WORKER_API = process.env.NEXT_PUBLIC_WORKER_API_URL || 'https://claims-worker.hijasond.workers.dev'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const workerRes = await fetch(`${WORKER_API}/engineer-scope`, {
      method: 'POST',
      headers: { 'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '' },
      body: formData,
    })

    const data = await workerRes.json()
    return NextResponse.json(data, { status: workerRes.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
