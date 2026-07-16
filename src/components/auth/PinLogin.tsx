'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PinLoginProps {
  onSuccess: () => void
}

export function PinLogin({ onSuccess }: PinLoginProps) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const email = process.env.NEXT_PUBLIC_LOGIN_EMAIL || 'jdewey420@gmail.com'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (pin.length < 6) {
      setError('PIN must be at least 6 digits')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: pin,
      })

      if (error) {
        throw error
      }

      if (data.session) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Invalid PIN')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Claims Experience</h1>
          <p className="text-slate-400 text-center text-sm">
            Please enter your PIN to access the dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-center text-2xl text-white tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:tracking-normal"
              placeholder="••••••••"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-500/10 text-red-500 text-sm p-3 rounded-lg text-center border border-red-500/20">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700"
            disabled={loading || pin.length < 6}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Unlock Dashboard'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
