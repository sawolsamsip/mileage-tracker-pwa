import { useState } from 'react'
import { format } from 'date-fns'
import { Route, Mic, PlusCircle } from 'lucide-react'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { useAllTrips } from '@/hooks/useAllTrips'
import { saveTripOffline } from '@/lib/db'
import { randomUUID } from '@/lib/uuid'
import type { Trip, TripPurpose } from '@/types'

const USER_ID_LOCAL = 'local'
const MANUAL_VEHICLE_ID = 'manual'

export default function Trips() {
  const [purpose, setPurpose] = useState<string>('business')
  const [notes, setNotes] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addDate, setAddDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [addMiles, setAddMiles] = useState('')
  const [addPurpose, setAddPurpose] = useState<TripPurpose>('business')
  const [addNotes, setAddNotes] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const { trips, loading, refresh } = useAllTrips()

  const { start: startVoice } = useVoiceInput((p, n) => {
    setPurpose(p)
    setNotes(n)
  })

  const handleAddTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    const miles = Number(addMiles?.replace(/,/g, '.'))
    if (!Number.isFinite(miles) || miles < 0) {
      setAddError('Enter a valid mileage (e.g. 12.5)')
      return
    }
    if (miles === 0) {
      setAddError('Enter miles greater than 0')
      return
    }
    setAddError(null)
    setAddBusy(true)
    try {
      const date = addDate || format(new Date(), 'yyyy-MM-dd')
      const now = new Date().toISOString()
      const trip: Trip = {
        id: randomUUID(),
        vehicleId: MANUAL_VEHICLE_ID,
        userId: USER_ID_LOCAL,
        startTime: `${date}T00:00:00.000Z`,
        endTime: `${date}T23:59:59.999Z`,
        startOdometer: 0,
        endOdometer: miles,
        miles,
        purpose: addPurpose,
        notes: addNotes.trim() || undefined,
        source: 'manual',
        confidence: 1,
        createdAt: now,
        updatedAt: now,
      }
      await saveTripOffline(trip)
      setAddMiles('')
      setAddNotes('')
      setShowAddForm(false)
      await refresh()
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddBusy(false)
    }
  }

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

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
          <PlusCircle className="h-4 w-4" />
          Add trip (manual)
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Add past or missed trips that didn&apos;t sync automatically. They appear in Reports for export.
        </p>
        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)]/20 px-4 py-2 text-sm font-medium text-[var(--accent)]"
          >
            <PlusCircle className="h-4 w-4" />
            Add trip
          </button>
        ) : (
          <form onSubmit={handleAddTrip} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Date</label>
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-slate-900/50 px-3 py-2 text-sm text-slate-100"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Miles</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 12.5"
                value={addMiles}
                onChange={(e) => setAddMiles(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Purpose</label>
              <select
                value={addPurpose}
                onChange={(e) => setAddPurpose(e.target.value as TripPurpose)}
                className="w-full rounded-lg border border-[var(--border)] bg-slate-900/50 px-3 py-2 text-sm text-slate-100"
              >
                <option value="business">Business</option>
                <option value="personal">Personal</option>
                <option value="medical">Medical</option>
                <option value="charity">Charity</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Notes (optional)</label>
              <input
                type="text"
                placeholder="e.g. Client visit, downtown"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={addBusy}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {addBusy ? 'Adding…' : 'Save trip'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setAddError(null); }}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-slate-400"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-slate-300">All trips</h3>
        <p className="mb-2 text-xs text-slate-500">Tesla: use &quot;Sync from Tesla&quot; on Vehicles. Add past or missed trips above.</p>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-8 text-center">
            <Route className="h-10 w-10 text-slate-600" />
            <p className="text-sm text-slate-500">No trips yet</p>
            <p className="text-xs text-slate-600">Connect Tesla and sync from Vehicles, or add trips manually above.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {trips.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <span className="text-sm text-slate-300">{format(new Date(t.startTime), 'MMM d, yyyy')}</span>
                <span className="font-medium text-[var(--accent)]">{t.miles.toFixed(1)} mi</span>
                <span className="text-sm text-slate-400">{t.purpose}</span>
                <span className="text-xs text-slate-500">
                  {t.source === 'tesla' ? 'Tesla' : t.source === 'manual' ? 'Manual' : t.source}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
