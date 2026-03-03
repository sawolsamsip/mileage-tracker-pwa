import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Route, PlusCircle, AlertCircle } from 'lucide-react'
import { useAllTrips } from '@/hooks/useAllTrips'
import { useMissingDays } from '@/hooks/useMissingDays'
import { saveTripOffline, deleteTripOffline } from '@/lib/db'
import { randomUUID } from '@/lib/uuid'
import type { Trip, TripPurpose } from '@/types'

const USER_ID_LOCAL = 'local'
const MANUAL_VEHICLE_ID = 'manual'

export default function Trips() {
  const [showAddForm, setShowAddForm] = useState(false)
  const [addDate, setAddDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [addMiles, setAddMiles] = useState('')
  const [addPurpose, setAddPurpose] = useState<TripPurpose>('business')
  const [addNotes, setAddNotes] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editMiles, setEditMiles] = useState('')
  const [editPurpose, setEditPurpose] = useState<TripPurpose>('business')
  const [editNotes, setEditNotes] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const { trips, loading, refresh } = useAllTrips()
  const { missingDates, loading: missingLoading, refresh: refreshMissing } = useMissingDays(90)

  const openAddForMissingDay = (date: string, purpose: TripPurpose) => {
    setAddDate(date)
    setAddPurpose(purpose)
    setAddMiles('')
    setAddNotes('')
    setAddError(null)
    setShowAddForm(true)
  }

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
      await refreshMissing()
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddBusy(false)
    }
  }

  const startEditTrip = (trip: Trip) => {
    if (trip.source !== 'manual') return
    setEditingTrip(trip)
    setEditDate(trip.startTime.slice(0, 10))
    setEditMiles(trip.miles.toString())
    setEditPurpose(trip.purpose)
    setEditNotes(trip.notes ?? '')
    setEditError(null)
  }

  const handleEditTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTrip) return
    const miles = Number(editMiles?.replace(/,/g, '.'))
    if (!Number.isFinite(miles) || miles < 0) {
      setEditError('Enter a valid mileage (e.g. 12.5)')
      return
    }
    if (miles === 0) {
      setEditError('Enter miles greater than 0')
      return
    }
    setEditBusy(true)
    setEditError(null)
    try {
      const date = editDate || editingTrip.startTime.slice(0, 10)
      const now = new Date().toISOString()
      const updated: Trip = {
        ...editingTrip,
        startTime: `${date}T00:00:00.000Z`,
        endTime: `${date}T23:59:59.999Z`,
        startOdometer: 0,
        endOdometer: miles,
        miles,
        purpose: editPurpose,
        notes: editNotes.trim() || undefined,
        updatedAt: now,
      }
      await saveTripOffline(updated)
      setEditingTrip(null)
      await refresh()
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setEditBusy(false)
    }
  }

  const handleDeleteTrip = async (trip: Trip) => {
    if (trip.source !== 'manual') return
    await deleteTripOffline(trip.id)
    if (editingTrip?.id === trip.id) {
      setEditingTrip(null)
    }
    await refresh()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Trips</h2>

      {!missingLoading && missingDates.length > 0 && (
        <section className="rounded-xl border border-[var(--warning)]/50 bg-[var(--warning)]/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--warning)]">
            <AlertCircle className="h-4 w-4" />
            Missing days (no Tesla snapshot)
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            Add miles for these days so your log is complete. Use &quot;Sync from Tesla&quot; on Vehicles first; if a day is still missing, add it below.
          </p>
          <ul className="space-y-2">
            {missingDates.slice(0, 14).map((d) => (
              <li key={d} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-300">{format(parseISO(d), 'MMM d, yyyy')}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openAddForMissingDay(d, 'business')}
                    className="rounded border border-[var(--border)] bg-[var(--accent)]/20 px-2 py-1 text-xs text-[var(--accent)]"
                  >
                    Add business miles
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddForMissingDay(d, 'personal')}
                    className="rounded border border-[var(--border)] px-2 py-1 text-xs text-slate-400"
                  >
                    Add personal miles
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {missingDates.length > 14 && (
            <p className="mt-2 text-xs text-slate-500">+ {missingDates.length - 14} more. Add trips above to fill gaps.</p>
          )}
        </section>
      )}

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

      {editingTrip && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-300">Edit trip (manual)</h3>
          <form onSubmit={handleEditTrip} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Date</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
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
                value={editMiles}
                onChange={(e) => setEditMiles(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Purpose</label>
              <select
                value={editPurpose}
                onChange={(e) => setEditPurpose(e.target.value as TripPurpose)}
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
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
            {editError && <p className="text-xs text-red-400">{editError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={editBusy}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {editBusy ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditingTrip(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-slate-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

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
                className="flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="text-sm text-slate-300">{format(new Date(t.startTime), 'MMM d, yyyy')}</span>
                  <span className="font-medium text-[var(--accent)]">{t.miles.toFixed(1)} mi</span>
                  <span className="text-sm text-slate-400">{t.purpose}</span>
                  <span className="text-xs text-slate-500">
                    {t.source === 'tesla' ? 'Tesla' : t.source === 'manual' ? 'Manual' : t.source}
                  </span>
                </div>
                {t.source === 'manual' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    {t.notes && <span className="text-slate-500 truncate">Notes: {t.notes}</span>}
                    <div className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditTrip(t)}
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs text-slate-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTrip(t)}
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
