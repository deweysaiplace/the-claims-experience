import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'

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
    max_tokens: 4000,
    system: systemInstruction,
    messages: [{ role: 'user', content }],
  })

  const first = msg.content?.[0]
  return first?.type === 'text' ? { text: first.text, provider: 'claude' } : null
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
  // A real reconcile run (5 photos, 8-section structured output) hit even
  // the 45s cap on all three providers at once -- turned out to be caused
  // by a since-fixed bug producing blurry source photos, not the providers
  // themselves. Claude is now confirmed both funded and reliable (it's the
  // one that came through once photo quality was still bad but the timeout
  // was generous), so it gets the primary slot and the lion's share of the
  // budget; Grok and Gemini are the backup race.
  const CLAUDE_TIMEOUT_MS = 85_000
  const BACKUP_TIMEOUT_MS = 25_000 // 85 + 25 = 110s, under the 120s ceiling

  // Claude tries alone first (see note above) so the common case stays fast
  // and doesn't burn Gemini's 20/day free-tier cap for no reason.
  const claudeStart = Date.now()
  try {
    const claude = await withTimeout(
      tryClaude(prompt, systemInstruction, base64Images, base64Pdfs),
      CLAUDE_TIMEOUT_MS,
      'Claude'
    )
    console.log(`Claude attempt took ${Date.now() - claudeStart}ms`)
    if (claude) return claude
  } catch (e: any) {
    console.error(`Claude failed after ${Date.now() - claudeStart}ms:`, e.message)
    errors.push(`Claude: ${e.message}`)
  }

  // Claude didn't come through — race the two backups against each other
  // instead of trying them one at a time, so a slow Gemini call doesn't
  // block Grok from getting a turn within the remaining budget.
  //
  // Explicit labels here, not attempt.name — production builds minify
  // function names (e.g. tryGemini becomes "h"), which is why an earlier
  // error showed unreadable single-letter provider names instead of
  // "Gemini" / "Grok".
  const backups: { fn: typeof tryGemini; label: string }[] = [
    { fn: tryGemini, label: 'Gemini' },
    { fn: tryGrok, label: 'Grok' },
  ]
  const settled = await Promise.allSettled(
    backups.map(({ fn, label }) =>
      withTimeout(fn(prompt, systemInstruction, base64Images, base64Pdfs), BACKUP_TIMEOUT_MS, label)
    )
  )

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]
    const label = backups[i].label
    if (outcome.status === 'fulfilled' && outcome.value) return outcome.value
    if (outcome.status === 'rejected') {
      console.error(`${label} failed:`, outcome.reason?.message ?? outcome.reason)
      errors.push(`${label}: ${outcome.reason?.message ?? outcome.reason}`)
    }
  }

  throw new Error(`All AI providers failed.\n${errors.join('\n')}`)
}
