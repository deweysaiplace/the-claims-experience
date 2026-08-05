'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Camera, X } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  className?: string
  label?: string
}

// The ImageCapture API isn't in TS's default DOM lib. Minimal shape for
// what this file actually uses.
interface ImageCaptureLike {
  takePhoto: () => Promise<Blob>
}
declare const ImageCapture: { new (track: MediaStreamTrack): ImageCaptureLike } | undefined

// Replaces <input type="file" capture="environment"> — on some Android
// Chrome versions that silently opens the file picker instead of the
// camera, especially when the input is triggered via a parent <label>.
// This drives the camera directly with getUserMedia so there's no OS
// chooser in the way. Falls back to the native file input (still with the
// capture hint) if getUserMedia is unsupported or permission is denied,
// so a device without camera API support isn't left with a dead button.
export default function CameraCapture({ onCapture, className, label = 'Take Photo' }: CameraCaptureProps) {
  const [open, setOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fallbackInputRef = useRef<HTMLInputElement>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      fallbackInputRef.current?.click()
      return
    }
    try {
      // Without explicit width/height, the browser defaults to a low
      // "video call" resolution (often well under 1MP) instead of the
      // camera's real photo resolution -- produced visibly fuzzy captures
      // on a real device. `ideal` asks for the highest the camera offers up
      // to this without forcing a hard failure if it can't hit it exactly.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 4032 },
          height: { ideal: 3024 },
        },
        audio: false,
      })
      streamRef.current = stream
      setOpen(true)
    } catch (err) {
      console.error('[CameraCapture] getUserMedia failed, falling back to native picker:', err)
      fallbackInputRef.current?.click()
    }
  }

  // requestAnimationFrame right after setOpen(true) was a guess that the
  // <video> element would already be mounted by the time it fired -- it
  // isn't always, especially on a slower phone, which left videoRef.current
  // null and the stream never attached: a black preview with no error.
  // A useEffect keyed on `open` runs after React actually commits the
  // mounted <video>, so the ref is reliably there.
  useEffect(() => {
    if (open && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [open])

  const close = () => {
    stopStream()
    setOpen(false)
  }

  const captureFromVideoFrame = () => {
    const video = videoRef.current
    if (!video) return
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      // The stream never actually attached (or hasn't started decoding
      // frames yet) -- this is the "capture does nothing" failure mode.
      // Surfacing it beats a silent no-op.
      console.error('[CameraCapture] video has no frame data (videoWidth/videoHeight = 0) -- stream not attached, capture will fail')
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      else console.error('[CameraCapture] canvas.toBlob returned null -- no photo captured')
      close()
    }, 'image/jpeg', 0.92)
  }

  const capture = async () => {
    // ImageCapture.takePhoto() asks the camera hardware for an actual still
    // photo -- full resolution, same as a native camera app. A canvas
    // snapshot of the <video> element only ever captures at the *video
    // stream's* resolution, which is a fundamentally lower-quality feed even
    // with the width/height constraints above. Prefer this when available
    // (Chrome/Android); fall back to the video-frame snapshot otherwise.
    const track = streamRef.current?.getVideoTracks()[0]
    if (track && typeof ImageCapture !== 'undefined') {
      try {
        const imageCapture = new ImageCapture(track)
        const blob = await imageCapture.takePhoto()
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' }))
        close()
        return
      } catch {
        // Some devices advertise ImageCapture but throw on takePhoto() --
        // fall through to the video-frame snapshot rather than failing.
      }
    }
    captureFromVideoFrame()
  }

  return (
    <>
      <button type="button" onClick={openCamera} className={className}>
        <Camera className="w-4 h-4" /> {label}
      </button>

      <input
        ref={fallbackInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onCapture(file)
          e.target.value = ''
        }}
      />

      {open && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* min-h-0 overrides the flex item's default auto min-height --
              without it, the video's intrinsic aspect ratio refuses to
              shrink below its natural size in a short (landscape) flex
              column, overflowing and pushing the capture button off-screen. */}
          <video ref={videoRef} autoPlay playsInline muted className="flex-1 min-h-0 w-full object-cover" />
          <div className="flex items-center justify-between p-4 bg-black/80">
            <button onClick={close} aria-label="Cancel" className="p-3 rounded-full bg-slate-800 text-white">
              <X className="w-6 h-6" />
            </button>
            <button onClick={capture} aria-label="Capture photo" className="w-16 h-16 rounded-full bg-white border-4 border-slate-400" />
            <div className="w-12" />
          </div>
        </div>
      )}
    </>
  )
}
