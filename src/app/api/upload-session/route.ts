import { NextRequest, NextResponse } from 'next/server'
import { uploadToR2, generateCode, keyExists, SessionManifest } from '@/lib/r2'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const files = form.getAll('files') as File[]
    const claimRef = (form.get('claimRef') as string) ?? ''
    const tool = (form.get('tool') as string) ?? 'general'

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }
    if (files.length > 10) {
      return NextResponse.json({ error: 'Max 10 files per session' }, { status: 400 })
    }

    // Generate a unique code
    let code = generateCode()
    let attempts = 0
    while (await keyExists(`sessions/${code}/manifest.json`) && attempts < 5) {
      code = generateCode()
      attempts++
    }

    const prefix = `sessions/${code}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const fileRecords: SessionManifest['files'] = []

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const buf = Buffer.from(bytes)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const key = `${prefix}/${safeName}`
      await uploadToR2(key, buf, file.type || 'application/octet-stream')
      fileRecords.push({ name: file.name, key, type: file.type, size: file.size })
    }

    const manifest: SessionManifest = {
      code,
      claimRef,
      tool,
      files: fileRecords,
      createdAt: new Date().toISOString(),
      expiresAt,
    }

    await uploadToR2(
      `${prefix}/manifest.json`,
      Buffer.from(JSON.stringify(manifest)),
      'application/json'
    )

    return NextResponse.json({ code, expiresAt, fileCount: files.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
