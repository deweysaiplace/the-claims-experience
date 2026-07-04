'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ClipboardList, Loader2, ScanSearch, Info, Mic, Camera, FileText,
  RotateCcw, Sparkles, Upload, Search, Filter, Shield, Send,
} from 'lucide-react'
import XactPhotoUpload from '@/components/xact/PhotoUpload'
import XactVoiceRecorder from '@/components/xact/VoiceRecorder'
import XactResultsPanel from '@/components/xact/ResultsPanel'
import { getTotalCodeCount, getAllCategories, getCodesByCategory } from '@/lib/code-matcher'

interface AnalysisResult {
  observations: string
  materials: string[]
  damageTypes: string[]
  labels: string[]
  matchResult: {
    matched: {
      code: string
      description: string
      category: string
      unit: string
      confidence: 'high' | 'medium' | 'low'
      matchedOn: string[]
    }[]
    unmatched: { label: string; reason: string }[]
  }
  summary: string
}

type Tab = 'finder' | 'browse' | 'policy'
type FinderMode = 'multi' | 'quick'

const POLICY_QUICK_Qs = [
  'What are the coverage limits and deductibles?',
  'Are there exclusions for this type of damage?',
  'What documentation is required for this claim?',
  'Does this cover additional living expenses?',
]

export default function XactScopePage() {
  const [tab, setTab] = useState<Tab>('finder')
  const [finderMode, setFinderMode] = useState<FinderMode>('multi')

  // Finder — multi
  const [photos, setPhotos] = useState<File[]>([])
  const [notes, setNotes] = useState('')
  const [transcription, setTranscription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')

  // Finder — quick
  const [quickPhoto, setQuickPhoto] = useState<File | null>(null)
  const [quickItems, setQuickItems] = useState<any[]>([])
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickError, setQuickError] = useState('')

  // Browse
  const [browseQuery, setBrowseQuery] = useState('')
  const [browseCategory, setBrowseCategory] = useState('All')
  const [categories, setCategories] = useState<string[]>(['All'])

  // Policy
  const [policyText, setPolicyText] = useState('')
  const [policyMsgs, setPolicyMsgs] = useState<{ role: string; content: string }[]>([])
  const [policyInput, setPolicyInput] = useState('')
  const [policyLoading, setPolicyLoading] = useState(false)
  const [policyError, setPolicyError] = useState('')
  const policyBottomRef = useRef<HTMLDivElement>(null)

  let codeCount = 0
  try { codeCount = getTotalCodeCount() } catch {}

  useEffect(() => {
    try { setCategories(['All', ...getAllCategories()]) } catch {}
  }, [])

  useEffect(() => {
    policyBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [policyMsgs, policyLoading])

  // Load policy when tab first opens
  useEffect(() => {
    if (tab !== 'policy' || policyText) return
    fetch('/api/policy-chat/load-docs')
      .then(r => r.json())
      .then(d => { if (d.success && d.combinedText?.trim().length > 10) setPolicyText(d.combinedText) })
      .catch(() => {})
  }, [tab, policyText])

  const canAnalyze = photos.length > 0 || notes.trim() || transcription.trim()

  const handleAnalyze = async () => {
    if (!canAnalyze) return
    setLoading(true); setError(''); setResult(null)
    try {
      const fd = new FormData()
      photos.forEach(f => fd.append('images', f))
      fd.append('notes', notes)
      fd.append('transcription', transcription)
      const res = await fetch('/api/xact-analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
    } finally { setLoading(false) }
  }

  const handleReset = () => {
    setPhotos([]); setNotes(''); setTranscription(''); setResult(null); setError('')
  }

  const handleQuickAnalyze = async () => {
    if (!quickPhoto) return
    setQuickLoading(true); setQuickError(''); setQuickItems([])
    const form = new FormData()
    form.append('photo', quickPhoto)
    try {
      const res = await fetch('/api/xact-scope', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQuickItems(data.items)
    } catch (err: unknown) {
      setQuickError(err instanceof Error ? err.message : 'Analysis failed')
    } finally { setQuickLoading(false) }
  }

  const sendPolicyMsg = async (q: string) => {
    if (!q.trim() || policyLoading || !policyText) return
    setPolicyInput(''); setPolicyError('')
    const history = policyMsgs.map(m => ({ role: m.role, content: m.content }))
    setPolicyMsgs(prev => [...prev, { role: 'user', content: q }])
    setPolicyLoading(true)
    try {
      const res = await fetch('/api/policy-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyText, question: q, history }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPolicyMsgs(prev => [...prev, { role: 'model', content: data.answer }])
    } catch (err: unknown) {
      setPolicyError(err instanceof Error ? err.message : 'Request failed')
      setPolicyMsgs(prev => prev.slice(0, -1))
    } finally { setPolicyLoading(false) }
  }

  // Browse: derive visible codes
  let browseCodes: ReturnType<typeof getCodesByCategory> = []
  try {
    const pool = browseCategory === 'All'
      ? getAllCategories().flatMap(c => getCodesByCategory(c))
      : getCodesByCategory(browseCategory)
    const q = browseQuery.toLowerCase()
    browseCodes = q
      ? pool.filter(c =>
          c.code.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.keywords.some(k => k.includes(q))
        )
      : pool
  } catch {}

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-400" />
            Xact Scope
          </h1>
          <p className="text-slate-400 text-sm mt-1">Match codes, browse the full library, and check policy coverage.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
          <Info size={11} />
          <span>{codeCount.toLocaleString()} codes loaded</span>
        </div>
      </div>

      {/* Main tab bar */}
      <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700 p-1 rounded-xl w-fit">
        {([
          { id: 'finder' as Tab, label: 'Code Finder', icon: <ScanSearch size={14} /> },
          { id: 'browse' as Tab, label: 'Browse Codes', icon: <Search size={14} /> },
          { id: 'policy' as Tab, label: 'Policy Chat', icon: <Shield size={14} /> },
        ]).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ===== CODE FINDER ===== */}
      {tab === 'finder' && (
        <>
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl w-fit">
            <button
              onClick={() => setFinderMode('multi')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${finderMode === 'multi' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              <Sparkles size={12} /> Full AI Matcher <span className="opacity-60">GPT-4o</span>
            </button>
            <button
              onClick={() => setFinderMode('quick')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${finderMode === 'quick' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              <Camera size={12} /> Quick Scan <span className="opacity-60">Gemini Flash</span>
            </button>
          </div>

          {finderMode === 'multi' && (
            <div className={`grid gap-6 ${result ? 'lg:grid-cols-2' : ''}`}>
              <div className="space-y-5">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h2 className="font-semibold text-slate-200 mb-3 flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    Damage Photos <span className="text-xs text-slate-500 font-normal">(up to 5)</span>
                  </h2>
                  <XactPhotoUpload onPhotosChange={setPhotos} />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h2 className="font-semibold text-slate-200 mb-3 flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    <Mic size={13} className="text-slate-500" /> Voice Note <span className="text-xs text-slate-500 font-normal">(Whisper)</span>
                  </h2>
                  <XactVoiceRecorder onTranscription={setTranscription} />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h2 className="font-semibold text-slate-200 mb-3 flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                    <FileText size={13} className="text-slate-500" /> Typed Notes <span className="text-xs text-slate-500 font-normal">(optional)</span>
                  </h2>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Water damage on north wall drywall, approx 8x4 feet. Laminate flooring buckling near bathroom doorway. Some mold visible on baseboard..."
                    rows={4}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none transition-colors"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={!canAnalyze || loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 px-6 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-600/20"
                  >
                    {loading
                      ? <><Loader2 size={15} className="animate-spin" /> Analyzing...</>
                      : <><ScanSearch size={15} /> Analyze &amp; Match Codes</>}
                  </button>
                  {result && (
                    <button onClick={handleReset} className="px-4 py-3 border border-slate-700 text-slate-400 rounded-xl text-sm font-medium hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2">
                      <RotateCcw size={13} /> New
                    </button>
                  )}
                </div>
                {error && <div className="bg-red-600/10 border border-red-600/20 rounded-xl p-4 text-sm text-red-400"><strong>Error:</strong> {error}</div>}
                {!canAnalyze && !loading && <p className="text-center text-xs text-slate-600">Add at least one photo, voice note, or typed note to begin</p>}
              </div>
              {result && <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><XactResultsPanel result={result} /></div>}
            </div>
          )}

          {finderMode === 'quick' && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <p className="text-slate-400 text-xs">Drop a single damage photo — Gemini 2.0 Flash identifies materials and suggests Xactimate codes.</p>
                {quickPhoto ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(quickPhoto)} alt="Damage" className="w-full h-56 object-cover" />
                    <button onClick={() => { setQuickPhoto(null); setQuickItems([]) }} className="absolute top-2 right-2 p-1.5 bg-slate-900/80 rounded-lg text-slate-300 hover:text-white">✕</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-slate-600 rounded-xl bg-slate-800/60 hover:bg-slate-800 hover:border-slate-500 text-slate-300 hover:text-white text-sm font-semibold cursor-pointer transition-colors select-none">
                      <Camera className="w-7 h-7" />
                      Take Photo
                      <input type="file" accept="image/*" capture className="hidden" onChange={e => { if (e.target.files?.[0]) { setQuickPhoto(e.target.files[0]); setQuickItems([]) } }} />
                    </label>
                    <label className="flex flex-col items-center justify-center gap-2 py-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white text-sm font-medium cursor-pointer transition-colors select-none">
                      <Upload className="w-6 h-6" />
                      Choose Library
                      <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setQuickPhoto(e.target.files[0]); setQuickItems([]) } }} />
                    </label>
                  </div>
                )}
                {quickError && <p className="text-red-400 text-sm">{quickError}</p>}
                <button onClick={handleQuickAnalyze} disabled={quickLoading || !quickPhoto} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors">
                  {quickLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Identifying codes…</> : <><Camera className="w-4 h-4" /> Identify Xactimate Codes</>}
                </button>
              </div>
              <div className="space-y-3">
                {quickItems.length > 0 ? quickItems.map((item: any, idx: number) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-blue-400 font-mono font-bold text-sm">{item.suggested_category_code}</span>
                      <span className="text-slate-300 font-mono text-sm">{item.suggested_item_code}</span>
                      <span className="text-xs text-slate-500 border border-slate-700 rounded px-1">{item.unit_of_measurement}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${item.confidence === 'High' ? 'bg-green-600/20 text-green-400 border-green-600/30' : item.confidence === 'Medium' ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30' : 'bg-red-600/20 text-red-400 border-red-600/30'}`}>{item.confidence}</span>
                    </div>
                    <p className="text-white text-sm font-medium">{item.material_type}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{item.damage_description}</p>
                    <p className="text-slate-500 text-xs mt-1">Qty: <span className="text-slate-300">{item.estimated_quantity} {item.unit_of_measurement}</span></p>
                  </div>
                )) : !quickLoading ? (
                  <div className="text-center py-16 text-slate-600"><Camera className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Upload a photo to get quick code suggestions</p></div>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== BROWSE CODES ===== */}
      {tab === 'browse' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={browseQuery}
                onChange={e => setBrowseQuery(e.target.value)}
                placeholder="Search by code, description, or keyword…"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Filter size={14} className="text-slate-500" />
              <select
                value={browseCategory}
                onChange={e => setBrowseCategory(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-600 px-1">
            {browseCodes.length.toLocaleString()} code{browseCodes.length !== 1 ? 's' : ''}
            {browseQuery || browseCategory !== 'All' ? ' matching' : ' total'}
          </p>

          <div className="space-y-1 max-h-[62vh] overflow-y-auto pr-1">
            {browseCodes.slice(0, 200).map(c => (
              <div key={c.code} className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
                <span className="font-mono font-bold text-blue-400 text-sm w-36 flex-shrink-0">{c.code}</span>
                <span className="text-slate-300 text-sm flex-1 min-w-0 truncate">{c.description}</span>
                <span className="text-xs text-slate-600 border border-slate-800 rounded px-2 py-0.5 flex-shrink-0">{c.unit}</span>
                <span className="text-xs text-slate-600 hidden md:block flex-shrink-0 w-36 truncate text-right">{c.category}</span>
              </div>
            ))}
            {browseCodes.length > 200 && (
              <p className="text-center text-xs text-slate-600 py-3">Showing 200 of {browseCodes.length.toLocaleString()} — refine search to see more</p>
            )}
          </div>
        </div>
      )}

      {/* ===== POLICY CHAT ===== */}
      {tab === 'policy' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Policy doc panel */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <FileText size={14} /> Policy Document
            </h3>
            {policyText ? (
              <div className="max-h-72 overflow-y-auto">
                <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono leading-relaxed">
                  {policyText.slice(0, 3000)}{policyText.length > 3000 ? '\n…' : ''}
                </pre>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">No policy loaded. Paste text below or extract from Site Walkthroughs.</p>
                <textarea
                  value={policyText}
                  onChange={e => setPolicyText(e.target.value)}
                  placeholder="Paste policy text here…"
                  rows={10}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                />
              </div>
            )}
          </div>

          {/* Chat panel */}
          <div className="lg:col-span-2 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden" style={{ minHeight: 480 }}>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!policyText ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 py-16">
                  <Shield className="w-14 h-14 mb-3 opacity-20" />
                  <p className="text-sm">Load a policy document to start</p>
                  <p className="text-xs mt-1">Paste it in the panel on the left</p>
                </div>
              ) : policyMsgs.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Quick questions</p>
                  {POLICY_QUICK_Qs.map(q => (
                    <button key={q} onClick={() => sendPolicyMsg(q)} className="block w-full text-left px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white text-xs transition-all">{q}</button>
                  ))}
                </div>
              ) : policyMsgs.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {policyLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2 text-slate-400 text-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing policy…
                  </div>
                </div>
              )}
              <div ref={policyBottomRef} />
            </div>

            <div className="border-t border-slate-800 p-4">
              {policyError && <p className="text-red-400 text-xs mb-2">{policyError}</p>}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={policyInput}
                  onChange={e => setPolicyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendPolicyMsg(policyInput)}
                  placeholder="Ask about coverage, limits, exclusions, or claim procedures…"
                  disabled={policyLoading || !policyText}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <button
                  onClick={() => sendPolicyMsg(policyInput)}
                  disabled={policyLoading || !policyInput.trim() || !policyText}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-slate-600 border-t border-slate-800/60 pt-4">
        No data is stored. Codes matched only from your extracted dataset.
      </p>
    </div>
  )
}
