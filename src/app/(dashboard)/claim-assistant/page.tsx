'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, Trash2, ImagePlus, X, Mic, MicOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import CameraCapture from '@/components/CameraCapture'
import { compressImages } from '@/lib/compress-image'
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds'

interface Message {
  role: 'user' | 'model'
  content: string
}

const STARTERS = [
  "I've got some inspection notes I want to think through before I write the scope.",
  'The insured sent an email pushing back on my estimate — help me think through a response.',
  "I'm not sure which exclusion actually applies here — let me describe the situation.",
  'Snip a photo of an email, text, or document and ask me about it.',
]

export default function ClaimAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const elapsedSeconds = useElapsedSeconds(loading)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Same fixed dictation pattern already proven on Policy Chat/Code Reference:
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
    // A photo with no typed question is a valid request on its own -- "here's
    // a screenshot, what does this mean" -- so fall back to a default
    // question instead of blocking send.
    const effectiveQuestion = q || 'What does this image show, and is there anything I should be thinking about here?'
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
      if (attachedPhotos.length) {
        // These are as likely to be a screenshot of an email/text as a photo
        // of physical damage, so keep color rather than assume grayscale is safe.
        const prepared = await compressImages(attachedPhotos, undefined, false)
        prepared.forEach((p) => form.append('photos', p))
      }

      const res = await fetch('/api/claim-assistant', { method: 'POST', body: form })

      if (!res.ok) {
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
      setMessages((prev) => [...prev, { role: 'model', content: data.answer }])
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
          <Sparkles className="w-6 h-6 text-amber-400" />
          Claim Assistant
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Your second pair of hands — notes, questions, a snipped email, anything claim related
        </p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-zinc-600 py-6">
              <Sparkles className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Ready when you are</p>
              <p className="text-xs mt-1 mb-5">Type, tap the mic, or attach a photo — pulls from the policy, Claim Manual, and Xactimate codes as needed</p>
              <div className="w-full">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Ideas to start with</p>
                <div className="grid grid-cols-1 gap-2">
                  {STARTERS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-left px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white text-xs transition-all"
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
                  ? 'bg-amber-700 text-white text-sm'
                  : 'bg-zinc-800 text-zinc-200 text-sm'
              }`}>
                {msg.role === 'model' ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:text-zinc-200 prose-p:text-zinc-300 prose-li:text-zinc-300 prose-code:text-amber-300 prose-code:bg-zinc-900 prose-code:px-1 prose-code:rounded">
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
              <div className="bg-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-2 text-zinc-400 text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {elapsedSeconds > 8 ? `Still working… (${elapsedSeconds}s, can take up to a minute or two)` : 'Thinking…'}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <CardContent className="border-t border-zinc-800 p-3">
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          {previews.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {previews.map((src, i) => (
                <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-zinc-700 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Attached ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0 right-0 p-1 bg-black/70 text-zinc-300 hover:text-red-400"
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
              past the right edge), same fix already applied on Code Reference. */}
          <div className="flex gap-2 mb-2">
            <CameraCapture
              onCapture={(file) => {
                if (/\.hei[cf]$/i.test(file.name) || /^image\/hei[cf]$/i.test(file.type)) {
                  setError('That photo came through as HEIC, which the AI can\'t read. Switch iPhone Settings → Camera → Formats to "Most Compatible", or try again — this button usually captures JPEG directly.')
                  return
                }
                setPhotos((prev) => [...prev, file])
              }}
              label=""
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            />
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              title="Attach photo or screenshot from library"
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
                  // iPhones save camera-roll photos/screenshots as HEIC by
                  // default -- same guard as Code Reference, see its comment
                  // for why this fails silently three steps downstream otherwise.
                  const heic = picked.filter((f) => /\.hei[cf]$/i.test(f.name) || /^image\/hei[cf]$/i.test(f.type))
                  const usable = picked.filter((f) => !heic.includes(f))
                  if (heic.length) {
                    setError(
                      `${heic.length} photo${heic.length > 1 ? 's' : ''} skipped — HEIC format isn't readable by the AI. ` +
                      `In iPhone Settings → Camera → Formats, switch to "Most Compatible" so new photos save as JPEG, ` +
                      `or use the camera button above to shoot directly in the app.`
                    )
                  }
                  if (usable.length) setPhotos((prev) => [...prev, ...usable])
                }
                e.target.value = ''
              }}
            />
            {recognitionRef.current && (
              <button
                onClick={toggleMic}
                title={isListening ? 'Stop listening' : 'Speak instead of typing'}
                className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${isListening ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white'}`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors ml-auto"
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
              placeholder={isListening ? 'Listening…' : 'Notes, a question, anything claim related…'}
              disabled={loading}
              className={`flex-1 bg-zinc-800 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors disabled:opacity-50 ${isListening ? 'border-red-500 placeholder-red-400' : 'border-zinc-700 focus:border-amber-600'}`}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || (!input.trim() && photos.length === 0)}
              className="p-2.5 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
