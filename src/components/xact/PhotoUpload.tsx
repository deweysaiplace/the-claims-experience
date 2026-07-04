'use client'

import { useState, useCallback } from 'react'
import { Upload, X, ImageIcon, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PhotoUploadProps {
  onPhotosChange: (files: File[]) => void
}

export default function XactPhotoUpload({ onPhotosChange }: PhotoUploadProps) {
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [dragging, setDragging] = useState(false)

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
      const newItems = arr.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }))
      setPhotos((prev) => {
        const updated = [...prev, ...newItems].slice(0, 5)
        onPhotosChange(updated.map((p) => p.file))
        return updated
      })
    },
    [onPhotosChange]
  )

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      const updated = prev.filter((_, i) => i !== index)
      onPhotosChange(updated.map((p) => p.file))
      return updated
    })
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      {/* Two buttons side by side: camera (capture) + library */}
      <div className="grid grid-cols-2 gap-2">
        {/* CAMERA — implicit label, input nested inside, no id/htmlFor needed */}
        <label className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm cursor-pointer transition-colors select-none">
          <Camera size={16} />
          Take Photo
          <input
            type="file"
            accept="image/*"
            capture
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </label>

        {/* LIBRARY — implicit label, no id/htmlFor */}
        <label
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          className={cn(
            'flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed font-semibold text-sm cursor-pointer transition-colors select-none',
            dragging
              ? 'border-blue-500 bg-blue-500/10 text-blue-400'
              : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:text-white'
          )}
        >
          <Upload size={16} />
          Choose from Library
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </label>
      </div>

      <p className="text-xs text-slate-600 text-center">Up to 5 photos — JPG, PNG, HEIC, WebP</p>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden aspect-square bg-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); removePhoto(i) }}
                  className="bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded flex items-center gap-1">
                <ImageIcon size={9} />
                {i + 1}
              </div>
            </div>
          ))}
          {photos.length < 5 && (
            <label className="border-2 border-dashed border-slate-700 rounded-lg aspect-square flex items-center justify-center cursor-pointer hover:border-slate-500 hover:bg-slate-800/70 transition-colors">
              <Upload size={18} className="text-slate-600" />
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </label>
          )}
        </div>
      )}
    </div>
  )
}
