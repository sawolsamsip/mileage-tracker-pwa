import { format } from 'date-fns'
import { Activity, Car, Route, Zap } from 'lucide-react'
import { useAllTrips } from '@/hooks/useAllTrips'

export default function Dashboard() {
  const { trips, loading } = useAllTrips()
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayTrips = trips.filter((t) => t.startTime.startsWith(today))
  const todayMiles = todayTrips.reduce((s, t) => s + t.miles, 0)
  const recentTrips = [...trips].reverse().slice(0, 5)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Dashboard</h2>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <Route className="h-4 w-4" />
            <span className="text-sm">Today&apos;s miles</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-[var(--accent)]">{loading ? '…' : Math.round(todayMiles)} mi</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <Activity className="h-4 w-4" />
            <span className="text-sm">Trips today</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-100">{loading ? '…' : todayTrips.length}</p>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
          <Car className="h-4 w-4" />
          Quick start trip
        </h3>
        <p className="mb-3 text-sm text-slate-400">
          Trip detection runs when this app is open. Add a vehicle and go to Trips to see auto-logged segments.
        </p>
        <a
          href="/vehicles"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)]/20 px-4 py-2 text-sm font-medium text-[var(--accent)]"
        >
          <Zap className="h-4 w-4" />
          Add vehicle
        </a>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-300">Recent trips</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : recentTrips.length === 0 ? (
          <p className="text-sm text-slate-500">No trips yet. Connect Tesla and sync from Vehicles, or add manually.</p>
        ) : (
          <ul className="space-y-2">
            {recentTrips.map((t) => (
              <li key={t.id} className="flex justify-between text-sm">
                <span className="text-slate-400">{format(new Date(t.startTime), 'MMM d')}</span>
                <span className="text-[var(--accent)]">{Math.round(t.miles)} mi</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
