'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Loader2, Copy, Mail, Check, FileText, Trash2, Plus, X, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import { readJsonOrThrow } from '@/lib/upload'
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition
    webkitSpeechRecognition: new () => ISpeechRecognition
  }
}

type LocationItem = { id: string; name: string; transcript: string }

const PRESET_LOCATIONS = ['Exterior North', 'Exterior South', 'Roof', 'Kitchen', 'Master Bedroom', 'Living Room']

export default function FieldNotesPage() {
  const [isRecording, setIsRecording] = useState(false)
  
  const [locations, setLocations] = useState<LocationItem[]>([{ id: '1', name: 'General Notes', transcript: '' }])
  const [activeLocationId, setActiveLocationId] = useState('1')
  const [newLocationName, setNewLocationName] = useState('')
  
  const [sessionTranscript, setSessionTranscript] = useState('')
  const sessionTranscriptRef = useRef('')

  const [claimRef, setClaimRef] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const elapsedSeconds = useElapsedSeconds(loading)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [note, setNote] = useState('')

  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const activeLocRef = useRef('1')
  // The browser ends recognition after a few seconds of silence and does not
  // expose that timer. This tracks whether the user actually pressed stop, so
  // onend can restart and a thinking pause doesn't end the recording.
  const shouldListenRef = useRef(false)
  // On this device, isFinal results aren't disjoint chunks -- the SAME result
  // keeps getting re-finalized with the sentence-so-far each time a new word
  // lands ("there" -> "there once" -> "there once was" ...), each marked
  // final. Appending each one produced "there there once there once was".
  // Fix: never append incrementally. Each onresult, rebuild the CURRENT
  // session's final text fresh from the complete result set (index 0 up),
  // and replace -- don't add to -- whatever this session contributed so far.
  // preSessionTranscriptRef is what existed before this recording session
  // (typed text, or earlier sessions); a genuine start() always resets
  // event.results, so that boundary is reliable even though isFinal isn't.
  const preSessionTranscriptRef = useRef('')
  // Mirrors `combined` from the latest onresult. onend is a stable closure
  // from mount (empty-deps useEffect), so it can't read fresh component state
  // -- this ref is how it knows the real baseline to restart from.
  const lastCommittedRef = useRef('')
  
  useEffect(() => {
    activeLocRef.current = activeLocationId
  }, [activeLocationId])

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setSpeechSupported(false)
      return
    }

    const recognition: ISpeechRecognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Rebuild from index 0 every time -- not from event.resultIndex, and not
      // appended to what we had. See preSessionTranscriptRef comment above.
      //
      // On this device, each new final result isn't the same index being
      // revised -- it's a NEW index whose transcript already contains the
      // whole utterance so far ("I" / "I was" / "I was going" ...). Naively
      // concatenating every final entry duplicates the growing prefix. Fix:
      // when a final chunk starts with the previous chunk, it's a fuller
      // version of the same utterance -- replace, don't append.
      const finalChunks: string[] = []
      let currentInterim = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const chunk = event.results[i][0].transcript.trim()
          if (!chunk) continue
          const prev = finalChunks[finalChunks.length - 1]
          if (prev && chunk.toLowerCase().startsWith(prev.toLowerCase())) {
            finalChunks[finalChunks.length - 1] = chunk
          } else {
            finalChunks.push(chunk)
          }
        } else {
          currentInterim += event.results[i][0].transcript
        }
      }

      const combined = (preSessionTranscriptRef.current + ' ' + finalChunks.join(' ')).trim()
      lastCommittedRef.current = combined
      setLocations(prev => prev.map(loc =>
        loc.id === activeLocRef.current ? { ...loc, transcript: combined } : loc
      ))

      setSessionTranscript(currentInterim ? `[${currentInterim}]` : '')
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      // A pause raises 'no-speech'. Ignore it — onend restarts us.
      if (e.error === 'no-speech') return
      // 'aborted' fires on a normal stop() and isn't worth surfacing.
      if (e.error !== 'aborted') setError(`Speech error: ${e.error}`)
      shouldListenRef.current = false
      setIsRecording(false)
    }

    recognition.onend = () => {
      if (shouldListenRef.current) {
        // Browser stopped on silence, not the user. A real start() resets
        // event.results, so the next session must carry forward everything
        // committed so far as its new pre-session baseline.
        preSessionTranscriptRef.current = lastCommittedRef.current
        try {
          recognition.start()
          return
        } catch {
          // start() throws if it's somehow already running; fall through to stop.
        }
      }
      setIsRecording(false)
      setSessionTranscript('')
      sessionTranscriptRef.current = ''
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
      setSessionTranscript('')
      sessionTranscriptRef.current = ''
      // Whatever's already in the active location (typed text, or an earlier
      // session) is the baseline new speech gets appended onto.
      const existing = locations.find(l => l.id === activeLocationId)?.transcript ?? ''
      preSessionTranscriptRef.current = existing
      lastCommittedRef.current = existing
      shouldListenRef.current = true
      recognitionRef.current.start()
      setIsRecording(true)
    }
  }

  const handleGenerate = async () => {
    const hasAnyText = locations.some(l => l.transcript.trim() || (l.id === activeLocationId && sessionTranscript.trim()))
    if (!hasAnyText) {
      setError('No transcripts to process. Record or type your field notes first.')
      return
    }
    setLoading(true)
    setError('')

    const payloadLocations = locations.filter(loc => loc.transcript.trim().length > 0)

    try {
      const res = await fetch('/api/field-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: payloadLocations, claimRef, address }),
      })
      const data = await readJsonOrThrow(res)
      setNote(data.note)
      // Save immediately rather than waiting on a manual click -- this is the
      // fix for "I generated the note and it never showed up in Portal".
      // The Save button stays for re-saving after edits.
      saveReport(data.note)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(note)
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
          subject: `Field Inspection Note${claimRef ? ` — Claim ${claimRef}` : ''}${address ? ` — ${address}` : ''}`,
          body: note,
          claimRef,
        }),
      })
      await readJsonOrThrow(res)
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch (err: unknown) {
      // The route already says what's actually wrong. Show that rather than a
      // canned guess pointing at .env.local, which production doesn't read.
      // resultError, not error: this button is next to the generated note,
      // and error sits above Generate, off-screen on a phone by now.
      setResultError(err instanceof Error ? err.message : 'Email failed')
    } finally {
      setEmailSending(false)
    }
  }

  const addLocation = (name: string) => {
    if (!name.trim()) return
    const newLoc = { id: Date.now().toString(), name: name.trim(), transcript: '' }
    setLocations([...locations, newLoc])
    setNewLocationName('')
    // Switch to new location
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setActiveLocationId(newLoc.id)
  }
  
  const removeLocation = (id: string) => {
    setLocations(locations.filter(l => l.id !== id))
    if (activeLocationId === id && locations.length > 1) {
      setActiveLocationId(locations.find(l => l.id !== id)!.id)
    }
  }

  const activeLocation = locations.find(l => l.id === activeLocationId)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Separate from the top-level `error` state above the Generate button --
  // on a phone that's off-screen once you're looking at the generated note,
  // so a real save failure there was invisible.
  const [resultError, setResultError] = useState('')

  // Takes content explicitly so the auto-save right after generation can
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
          type: 'field-note'
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

  const handleSavePortal = () => saveReport(note)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Mic className="w-6 h-6 text-amber-400" />
          Field Narratives
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Create location tags, speak your raw inspection notes, and let AI format them into a room-by-room claim narrative
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">Claim Ref (last 4)</label>
                <input
                  type="text"
                  value={claimRef}
                  onChange={(e) => setClaimRef(e.target.value)}
                  placeholder="e.g. 7842"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-600"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">Property Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 412 Maple St"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-600"
                />
              </div>
            </CardContent>
          </Card>

          {/* Locations Section */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Location Tags</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {locations.map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => {
                        if (isRecording) toggleRecording()
                        setActiveLocationId(loc.id)
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                        activeLocationId === loc.id 
                          ? 'bg-amber-700 border-amber-600 text-white shadow-lg shadow-amber-600/20' 
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {loc.name}
                      {locations.length > 1 && (
                        <div 
                          onClick={(e) => { e.stopPropagation(); removeLocation(loc.id) }}
                          className="ml-1 p-0.5 rounded-full hover:bg-black/20 text-zinc-400 hover:text-white transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Add new location */}
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="flex bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden flex-1 min-w-[150px]">
                    <input
                      type="text"
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addLocation(newLocationName)}
                      placeholder="Add custom location..."
                      className="w-full bg-transparent px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none"
                    />
                    <button onClick={() => addLocation(newLocationName)} className="px-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-zinc-500 flex gap-2 flex-wrap">
                    {PRESET_LOCATIONS.filter(p => !locations.find(l => l.name === p)).map(preset => (
                      <button key={preset} onClick={() => addLocation(preset)} className="hover:text-amber-400 transition-colors">
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {!speechSupported && (
            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 text-yellow-400 text-sm">
              Voice recording not supported in this browser. Type your notes below instead.
            </div>
          )}

          {speechSupported && activeLocation && (
            <button
              onClick={toggleRecording}
              className={`w-full py-5 rounded-xl font-semibold flex items-center justify-center gap-3 text-lg transition-all
                ${isRecording
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 shadow-lg'}`}
            >
              {isRecording ? (
                <><MicOff className="w-6 h-6" /> Stop Recording ({activeLocation.name})</>
              ) : (
                <><Mic className="w-6 h-6" /> Dictate for {activeLocation.name}</>
              )}
            </button>
          )}

          {activeLocation && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {isRecording ? `Live Transcript: ${activeLocation.name}` : `Transcript: ${activeLocation.name}`}
                </label>
                {(activeLocation.transcript || sessionTranscript) && (
                  <button 
                    onClick={() => { 
                      setLocations(prev => prev.map(l => l.id === activeLocationId ? { ...l, transcript: '' } : l))
                      if (isRecording) toggleRecording()
                      setSessionTranscript('')
                      sessionTranscriptRef.current = ''
                    }} 
                    className="text-zinc-600 hover:text-red-400 text-xs flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <textarea
                value={activeLocation.transcript + (isRecording && sessionTranscript ? (activeLocation.transcript ? ' ' : '') + sessionTranscript : '')}
                onChange={(e) => { 
                  const val = e.target.value
                  setLocations(prev => prev.map(l => l.id === activeLocationId ? { ...l, transcript: val } : l)) 
                }}
                placeholder={`Recording will appear here… or type your raw notes for ${activeLocation.name} manually.`}
                rows={6}
                disabled={isRecording}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-600 resize-none font-mono disabled:opacity-70"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors mt-6"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating File Note… ({elapsedSeconds}s)</>
            ) : (
              <><FileText className="w-4 h-4" /> Generate File Note ({locations.length} Locations)</>
            )}
          </button>
          {loading && (
            <p className="text-center text-xs text-zinc-500 mt-2">
              Can take up to a minute or two — this is still working, not stuck.
            </p>
          )}
        </div>

        <div>
          {note ? (
            <Card className="bg-zinc-900 border-zinc-800 h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base">Field Inspection Narrative</CardTitle>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      onClick={handleSavePortal}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-medium transition-colors"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                      {saved ? 'Saved!' : 'Save to Portal'}
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleEmail}
                      disabled={emailSending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-medium"
                    >
                      {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : emailSent ? <Check className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                      {emailSent ? 'Sent!' : 'Email'}
                    </button>
                  </div>
                </div>
                {resultError && <p className="text-red-400 text-xs mt-2">{resultError}</p>}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-zinc-200 prose prose-invert prose-base max-w-none prose-table:text-sm prose-headings:text-amber-400 prose-headings:mt-6 prose-headings:mb-3 prose-p:text-zinc-200 prose-li:text-zinc-200 prose-strong:text-white prose-td:border-zinc-700 prose-th:border-zinc-700 p-4">
                  <ReactMarkdown>{note}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-zinc-600 bg-zinc-900/50 rounded-2xl border border-zinc-800 border-dashed">
              <FileText className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">Formatted file note will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
