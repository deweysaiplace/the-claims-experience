'use client'

import { useState, useEffect, useRef } from 'react'
import { FileText, MessageCircle, Send, Loader2, Copy, Check, Mic, MicOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'model'
  content: string
}

const QUICK_QUESTIONS = [
  'What are the coverage limits and deductibles?',
  'Are there any exclusions for this type of damage?',
  'What documentation is required for this claim?',
  'Does this policy cover additional living expenses?',
  'What are the notice requirements and time limits?',
  'Analyze this estimate for reasonableness',
]

export default function PolicyChatPage() {
  const [policyText, setPolicyText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

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
      let newText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          newText += e.results[i][0].transcript
        }
      }
      if (newText) {
        setInput((prev) => (prev ? prev + ' ' + newText.trim() : newText.trim()))
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
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Load policy text from server (or fallback to localStorage if passed from Site Walkthroughs)
  useEffect(() => {
    const saved = localStorage.getItem('claims_policy_text')
    if (saved) {
      setPolicyText(saved)
      // Clear it after loading so it doesn't persist across sessions
      localStorage.removeItem('claims_policy_text')
      return
    }

    const loadDocs = async () => {
      try {
        const res = await fetch('/api/policy-chat/load-docs')
        const data = await res.json()
        if (data.success && data.combinedText.trim() !== '=========================================') {
          setPolicyText(data.combinedText)
        }
      } catch (err) {
        console.error('Error loading extracted docs:', err)
      }
    }
    loadDocs()
  }, [])

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading || !policyText.trim()) return
    const q = question.trim()
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

  const handleCopyPolicy = async () => {
    await navigator.clipboard.writeText(policyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-400" />
          Policy Chat
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Ask questions about your policy document — AI answers based only on the text provided
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Policy Document */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm">Policy Document</CardTitle>
                {policyText && (
                  <button
                    onClick={handleCopyPolicy}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {policyText ? (
                <div className="max-h-96 overflow-y-auto pr-2">
                  <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
                    {policyText}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-600">
                  <FileText className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm text-center">No policy document loaded</p>
                  <p className="text-xs mt-1 text-center">Extract text from a video in Site Walkthroughs, or paste policy text here</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual paste option */}
          {!policyText && (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Or paste policy text:</label>
                <textarea
                  value={policyText}
                  onChange={(e) => setPolicyText(e.target.value)}
                  placeholder="Paste your policy document text here..."
                  className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 resize-none"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Chat */}
        <div className="lg:col-span-2 space-y-4">
          {policyText && messages.length === 0 && (
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
              {!policyText ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 py-12">
                  <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-sm">Load a policy document to start chatting</p>
                  <p className="text-xs mt-1">Extract from video or paste text above</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 py-12">
                  <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-sm">Your policy analyst is ready</p>
                  <p className="text-xs mt-1">Ask about coverage, limits, exclusions, or claim procedures</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
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
                ))
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2 text-slate-400 text-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing policy…
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
                  placeholder={isListening ? 'Listening…' : 'Ask about coverage, limits, exclusions, or claim procedures…'}
                  disabled={loading || !policyText}
                  className={`flex-1 bg-slate-800 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors disabled:opacity-50 ${isListening ? 'border-red-500 placeholder-red-400' : 'border-slate-700 focus:border-blue-500'}`}
                />
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={loading || !policyText}
                  title={isListening ? 'Stop listening' : 'Speak your question'}
                  className={`p-2.5 rounded-xl transition-colors disabled:opacity-40 ${isListening ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim() || !policyText}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
