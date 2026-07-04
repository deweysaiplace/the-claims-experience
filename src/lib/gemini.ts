import { GoogleGenAI } from '@google/genai'

export function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in .env.local')
  return new GoogleGenAI({ apiKey })
}

export const proModel = 'gemini-2.5-pro'
export const flashModel = 'gemini-2.5-flash'
