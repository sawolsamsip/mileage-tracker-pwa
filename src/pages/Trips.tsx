import { useState } from 'react'
import { format } from 'date-fns'
import { Route, Mic } from 'lucide-react'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { useAllTrips } from '@/hooks/useAllTrips'

export default function Trips() {
  const [purpose, setPurpose] = useState<string>('business')
  const [notes, setNotes] = useState('')
  const { trips, loading } = useAllTrips()

  const { start: startVoice } = useVoiceInput((p, n) => {
    setPurpose(p)
    setNotes(n)
  })

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Trips</h2>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-300">Voice: set purpose</h3>
        <p className="mb-2 text-xs text-slate-500">Say e.g. &quot;business client meeting&quot; or &quot;personal errands&quot;</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)]/20 px-3 py-2 text-sm text-[var(--accent)]"
            onClick={startVoice}
          >
            <Mic className="h-4 w-4" />
            Start voice
          </button>
          {purpose && <span className="text-sm text-slate-400">Purpose: {purpose}</span>}
          {notes && <span className="text-sm text-slate-400">Notes: {notes}</span>}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-slate-300">All trips</h3>
        <p className="mb-2 text-xs text-slate-500">After connecting Tesla, use &quot;Sync from Tesla&quot; on Vehicles to see daily mileage here.</p>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-8 text-center">
            <Route className="h-10 w-10 text-slate-600" />
            <p className="text-sm text-slate-500">No trips yet</p>
            <p className="text-xs text-slate-600">Connect Tesla and sync from Vehicles, or add trips manually / by voice.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {trips.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <span className="text-sm text-slate-300">{format(new Date(t.startTime), 'MMM d, yyyy')}</span>
                <span className="font-medium text-[var(--accent)]">{t.miles.toFixed(1)} mi</span>
                <span className="text-sm text-slate-400">{t.purpose}</span>
                {t.source === 'tesla' && <span className="text-xs text-slate-500">Tesla</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
