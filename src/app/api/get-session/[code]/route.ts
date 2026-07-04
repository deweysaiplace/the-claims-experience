import { NextRequest, NextResponse } from 'next/server'
import { r2, getPresignedUrl, SessionManifest } from '@/lib/r2'
import { GetObjectCommand } from '@aws-sdk/client-s3'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const clean = code.toUpperCase().trim()

    // Read manifest
    let manifest: SessionManifest
    try {
      const res = await r2.send(new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME ?? 'claims-sessions',
        Key: `sessions/${clean}/manifest.json`,
      }))
      const text = await res.Body?.transformToString()
      if (!text) throw new Error('Empty manifest')
      manifest = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Session not found — check the code and try again' }, { status: 404 })
    }

    // Check expiry
    if (new Date(manifest.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Session expired (24-hour limit)' }, { status: 410 })
    }

    // Generate presigned URLs for each file (1-hour expiry)
    const files = await Promise.all(
      manifest.files.map(async f => ({
        name: f.name,
        type: f.type,
        size: f.size,
        url: await getPresignedUrl(f.key, 3600),
      }))
    )

    return NextResponse.json({
      code: manifest.code,
      claimRef: manifest.claimRef,
      tool: manifest.tool,
      files,
      createdAt: manifest.createdAt,
      expiresAt: manifest.expiresAt,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve session'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
