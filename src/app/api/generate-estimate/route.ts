import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'
import { scrubPii } from '@/utils/sanitizer'

export const maxDuration = 120 // seconds

const WORKER_API = process.env.NEXT_PUBLIC_WORKER_API_URL || 'https://claims-worker.hijasond.workers.dev'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    
    // Parse form data (typically contains files for OCR mode)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const mode = (formData.get('mode') as string) || 'parse'
      
      if (mode === 'parse') {
        const files = formData.getAll('files') as File[]
        if (files.length === 0) {
          return NextResponse.json({ error: 'No files provided for parsing' }, { status: 400 })
        }

        // If we have a Cloudflare Worker URL, proxy the heavy OCR work to the worker to avoid Vercel timeouts
        if (WORKER_API) {
          try {
            console.log(`Proxying ${files.length} files to Cloudflare Worker /generate-estimate for OCR parsing...`)
            const workerForm = new FormData()
            files.forEach(f => workerForm.append('files', f))
            workerForm.append('mode', 'parse')

            const workerRes = await fetch(`${WORKER_API}/generate-estimate`, {
              method: 'POST',
              body: workerForm
            })
            if (!workerRes.ok) {
              throw new Error(`Worker returned HTTP ${workerRes.status}: ${await workerRes.text()}`)
            }
            const data = await workerRes.json()
            return NextResponse.json(data)
          } catch (workerErr: any) {
            console.error('Worker parsing proxy failed, falling back to local:', workerErr.message)
          }
        }

        // Fallback local processing
        const toBase64 = async (file: File) => {
          const bytes = await file.arrayBuffer()
          return Buffer.from(bytes).toString('base64')
        }

        const base64Images = await Promise.all(files.map(async f => await toBase64(f)))
        const systemInstruction = `You are an expert OCR parser for property insurance adjusting documents.
Analyze the uploaded EagleView roof measurement report images and hand-written/typed Roofing Scope Sheets.
Your goal is to extract all key details and output them in a STRICT JSON block. Do not write any conversational text or markdown code blocks (except the json block itself).

Strictly follow this JSON schema for your output:
{
  "claimRef": "string",
  "insuredName": "string",
  "pitch": number,
  "roofMaterial": "3-Tab" | "Laminate" | "Metal" | "Modified Bitumen" | "Wood" | "Slate" | "Tile" | "",
  "exposure": "5\\"" | "5 5/8\\"" | "Other" | "N/A" | "",
  "layers": number,
  "totalArea": number,
  "ridges": number,
  "hips": number,
  "valleys": number,
  "rakes": number,
  "eaves": number,
  "dripEdge": number,
  "flashing": number,
  "stepFlashing": number,
  "pipeJacks": number,
  "powerAtticVents": number,
  "turtleVents": number,
  "turbineVents": number,
  "ridgeVents": number,
  "satelliteDishes": number,
  "sawmEaves": boolean,
  "sawmRakes": boolean,
  "sawmValleys": boolean,
  "sawmEntire": boolean,
  "secondStoryPct": number
}

Make sure to extract:
- 'pitch' as a single number (e.g. 8 for 8/12 pitch).
- Linear measurements (ridges, hips, valleys, rakes, eaves, dripEdge, flashing, stepFlashing) as numbers (in feet).
- Quantities of accessories (pipeJacks, vents, satelliteDishes) as numbers.
- Self-adhered waterproof membrane (SAWM/ice & water shield) locations as booleans.
- 'secondStoryPct' as a number from 0 to 100 if any 2-story height breakdown or percentages are mentioned (e.g. 70).
- If a value cannot be found, set it to 0 or empty string.`

        const userPrompt = `Please parse the uploaded EagleView measurements and hand-written scope sheets to extract all roof parameters. Return only the strict JSON block.`

        const response = await generateWithFallback(userPrompt, systemInstruction, base64Images)
        
        // Clean markdown block wrappers if present
        let cleanText = response.text.trim()
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```\s*$/g, '').trim()
        }

        try {
          const parsedData = JSON.parse(cleanText)
          return NextResponse.json({ success: true, result: parsedData, provider: response.provider })
        } catch (jsonErr) {
          console.error('Failed to parse JSON output from AI:', cleanText)
          return NextResponse.json({ error: 'AI output was not valid JSON', raw: cleanText }, { status: 500 })
        }
      }
    }

    // JSON Payload mode: Mode === 'generate'
    const body = await request.json()
    const { mode, scopeData } = body

    if (mode === 'generate' && scopeData) {
      const { scrubbed: scrubName } = scrubPii(scopeData.insuredName || '')
      const { scrubbed: scrubRef } = scrubPii(scopeData.claimRef || '')

      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })

      // We will generate the estimate line items using AI reasoning grounded on standard scoping guidelines
      const systemInstruction = `You are an elite property insurance claims estimating expert with deep knowledge of Xactimate line item codes, CSI divisions, and standard scoping methodology.
You are generating a complete Xactimate estimate based on a validated Roofing Scope Sheet.

Date of Review: ${today}
Claim Reference: ${scrubRef || 'N/A'}
Property Address: ${scopeData.address ? scrubPii(scopeData.address).scrubbed : 'N/A'}
Insured Name: ${scrubName || 'N/A'}

INSTRUCTIONS:
1. Generate the recommended Xactimate line items based on the provided Scope Sheet data.
2. Apply standard estimating calculations:
   - Shingle removal: net roof squares (totalArea / 100).
   - Shingle installation: net roof squares + waste factor (use 15% waste for Hip roofs or 10% waste for Gable roofs).
   - Underlayment: net roof squares.
   - Ice & Water Shield: eaves, rakes, or valleys length * width in feet, converted to squares (SF / 100).
   - Ridge cap: total Ridges + Hips (unless ridge vent covers ridges, then subtract ridge vent length from hips/ridges cap).
   - Steep roof charges: If pitch is > 7, you MUST add 'RFG STEEP' (Steep charges - 7/12 to 9/12) for the net area of the roof. If pitch is > 9, add 'RFG STEEP>' (Steep charges - 10/12 to 12/12).
   - Story Height Split (secondStoryPct): If 'secondStoryPct' > 0:
     * Split the High Roof Charge 'RFG HIGH' (Remove) and 'RFG HIGH' (Install) using the specified percentage: Qty = Area * (secondStoryPct / 100).
     * Split the steep charges: The 2-story portion uses 'RFG STEEP2' (7/12 to 9/12), 'RFG STEEP2>' (10/12 to 12/12), and 'RFG STEEP2>>' (13/12 to 15/12). The remaining portion (100 - secondStoryPct) uses standard 1-story steep codes ('RFG STEEP', 'RFG STEEP>').
3. Do NOT include double-billing items (e.g. do not charge for separate nails, tarps, or clean up if standard in shingle unit rates).
4. Output must contain exactly these sections:

## ESTIMATE SUMMARY
Provide a brief summary of the roof size, material chosen, pitch, waste percentage applied, second-story height split calculations, and findings.

## XACTIMATE QUICK ENTRY GRID
A markdown table with columns: | Cat | Sel | Act | Description | Qty | Unit | Justification & Calculation |
- Category must be standard (e.g. RFG, DMO, SPC).
- Selector must be a valid code.
- Activity is '+' for install, '-' for remove, or '&' for replace.
- Quantity must be formatted as a decimal number.
- Include all calculations in 'Justification & Calculation'.

## FILE NOTE
Claim file note ready to copy-paste.

## EXPLANATORY MEMORANDUM
Explanations of the scoping decisions, building code compliance requirements, and any steep/high-profile ridge exclusions.`

      const userPrompt = `Please generate a complete Xactimate estimate from this verified Roofing Scope Sheet data:
${JSON.stringify(scopeData, null, 2)}`

      const response = await generateWithFallback(userPrompt, systemInstruction, [])
      return NextResponse.json({ success: true, result: response.text, provider: response.provider })
    }

    return NextResponse.json({ error: 'Invalid mode or payload' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
