import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'

// Types for our unified fallback response
export interface AIFallbackResponse {
  text: string;
  provider: 'gemini' | 'claude' | 'grok';
}

/**
 * Provider order is deliberate: Grok is the only paid account, Gemini's free
 * tier is capped at 20 requests/day, and Claude needs an account balance.
 * Trying the dead ones first cost two failing round-trips per request.
 */

/** The callers pass raw base64 with no mime type, so read it off the magic bytes. */
function detectMimeType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png'
  if (base64.startsWith('UklGR')) return 'image/webp'
  if (base64.startsWith('R0lGOD')) return 'image/gif'
  return 'image/jpeg'
}

async function tryGrok(
  prompt: string,
  systemInstruction?: string,
  base64Images?: string[]
): Promise<AIFallbackResponse | null> {
  if (!process.env.GROK_API_KEY) return null

  console.log('Attempting Grok generation...')
  const userContent: any[] = [{ type: 'text', text: prompt }]
  for (const img of base64Images ?? []) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${detectMimeType(img)};base64,${img}` },
    })
  }

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-4.5',
      max_tokens: 4000,
      messages: [
        ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Grok API error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  return text ? { text, provider: 'grok' } : null
}

async function tryGemini(
  prompt: string,
  systemInstruction?: string,
  base64Images?: string[]
): Promise<AIFallbackResponse | null> {
  if (!process.env.GEMINI_API_KEY) return null

  console.log('Attempting Gemini generation...')
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  const contents: any[] = []
  for (const img of base64Images ?? []) {
    contents.push({ inlineData: { data: img, mimeType: detectMimeType(img) } })
  }
  contents.push({ text: prompt })

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: systemInstruction ? { systemInstruction } : undefined,
  })

  return response.text ? { text: response.text, provider: 'gemini' } : null
}

async function tryClaude(
  prompt: string,
  systemInstruction?: string,
  base64Images?: string[]
): Promise<AIFallbackResponse | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  console.log('Attempting Claude generation...')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const content: any[] = []
  for (const img of base64Images ?? []) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: detectMimeType(img), data: img },
    })
  }
  content.push({ type: 'text', text: prompt })

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    system: systemInstruction,
    messages: [{ role: 'user', content }],
  })

  const first = msg.content?.[0]
  return first?.type === 'text' ? { text: first.text, provider: 'claude' } : null
}

export async function generateWithFallback(
  prompt: string,
  systemInstruction?: string,
  base64Images?: string[] // Optional array of base64 images (without data URI prefix)
): Promise<AIFallbackResponse> {
  const errors: string[] = []

  for (const attempt of [tryGrok, tryGemini, tryClaude]) {
    try {
      const result = await attempt(prompt, systemInstruction, base64Images)
      if (result) return result
    } catch (e: any) {
      console.error(`${attempt.name} failed:`, e.message)
      errors.push(`${attempt.name.replace('try', '')}: ${e.message}`)
    }
  }

  throw new Error(`All AI providers failed.\n${errors.join('\n')}`)
}
