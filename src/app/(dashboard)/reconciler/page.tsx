'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, GitCompare, Loader2, Copy, Mail, Check, FileImage, X, FileText, Plus, Camera, Smartphone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'

function MultiPageDropzone({
  label,
  files,
  onAdd,
  onRemove,
}: {
  label: string
  files: File[]
  onAdd: (f: File[]) => void
  onRemove: (i: number) => void
}) {
  const onDrop = useCallback((accepted: File[]) => onAdd(accepted), [onAdd])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
      'application/pdf': ['.pdf'],
    },
    multiple: true,
  })

  const [previews, setPreviews] = useState<string[]>([])

  useEffect(() => {
    const urls = files.map((f) => {
      const isPdf = f.type === 'application/pdf' || f.name.endsWith('.pdf')
      return isPdf ? '' : URL.createObjectURL(f)
    })
    setPreviews(urls)
    return () => urls.forEach((u) => { if (u) URL.revokeObjectURL(u) })
  }, [files])

  const onCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) onAdd(Array.from(e.target.files))
    e.target.value = ''
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</div>

      {/* Thumbnails */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {files.map((file, i) => {
            const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
            return (
              <div key={i} className="relative rounded-lg overflow-hidden border border-slate-700 group aspect-[4/3] bg-slate-900">
                {isPdf ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <FileText className="w-6 h-6 text-red-400" />
                    <span className="text-[9px] text-slate-400 mt-1 px-1 truncate max-w-full">{file.name}</span>
                  </div>
                ) : (
                  <img src={previews[i]} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                )}
                <button onClick={() => onRemove(i)}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 rounded text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[9px] text-slate-300 py-0.5">
                  pg {i + 1}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add area */}
      <div className="flex gap-1.5">
        <div {...getRootProps()}
          className={`flex-1 border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-center
            ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900'}
            ${files.length > 0 ? 'py-2' : 'py-6'}`}>
          <input {...getInputProps()} />
          {files.length === 0 ? (
            <>
              <Upload className="w-6 h-6 text-slate-600 mb-1" />
              <p className="text-slate-400 text-xs">Drop photos/PDF or tap</p>
              <p className="text-slate-600 text-[10px] mt-0.5">Multi-page supported</p>
            </>
          ) : (
            <span className="text-slate-400 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Add pages</span>
          )}
        </div>
        {/* CAMERA — implicit label, input nested inside */}
        <label className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors flex items-center cursor-pointer select-none">
          <Camera className="w-4 h-4" />
          <input
            type="file"
            accept="image/*"
            capture
            multiple
            className="hidden"
            onChange={onCamera}
          />
        </label>
      </div>
    </div>
  )
}

export default function ReconcilerPage() {
  const [pagesA, setPagesA] = useState<File[]>([])
  const [pagesB, setPagesB] = useState<File[]>([])
  const [claimRef, setClaimRef] = useState('')
  const [address, setAddress] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Phone handoff
  const [phoneModal, setPhoneModal] = useState(false)
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  const loadFromPhone = async () => {
    const code = phoneCode.trim().toUpperCase()
    if (code.length !== 6) { setPhoneError('Enter the 6-character code from your phone'); return }
    setPhoneLoading(true); setPhoneError('')
    try {
      const res = await fetch(`/api/get-session/${code}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Fetch each file and convert to File objects
      const loaded: File[] = await Promise.all(
        data.files.map(async (f: { name: string; type: string; url: string }) => {
          const blob = await fetch(f.url).then(r => r.blob())
          return new File([blob], f.name, { type: f.type })
        })
      )
      // Half goes to A, half to B (or all to A if only one set)
      if (loaded.length === 1) {
        setPagesA(loaded)
      } else {
        const mid = Math.ceil(loaded.length / 2)
        setPagesA(loaded.slice(0, mid))
        setPagesB(loaded.slice(mid))
      }
      if (data.claimRef) setClaimRef(data.claimRef)
      setPhoneModal(false); setPhoneCode('')
    } catch (err: unknown) {
      setPhoneError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setPhoneLoading(false) }
  }

  const handleAnalyze = async () => {
    if (pagesA.length === 0 || pagesB.length === 0) {
      setError('Please upload at least one page for each estimate.')
      return
    }
    setLoading(true)
    setError('')
    setResult('')

    const form = new FormData()
    // Append all pages for each estimate
    pagesA.forEach((f) => form.append('estimateA', f))
    pagesB.forEach((f) => form.append('estimateB', f))
    form.append('claimRef', claimRef)
    form.append('address', address)

    try {
      const res = await fetch('/api/reconcile', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEmail = async () => {
    setEmailSending(true)
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `Estimate Reconciliation${claimRef ? ` — Claim ${claimRef}` : ''}${address ? ` — ${address}` : ''}`,
          body: result,
          claimRef,
        }),
      })
      if (!res.ok) throw new Error('Send failed')
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch {
      setError('Email failed — check SMTP settings in .env.local')
    } finally {
      setEmailSending(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-blue-400" />
            Estimate Reconciler
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Upload photos of both estimates (multi-page) — AI generates a variance matrix + dual output drafts
          </p>
        </div>
        <button onClick={() => setPhoneModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition-colors flex-shrink-0">
          <Smartphone className="w-4 h-4 text-blue-400" /> Load from phone
        </button>
      </div>

      {/* Phone handoff modal */}
      {phoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2"><Smartphone className="w-4 h-4 text-blue-400" /> Load from phone</h3>
              <button onClick={() => { setPhoneModal(false); setPhoneCode(''); setPhoneError('') }} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-slate-400 text-sm">Enter the 6-character code shown on your phone after uploading.</p>
            <input
              type="text"
              value={phoneCode}
              onChange={e => setPhoneCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && loadFromPhone()}
              placeholder="AB3X7K"
              maxLength={6}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-2xl font-mono tracking-widest placeholder-slate-600 outline-none focus:border-blue-500"
            />
            {phoneError && <p className="text-red-400 text-sm">{phoneError}</p>}
            <button onClick={loadFromPhone} disabled={phoneLoading || phoneCode.length !== 6}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold flex items-center justify-center gap-2 transition-colors">
              {phoneLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</> : 'Load Files'}
            </button>
            <p className="text-xs text-slate-600 text-center">First half of files → Estimate A · Second half → Estimate B</p>
          </div>
        </div>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Claim Reference (last 4)
              </label>
              <input type="text" value={claimRef} onChange={(e) => setClaimRef(e.target.value)} placeholder="e.g. 7842"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Property Address
              </label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 412 Maple St"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="flex gap-4">
            <MultiPageDropzone
              label={`Estimate A — Carrier (${pagesA.length} pg)`}
              files={pagesA}
              onAdd={(f) => setPagesA((prev) => [...prev, ...f])}
              onRemove={(i) => setPagesA((prev) => prev.filter((_, idx) => idx !== i))}
            />
            <MultiPageDropzone
              label={`Estimate B — Contractor (${pagesB.length} pg)`}
              files={pagesB}
              onAdd={(f) => setPagesB((prev) => [...prev, ...f])}
              onRemove={(i) => setPagesB((prev) => prev.filter((_, idx) => idx !== i))}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={handleAnalyze}
            disabled={loading || pagesA.length === 0 || pagesB.length === 0}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing {pagesA.length + pagesB.length} pages…</>
            ) : (
              <><GitCompare className="w-4 h-4" /> Reconcile Estimates ({pagesA.length + pagesB.length} pages)</>
            )}
          </button>
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base">Analysis Results</CardTitle>
              <div className="flex gap-2">
                <button onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy All'}
                </button>
                <button onClick={handleEmail} disabled={emailSending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
                  {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : emailSent ? <Check className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                  {emailSent ? 'Sent!' : 'Email Report'}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="prose prose-invert prose-sm max-w-none prose-table:text-xs prose-headings:text-slate-200 prose-p:text-slate-300 prose-li:text-slate-300">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
