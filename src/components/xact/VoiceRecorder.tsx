'use client'

import { useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface VoiceRecorderProps {
  onTranscription: (text: string) => void
}

type RecorderState = 'idle' | 'recording' | 'transcribing' | 'done' | 'error'

export default function XactVoiceRecorder({ onTranscription }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await transcribeAudio(blob)
      }

      mediaRecorderRef.current = recorder
      recorder.start(250)
      setState('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.')
      setState('error')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    setState('transcribing')
  }, [])

  const transcribeAudio = async (blob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Transcription failed')

      setTranscript(data.text)
      onTranscription(data.text)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed')
      setState('error')
    }
  }

  const reset = () => {
    setTranscript('')
    setError('')
    setSeconds(0)
    setState('idle')
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {state === 'idle' && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <Mic size={15} />
            Record Voice Note
          </button>
        )}

        {state === 'recording' && (
          <>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 font-medium text-sm transition-colors"
            >
              <MicOff size={15} />
              Stop Recording
            </button>
            <div className="flex items-center gap-2 text-red-400">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-mono font-medium">{formatTime(seconds)}</span>
            </div>
          </>
        )}

        {state === 'transcribing' && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 size={15} className="animate-spin" />
            <span className="text-sm">Transcribing with Gemini...</span>
          </div>
        )}

        {state === 'done' && (
          <div className="flex items-center gap-2">
            <CheckCircle size={15} className="text-green-500" />
            <span className="text-sm text-green-400 font-medium">Transcription complete</span>
            <button onClick={reset} className="text-xs text-blue-400 underline ml-1">Re-record</button>
          </div>
        )}

        {state === 'error' && (
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-red-500" />
            <span className="text-sm text-red-400">{error}</span>
            <button onClick={reset} className="text-xs text-blue-400 underline ml-1">Try again</button>
          </div>
        )}
      </div>

      {transcript && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Transcript</p>
          <p className="text-sm text-slate-300">{transcript}</p>
        </div>
      )}
    </div>
  )
}
