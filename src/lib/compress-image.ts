/**
 * Phone photos run 3-12MB each. Vercel caps serverless request bodies at ~4.5MB,
 * so a couple of raw photos get a 413 back — and because Vercel's 413 body is
 * plain text ("Request Entity Too Large"), calling res.json() on it fails with
 * "Unexpected token 'R'" rather than anything that names the real problem.
 *
 * Downscale and re-encode client-side before upload. 1600px on the long edge is
 * well past what the vision models need to read damage, and takes a 12MB photo
 * to roughly 300KB.
 */
export async function compressImage(
  file: File,
  maxEdge = 1600,
  quality = 0.8
): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  let bitmap: ImageBitmap
  try {
    // from-image applies EXIF rotation. Without it, photos taken in portrait
    // arrive sideways and the model reads them that way.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file // unsupported format — let the server deal with it
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )

  // Already small, or re-encoding made it bigger — keep the original.
  if (!blob || blob.size >= file.size) return file

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

/** Compress a batch, keeping any that fail as-is. */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f).catch(() => f)))
}
