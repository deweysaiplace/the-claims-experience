'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, GitCompare, Loader2, Copy, Mail, Check, FileImage, X, FileText, Plus, Smartphone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import { compressImages } from '@/lib/compress-image'
import { readJsonOrThrow } from '@/lib/upload'
import CameraCapture from '@/components/CameraCapture'
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds'
import { parseEngineerReport } from '@/lib/report-formatter'

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

  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{label}</div>

      {/* Thumbnails */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {files.map((file, i) => {
            const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
            return (
              <div key={i} className="relative rounded-lg overflow-hidden border border-zinc-700 group aspect-[4/3] bg-zinc-900">
                {isPdf ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <FileText className="w-6 h-6 text-red-400" />
                    <span className="text-[9px] text-zinc-400 mt-1 px-1 truncate max-w-full">{file.name}</span>
                  </div>
                ) : (
                  <img src={previews[i]} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                )}
                <button onClick={() => onRemove(i)}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 rounded text-zinc-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[9px] text-zinc-300 py-0.5">
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
            ${isDragActive ? 'border-amber-600 bg-amber-600/10' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900'}
            ${files.length > 0 ? 'py-2' : 'py-6'}`}>
          <input {...getInputProps()} />
          {files.length === 0 ? (
            <>
              <Upload className="w-6 h-6 text-zinc-600 mb-1" />
              <p className="text-zinc-400 text-xs">Drop photos/PDF or tap</p>
              <p className="text-zinc-600 text-[10px] mt-0.5">Multi-page supported</p>
            </>
          ) : (
            <span className="text-zinc-400 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Add pages</span>
          )}
        </div>
        <CameraCapture
          onCapture={(file) => onAdd([file])}
          label=""
          className="px-3.5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border border-zinc-700 text-amber-400 hover:text-amber-300 transition-colors flex items-center justify-center cursor-pointer select-none min-h-[48px] min-w-[48px] touch-manipulation"
        />
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
  const elapsedSeconds = useElapsedSeconds(loading)
  const [qualityWarning, setQualityWarning] = useState('')
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
    setError('')
    setResult('')

    try {
      // Multi-page estimates are the heaviest upload in the app. Raw phone
      // photos blow past Vercel's ~4.5MB body cap within two or three pages.
      // Compression scales down harder as the combined page count grows,
      // since that's what determines how much data the AI has to churn
      // through in one request.
      const totalPages = pagesA.length + pagesB.length
      const [preparedA, preparedB] = await Promise.all([
        compressImages(pagesA, totalPages),
        compressImages(pagesB, totalPages),
      ])

      // A blurry/low-detail capture compresses to a suspiciously small file
      // -- this is the exact signal that flagged a real blurry-camera bug
      // tonight (22-25KB vs a normal 150-400KB for a legible document
      // photo). Catching it here saves a wasted 90+ second AI round-trip on
      // a photo that's already known to be unreadable. Soft warning, not a
      // hard block -- tapping Reconcile again proceeds anyway.
      if (!qualityWarning) {
        const MIN_KB = 40
        const tooSmall = [
          ...preparedA.map((f, i) => ({ label: `Estimate A, page ${i + 1}`, kb: f.size / 1024 })),
          ...preparedB.map((f, i) => ({ label: `Estimate B, page ${i + 1}`, kb: f.size / 1024 })),
        ].filter((f) => f.kb < MIN_KB)

        if (tooSmall.length > 0) {
          setQualityWarning(
            `${tooSmall.map((f) => f.label).join(', ')} look unusually low quality — may be too blurry to read. Tap Reconcile Estimates again to proceed anyway, or retake those photos.`
          )
          return
        }
      }
      setQualityWarning('')
      setLoading(true)

      const form = new FormData()
      preparedA.forEach((f) => form.append('estimateA', f))
      preparedB.forEach((f) => form.append('estimateB', f))
      form.append('claimRef', claimRef)
      form.append('address', address)

      const res = await fetch('/api/reconcile', { method: 'POST', body: form })
      const data = await readJsonOrThrow(res)
      setResult(data.result)
      // Save immediately rather than waiting on a manual click -- this is the
      // fix for "I ran reconciliation and it never showed up in Portal".
      // The Save button stays for re-saving after edits.
      saveReport(data.result)
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
      await readJsonOrThrow(res)
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch (err: unknown) {
      // The route already says what's actually wrong. Show that rather than a
      // canned guess pointing at .env.local, which production doesn't read.
      // resultError, not error: this button is next to the results panel,
      // and error sits above Reconcile, off-screen on a phone by now.
      setResultError(err instanceof Error ? err.message : 'Email failed')
    } finally {
      setEmailSending(false)
    }
  }

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Separate from the top-level `error` state above the Reconcile button --
  // on a phone that's off-screen once you're looking at results, so a real
  // save failure there was invisible.
  const [resultError, setResultError] = useState('')

  // Takes content explicitly so the auto-save right after reconciliation can
  // save what the API just returned without waiting on a state update.
  const saveReport = async (content: string) => {
    setSaving(true)
    setResultError('')
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimRef,
          address,
          adjusterName: null,
          content,
          type: 'reconciliation'
        })
      })
      await readJsonOrThrow(res)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setResultError(
        `Auto-save to Portal failed: ${err instanceof Error ? err.message : 'unknown error'}. Use Save to retry.`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleSavePortal = () => saveReport(result)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-amber-400" />
            Estimate Reconciler
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Upload photos of both estimates (multi-page) — AI generates a variance matrix + dual output drafts
          </p>
        </div>
        <button onClick={() => setPhoneModal(true)}
          className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-sm font-medium transition-colors flex-shrink-0">
          <Smartphone className="w-4 h-4 text-amber-400" /> Load from phone
        </button>
      </div>

      {/* Phone handoff modal */}
      {phoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2"><Smartphone className="w-4 h-4 text-amber-400" /> Load from phone</h3>
              <button onClick={() => { setPhoneModal(false); setPhoneCode(''); setPhoneError('') }} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-zinc-400 text-sm">Enter the 6-character code shown on your phone after uploading.</p>
            <input
              type="text"
              value={phoneCode}
              onChange={e => setPhoneCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && loadFromPhone()}
              placeholder="AB3X7K"
              maxLength={6}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-center text-2xl font-mono tracking-widest placeholder-zinc-600 outline-none focus:border-amber-600"
            />
            {phoneError && <p className="text-red-400 text-sm">{phoneError}</p>}
            <button onClick={loadFromPhone} disabled={phoneLoading || phoneCode.length !== 6}
              className="w-full py-3 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold flex items-center justify-center gap-2 transition-colors">
              {phoneLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</> : 'Load Files'}
            </button>
            <p className="text-xs text-zinc-600 text-center">First half of files → Estimate A · Second half → Estimate B</p>
          </div>
        </div>
      )}

      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Claim Reference (last 4)
              </label>
              <input type="text" value={claimRef} onChange={(e) => setClaimRef(e.target.value)} placeholder="e.g. 7842"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-600" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Property Address
              </label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 412 Maple St"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-600" />
            </div>
          </div>

          <div className="flex gap-4">
            <MultiPageDropzone
              label={`Estimate A — Carrier (${pagesA.length} pg)`}
              files={pagesA}
              onAdd={(f) => { setPagesA((prev) => [...prev, ...f]); setQualityWarning('') }}
              onRemove={(i) => { setPagesA((prev) => prev.filter((_, idx) => idx !== i)); setQualityWarning('') }}
            />
            <MultiPageDropzone
              label={`Estimate B — Contractor (${pagesB.length} pg)`}
              files={pagesB}
              onAdd={(f) => { setPagesB((prev) => [...prev, ...f]); setQualityWarning('') }}
              onRemove={(i) => { setPagesB((prev) => prev.filter((_, idx) => idx !== i)); setQualityWarning('') }}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {qualityWarning && <p className="text-amber-400 text-sm">{qualityWarning}</p>}

          <button onClick={handleAnalyze}
            disabled={loading || pagesA.length === 0 || pagesB.length === 0}
            className="w-full py-3 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing {pagesA.length + pagesB.length} pages… ({elapsedSeconds}s)</>
            ) : (
              <><GitCompare className="w-4 h-4" /> Reconcile Estimates ({pagesA.length + pagesB.length} pages)</>
            )}
          </button>
          {loading && (
            <p className="text-center text-xs text-zinc-500">
              Multi-page reconciliation can take up to a minute or two — this is still working, not stuck.
            </p>
          )}
        </CardContent>
      </Card>

      {result && (() => {
        const parsed = parseEngineerReport(result)
        return (
          <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-white text-base font-bold flex items-center gap-2">
                  <GitCompare className="w-5 h-5 text-amber-400" /> Reconciler Audit Results
                </CardTitle>
                <div className="flex gap-2 flex-wrap justify-end">
                  <button onClick={handleEmail} disabled={emailSending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold transition-all active:scale-95 shadow-sm">
                    {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : emailSent ? <Check className="w-3.5 h-3.5 text-white" /> : <Mail className="w-3.5 h-3.5" />}
                    {emailSent ? 'Sent HTML Report!' : 'Email HTML Report'}
                  </button>
                  <button onClick={handleSavePortal} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-semibold transition-colors">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                    {saved ? 'Saved!' : 'Save'}
                  </button>
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied Full Report!' : 'Copy'}
                  </button>
                </div>
              </div>
              {resultError && <p className="text-red-400 text-xs mt-2">{resultError}</p>}
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Executive Status Bar */}
              <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs">
                <span className="text-zinc-400 font-medium">Reconciliation Verdict:</span>
                <span className={`px-2.5 py-0.5 rounded text-[11px] font-black ${
                  parsed.summary.coverageStatus === 'excluded' ? 'bg-red-950 text-red-400 border border-red-800' :
                  parsed.summary.coverageStatus === 'limited' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}>
                  {parsed.summary.coverageStatus === 'excluded' ? '🔴 DISCREPANCIES / EXCLUDED ITEMS DETECTED' :
                   parsed.summary.coverageStatus === 'limited' ? '🟡 VARIANCE / QUANTITY DIFFERENCES' : '🟢 RECONCILED / COVERED'}
                </span>
              </div>

              <div className="text-zinc-200 prose prose-invert prose-base max-w-none prose-table:text-sm prose-headings:text-amber-400 prose-headings:mt-6 prose-headings:mb-3 prose-p:text-zinc-200 prose-li:text-zinc-200 prose-strong:text-white prose-td:border-zinc-700 prose-th:border-zinc-700 p-2">
                <ReactMarkdown>{parsed.cleanFullReport}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}
