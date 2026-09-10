'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UpdateAppButtonProps {
  className?: string
  variant?: 'icon' | 'sidebar' | 'pill'
}

export function UpdateAppButton({ className, variant = 'icon' }: UpdateAppButtonProps) {
  const [updating, setUpdating] = useState(false)
  const [updated, setUpdated] = useState(false)

  const handleForceUpdate = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (updating) return
    setUpdating(true)

    try {
      // 1. Unregister all active service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          try {
            await registration.unregister()
          } catch (err) {
            console.warn('[SW Unregister failed]', err)
          }
        }
      }

      // 2. Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        for (const name of cacheNames) {
          try {
            await caches.delete(name)
          } catch (err) {
            console.warn('[Cache Delete failed]', err)
          }
        }
      }

      setUpdated(true)

      // 3. Short pause for user feedback then hard-reload
      setTimeout(() => {
        // Force fresh load bypassing cache
        window.location.href = window.location.pathname + '?v=' + Date.now()
      }, 700)
    } catch (err) {
      console.error('[Force update failed]', err)
      window.location.reload()
    }
  }

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={handleForceUpdate}
        disabled={updating}
        className={cn(
          'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
          'text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 hover:border-indigo-500/60',
          updating && 'opacity-75 cursor-wait',
          className
        )}
        title="Purge cache and load the newest version"
      >
        <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-indigo-200">
          <RefreshCw className={cn('w-3.5 h-3.5', updating && 'animate-spin')} />
        </div>
        <div className="text-left flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-200">
              {updating ? 'Updating App...' : updated ? 'Fresh Copy Loaded!' : 'Update App'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 font-mono">
              v6.5
            </span>
          </div>
          <div className="text-[10px] text-indigo-400/80">Force fresh copy & purge cache</div>
        </div>
      </button>
    )
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleForceUpdate}
        disabled={updating}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all shadow-sm',
          'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-indigo-100 border border-indigo-500/30 active:scale-95',
          updating && 'opacity-75 cursor-wait',
          className
        )}
        title="Force Fresh Copy / Update App"
      >
        <RefreshCw className={cn('w-3 h-3 text-indigo-400', updating && 'animate-spin')} />
        <span>{updating ? 'Updating...' : updated ? 'Updated!' : 'Update App'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleForceUpdate}
      disabled={updating}
      className={cn(
        'relative p-2 rounded-xl text-indigo-400 hover:text-white bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-500/30 transition-all active:scale-95 flex items-center justify-center',
        updating && 'opacity-75 cursor-wait',
        className
      )}
      title="Update App / Force Fresh Copy (Purges Browser Cache)"
      aria-label="Update App"
    >
      {updated ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      ) : (
        <RefreshCw className={cn('w-4 h-4 text-indigo-400', updating && 'animate-spin')} />
      )}
      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
      </span>
    </button>
  )
}
