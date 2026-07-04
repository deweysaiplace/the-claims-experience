import { NextRequest, NextResponse } from 'next/server'
import { getGenAI, flashModel, proModel } from '@/lib/gemini'

// Smart rate limiting and processing
const RATE_LIMIT_WINDOW = 60000 // 1 minute between requests
const MAX_RETRIES = 3

// Track API usage
const apiUsage = {
  lastRequestTime: 0,
  requestCount: 0,
  quotaErrors: 0
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileUri, mimeType, claimRef, address, docType } = body

    if (!fileUri) {
      return NextResponse.json({ error: 'fileUri is required' }, { status: 400 })
    }

    // Rate limiting check
    const now = Date.now()
    const timeSinceLastRequest = now - apiUsage.lastRequestTime
    
    if (timeSinceLastRequest < RATE_LIMIT_WINDOW) {
      const waitTime = Math.ceil((RATE_LIMIT_WINDOW - timeSinceLastRequest) / 1000)
      console.log(`Rate limit: Waiting ${waitTime}s before processing...`)
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WINDOW - timeSinceLastRequest))
    }

    apiUsage.lastRequestTime = Date.now()
    apiUsage.requestCount++

    console.log(`Processing video ${apiUsage.requestCount} - ${fileUri}`)

    // Try different models in order
    const models = [proModel, flashModel]
    let lastError: any = null

    for (const model of models) {
      try {
        console.log(`Trying model: ${model}`)
        
        const genai = getGenAI()
        
        // Simplified prompt for faster processing
        const prompt = `Extract and organize all text from this insurance video. Format as:
        
## POLICY INFO
- Policy Number:
- Coverage Limits:
- Deductibles:

## LINE ITEMS
| Code | Description | Amount |

## TOTALS
- Subtotal:
- Tax:
- Total:

## RAW TEXT
[All visible text]`

        const response = await genai.models.generateContent({
          model: model,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  fileData: {
                    mimeType: mimeType,
                    fileUri: fileUri,
                  },
                },
              ],
            },
          ],
        })

        const result = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        
        console.log(`✅ Success with model: ${model}`)
        apiUsage.quotaErrors = 0 // Reset error count on success
        
        return NextResponse.json({ 
          success: true, 
          result,
          model: model,
          attempt: apiUsage.requestCount
        })

      } catch (error: any) {
        console.log(`❌ Failed with ${model}:`, error.message)
        lastError = error
        
        // If quota error, continue to next model
        if (error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
          apiUsage.quotaErrors++
          console.log(`Quota error #${apiUsage.quotaErrors}, trying next model...`)
          continue
        }
        
        // For other errors, throw immediately
        throw error
      }
    }

    // All models failed
    throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown'}`)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Parse video error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
