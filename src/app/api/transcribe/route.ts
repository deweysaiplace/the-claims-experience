import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY && !process.env.NEXT_PUBLIC_GEMINI_KEY) {
    return NextResponse.json(
      { error: 'Gemini API key not configured. Add GEMINI_API_KEY to your environment variables.' },
      { status: 500 }
    )
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_KEY })

  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 })
    }

    const bytes = await audioFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64, mimeType: audioFile.type || 'audio/webm' } },
            { text: 'You are an expert transcriptionist. Please transcribe the following audio verbatim. Return ONLY the transcribed text and absolutely nothing else. Do not wrap in quotes or markdown.' }
          ]
        }
      ]
    })

    return NextResponse.json({ text: response.text })
  } catch (error: unknown) {
    console.error('Transcription error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Transcription failed: ${message}` }, { status: 500 })
  }
}
