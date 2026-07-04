import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('Upload request received')
    
    const body = await request.json()
    const { fileName, fileSize, fileType, fileBase64 } = body
    
    if (!fileName || !fileBase64) {
      return NextResponse.json({ error: 'Missing file data' }, { status: 400 })
    }

    console.log('Upload request received:', {
      fileName,
      fileSize,
      fileType
    })

    // Convert base64 back to buffer for upload
    const fileBuffer = Buffer.from(fileBase64, 'base64')

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    // Step 1: Initiate resumable upload to Google Files API
    const initRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable&key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': fileBuffer.length.toString(),
          'X-Goog-Upload-Header-Content-Type': fileType || 'application/octet-stream',
        },
        body: JSON.stringify({ file: { display_name: fileName } }),
      }
    )

    if (!initRes.ok) {
      const errorText = await initRes.text()
      return NextResponse.json({ 
        error: `Failed to initiate upload: ${initRes.statusText}`,
        details: errorText 
      }, { status: 500 })
    }

    const uploadUrl = initRes.headers.get('x-goog-upload-url')
    if (!uploadUrl) {
      return NextResponse.json({ error: 'No upload URL received from Google Files API' }, { status: 500 })
    }

    // Step 2: Upload the file to the received upload URL
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': fileBuffer.length.toString(),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: fileBuffer,
    })

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text()
      return NextResponse.json({ 
        error: `Failed to upload file: ${uploadRes.statusText}`,
        details: errorText 
      }, { status: 500 })
    }

    // Step 3: Get the file metadata from the response
    let fileUri: string
    try {
      const uploadResult = await uploadRes.json()
      fileUri = uploadResult.file?.uri
      if (!fileUri) {
        // Extract from upload URL if response doesn't contain file URI
        const uploadIdMatch = uploadUrl.match(/upload_id=([^&]+)/)
        if (uploadIdMatch) {
          const uploadId = uploadIdMatch[1]
          fileUri = `https://generativelanguage.googleapis.com/v1beta/files/${uploadId}`
        } else {
          return NextResponse.json({ error: 'Could not determine file URI' }, { status: 500 })
        }
      }
    } catch {
      // Fallback: extract from upload URL
      const uploadIdMatch = uploadUrl.match(/upload_id=([^&]+)/)
      if (uploadIdMatch) {
        const uploadId = uploadIdMatch[1]
        fileUri = `https://generativelanguage.googleapis.com/v1beta/files/${uploadId}`
      } else {
        return NextResponse.json({ error: 'Could not determine file URI' }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      success: true, 
      fileUri,
      mimeType: fileType || 'application/octet-stream',
      fileName,
      fileSize: fileBuffer.length
    })

  } catch (error) {
    console.error('Upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
