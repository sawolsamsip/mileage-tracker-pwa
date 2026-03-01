import { Outlet } from 'react-router-dom'
import Nav from './Nav'
import AutoSyncTesla from '@/components/AutoSyncTesla'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <h1 className="text-lg font-semibold text-[var(--accent)]">Mileage Tracker Pro</h1>
          <span className="text-xs text-slate-400" title="PWA">Offline-ready</span>
        </div>
      </header>
      <main className="flex-1 p-4 pb-24 safe-bottom max-w-6xl mx-auto w-full">
        <AutoSyncTesla />
        <Outlet />
      </main>
      <Nav />
    </div>
  )
}
