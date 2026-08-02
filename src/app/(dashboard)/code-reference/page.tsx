'use client'

import { useState, useRef, useEffect } from 'react'
import { BookOpen, Send, Loader2, Trash2, Camera, ImagePlus, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import CameraCapture from '@/components/CameraCapture'
import { compressImages } from '@/lib/compress-image'

interface Message {
  role: 'user' | 'model'
  content: string
}

const QUICK_QUESTIONS = [
  'What is the standard code for detaching and resetting an aluminum awning?',
  'When does O&P apply on a State Farm claim?',
  'What is the difference between RFG LAY and RFG TRN?',
  'How do I code soft metal dents on box vents?',
  'What unit does carpet use in Xactimate?',
  'When is matching required for siding replacement?',
]

export default function CodeReferencePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

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
      if (attachedPhotos.length) {
        const prepared = await compressImages(attachedPhotos)
        prepared.forEach((p) => form.append('photos', p))
      }

      const res = await fetch('/api/code-reference', { method: 'POST', body: form })
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

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-400" />
          Code Reference
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Ask anything about Xactimate codes, scoping rules, O&P, coverage, or estimating best practices
        </p>
      </div>

      {messages.length === 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Quick questions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-left px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-white text-xs transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <Card className="bg-slate-900 border-slate-800 flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 py-12">
              <BookOpen className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">Your Xactimate expert is ready</p>
              <p className="text-xs mt-1">Ask about codes, scoping, O&P, coverage rules…</p>
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
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking it up…
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
          <div className="flex gap-2">
            <CameraCapture
              onCapture={(file) => setPhotos((prev) => [...prev, file])}
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
                if (e.target.files) setPhotos((prev) => [...prev, ...Array.from(e.target.files!)])
                e.target.value = ''
              }}
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="Ask about any Xactimate code, scoping rule, or coverage question…"
              disabled={loading}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 disabled:opacity-50"
            />
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
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
