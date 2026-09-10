'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newPin = [...pin]
    newPin[index] = value.slice(-1)
    setPin(newPin)
    setError('')

    if (value && index < 3) {
      inputs.current[index + 1]?.focus()
    }

    if (newPin.every((d) => d !== '') && newPin.join('').length === 4) {
      submit(newPin.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  const submit = async (code: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code }),
      })
      if (res.ok) {
        router.push('/reconciler')
        router.refresh()
      } else {
        setError('Incorrect PIN. Enter 4201.')
        setPin(['', '', '', ''])
        inputs.current[0]?.focus()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-700 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Claims Experience</h1>
          <p className="text-zinc-400 text-sm mt-1">Enter your PIN to continue</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <div className="flex justify-center gap-3 mb-6">
            {pin.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 bg-zinc-800 text-white outline-none transition-all
                  ${error ? 'border-red-500' : digit ? 'border-amber-600' : 'border-zinc-700'}
                  focus:border-amber-400 disabled:opacity-50`}
              />
            ))}
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center mb-4">{error}</p>
          )}

          {loading && (
            <div className="flex justify-center">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            </div>
          )}
        </div>

        <p className="text-zinc-600 text-xs text-center mt-6">
          Secure · Zero-PII · Field Ready
        </p>
      </div>
    </div>
  )
}
