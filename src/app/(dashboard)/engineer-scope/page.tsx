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

const WORKER_API = process.env.NEXT_PUBLIC_WORKER_API_URL || 'https://claims-worker.hijasond.workers.dev'

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
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</div>

      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 mb-2">
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

      <div className="flex gap-1.5">
        <div {...getRootProps()}
          className={`flex-1 border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-center
            ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900'}
            ${files.length > 0 ? 'py-2' : 'py-6'}`}>
          <input {...getInputProps()} />
          {files.length === 0 ? (
            <>
              <Upload className="w-6 h-6 text-slate-600 mb-1" />
              <p className="text-slate-400 text-xs">Drop engineer report photos/PDF</p>
              <p className="text-slate-600 text-[10px] mt-0.5">Multi-page supported</p>
            </>
          ) : (
            <span className="text-slate-400 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Add pages</span>
          )}
        </div>
        <CameraCapture
          onCapture={(file) => onAdd([file])}
          label=""
          className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors flex items-center cursor-pointer select-none"
        />
      </div>
    </div>
  )
}

export default function EngineerScopePage() {
  const [files, setFiles] = useState<File[]>([])
  const [claimRef, setClaimRef] = useState('')
  const [address, setAddress] = useState('')
  const [insuredLastName, setInsuredLastName] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const elapsedSeconds = useElapsedSeconds(loading)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'policy' | 'scope' | 'note'>('policy')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Separate from the top-level `error` state above the Analyze button --
  // on a phone that's off-screen once you're looking at results, so a real
  // save failure there was invisible. Same bug already found and fixed on
  // field-scope, field-notes and reconciler.
  const [resultError, setResultError] = useState('')

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
          adjusterName: insuredLastName || null,
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
    setLoading(true)
    setError('')
    setResult('')

    try {
      const prepared = await compressImages(files)
      const form = new FormData()
      prepared.forEach((f) => form.append('report', f))
      form.append('claimRef', claimRef)
      form.append('address', address)

      const apiUrl = `${WORKER_API}/engineer-scope`
      const res = await fetch(apiUrl, { method: 'POST', body: form })
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

  const handleSavePortal = () => saveReport(result)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          Engineer Scope Generator
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Upload expert engineer report — Automatically extracts structural findings, checks State Farm policy limits, and outputs Xactimate items.
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Claim Reference
              </label>
              <input type="text" value={claimRef} onChange={(e) => setClaimRef(e.target.value)} placeholder="e.g. 7842"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Insured Last Name
              </label>
              <input type="text" value={insuredLastName} onChange={(e) => setInsuredLastName(e.target.value)} placeholder="e.g. Smith"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Property Address
              </label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 412 Maple St"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500" />
            </div>
          </div>

          <MultiPageDropzone
            label={`Engineer Report Pages (${files.length})`}
            files={files}
            onAdd={(f) => setFiles((prev) => [...prev, ...f])}
            onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={handleAnalyze}
            disabled={loading || files.length === 0}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing Engineering Report… ({elapsedSeconds}s)</>
            ) : (
              <><Shield className="w-4 h-4" /> Generate Aligned Scope ({files.length} pages)</>
            )}
          </button>
          {loading && (
            <p className="text-center text-xs text-slate-500">
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
              <Card className="bg-slate-900 border-slate-800 p-4">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Engineering Firm</div>
                <div className="text-lg font-bold text-white mt-1">{parsed.summary.firm}</div>
              </Card>
              <Card className="bg-slate-900 border-slate-800 p-4">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Report Date</div>
                <div className="text-lg font-bold text-white mt-1">{parsed.summary.date}</div>
              </Card>
              <Card className="bg-slate-900 border-slate-800 p-4">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Primary Scope Findings</div>
                <div className="text-xs text-slate-300 mt-1 truncate">{parsed.summary.findings}</div>
              </Card>
            </div>
          )}

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 max-w-max">
                  <button onClick={() => setActiveTab('policy')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'policy' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                    🛡️ Policy Alignment
                  </button>
                  {parsed.hasTags && (
                    <>
                      <button onClick={() => setActiveTab('scope')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'scope' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                        📊 Xactimate Scope
                      </button>
                      <button onClick={() => setActiveTab('note')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'note' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                        📝 File Note
                      </button>
                    </>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied Tab!' : `Copy ${activeTab === 'policy' ? 'Alignment' : activeTab === 'scope' ? 'Scope' : 'Note'}`}
                  </button>
                </div>
              </div>
              {resultError && <p className="text-red-400 text-xs mt-2">{resultError}</p>}
            </CardHeader>
            <CardContent className="pt-4">
              <div className="prose prose-invert prose-sm max-w-none prose-table:text-xs prose-headings:text-slate-200 prose-p:text-slate-300 prose-li:text-slate-300">
                {activeTab === 'policy' && <ReactMarkdown>{parsed.policy}</ReactMarkdown>}
                {activeTab === 'scope' && <ReactMarkdown>{parsed.scope}</ReactMarkdown>}
                {activeTab === 'note' && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-100 whitespace-pre-wrap select-all">
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
