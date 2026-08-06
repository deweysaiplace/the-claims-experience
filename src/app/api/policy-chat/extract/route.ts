import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'

// Same worst-case budget as code-reference/route.ts -- a multi-page PDF or
// several page photos in one vision call can take a while.
export const maxDuration = 120

const TRANSCRIBE_PROMPT = `You are transcribing an insurance policy document (or pages of one) so an adjuster can search and ask questions about it later. Transcribe the text verbatim -- every section, limit, exclusion, and endorsement -- preserving headings and structure as plain text. Do not summarize, paraphrase, or omit anything, even boilerplate. If a page or region is illegible, note "[illegible]" at that point rather than guessing. Output only the transcribed text, no commentary before or after it.`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const images = files.filter((f) => f.type.startsWith('image/'))
    const pdfs = files.filter((f) => f.type === 'application/pdf')

    if (images.length + pdfs.length === 0) {
      return NextResponse.json({ error: 'Only images and PDF files are supported' }, { status: 400 })
    }

    console.log(`[policy-chat/extract] received ${images.length} image(s), ${pdfs.length} pdf(s)`)

    const [base64Images, base64Pdfs] = await Promise.all([
      Promise.all(images.map(async (f) => Buffer.from(await f.arrayBuffer()).toString('base64'))),
      Promise.all(pdfs.map(async (f) => Buffer.from(await f.arrayBuffer()).toString('base64'))),
    ])

    const { text } = await generateWithFallback(TRANSCRIBE_PROMPT, undefined, base64Images, base64Pdfs)

    return NextResponse.json({ success: true, extractedText: text, filesReceived: files.length })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'Unknown error'
    console.error('policy-chat/extract failed:', detail)

    const friendly = detail.includes('All AI providers failed')
      ? 'No AI provider is available right now. Check the server logs for details.'
      : 'Could not extract text from those files. Check the server logs for details.'

    return NextResponse.json({ error: friendly, detail }, { status: 500 })
  }
}
