'use client'

import { useState } from 'react'
import { Bug, Send, CheckCircle2 } from 'lucide-react'

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedback.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: '🔥 BUG REPORT / FEEDBACK: Claims Experience App',
          body: `USER FEEDBACK:\n\n${feedback}\n\n---\nSubmitted from: ${window.location.href}\nUser Agent: ${navigator.userAgent}`,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send feedback')
      }

      setSubmitted(true)
      setFeedback('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Bug className="w-6 h-6 text-blue-500" />
          Report an Issue or Feedback
        </h1>
        <p className="text-slate-400 mt-2">
          Use this form to document anything that doesn't work as expected. 
          This will immediately email the development team (and your AI agent) so we can troubleshoot it for you.
        </p>
      </div>

      {submitted ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h2 className="text-lg font-medium text-white mb-2">Feedback Sent!</h2>
          <p className="text-emerald-200 mb-6">
            Your report has been logged and emailed directly. We will look into it right away!
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="text-emerald-400 hover:text-emerald-300 font-medium text-sm"
          >
            Submit another report
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              What happened? (Please be as specific as possible)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full h-48 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. When I upload a video on my iPhone 15, the screen goes blank and it says 'Quota Exceeded'..."
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              Error sending report: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !feedback.trim()}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium py-3 px-4 rounded-xl transition-all"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Feedback
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
