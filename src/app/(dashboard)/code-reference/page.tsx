'use client'

import { useState, useRef, useEffect } from 'react'
import { BookOpen, Send, Loader2, Trash2, ImagePlus, X, Mic, MicOff, MessageSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import CameraCapture from '@/components/CameraCapture'
import { compressImages } from '@/lib/compress-image'
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds'

interface Message {
  role: 'user' | 'model'
  content: string
}

type Mode = 'lookup' | 'consult'

const QUICK_QUESTIONS = [
  'What is the standard code for detaching and resetting an aluminum awning?',
  'When does O&P apply on a State Farm claim?',
  'What is the difference between RFG LAY and RFG TRN?',
  'How do I code soft metal dents on box vents?',
  'What unit does carpet use in Xactimate?',
  'When is matching required for siding replacement?',
]

const CONSULT_STARTERS = [
  "I'm at a property with wind damage to the roof and siding — walk me through what I should be scoping.",
  'Insured says the water damage is a few days old, but what I\'m seeing suggests longer-term — how should I approach this?',
  'Contractor wants a full roof replacement, but the damage looks localized — how do I evaluate whether matching applies?',
  "The insured is pushing back on my scope — help me think through what's actually defensible here.",
]

export default function CodeReferencePage() {
  const [mode, setMode] = useState<Mode>('lookup')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const elapsedSeconds = useElapsedSeconds(loading)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Same fixed dictation pattern already proven on Policy Chat/Field Notes:
  // rebuild from index 0 each time and replace (not append) a final chunk
  // that's just a fuller version of the last one -- see those pages for why.
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const micBaselineRef = useRef('')

  useEffect(() => {
    const SpeechAPI = typeof window !== 'undefined'
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

  const switchMode = (next: Mode) => {
    if (next === mode) return
    // Different system prompts per mode -- keeping cross-mode history around
    // would send the consult framing a lookup-mode answer, or vice versa.
    // Starting fresh avoids a confused mid-conversation context switch.
    setMode(next)
    setMessages([])
    setError('')
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const urls = photos.map((p) => URL.createObjectURL(p))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [photos])

  const sendMessage = async (question: string) => {
    const q = question.trim()
    if ((!q && photos.length === 0) || loading) return
    // A photo with no typed question is a valid request on its own -- "point
    // the camera at damage and ask what it is" -- so fall back to a default
    // question instead of blocking send.
    const effectiveQuestion = q || 'What is the standard Xactimate procedure and code for the damage shown in this photo?'
    const attachedPhotos = photos
    setInput('')
    setPhotos([])
    setError('')

    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, {
      role: 'user',
      content: effectiveQuestion + (attachedPhotos.length ? `\n\n_${attachedPhotos.length} photo${attachedPhotos.length > 1 ? 's' : ''} attached_` : ''),
    }])
    setLoading(true)

    try {
      const form = new FormData()
      form.append('question', effectiveQuestion)
      form.append('history', JSON.stringify(history))
      form.append('mode', mode)
      if (attachedPhotos.length) {
        const prepared = await compressImages(attachedPhotos)
        console.log(`[ClaimConsult] sending ${prepared.length}/${attachedPhotos.length} photo(s), ${prepared.reduce((sum, p) => sum + p.size, 0)}b total`)
        prepared.forEach((p) => form.append('photos', p))
      }

      const res = await fetch('/api/code-reference', { method: 'POST', body: form })

      if (!res.ok) {
        // A 413 (request too large -- several full-res photos at once) comes
        // back from Vercel's platform as plain text, not JSON. Calling
        // res.json() on that throws a cryptic parse error instead of naming
        // the real problem, so check status before assuming a JSON body.
        if (res.status === 413) {
          throw new Error('Photos too large to send together — try attaching 2-3 at a time.')
        }
        const contentType = res.headers.get('content-type') || ''
        const message = contentType.includes('application/json')
          ? (await res.json()).error
          : `Request failed (${res.status})`
        throw new Error(message || `Request failed (${res.status})`)
      }

      const data = await res.json()

      if (attachedPhotos.length && typeof data.photosReceived === 'number' && data.photosReceived < attachedPhotos.length) {
        const missing = attachedPhotos.length - data.photosReceived
        console.error(`[ClaimConsult] photo mismatch: sent ${attachedPhotos.length}, server received ${data.photosReceived}`)
        setMessages((prev) => [...prev, {
          role: 'model',
          content: `⚠️ ${missing} of ${attachedPhotos.length} photo${attachedPhotos.length > 1 ? 's' : ''} didn't make it to the AI — treat this answer as text-only.\n\n${data.answer}`,
        }])
      } else {
        setMessages((prev) => [...prev, { role: 'model', content: data.answer }])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-400" />
          Code Reference
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {mode === 'lookup'
            ? 'Ask anything about Xactimate codes, scoping rules, O&P, coverage, or estimating best practices'
            : 'Describe a live claim situation and think it through with a second opinion'}
        </p>
      </div>

      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 max-w-max mb-4">
        <button onClick={() => switchMode('lookup')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${mode === 'lookup' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
          <BookOpen className="w-3.5 h-3.5" /> Quick Lookup
        </button>
        <button onClick={() => switchMode('consult')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${mode === 'consult' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
          <MessageSquare className="w-3.5 h-3.5" /> Claim Consult
        </button>
      </div>

      <Card className="bg-slate-900 border-slate-800 flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            // Starter buttons live in here, inside the scrollable area, not
            // as a separate block above the card -- that competed with the
            // card for the page's fixed height budget and could push the
            // input row below (fixed max-h-[calc(100dvh-8rem)]) is 8rem too
            // short on a real phone here) the visible screen entirely.
            <div className="flex flex-col items-center text-slate-600 py-6">
              {mode === 'lookup' ? (
                <>
                  <BookOpen className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">Your Xactimate expert is ready</p>
                  <p className="text-xs mt-1 mb-5">Ask about codes, scoping, O&P, coverage rules…</p>
                </>
              ) : (
                <>
                  <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">Talk through a claim, live</p>
                  <p className="text-xs mt-1 mb-5">Type or tap the mic and describe what you're seeing…</p>
                </>
              )}
              <div className="w-full">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {mode === 'lookup' ? 'Quick questions' : 'Example scenarios'}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {(mode === 'lookup' ? QUICK_QUESTIONS : CONSULT_STARTERS).map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-left px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-white text-xs transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white text-sm'
                  : 'bg-slate-800 text-slate-200 text-sm'
              }`}>
                {msg.role === 'model' ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-200 prose-p:text-slate-300 prose-li:text-slate-300 prose-code:text-blue-300 prose-code:bg-slate-900 prose-code:px-1 prose-code:rounded">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {elapsedSeconds > 8 ? `Still working… (${elapsedSeconds}s, can take up to a minute or two)` : 'Looking it up…'}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <CardContent className="border-t border-slate-800 p-3">
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          {previews.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {previews.map((src, i) => (
                <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-700 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Attached ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0 right-0 p-1 bg-black/70 text-slate-300 hover:text-red-400"
                    title="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Attach/dictate row, separate from type-and-send below -- camera +
              gallery + mic + text + clear + send all in one row overflowed
              off-screen on a real phone (text input and send button pushed
              past the right edge). */}
          <div className="flex gap-2 mb-2">
            <CameraCapture
              onCapture={(file) => {
                console.log(`[ClaimConsult] camera capture -> ${file.name}, ${file.size}b, ${file.type}`)
                setPhotos((prev) => [...prev, file])
              }}
              label=""
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            />
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Attach photo from library"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  const picked = Array.from(e.target.files)
                  console.log(`[ClaimConsult] gallery select -> ${picked.length} file(s): ${picked.map((f) => `${f.name} (${f.size}b)`).join(', ')}`)
                  setPhotos((prev) => [...prev, ...picked])
                } else {
                  console.error('[ClaimConsult] gallery picker onChange fired with no files')
                }
                e.target.value = ''
              }}
            />
            {recognitionRef.current && (
              <button
                onClick={toggleMic}
                title={isListening ? 'Stop listening' : 'Speak instead of typing'}
                className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${isListening ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'}`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors ml-auto"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder={isListening ? 'Listening…' : mode === 'lookup' ? 'Ask about any Xactimate code, scoping rule, or coverage question…' : 'Describe what you\'re seeing, or tap the mic…'}
              disabled={loading}
              className={`flex-1 bg-slate-800 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors disabled:opacity-50 ${isListening ? 'border-red-500 placeholder-red-400' : 'border-slate-700 focus:border-blue-500'}`}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || (!input.trim() && photos.length === 0)}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
