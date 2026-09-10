import { Sidebar, MobileHeader } from '@/components/Sidebar'
import { MobileBottomNav } from '@/components/MobileBottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-slate-950 text-slate-100 antialiased selection:bg-red-500/30 selection:text-red-200">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden relative bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(225,27,34,0.12),rgba(255,255,255,0))]">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-24 lg:pb-6">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  )
}
