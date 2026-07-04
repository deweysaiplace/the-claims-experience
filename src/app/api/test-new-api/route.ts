import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { fileUri, mimeType, text } = await request.json()
    
    // Use the new API key and endpoint format
    const apiKey = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6KM85JHD5sIFHbtjoeiszlIsJgllPySxw0kDIJ7HEypbA'
    
    console.log('Testing new API format...')
    console.log('API Key format:', apiKey.substring(0, 10) + '...')
    
    // Test with simple text first
    const parts: any[] = [
      {
        text: text || "Explain how AI works in a few words"
      }
    ]
    
    // If video file provided, add file data
    if (fileUri && mimeType) {
      parts.push({
        file_data: {
          mime_type: mimeType,
          file_uri: fileUri
        }
      })
    }
    
    const testPayload = {
      contents: [
        {
          parts: parts
        }
      ]
    }
    
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify(testPayload)
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log('API Error:', response.status, errorText)
      return NextResponse.json({ 
        error: `API Error ${response.status}`, 
        details: errorText 
      }, { status: response.status })
    }
    
    const data = await response.json()
    console.log('API Success!')
    
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text'
    
    return NextResponse.json({ 
      success: true, 
      result,
      apiStatus: 'working'
    })
    
  } catch (error: any) {
    console.error('Test API Error:', error.message)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}
