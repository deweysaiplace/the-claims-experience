'use client'

import { useState, useEffect, useRef } from 'react'
import {
  FileText,
  MessageCircle,
  Send,
  Loader2,
  Copy,
  Check,
  Mic,
  MicOff,
  Upload,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds'
import { compressImages } from '@/lib/compress-image'
import { readJsonOrThrow } from '@/lib/upload'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'model'
  content: string
}

const QUICK_QUESTIONS = [
  'What are the 10x10 test square hail criteria on composition roofs?',
  'Does the 50% repair vs replace rule apply to this roof slope?',
  'What qualifies as PLH (Potential Large Hail) for inspection bypass?',
  'How do we differentiate accidental wind unsealing vs cold thermal failure?',
  'Are overhead and profit (O&P) warrantable on this claim scope?',
  'What are the notice requirements and time limits for supplemental items?',
]

const CARRIER_SOPS = [
  {
    title: 'Wind & Hail Inspection SOPs (10x10 Test Squares & PLH)',
    ref: 'OG 75-160 A',
    content: `• **Test Squares (Hail)**: Measure 10' x 10' (100 sq ft) sample area on each slope direction. Count damaged shingles (not individual tabs). Test squares are NOT used for wind claims.
• **Potential Large Hail (PLH) Workflow**: On-roof physical inspection may be bypassed for full replacement if Verisk hail is >= 2.25 inches AND collateral damage to exterior elevations is consistent with hail large enough to require roof replacement.
• **Unsealed Shingles**: Check for broken heat seals, tearing on underlying shingle, and residue transfer to establish accidental direct physical loss vs cold/wear.
• **Wood Roofs**: Hail damage requires a split that compromises watertight integrity and exposes fresh, light-colored wood. Weather splits show grey wood or inverted 'V'.`,
  },
  {
    title: 'Repair vs. Replace & Wear Factor SOPs (50% & 80% Rules)',
    ref: 'OG 75-160 B',
    content: `• **Composition Shingles (50% Rule)**: If repair cost approaches or exceeds 50% of the cost to remove and replace the damaged slope (walk-on 1-story base), determine whether to replace the slope.
• **Other Shingle/Shake Roofs (80% Rule)**: If repair cost approaches or exceeds 80% of the remove & replace cost, replace the slope.
• **Damage Repair Factors (Wear)**:
  - 0% to 50% worn = 1.0
  - 50% to 75% worn = 1.5
  - >75% worn = 2.0`,
  },
  {
    title: 'Interior Water, Freeze & Consequential Damage',
    ref: 'Claim Manual §4',
    content: `• **Water Ingress**: Accidental direct physical loss requires an exterior storm opening created by wind or hail (peril penetration) through which rain enters.
• **Freeze Claims**: Must verify reasonable heat was maintained in the dwelling or system was drained.
• **Overhead & Profit (O&P)**: Requires complexity involving three or more distinct construction trades and coordination by a general contractor.`,
  },
]

