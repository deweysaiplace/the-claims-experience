import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import { getActiveGeminiModels } from './gemini-models'

// Types for our unified fallback response
export interface AIFallbackResponse {
  text: string;
  provider: 'gemini' | 'claude' | 'grok';
}

/**
 * Provider order is deliberate: Claude is now the primary paid, reliable
 * account (2026-08-02). Gemini's free tier is capped at 20 requests/day;
 * Grok is a backup. Trying a dead/capped one first costs a failing
 * round-trip for no reason.
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
  // No base64Pdfs param here -- xAI's chat completions API doesn't accept a
  // PDF content block the way Claude/Gemini do, and Grok only ever runs as a
  // backup (Claude tries first; Gemini is checked before Grok in the backup
  // race). Silently dropping PDFs on this one path is an acceptable fallback
  // gap, not a blocker.
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
  base64Images?: string[],
  base64Pdfs?: string[]
): Promise<AIFallbackResponse | null> {
  if (!process.env.GEMINI_API_KEY) return null

  console.log('Attempting Gemini generation...')
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  const contents: any[] = []
  for (const img of base64Images ?? []) {
    contents.push({ inlineData: { data: img, mimeType: detectMimeType(img) } })
  }
  for (const pdf of base64Pdfs ?? []) {
    contents.push({ inlineData: { data: pdf, mimeType: 'application/pdf' } })
  }
  contents.push({ text: prompt })

  const models = await getActiveGeminiModels(process.env.GEMINI_API_KEY)
  let lastError: any = null
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemInstruction || undefined,
          thinkingConfig: { thinkingBudget: 0 },
        },
      })

      if (response.text) {
        return { text: response.text, provider: 'gemini' }
      }
    } catch (err: any) {
      lastError = err
      console.warn(`Gemini model ${model} failed, trying next:`, err?.message || err)
    }
  }

  if (lastError) throw lastError
  return null
}

async function tryClaude(
  prompt: string,
  systemInstruction?: string,
  base64Images?: string[],
  base64Pdfs?: string[]
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
  for (const pdf of base64Pdfs ?? []) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdf },
    })
  }
  content.push({ type: 'text', text: prompt })

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 8000,
    thinking: { type: 'disabled' } as any,
    system: systemInstruction,
    messages: [{ role: 'user', content }],
  })

  const textBlocks = (msg.content || []).filter((b: any) => b.type === 'text')
  const fullText = textBlocks.map((b: any) => b.text).join('\n').trim()
  if (!fullText) {
    console.error('Claude returned no text block:', msg.stop_reason, msg.content?.map((b) => b.type))
    return null
  }
  return { text: fullText, provider: 'claude' }
}

/**
 * Races a provider attempt against a timeout so one slow/hung call can't eat
 * the whole function budget (maxDuration) before the next provider in the
 * fallback chain ever gets a turn. This doesn't cancel the underlying network
 * call — it just stops waiting on it — which is fine here since the whole
 * function returns shortly after anyway.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ])
}

export async function generateWithFallback(
  prompt: string,
  systemInstruction?: string,
  base64Images?: string[], // Optional array of base64 images (without data URI prefix)
  base64Pdfs?: string[] // Optional array of base64 PDFs (without data URI prefix) -- Claude and Gemini only, see tryGrok
): Promise<AIFallbackResponse> {
  const errors: string[] = []
  const hasVisualMedia = (base64Images && base64Images.length > 0) || (base64Pdfs && base64Pdfs.length > 0)

  // Smart routing:
  // When photos/PDFs of estimates are provided, Gemini Flash is 10x-20x faster than Claude
  // at vision/OCR extraction (~3-5s vs 60-80s), preventing Vercel & mobile socket timeouts.
  // For text-only synthesis & reasoning (diffAndDraft), Claude Sonnet leads.
  const providerOrder = hasVisualMedia
    ? [
        { fn: tryGemini, label: 'Gemini', timeoutMs: 50_000 },
        { fn: tryClaude, label: 'Claude', timeoutMs: 55_000 },
        { fn: tryGrok, label: 'Grok', timeoutMs: 25_000 },
      ]
    : [
        { fn: tryClaude, label: 'Claude', timeoutMs: 45_000 },
        { fn: tryGemini, label: 'Gemini', timeoutMs: 30_000 },
        { fn: tryGrok, label: 'Grok', timeoutMs: 25_000 },
      ]

  for (const provider of providerOrder) {
    const start = Date.now()
    try {
      console.log(`[ai-fallback] Attempting ${provider.label} (${hasVisualMedia ? 'vision' : 'text'})...`)
      const res = await withTimeout(
        provider.fn(prompt, systemInstruction, base64Images, base64Pdfs),
        provider.timeoutMs,
        provider.label
      )
      if (res && res.text) {
        console.log(`[ai-fallback] ${provider.label} succeeded in ${Date.now() - start}ms`)
        return res
      }
    } catch (err: any) {
      const elapsed = Date.now() - start
      console.warn(`[ai-fallback] ${provider.label} failed after ${elapsed}ms:`, err?.message || err)
      errors.push(`${provider.label}: ${err?.message || err}`)
    }
  }

  throw new Error(`All AI providers failed.\n${errors.join('\n')}`)
}
