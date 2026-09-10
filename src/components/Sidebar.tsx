'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  GitCompare,
  Camera,
  BookOpen,
  Mic,
  MessageCircle,
  Shield,
  Menu,
  X,
  LogOut,
  Crosshair,
  FileText,
  Sparkles,
  Home,
  CheckSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UpdateAppButton } from './UpdateAppButton'

const NAV_ITEMS = [
  {
    href: '/reconciler',
    label: 'Estimate Reconciler',
    icon: GitCompare,
    description: 'Compare estimates & audit variances',
    badge: 'AUDIT',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    activeColor: 'bg-gradient-to-r from-emerald-600/30 to-emerald-900/40 text-emerald-300 border-l-4 border-emerald-500 shadow-lg shadow-emerald-950/40',
    iconColor: 'text-emerald-400',
  },
  {
    href: '/roofing-scope',
    label: 'Roofing Scope & EagleView',
    icon: Home,
    description: 'Verbatim scope form & pitch math',
    badge: 'ROOF SCOPE',
    badgeColor: 'bg-red-500/15 text-red-400 border-red-500/30',
    activeColor: 'bg-gradient-to-r from-red-600/30 to-red-900/40 text-red-300 border-l-4 border-red-500 shadow-lg shadow-red-950/40',
    iconColor: 'text-red-400',
  },
  {
    href: '/tasks',
    label: 'Tasks & Voicemails',
    icon: CheckSquare,
    description: 'Adjuster callbacks & action log',
    badge: 'TASKS',
    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    activeColor: 'bg-gradient-to-r from-indigo-600/30 to-indigo-900/40 text-indigo-300 border-l-4 border-indigo-500 shadow-lg shadow-indigo-950/40',
    iconColor: 'text-indigo-400',
  },
  {
    href: '/field-scope',
    label: 'Field Scope',
    icon: Crosshair,
    description: 'Photos + voice → 1-tap scope',
    badge: '1-TAP XACT',
    badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    activeColor: 'bg-gradient-to-r from-rose-600/30 to-rose-900/40 text-rose-300 border-l-4 border-rose-500 shadow-lg shadow-rose-950/40',
    iconColor: 'text-rose-400',
  },
  {
    href: '/field-notes',
    label: 'Field Notes',
    icon: Mic,
    description: 'Roof & field voice → claim note',
    badge: 'VOICE',
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    activeColor: 'bg-gradient-to-r from-amber-600/30 to-amber-900/40 text-amber-300 border-l-4 border-amber-500 shadow-lg shadow-amber-950/40',
    iconColor: 'text-amber-400',
  },
  {
    href: '/policy-chat',
    label: 'Policy Chat & SOP',
    icon: MessageCircle,
    description: 'Carrier SOP, endorsements & checker',
    badge: 'SOP SEARCH',
    badgeColor: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    activeColor: 'bg-gradient-to-r from-sky-600/30 to-sky-900/40 text-sky-300 border-l-4 border-sky-500 shadow-lg shadow-sky-950/40',
    iconColor: 'text-sky-400',
  },
  {
    href: '/portal',
    label: 'Reports & Cloud Vault',
    icon: FileText,
    description: 'Archived scopes, audits & notes',
    badge: 'VAULT',
    badgeColor: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    activeColor: 'bg-gradient-to-r from-teal-600/30 to-teal-900/40 text-teal-300 border-l-4 border-teal-500 shadow-lg shadow-teal-950/40',
    iconColor: 'text-teal-400',
  },
  {
    href: '/engineer-scope',
    label: 'Structural Engineer Scope',
    icon: Shield,
    description: 'Engineer report → Xact line items',
    badge: 'STRUCTURAL',
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    activeColor: 'bg-gradient-to-r from-purple-600/30 to-purple-900/40 text-purple-300 border-l-4 border-purple-500 shadow-lg shadow-purple-950/40',
    iconColor: 'text-purple-400',
  },
  {
    href: '/claim-assistant',
    label: 'Claim Assistant',
    icon: Sparkles,
    description: 'Copilot for complex claims',
    badge: 'COPILOT',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    activeColor: 'bg-gradient-to-r from-blue-600/30 to-blue-900/40 text-blue-300 border-l-4 border-blue-500 shadow-lg shadow-blue-950/40',
    iconColor: 'text-blue-400',
  },
  {
    href: '/xact-scope',
    label: 'Xact Code Finder',
    icon: Camera,
    description: 'Damage photo → code match',
    badge: 'XACT',
    badgeColor: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    activeColor: 'bg-gradient-to-r from-orange-600/30 to-orange-900/40 text-orange-300 border-l-4 border-orange-500 shadow-lg shadow-orange-950/40',
    iconColor: 'text-orange-400',
  },
  {
    href: '/code-reference',
    label: 'Code Reference',
    icon: BookOpen,
    description: 'Price list database reference',
    badge: 'LOOKUP',
    badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    activeColor: 'bg-gradient-to-r from-cyan-600/30 to-cyan-900/40 text-cyan-300 border-l-4 border-cyan-500 shadow-lg shadow-cyan-950/40',
    iconColor: 'text-cyan-400',
  },
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
        'flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group border border-transparent',
        isActive
          ? cn(item.activeColor, 'border-slate-700/50')
          : 'text-slate-400 hover:text-white hover:bg-slate-800/60 hover:border-slate-700/40'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105',
            isActive ? 'bg-white/10' : 'bg-slate-800/70',
            item.iconColor
          )}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
        </div>
        <div className="min-w-0 text-left">
          <div className={cn('text-xs font-semibold truncate', isActive ? 'text-white' : 'text-slate-200')}>
            {item.label}
          </div>
          <div className="text-[10px] text-slate-400/80 truncate">
            {item.description}
          </div>
        </div>
      </div>
      {item.badge && (
        <span
          className={cn(
            'text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-wider ml-1.5 flex-shrink-0 uppercase',
            item.badgeColor
          )}
        >
          {item.badge}
        </span>
      )}
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
    <aside className="hidden lg:flex flex-col w-72 bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-xl min-h-screen">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between">
          <Link href="/reconciler" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/30 ring-1 ring-red-400/40 transition-transform group-hover:scale-105">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-extrabold text-base tracking-tight font-heading">DOC</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  ONLINE
                </span>
              </div>
              <div className="text-slate-400 text-[11px] font-medium">Claims Experience Suite</div>
            </div>
          </Link>
          <UpdateAppButton variant="icon" />
        </div>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Footer with Update App & Sign Out */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        <UpdateAppButton variant="sidebar" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-medium transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out (Remembered for 1 Year)
        </button>
      </div>
    </aside>
  )
}

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const currentItem = NAV_ITEMS.find((item) => item.href === pathname) || NAV_ITEMS[0]

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <header className="lg:hidden flex items-center justify-between px-4 py-2.5 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <Link href="/reconciler" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md shadow-red-600/30 ring-1 ring-red-400/40">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-bold text-sm tracking-tight">DOC</span>
                <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  LIVE
                </span>
              </div>
            </div>
          </Link>
          <span className="text-slate-600 text-xs">/</span>
          <span className="text-slate-300 text-xs font-medium truncate max-w-[130px]">
            {currentItem.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Force Fresh Copy / Update App Button */}
          <UpdateAppButton variant="icon" />

          {/* Menu Drawer Toggle */}
          <button
            onClick={() => setOpen(true)}
            className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all active:scale-95"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative ml-auto w-80 bg-slate-950 h-full flex flex-col shadow-2xl border-l border-slate-800/80">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <span className="text-white font-bold text-sm">DOC Field Suite</span>
                  <div className="text-[10px] text-slate-400">All Adjuster Tools</div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} onClick={() => setOpen(false)} />
              ))}
            </nav>

            <div className="p-4 border-t border-slate-800 space-y-2.5">
              <UpdateAppButton variant="sidebar" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:text-red-400 text-xs font-medium rounded-xl hover:bg-slate-900"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
