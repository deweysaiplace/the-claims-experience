'use client'

import { useState } from 'react'
import { Camera, Upload, X, CheckCircle, Loader2, Shield, ImageIcon } from 'lucide-react'

export default function PhoneUploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [claimRef, setClaimRef] = useState('')
  const [tool, setTool] = useState<'reconciler' | 'field-scope' | 'general'>('reconciler')
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const arr = Array.from(incoming).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
    const newPreviews = arr.map(f => f.type.startsWith('image/') ? URL.createObjectURL(f) : '')
    setFiles(prev => [...prev, ...arr].slice(0, 10))
    setPreviews(prev => [...prev, ...newPreviews].slice(0, 10))
  }

  const removeFile = (i: number) => {
    if (previews[i]) URL.revokeObjectURL(previews[i])
    setFiles(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    setLoading(true)
    setError('')

    const form = new FormData()
    files.forEach(f => form.append('files', f))
    form.append('claimRef', claimRef)
    form.append('tool', tool)

    try {
      const res = await fetch('/api/upload-session', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCode(data.code)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    previews.forEach(p => { if (p) URL.revokeObjectURL(p) })
    setFiles([]); setPreviews([]); setCode(''); setError(''); setClaimRef('')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800 bg-slate-900">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-white font-bold text-sm leading-tight">Claims Experience</div>
          <div className="text-slate-500 text-xs">Phone → Desktop handoff</div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-5 max-w-lg mx-auto w-full">

        {code ? (
          /* ── SUCCESS STATE ── */
          <div className="space-y-6 pt-4">
            <div className="flex flex-col items-center text-center space-y-3">
              <CheckCircle className="w-14 h-14 text-green-400" />
              <h2 className="text-white text-xl font-bold">Files uploaded!</h2>
              <p className="text-slate-400 text-sm">Enter this code on your workstation to load these files.</p>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Session Code</div>
              <div className="text-5xl font-mono font-black text-blue-400 tracking-widest">{code}</div>
              <div className="text-xs text-slate-600 mt-3">Expires in 24 hours · {files.length} file{files.length !== 1 ? 's' : ''}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-400 space-y-1">
              <p className="font-medium text-slate-300">On your workstation:</p>
              <p>Open Claims Experience → click <span className="text-blue-400 font-mono">"Load from phone"</span> → enter <span className="font-mono text-white">{code}</span></p>
            </div>

            <button onClick={reset} className="w-full py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors">
              Upload another session
            </button>
          </div>
        ) : (
          /* ── UPLOAD STATE ── */
          <>
            <div>
              <h1 className="text-white text-xl font-bold">Upload field photos</h1>
              <p className="text-slate-400 text-sm mt-1">Select what you're uploading for, then add your photos.</p>
            </div>

            {/* Tool selector */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Uploading for</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'reconciler', label: 'Reconciler' },
                  { id: 'field-scope', label: 'Field Scope' },
                  { id: 'general', label: 'General' },
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setTool(opt.id)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      tool === opt.id
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Claim ref */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Claim Reference (optional)</label>
              <input
                type="text"
                value={claimRef}
                onChange={e => setClaimRef(e.target.value)}
                placeholder="e.g. 7842"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-blue-500 text-sm"
              />
            </div>

            {/* Photo grid */}
            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                    {previews[i]
                      ? <img src={previews[i]} alt="" className="w-full h-full object-cover" />
                      : <div className="flex flex-col items-center justify-center h-full gap-1"><ImageIcon className="w-6 h-6 text-slate-500" /><span className="text-[9px] text-slate-500 px-1 truncate max-w-full">{f.name}</span></div>
                    }
                    <button onClick={() => removeFile(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add photos */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-slate-600 rounded-2xl bg-slate-900 hover:border-blue-500 cursor-pointer transition-colors">
                <Camera className="w-8 h-8 text-slate-400" />
                <span className="text-slate-300 text-sm font-medium">Take Photo</span>
                <input type="file" accept="image/*" capture className="hidden" multiple onChange={e => addFiles(e.target.files)} />
              </label>
              <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-2xl bg-slate-800 border border-slate-700 hover:bg-slate-700 cursor-pointer transition-colors">
                <Upload className="w-8 h-8 text-slate-400" />
                <span className="text-slate-300 text-sm font-medium">Choose Files</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" multiple onChange={e => addFiles(e.target.files)} />
              </label>
            </div>

            {files.length > 0 && (
              <p className="text-center text-xs text-slate-600">{files.length} / 10 files selected</p>
            )}

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              onClick={handleUpload}
              disabled={loading || files.length === 0}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-xl shadow-blue-600/20"
            >
              {loading
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Uploading {files.length} file{files.length !== 1 ? 's' : ''}…</>
                : <>Upload &amp; Get Code</>
              }
            </button>
          </>
        )}
      </div>
    </div>
  )
}
