'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Loader2, Copy, Mail, Check, X, FileText, Plus, Shield, FileSpreadsheet } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import { compressImages } from '@/lib/compress-image'
import { readJsonOrThrow } from '@/lib/upload'
import CameraCapture from '@/components/CameraCapture'
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds'
import { parseEngineerReport } from '@/lib/report-formatter'
import ScopeEditor from '@/components/xact/ScopeEditor'

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
  const [qeCopied, setQeCopied] = useState(false)
  const [noteCopied, setNoteCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'policy' | 'scope' | 'note'>('all')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resultError, setResultError] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

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
      saveReport(data.result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const parsedData = parseEngineerReport(result)

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
          address
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
            className="w-full py-3 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-900/30">
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
          {/* Executive Summary Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-zinc-900 border-zinc-800 p-3.5">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Engineering Firm</div>
              <div className="text-base font-bold text-white mt-1 truncate">{parsedData.summary.firm || 'N/A'}</div>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800 p-3.5">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Report Date</div>
              <div className="text-base font-bold text-white mt-1 truncate">{parsedData.summary.reportDate || 'N/A'}</div>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800 p-3.5">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Coverage Determination</div>
              <div className="mt-1">
                <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-black tracking-tight ${
                  parsedData.summary.coverageStatus === 'excluded' ? 'bg-red-950/80 text-red-400 border border-red-800/60' :
                  parsedData.summary.coverageStatus === 'limited' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60' :
                  parsedData.summary.coverageStatus === 'covered' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60' :
                  'bg-zinc-800 text-zinc-300 border border-zinc-700'
                }`}>
                  {parsedData.summary.coverageStatus === 'excluded' ? '🔴 EXCLUDED / DENIED' :
                   parsedData.summary.coverageStatus === 'limited' ? '🟡 LIMITED REPAIR' :
                   parsedData.summary.coverageStatus === 'covered' ? '🟢 COVERED DAMAGE' : '🛡️ AUDIT COMPLETE'}
                </span>
              </div>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800 p-3.5">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Audit Status</div>
              <div className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" /> Verified Clean
              </div>
            </Card>
          </div>

          <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Smart View Tabs */}
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 max-w-max flex-wrap gap-0.5">
                  <button onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${activeTab === 'all' ? 'bg-purple-700 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}>
                    🌟 Executive Audit
                  </button>
                  <button onClick={() => setActiveTab('policy')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'policy' ? 'bg-amber-700 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}>
                    🛡️ Policy Alignment
                  </button>
                  <button onClick={() => setActiveTab('scope')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'scope' ? 'bg-amber-700 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}>
                    📊 Xactimate Scope ({parsedData.scope.rows.length})
                  </button>
                  <button onClick={() => setActiveTab('note')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'note' ? 'bg-amber-700 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}>
                    📝 File Note
                  </button>
                </div>

                {/* Toolbar Actions */}
                <div className="flex gap-2 justify-end flex-wrap">
                  <button
                    onClick={handleEmail}
                    disabled={emailSending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/40 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                    title="Send executive HTML report to work email"
                  >
                    {emailSending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : emailSent ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Mail className="w-3.5 h-3.5 text-purple-400" />
                    )}
                    {emailSent ? 'Sent HTML Report!' : emailSending ? 'Sending…' : 'Email HTML Report'}
                  </button>
                  <button onClick={handleSavePortal} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-medium transition-colors">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                    {saved ? 'Saved!' : 'Save'}
                  </button>
                  <button
                    onClick={async () => {
                      const textToCopy = parsedData.cleanFullReport
                      await navigator.clipboard.writeText(textToCopy)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                    title="Copy full clean text without XML tags"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied Full Report!' : 'Copy Full Audit'}
                  </button>
                </div>
              </div>
              {resultError && <p className="text-red-400 text-xs mt-2">{resultError}</p>}
            </CardHeader>

            <CardContent className="pt-6 space-y-8">
              {/* Executive All-in-One Smart Audit View */}
              {(activeTab === 'all' || activeTab === 'policy') && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                    <Shield className="w-5 h-5 text-amber-400" />
                    <h2 className="text-base font-bold text-amber-400">Forensic Policy Alignment & Causation Analysis</h2>
                  </div>
                  <div className="text-zinc-200 prose prose-invert prose-base max-w-none prose-headings:text-amber-400 prose-headings:font-bold prose-headings:mt-6 prose-headings:mb-3 prose-p:text-zinc-200 prose-li:text-zinc-200 prose-strong:text-white p-2">
                    <ReactMarkdown>{parsedData.policy}</ReactMarkdown>
                  </div>
                </div>
              )}

              {(activeTab === 'all' || activeTab === 'scope') && (
                <div className="space-y-4 pt-4">
                  {parsedData.scope.rows.length > 0 ? (
                    <ScopeEditor initialRows={parsedData.scope.rows} />
                  ) : (
                    <div className="text-zinc-200 prose prose-invert prose-base max-w-none p-2">
                      <ReactMarkdown>{parsedData.scope.rawScope}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'all' || activeTab === 'note') && parsedData.fileNote && (
                <div className="space-y-3 pt-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-400" />
                      <h2 className="text-base font-bold text-emerald-400">Formal Claim System File Note</h2>
                    </div>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(parsedData.fileNote)
                        setNoteCopied(true)
                        setTimeout(() => setNoteCopied(false), 2000)
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
                    >
                      {noteCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                      {noteCopied ? 'Copied File Note!' : 'Copy File Note'}
                    </button>
                  </div>
                  <pre className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 font-mono text-xs text-zinc-100 whitespace-pre-wrap select-all leading-relaxed">
                    {parsedData.fileNote}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
