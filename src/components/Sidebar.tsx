'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  GitCompare,
  Camera,
  Video,
  BookOpen,
  Mic,
  MessageCircle,
  Shield,
  Menu,
  X,
  LogOut,
  Crosshair,
  Bug,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/field-scope', label: 'Field Scope', icon: Crosshair, description: 'Photos + voice → scope' },
  { href: '/reconciler', label: 'Estimate Reconciler', icon: GitCompare, description: 'Compare estimates' },
  { href: '/xact-scope', label: 'Xact Code Finder', icon: Camera, description: 'Photos + voice → codes' },
  { href: '/field-notes', label: 'Field Narratives', icon: Mic, description: 'Voice → file note' },
  { href: '/site-walkthroughs', label: 'Site Walkthroughs', icon: Video, description: 'Video inspection' },
  { href: '/policy-chat', label: 'Policy Chat', icon: MessageCircle, description: 'Policy Q&A' },
  { href: '/code-reference', label: 'Code Reference', icon: BookOpen, description: 'Xactimate Q&A' },
  { href: '/feedback', label: 'Report Issue', icon: Bug, description: 'Log a bug or idea' },
]

function NavLink({ item, onClick }: { item: typeof NAV_ITEMS[0]; onClick?: () => void }) {
  const pathname = usePathname()
  const isActive = pathname === item.href || (item.href === '/reconciler' && pathname === '/')
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
        isActive
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <div>
        <div>{item.label}</div>
        <div className={cn('text-xs', isActive ? 'text-blue-200' : 'text-slate-600 group-hover:text-slate-500')}>
          {item.description}
        </div>
      </div>
    </Link>
  )
}

export function Sidebar() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 min-h-screen">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Claims Experience</div>
            <div className="text-slate-500 text-xs">Adjuster Toolkit</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-xl text-sm transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Claims Experience</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative ml-auto w-72 bg-slate-900 h-full flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <span className="text-white font-bold">Navigation</span>
              <button onClick={() => setOpen(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} onClick={() => setOpen(false)} />
              ))}
            </nav>
            <div className="p-3 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-slate-500 hover:text-red-400 text-sm"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
