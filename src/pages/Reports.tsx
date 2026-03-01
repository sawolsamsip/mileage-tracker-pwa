import { useState } from 'react'
import { format, subMonths } from 'date-fns'
import { FileText, Download, AlertTriangle } from 'lucide-react'
import { exportPDF, exportCSV, tripsToLogEntries, flagAudit } from '@/lib/exportLogs'
import { getEVIncentiveSummary } from '@/lib/evTaxIncentive'
import { useAllTrips } from '@/hooks/useAllTrips'

export default function Reports() {
  const [start] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'))
  const [end] = useState(format(new Date(), 'yyyy-MM-dd'))
  const { trips: allTrips, loading } = useAllTrips()
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
        <h3 className="mb-2 text-sm font-medium text-slate-300">EV tax incentive summary</h3>
        <p className="mb-2 text-xs text-slate-500">Business miles YTD: {evSummary.businessMilesYTD.toFixed(1)}</p>
        <p className="text-sm text-slate-400">{evSummary.suggestedAction}</p>
      </section>
    </div>
  )
}
