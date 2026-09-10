'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GitCompare, Home, Crosshair, CheckSquare, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const BOTTOM_ITEMS = [
  {
    href: '/reconciler',
    label: 'Reconcile',
    icon: GitCompare,
    activeColor: 'text-emerald-400 font-bold',
    glowColor: 'bg-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/30 ring-1 ring-emerald-500/40',
  },
  {
    href: '/roofing-scope',
    label: 'Roof Scope',
    icon: Home,
    activeColor: 'text-red-400 font-bold',
    glowColor: 'bg-red-500/20 text-red-400 shadow-sm shadow-red-500/30 ring-1 ring-red-500/40',
  },
  {
    href: '/field-scope',
    label: 'Field Scope',
    icon: Crosshair,
    activeColor: 'text-rose-400 font-bold',
    glowColor: 'bg-rose-500/20 text-rose-400 shadow-sm shadow-rose-500/30 ring-1 ring-rose-500/40',
  },
  {
    href: '/tasks',
    label: 'Tasks',
    icon: CheckSquare,
    activeColor: 'text-indigo-400 font-bold',
    glowColor: 'bg-indigo-500/20 text-indigo-400 shadow-sm shadow-indigo-500/30 ring-1 ring-indigo-500/40',
  },
  {
    href: '/portal',
    label: 'Vault',
    icon: FileText,
    activeColor: 'text-teal-400 font-bold',
    glowColor: 'bg-teal-500/20 text-teal-400 shadow-sm shadow-teal-500/30 ring-1 ring-teal-500/40',
  },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-800/80 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-2xl transition-all"
      aria-label="Mobile Field Navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {BOTTOM_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href === '/reconciler' && pathname === '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all touch-manipulation select-none active:scale-95',
                isActive ? item.activeColor : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <div
                className={cn(
                  'p-1.5 rounded-xl transition-all',
                  isActive ? item.glowColor : 'bg-transparent text-slate-400'
                )}
              >
                <Icon className={cn('w-4 h-4 transition-transform', isActive && 'scale-110')} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
