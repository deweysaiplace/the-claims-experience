'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Loader2, Copy, Mail, Check, X, FileText, Plus, Shield, FileSpreadsheet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import { compressImages } from '@/lib/compress-image'
import { readJsonOrThrow } from '@/lib/upload'
import CameraCapture from '@/components/CameraCapture'
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds'

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

      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 mb-2">
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

      <div className="flex gap-1.5">
        <div {...getRootProps()}
          className={`flex-1 border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-center
            ${isDragActive ? 'border-amber-600 bg-amber-600/10' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900'}
            ${files.length > 0 ? 'py-2' : 'py-6'}`}>
          <input {...getInputProps()} />
          {files.length === 0 ? (
            <>
              <Upload className="w-6 h-6 text-zinc-600 mb-1" />
              <p className="text-zinc-400 text-xs">Drop engineer report photos/PDF</p>
              <p className="text-zinc-600 text-[10px] mt-0.5">Multi-page supported</p>
            </>
          ) : (
            <span className="text-zinc-400 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Add pages</span>
          )}
        </div>
        <CameraCapture
          onCapture={(file) => onAdd([file])}
          label=""
          className="px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-white transition-colors flex items-center cursor-pointer select-none"
        />
      </div>
    </div>
  )
}

export default function EngineerScopePage() {
  const [files, setFiles] = useState<File[]>([])
  const [claimRef, setClaimRef] = useState('')
  const [address, setAddress] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const elapsedSeconds = useElapsedSeconds(loading)
  const [error, setError] = useState('')
  const [qualityWarning, setQualityWarning] = useState('')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'policy' | 'scope' | 'note'>('policy')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Separate from the top-level `error` state above the Analyze button --
  // on a phone that's off-screen once you're looking at results, so a real
  // save failure there was invisible. Same bug already found and fixed on
  // field-scope, field-notes and reconciler.
  const [resultError, setResultError] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Takes content explicitly so the auto-save right after analysis can save
  // what the API just returned without waiting on a state update to land.
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
          type: 'engineering_review'
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

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('Please upload at least one page of the engineering report.')
      return
    }
    setError('')
    setResult('')

    try {
      const prepared = await compressImages(files)

      // Same signal that flagged a real blurry-camera bug on Reconciler
      // tonight: a low-detail capture compresses to a suspiciously small
      // file. Soft warning, not a hard block -- tapping Analyze again
      // proceeds anyway. PDFs pass through compressImages unchanged (not
      // image files), so only check actual images here.
      if (!qualityWarning) {
        const MIN_KB = 40
        const tooSmall = prepared
          .map((f, i) => ({ label: `Page ${i + 1}`, kb: f.size / 1024, isImage: f.type.startsWith('image/') }))
          .filter((f) => f.isImage && f.kb < MIN_KB)

        if (tooSmall.length > 0) {
          setQualityWarning(
            `${tooSmall.map((f) => f.label).join(', ')} look unusually low quality — may be too blurry to read. Tap Generate Aligned Scope again to proceed anyway, or retake those photos.`
          )
          return
        }
      }
      setQualityWarning('')
      setLoading(true)

      const form = new FormData()
      prepared.forEach((f) => form.append('report', f))
      form.append('claimRef', claimRef)
      form.append('address', address)

      // Proxied through this app's own /api/engineer-scope route rather than
      // calling the Cloudflare Worker directly -- keeps the Worker's URL and
      // auth secret server-side only instead of shipping in the client bundle.
      // AbortController still gives it a real ceiling: if the worker hangs,
      // this fetch would otherwise wait indefinitely with no resolution.
      const apiUrl = '/api/engineer-scope'
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120_000)
      let res: Response
      try {
        res = await fetch(apiUrl, { method: 'POST', body: form, signal: controller.signal })
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error('The engineering report analysis timed out after 2 minutes. Try again, or with fewer pages.')
        }
        throw err
      } finally {
        clearTimeout(timeoutId)
      }
      const data = await readJsonOrThrow(res)
      setResult(data.result)
      // Save immediately rather than waiting on a manual click -- this is the
      // fix for "I ran the analysis and it never showed up in Portal", found
      // tonight on three other pages before this one had even been used.
      saveReport(data.result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  // Parse structured sections out of raw response
  const parseResult = (raw: string) => {
    const extract = (tag: string) => {
      const match = raw.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
      return match ? match[1].trim() : ''
    }

    const summaryRaw = extract('summary_data')
    const policy = extract('policy_alignment') || raw // fallback to full text
    const scope = extract('xactimate_scope')
    const note = extract('file_note')

    const summary: Record<string, string> = {
      firm: 'N/A',
      date: 'N/A',
      findings: ''
    }

    if (summaryRaw) {
      summaryRaw.split('\n').forEach(line => {
        const parts = line.split(':')
        if (parts.length >= 2) {
          const key = parts[0].trim()
          const val = parts.slice(1).join(':').trim()
          if (key === 'ENGINEER_FIRM') summary.firm = val
          if (key === 'REPORT_DATE') summary.date = val
          if (key === 'PRIMARY_FINDINGS') summary.findings = val
        }
      })
    }
    return { summary, policy, scope, note, hasTags: !!summaryRaw }
  }

  const parsed = parseResult(result)

  const handleEmail = async () => {
    if (emailSending || !result) return
    setEmailSending(true)
    setResultError('')
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `Structural Engineering Scope Audit${claimRef ? ` — Claim ${claimRef}` : ''}${address ? ` — ${address}` : ''}`,
          body: result,
          claimRef,
        }),
      })
      await readJsonOrThrow(res)
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch (err: unknown) {
      setResultError(err instanceof Error ? err.message : 'Email failed to send')
    } finally {
      setEmailSending(false)
    }
  }

  const handleSavePortal = () => saveReport(result)

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-950 border border-purple-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-600/40 ring-1 ring-purple-400/40">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Structural Engineer Scope Generator
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  STRUCTURAL AI
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Forensic report audit, State Farm policy alignment, causation analysis, and Xactimate structural items
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Claim Reference
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

          <MultiPageDropzone
            label={`Engineer Report Pages (${files.length})`}
            files={files}
            onAdd={(f) => { setFiles((prev) => [...prev, ...f]); setQualityWarning('') }}
            onRemove={(i) => { setFiles((prev) => prev.filter((_, idx) => idx !== i)); setQualityWarning('') }}
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {qualityWarning && <p className="text-amber-400 text-sm">{qualityWarning}</p>}

          <button onClick={handleAnalyze}
            disabled={loading || files.length === 0}
            className="w-full py-3 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing Engineering Report… ({elapsedSeconds}s)</>
            ) : (
              <><Shield className="w-4 h-4" /> Generate Aligned Scope ({files.length} pages)</>
            )}
          </button>
          {loading && (
            <p className="text-center text-xs text-zinc-500">
              Can take up to a minute or two — this is still working, not stuck.
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {parsed.hasTags && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-zinc-900 border-zinc-800 p-4">
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Engineering Firm</div>
                <div className="text-lg font-bold text-white mt-1">{parsed.summary.firm}</div>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800 p-4">
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Report Date</div>
                <div className="text-lg font-bold text-white mt-1">{parsed.summary.date}</div>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800 p-4">
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Primary Scope Findings</div>
                <div className="text-xs text-zinc-300 mt-1 truncate">{parsed.summary.findings}</div>
              </Card>
            </div>
          )}

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 max-w-max">
                  <button onClick={() => setActiveTab('policy')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'policy' ? 'bg-amber-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>
                    🛡️ Policy Alignment
                  </button>
                  {parsed.hasTags && (
                    <>
                      <button onClick={() => setActiveTab('scope')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'scope' ? 'bg-amber-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>
                        📊 Xactimate Scope
                      </button>
                      <button onClick={() => setActiveTab('note')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'note' ? 'bg-amber-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>
                        📝 File Note
                      </button>
                    </>
                  )}
                </div>

                <div className="flex gap-2 justify-end flex-wrap">
                  <button
                    onClick={handleEmail}
                    disabled={emailSending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/40 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                    title="Send full report to work email"
                  >
                    {emailSending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : emailSent ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Mail className="w-3.5 h-3.5 text-purple-400" />
                    )}
                    {emailSent ? 'Sent to Work!' : emailSending ? 'Sending…' : 'Email to Work'}
                  </button>
                  <button onClick={handleSavePortal} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-medium transition-colors">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                    {saved ? 'Saved!' : 'Save'}
                  </button>
                  <button
                    onClick={async () => {
                      const textToCopy =
                        activeTab === 'policy' ? parsed.policy :
                        activeTab === 'scope' ? parsed.scope : parsed.note
                      await navigator.clipboard.writeText(textToCopy)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied Tab!' : `Copy ${activeTab === 'policy' ? 'Alignment' : activeTab === 'scope' ? 'Scope' : 'Note'}`}
                  </button>
                </div>
              </div>
              {resultError && <p className="text-red-400 text-xs mt-2">{resultError}</p>}
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-zinc-200 prose prose-invert prose-base max-w-none prose-table:text-sm prose-headings:text-amber-400 prose-headings:mt-6 prose-headings:mb-3 prose-p:text-zinc-200 prose-li:text-zinc-200 prose-strong:text-white prose-td:border-zinc-700 prose-th:border-zinc-700 p-4">
                {activeTab === 'policy' && <ReactMarkdown>{parsed.policy}</ReactMarkdown>}
                {activeTab === 'scope' && <ReactMarkdown>{parsed.scope}</ReactMarkdown>}
                {activeTab === 'note' && (
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 font-mono text-xs text-zinc-100 whitespace-pre-wrap select-all">
                    {parsed.note}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
