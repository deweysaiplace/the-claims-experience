'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Loader2, Copy, Mail, Check, FileText, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
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

export default function FieldNotesPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [note, setNote] = useState('')
  const [claimRef, setClaimRef] = useState('')
  const [address, setAddress] = useState('')
  const [adjusterName, setAdjusterName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const transcriptRef = useRef('')

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
      let final = ''
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' '
        } else {
          interim += event.results[i][0].transcript
        }
      }
      transcriptRef.current = final
      setTranscript(final + (interim ? `[${interim}]` : ''))
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech') setError(`Speech error: ${e.error}`)
      setIsRecording(false)
    }

    recognition.onend = () => {
      setTranscript(transcriptRef.current)
      setIsRecording(false)
    }

    recognitionRef.current = recognition
  }, [])

  const toggleRecording = () => {
    if (!recognitionRef.current) return
    if (isRecording) {
      recognitionRef.current.stop()
    } else {
      setError('')
      recognitionRef.current.start()
      setIsRecording(true)
    }
  }

  const handleGenerate = async () => {
    const text = transcriptRef.current || transcript
    if (!text.trim()) {
      setError('No transcript to process. Record or type your field notes first.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/field-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, claimRef, address, adjusterName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNote(data.note)
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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Mic className="w-6 h-6 text-blue-400" />
          Field Narratives
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Speak your raw inspection notes — Gemini formats them into a professional claim file narrative
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Claim Ref (last 4)</label>
                  <input
                    type="text"
                    value={claimRef}
                    onChange={(e) => setClaimRef(e.target.value)}
                    placeholder="e.g. 7842"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Adjuster Name</label>
                  <input
                    type="text"
                    value={adjusterName}
                    onChange={(e) => setAdjusterName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Property Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 412 Maple St"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
            </CardContent>
          </Card>

          {!speechSupported && (
            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 text-yellow-400 text-sm">
              Voice recording not supported in this browser. Type your notes below instead.
            </div>
          )}

          {speechSupported && (
            <button
              onClick={toggleRecording}
              className={`w-full py-5 rounded-xl font-semibold flex items-center justify-center gap-3 text-lg transition-all
                ${isRecording
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'}`}
            >
              {isRecording ? (
                <><MicOff className="w-6 h-6" /> Stop Recording</>
              ) : (
                <><Mic className="w-6 h-6" /> Start Recording</>
              )}
            </button>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {isRecording ? 'Live Transcript' : 'Transcript / Notes'}
              </label>
              {transcript && (
                <button onClick={() => { setTranscript(''); transcriptRef.current = '' }} className="text-slate-600 hover:text-red-400 text-xs flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <textarea
              value={transcript}
              onChange={(e) => { setTranscript(e.target.value); transcriptRef.current = e.target.value }}
              placeholder="Recording will appear here… or type your raw field notes manually."
              rows={8}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 resize-none font-mono"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={loading || !transcript.trim()}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating File Note…</>
            ) : (
              <><FileText className="w-4 h-4" /> Generate File Note</>
            )}
          </button>
        </div>

        <div>
          {note ? (
            <Card className="bg-slate-900 border-slate-800 h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base">Field Inspection Narrative</CardTitle>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleEmail}
                      disabled={emailSending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium"
                    >
                      {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : emailSent ? <Check className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                      {emailSent ? 'Sent!' : 'Email Note'}
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-200 prose-p:text-slate-300 prose-li:text-slate-300">
                  <ReactMarkdown>{note}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-slate-600">
              <FileText className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">Formatted file note will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
