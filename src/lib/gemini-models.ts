// Evergreen default models (always prioritizes Google's fastest flash models)
export const DEFAULT_GEMINI_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
]

let cachedModels: string[] = []
let cacheExpiry = 0

/**
 * Returns prioritized, active Gemini models for the current API key.
 * Dynamically queries Google's model catalog so when Google retires or introduces
 * new models in the future, DOC automatically adopts them without code edits.
 */
export async function getActiveGeminiModels(apiKey?: string): Promise<string[]> {
  const key = apiKey || process.env.GEMINI_API_KEY
  if (!key) return DEFAULT_GEMINI_MODELS

  const now = Date.now()
  if (cachedModels.length > 0 && now < cacheExpiry) {
    return cachedModels
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
    if (res.ok) {
      const data = await res.json()
      // Strictly exclude specialized non-multimodal / experimental models:
      // tts, audio, image-generation, robotics, computer-use, preview, and retired 2.5-flash
      const cleanModels = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''))
        .filter((name: string) => {
          const lower = name.toLowerCase()
          return !lower.includes('tts') &&
                 !lower.includes('image') &&
                 !lower.includes('transcribe') &&
                 !lower.includes('robotics') &&
                 !lower.includes('computer-use') &&
                 !lower.includes('deep-research') &&
                 !lower.includes('nano-') &&
                 !lower.includes('preview') &&
                 lower !== 'gemini-2.5-flash' &&
                 lower !== 'gemini-2.0-flash' &&
                 lower !== 'gemini-1.5-flash'
        })

      // Always place verified production workhorses FIRST: 3.7-flash, 3.6-flash, 3.5-flash, flash-latest
      const priority = [
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-pro-latest'
      ]

      const merged = Array.from(new Set([
        ...priority.filter((p: string) => cleanModels.includes(p) || DEFAULT_GEMINI_MODELS.includes(p)),
        ...cleanModels.filter((m: string) => m.includes('flash')),
        ...cleanModels.filter((m: string) => m.includes('pro')),
        ...DEFAULT_GEMINI_MODELS
      ]))

      if (merged.length > 0) {
        cachedModels = merged
        cacheExpiry = now + 3600 * 1000 // Cache for 1 hour
        return cachedModels
      }
    }
  } catch (err) {
    console.warn('Dynamic model query error, falling back to defaults:', err)
  }

  return DEFAULT_GEMINI_MODELS
}