export default function PolicyChatPage() {
  const [policyText, setPolicyText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const elapsedSeconds = useElapsedSeconds(loading)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [sopExpanded, setSopExpanded] = useState<number | null>(null)
  const [showEscalationChecker, setShowEscalationChecker] = useState(false)

  // Escalation Checker state
  const [checkWind, setCheckWind] = useState(58)
  const [checkHail, setCheckHail] = useState(0.75)
  const [checkMethod, setCheckMethod] = useState('roof')
  const [escalationResult, setEscalationResult] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const micBaselineRef = useRef('')

  useEffect(() => {
    const SpeechAPI =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null
    if (!SpeechAPI) return
    const rec = new SpeechAPI()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (e: any) => {
      const finalChunks: string[] = []
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const chunk = e.results[i][0].transcript.trim()
          if (!chunk) continue
          const prev = finalChunks[finalChunks.length - 1]
          if (prev && chunk.toLowerCase().startsWith(prev.toLowerCase())) {
            finalChunks[finalChunks.length - 1] = chunk
          } else {
            finalChunks.push(chunk)
          }
        }
      }
      const sessionFinal = finalChunks.join(' ')
      if (sessionFinal) {
        const base = micBaselineRef.current
        setInput(base ? `${base} ${sessionFinal}`.trim() : sessionFinal)
      }
    }
    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)
    recognitionRef.current = rec
  }, [])

  const toggleMic = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
    } else {
      micBaselineRef.current = input
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    try {
      const doc = sessionStorage.getItem('policy_chat_doc')
      if (doc) {
        setPolicyText(doc)
        sessionStorage.removeItem('policy_chat_doc')
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [])

  const handleDocsSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setExtracting(true)
    setExtractError('')

    try {
      const files = Array.from(fileList)
      const images = files.filter((f) => f.type.startsWith('image/'))
      const pdfs = files.filter((f) => f.type === 'application/pdf')

      const compressed = images.length > 0 ? await compressImages(images) : []
      const form = new FormData()
      compressed.forEach((f) => form.append('files', f, f.name))
      pdfs.forEach((f) => form.append('files', f, f.name))

      const res = await fetch('/api/policy-chat/extract', {
        method: 'POST',
        body: form,
      })
      const data = (await readJsonOrThrow(res)) as { text?: string }
      if (!data.text) throw new Error('No text returned from document extraction')

      setPolicyText((prev) => (prev ? `${prev}\n\n---\n\n${data.text}` : data.text!))
    } catch (err: unknown) {
      setExtractError(err instanceof Error ? err.message : 'Failed to extract text from document')
    } finally {
      setExtracting(false)
    }
  }

  const handleSend = async (q: string) => {
    if (!q.trim() || loading) return

    setInput('')
    setError('')

    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const res = await fetch('/api/policy-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyText, question: q, history }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessages((prev) => [...prev, { role: 'model', content: data.answer }])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const handleCheckEscalation = () => {
    const reasons: string[] = []
    if (checkWind >= 58) {
      reasons.push('Wind speed is >= 58 mph (Severe Convective Wind trigger).')
    }
    if (checkHail >= 2.25) {
      reasons.push('Hail size is >= 2.25 in (PLH Potential Large Hail workflow applies).')
    }
    if (checkMethod === 'perimeter') {
      reasons.push('Perimeter/ladder-only inspection requires documented safety hazard and team leader signoff.')
    }

    if (reasons.length > 0) {
      setEscalationResult(`🚨 SUPERVISOR SIGNOFF REQUIRED (OG 75-160 II.L):\n• ` + reasons.join('\n• '))
    } else {
      setEscalationResult('✅ STANDARD ADJUSTER AUTHORITY: Within standard field handling guidelines. No automatic supervisor review trigger.')
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-950 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-600/40 ring-1 ring-indigo-400/40">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Carrier Policy Chat & SOP Engine
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  HW2130 & OG 75-160
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Instant SOP quick reference, escalation checker, and conversational policy copilot
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowEscalationChecker(!showEscalationChecker)}
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            {showEscalationChecker ? 'Hide Escalation Checker' : 'Supervisor Trigger Checker'}
          </button>
        </div>
      </div>

      {/* Escalation Trigger Checker Card (Collapsible) */}
      {showEscalationChecker && (
        <Card className="bg-slate-900/90 border-amber-500/40 shadow-xl backdrop-blur-xl">
          <CardHeader className="py-3 border-b border-slate-800">
            <CardTitle className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Management Review & Supervisor Signoff Checker (OG 75-160 A II.L)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Max Wind Speed (mph)</label>
                <input
                  type="number"
                  value={checkWind}
                  onChange={(e) => setCheckWind(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Estimated Hail Size (in)</label>
                <input
                  type="number"
                  step="0.25"
                  value={checkHail}
                  onChange={(e) => setCheckHail(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Inspection Workflow</label>
                <select
                  value={checkMethod}
                  onChange={(e) => setCheckMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="roof">Full Physical On-Roof</option>
                  <option value="perimeter">Perimeter / Ladder Only (Unsafe)</option>
                  <option value="plh">PLH Workflow (Hail &ge; 2.25&quot;)</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleCheckEscalation}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              Check Signoff Requirement
            </button>
            {escalationResult && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-medium text-slate-200 whitespace-pre-wrap mt-2">
                {escalationResult}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SOP Reference Accordions */}
      <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl">
        <CardHeader className="py-3.5 border-b border-slate-800">
          <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            Carrier SOP Quick Reference Library
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 space-y-2.5">
          {CARRIER_SOPS.map((sop, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden transition-all"
            >
              <button
                onClick={() => setSopExpanded(sopExpanded === idx ? null : idx)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">{sop.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                    {sop.ref}
                  </span>
                </div>
                {sopExpanded === idx ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {sopExpanded === idx && (
                <div className="p-3 border-t border-slate-800 text-xs text-slate-300 leading-relaxed bg-slate-950/80">
                  <div className="whitespace-pre-wrap">{sop.content}</div>
                  <button
                    onClick={() => handleSend(`Explain carrier SOP: ${sop.title} and how it applies to our estimate scope`)}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 text-[11px] font-semibold flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Ask AI Copilot About This SOP
                  </button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Main Grid: Document upload + Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Document text */}
        <div className="space-y-4">
          <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl">
            <CardHeader className="py-3 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Claim Policy / Endorsements
              </CardTitle>
              <button
                onClick={() => docInputRef.current?.click()}
                disabled={extracting}
                className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {extracting ? 'Reading...' : 'Upload Docs'}
              </button>
              <input
                ref={docInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleDocsSelected(e.target.files)
                  e.target.value = ''
                }}
              />
            </CardHeader>
            <CardContent className="p-3">
              {extractError && <p className="text-red-400 text-xs mb-2">{extractError}</p>}
              {policyText ? (
                <div className="max-h-72 overflow-y-auto pr-1">
                  <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
                    {policyText}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Optional: Upload declarations, endorsements, or paste policy excerpt. The master Claim Manual is always active.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Conversational Chat */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Questions */}
          {messages.length === 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Frequently Asked SOP Questions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-left text-xs text-slate-300 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="space-y-3 min-h-[250px] max-h-[500px] overflow-y-auto pr-1">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  'p-4 rounded-2xl text-xs sm:text-sm leading-relaxed border',
                  m.role === 'user'
                    ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-100 ml-8'
                    : 'bg-slate-900/90 border-slate-800 text-slate-200 mr-8 shadow-xl'
                )}
              >
                <div className="font-bold text-[11px] mb-1 text-slate-400 uppercase tracking-wider">
                  {m.role === 'user' ? 'You' : 'Policy Copilot'}
                </div>
                <div className="prose prose-invert max-w-none text-xs sm:text-sm">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs text-indigo-400 mr-8">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching policy & Claim Manual ({elapsedSeconds}s)...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Bar */}
          <div className="flex items-center gap-2 p-2 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl">
            <button
              onClick={toggleMic}
              className={cn(
                'p-2.5 rounded-xl transition-all',
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'text-slate-400 hover:text-white bg-slate-800'
              )}
              title={isListening ? 'Stop voice input' : 'Dictate question'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend(input)
              }}
              placeholder="Ask a policy, SOP, or endorsement question..."
              className="flex-1 bg-transparent px-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold disabled:opacity-50 transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
