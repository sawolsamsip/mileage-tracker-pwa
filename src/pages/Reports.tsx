import { useState, useEffect, useCallback } from 'react'
import { format, subMonths } from 'date-fns'
import { FileText, Download, AlertTriangle, Gauge } from 'lucide-react'
import { exportPDF, exportCSV, tripsToLogEntries, flagAudit } from '@/lib/exportLogs'
import { getEVIncentiveSummary } from '@/lib/evTaxIncentive'
import { useAllTrips } from '@/hooks/useAllTrips'
import { getCache, setCache, getOdometerSnapshotsByVehicle } from '@/lib/db'
import { TESLA_VEHICLES_KEY } from '@/pages/AuthTeslaCallback'

function loadTeslaVehicles(): { id: string; displayName: string }[] {
  try {
    const raw = localStorage.getItem(TESLA_VEHICLES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as { id: string; displayName: string }[]
  } catch {
    return []
  }
}

const BEGINNING_ODOMETER_KEY = (vehicleId: string, year: number) =>
  `beginning_odometer_${vehicleId}_${year}`

export default function Reports() {
  const [start] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'))
  const [end] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [yearRows, setYearRows] = useState<{ vehicleId: string; displayName: string; beginning: number | null; endOdo: number | null; total: number | null }[]>([])
  const [yearSelect, setYearSelect] = useState(new Date().getFullYear())
  const [savingBeginning, setSavingBeginning] = useState<string | null>(null)
  const { trips: allTrips, loading } = useAllTrips()

  const loadYearSummary = useCallback(async () => {
    const vehicles = loadTeslaVehicles()
    const y = yearSelect
    const rows = await Promise.all(
      vehicles.map(async (v) => {
        const beginning = (await getCache<number>(BEGINNING_ODOMETER_KEY(v.id, y))) ?? null
        const snapshots = await getOdometerSnapshotsByVehicle(v.id)
        const inYear = snapshots.filter((r) => r.date.startsWith(String(y)))
        const endRow = inYear.length ? inYear[inYear.length - 1] : null
        const endOdo = endRow ? endRow.lastOdometer : null
        const total =
          beginning != null && endOdo != null && endOdo >= beginning ? endOdo - beginning : null
        return {
          vehicleId: v.id,
          displayName: v.displayName,
          beginning,
          endOdo,
          total,
        }
      })
    )
    setYearRows(rows)
  }, [yearSelect])

  useEffect(() => {
    loadYearSummary()
  }, [loadYearSummary])

  const saveBeginningOdometer = async (vehicleId: string, value: string) => {
    const num = Number(value?.replace(/,/g, '.'))
    if (!Number.isFinite(num) || num < 0) return
    setSavingBeginning(vehicleId)
    await setCache(BEGINNING_ODOMETER_KEY(vehicleId, yearSelect), num)
    await loadYearSummary()
    setSavingBeginning(null)
  }
  const trips = allTrips.filter((t) => {
    const d = t.startTime.slice(0, 10)
    return d >= start && d <= end
  })
  const vehicleDescription = 'My Vehicle'

  const entries = flagAudit(tripsToLogEntries(trips, vehicleDescription))
  const evSummary = getEVIncentiveSummary(
    trips.filter((t) => t.purpose === 'business').reduce((s, t) => s + t.miles, 0)
  )

  const handleExportPDF = () => exportPDF(entries, `Mileage Log ${start} to ${end}`)
  const handleExportCSV = () => exportCSV(entries, `mileage-log-${start}-${end}.csv`)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Reports</h2>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
          <FileText className="h-4 w-4" />
          IRS mileage log
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Date range: {start} – {end}. Includes Tesla-synced daily mileage. Export includes all required fields; audit flags highlight gaps.
        </p>
        {loading && <p className="mb-2 text-xs text-slate-500">Loading trips…</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)]/20 px-4 py-2 text-sm font-medium text-[var(--accent)]"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-slate-300"
          >
            Export CSV
          </button>
        </div>
        {entries.some((e) => e.auditFlag) && (
          <p className="mt-3 flex items-center gap-2 text-xs text-[var(--warning)]">
            <AlertTriangle className="h-4 w-4" />
            Some entries have audit flags. Fix before submitting.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
          <Gauge className="h-4 w-4" />
          Year summary (IRS beginning/end odometer)
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Set each vehicle&apos;s odometer at the start of the year. Total miles = end (from sync) − beginning.
        </p>
        <div className="mb-3">
          <label className="mr-2 text-xs text-slate-400">Year</label>
          <select
            value={yearSelect}
            onChange={(e) => setYearSelect(Number(e.target.value))}
            className="rounded border border-[var(--border)] bg-slate-900/50 px-2 py-1 text-sm text-slate-100"
          >
            {[yearSelect, yearSelect - 1, yearSelect - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {yearRows.length === 0 ? (
          <p className="text-xs text-slate-500">No Tesla vehicles. Connect Tesla in Vehicles.</p>
        ) : (
          <ul className="space-y-3">
            {yearRows.map((r) => (
              <li key={r.vehicleId} className="rounded-lg border border-[var(--border)] p-3">
                <div className="mb-2 font-medium text-slate-200">{r.displayName}</div>
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <label className="block text-xs text-slate-500">Beginning (Jan 1)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 12500"
                      defaultValue={r.beginning ?? ''}
                      onBlur={(e) => saveBeginningOdometer(r.vehicleId, e.target.value)}
                      className="mt-0.5 w-full rounded border border-[var(--border)] bg-slate-900/50 px-2 py-1 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500">End (from sync)</label>
                    <p className="mt-0.5 text-slate-300">{r.endOdo != null ? `${r.endOdo.toLocaleString()} mi` : '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500">Total miles {yearSelect}</label>
                    <p className="mt-0.5 font-medium text-[var(--accent)]">
                      {r.total != null ? `${r.total.toLocaleString()} mi` : '—'}
                    </p>
                  </div>
                </div>
                {savingBeginning === r.vehicleId && <span className="text-xs text-slate-500">Saving…</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-300">EV tax incentive summary</h3>
        <p className="mb-2 text-xs text-slate-500">Business miles YTD: {evSummary.businessMilesYTD.toFixed(1)}</p>
        <p className="text-sm text-slate-400">{evSummary.suggestedAction}</p>
      </section>
    </div>
  )
}
