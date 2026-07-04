'use client'

import { useState, useRef, useEffect } from 'react'
import { BookOpen, Send, Loader2, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'

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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return
    const q = question.trim()
    setInput('')
    setError('')

    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const res = await fetch('/api/code-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
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
          <div className="flex gap-2">
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
              disabled={loading || !input.trim()}
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
