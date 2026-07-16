import OpenAI from 'openai'

export function getGrok(): OpenAI {
  const apiKey = process.env.GROK_API_KEY
  if (!apiKey) throw new Error('GROK_API_KEY is not set in .env.local')
  return new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.x.ai/v1',
  })
}

// 'grok-2-vision' does not exist. Confirmed live on this key: grok-4.5 (text + vision).
export const grokModel = 'grok-4.5'
