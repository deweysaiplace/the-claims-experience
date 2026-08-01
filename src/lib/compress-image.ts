/**
 * Phone photos run 3-12MB each. Vercel caps serverless request bodies at ~4.5MB,
 * so a couple of raw photos get a 413 back — and because Vercel's 413 body is
 * plain text ("Request Entity Too Large"), calling res.json() on it fails with
 * "Unexpected token 'R'" rather than anything that names the real problem.
 *
 * Downscale and re-encode client-side before upload. These are photographed
 * text documents (Xactimate line items), not scenery — color carries no
 * information a vision model needs to read them, so converting to grayscale
 * shrinks the file with no cost to legibility. Resolution also scales down
 * as the total page count grows: a 9-page reconcile run sends every image to
 * the AI in one combined request, so more pages means each one needs to be
 * lighter to keep the whole request — and the API cost — reasonable.
 */
export async function compressImage(
  file: File,
  totalPageCount = 1
): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  const { maxEdge, quality } =
    totalPageCount <= 4 ? { maxEdge: 1600, quality: 0.8 } :
    totalPageCount <= 8 ? { maxEdge: 1400, quality: 0.75 } :
    { maxEdge: 1150, quality: 0.68 }

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

  // Grayscale: photographed line-item text, not a photo where color carries
  // meaning — this is a free size reduction with no legibility cost.
  ctx.filter = 'grayscale(1)'
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

/**
 * Compress a batch, keeping any that fail as-is. Pass totalPageCount as the
 * COMBINED count across both estimates (A + B) — that's what actually
 * determines the size of the single AI request this batch feeds into, not
 * just the size of this one side.
 */
export async function compressImages(files: File[], totalPageCount?: number): Promise<File[]> {
  const total = totalPageCount ?? files.length
  return Promise.all(files.map((f) => compressImage(f, total).catch(() => f)))
}
