'use client'

import { useRef, useState, useCallback } from 'react'
import { Camera, X } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  className?: string
  label?: string
}

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setOpen(true)
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
    } catch {
      fallbackInputRef.current?.click()
    }
  }

  const close = () => {
    stopStream()
    setOpen(false)
  }

  const capture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      close()
    }, 'image/jpeg', 0.9)
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
          <video ref={videoRef} autoPlay playsInline muted className="flex-1 w-full h-full object-cover" />
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
