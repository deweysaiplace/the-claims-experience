'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Camera, Mic, MicOff, Upload, Loader2, Copy, Mail, Check,
  FileImage, X, Crosshair, Trash2, Plus, FileText, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'



const CAUSE_OPTIONS = [
  'Wind / Hail',
  'Water / Plumbing',
  'Fire / Smoke',
  'Lightning',
  'Tree / Impact',
  'Theft / Vandalism',
  'Other',
]

export default function FieldScopePage() {
  // Claim context
  const [claimRef, setClaimRef] = useState('')
  const [address, setAddress] = useState('')
  const [adjusterName, setAdjusterName] = useState('')
  const [causeOfLoss, setCauseOfLoss] = useState('')

  // Photos
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  useEffect(() => {
    const urls = photos.map((p) => URL.createObjectURL(p))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [photos])

  // Voice
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [speechSupported, setSpeechSupported] = useState(true)
  const recognitionRef = useRef<any | null>(null)
  const transcriptRef = useRef('')

  // Results
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [provider, setProvider] = useState('')

  // UI
  const [contextOpen, setContextOpen] = useState(true)

  const previousTranscriptRef = useRef('')
  // The browser ends recognition after a few seconds of silence and does not
  // expose that timer. This tracks whether the user actually pressed stop, so
  // onend can restart and a thinking pause doesn't end the recording.
  const shouldListenRef = useRef(false)

  // Speech recognition setup
  useEffect(() => {
    const SpeechAPI = typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null
    if (!SpeechAPI) {
      setSpeechSupported(false)
      return
    }
    const recognition = new SpeechAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' '
        } else {
          interim += event.results[i][0].transcript
        }
      }
      
      const prev = previousTranscriptRef.current ? previousTranscriptRef.current.trim() + '\n' : ''
      const newFullText = prev + final
      
      transcriptRef.current = newFullText
      setTranscript(newFullText + (interim ? ` [${interim}]` : ''))
    }
    recognition.onerror = (e: any) => {
      // A pause raises 'no-speech'. Ignore it — onend restarts us.
      if (e.error === 'no-speech') return
      // 'aborted' fires on a normal stop() and isn't worth surfacing.
      if (e.error !== 'aborted') setError(`Speech error: ${e.error}`)
      shouldListenRef.current = false
      setIsRecording(false)
    }
    recognition.onend = () => {
      if (shouldListenRef.current) {
        // Browser stopped on silence, not the user. onresult rebuilds from
        // previousTranscriptRef, so carry what we have forward or the next
        // segment overwrites it.
        previousTranscriptRef.current = transcriptRef.current
        try {
          recognition.start()
          return
        } catch {
          // start() throws if it's somehow already running; fall through to stop.
        }
      }
      setTranscript(transcriptRef.current)
      setIsRecording(false)
    }
    recognitionRef.current = recognition
  }, [])

  const toggleRecording = () => {
    if (!recognitionRef.current) return
    if (isRecording) {
      shouldListenRef.current = false
      recognitionRef.current.stop()
    } else {
      setError('')
      previousTranscriptRef.current = transcript // Save whatever is currently typed
      shouldListenRef.current = true
      recognitionRef.current.start()
      setIsRecording(true)
    }
  }

  // Photo handling
  const onDrop = useCallback((accepted: File[]) => {
    setPhotos((prev) => [...prev, ...accepted])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    multiple: true,
  })

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  // Camera capture
  const onCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setPhotos((prev) => [...prev, ...Array.from(files)])
    e.target.value = ''
  }

  // Submit
  const handleAnalyze = async () => {
    if (photos.length === 0 && !transcript.trim()) {
      setError('Add at least one photo or record voice notes.')
      return
    }
    setLoading(true)
    setError('')
    setResult('')

    const form = new FormData()
    photos.forEach((p) => form.append('photos', p))
    form.append('transcript', transcriptRef.current || transcript)
    form.append('claimRef', claimRef)
    form.append('address', address)
    form.append('adjusterName', adjusterName)
    form.append('causeOfLoss', causeOfLoss)

    try {
      const res = await fetch('/api/field-scope', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.result)
      setProvider(data.provider)
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
          subject: `Field Scope Report${claimRef ? ` — Claim ${claimRef}` : ''}${address ? ` — ${address}` : ''}`,
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

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSavePortal = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimRef,
          address,
          adjusterName,
          content: result,
          type: 'field-scope'
        })
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save report to portal')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Crosshair className="w-6 h-6 text-emerald-400" />
          Field Scope
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Capture photos + voice notes → AI generates damage assessment, Xactimate line items, and field narrative
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* LEFT: Inputs (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Claim Context — Collapsible */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-0 cursor-pointer" onClick={() => setContextOpen(!contextOpen)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm">Claim Context</CardTitle>
                {contextOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </div>
            </CardHeader>
            {contextOpen && (
              <CardContent className="pt-3 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Claim Ref</label>
                    <input type="text" value={claimRef} onChange={(e) => setClaimRef(e.target.value)} placeholder="e.g. 7842"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Adjuster</label>
                    <input type="text" value={adjusterName} onChange={(e) => setAdjusterName(e.target.value)} placeholder="Your name"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Property Address</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 412 Maple St, Neptune NJ"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Cause of Loss</label>
                  <div className="flex flex-wrap gap-2">
                    {CAUSE_OPTIONS.map((c) => (
                      <button key={c} onClick={() => setCauseOfLoss(c)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${causeOfLoss === c ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Photo Capture */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                Damage Photos ({photos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Photo grid */}
              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {photos.map((photo, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden border border-slate-700 group aspect-square">
                      <img src={previews[i]} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 p-1 bg-black/70 rounded-md text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-0.5 text-[10px] text-slate-300">
                        #{i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add photos buttons */}
              <div className="flex gap-2">
                {/* CAMERA — implicit label, input nested inside */}
                <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm cursor-pointer transition-colors select-none">
                  <Camera className="w-4 h-4" /> Take Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={onCameraCapture}
                  />
                </label>
                <div {...getRootProps()}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-semibold cursor-pointer transition-all
                    ${isDragActive ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}>
                  <input {...getInputProps()} />
                  <Upload className="w-4 h-4" /> Upload
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Voice Notes */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-400" />
                Voice Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {speechSupported && (
                <button onClick={toggleRecording}
                  className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
                    ${isRecording
                      ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}>
                  {isRecording ? <><MicOff className="w-5 h-5" /> Stop Recording</> : <><Mic className="w-5 h-5" /> Record Field Notes</>}
                </button>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {isRecording ? 'Live Transcript' : 'Transcript / Notes'}
                  </label>
                  {transcript && (
                    <button onClick={() => { setTranscript(''); transcriptRef.current = '' }}
                      className="text-slate-600 hover:text-red-400 text-xs flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
                <textarea value={transcript}
                  onChange={(e) => { setTranscript(e.target.value); transcriptRef.current = e.target.value }}
                  placeholder="Walk the property and describe what you see… or type notes here."
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 resize-none font-mono" />
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Submit */}
          <button onClick={handleAnalyze} disabled={loading || (photos.length === 0 && !transcript.trim())}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center gap-2 transition-colors text-lg">
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing with AI…</>
            ) : (
              <><Crosshair className="w-5 h-5" /> Run Field Scope Analysis</>
            )}
          </button>
        </div>

        {/* RIGHT: Results (2 cols) */}
        <div className="lg:col-span-2">
          {result ? (
            <Card className="bg-slate-900 border-slate-800 sticky top-6">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm">
                    Scope Results
                    {provider && <span className="ml-2 text-xs text-slate-500 font-normal">via {provider}</span>}
                  </CardTitle>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    <button onClick={handleSavePortal} disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-medium transition-colors">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                      {saved ? 'Saved!' : 'Save'}
                    </button>
                    <button onClick={handleCopy}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium">
                      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={handleEmail} disabled={emailSending}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium">
                      {emailSending ? <Loader2 className="w-3 h-3 animate-spin" /> : emailSent ? <Check className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                      {emailSent ? 'Sent!' : 'Email'}
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="text-slate-200 prose prose-invert prose-base max-w-none prose-table:text-sm prose-headings:text-emerald-400 prose-headings:mt-6 prose-headings:mb-3 prose-p:text-slate-200 prose-li:text-slate-200 prose-strong:text-white prose-td:border-slate-700 prose-th:border-slate-700 p-4">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-600 lg:sticky lg:top-6">
              <Crosshair className="w-16 h-16 mb-4 opacity-15" />
              <p className="text-sm text-center">Take photos & record notes,<br />then run analysis</p>
              <p className="text-xs text-slate-700 mt-2">AI will generate line items + narrative</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
