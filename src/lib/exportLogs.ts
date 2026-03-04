/**
 * IRS-proof mileage log export: PDF and CSV with required fields and audit flagging.
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { MileageLogEntry, Trip, TripPurpose } from '@/types'
import { format } from 'date-fns'

const PURPOSE_LABELS: Record<TripPurpose, string> = {
  business: 'Business',
  personal: 'Personal',
  medical: 'Medical',
  charity: 'Charity',
}

/** Build log entries from trips (e.g. for date range). */
export function tripsToLogEntries(trips: Trip[], vehicleDescription: string): MileageLogEntry[] {
  return trips.map((t) => ({
    date: format(new Date(t.startTime), 'yyyy-MM-dd'),
    vehicleDescription,
    startOdometer: t.startOdometer,
    endOdometer: t.endOdometer,
    miles: t.miles,
    purpose: t.purpose,
    placeOrDescription: t.notes ?? '',
    auditFlag: t.auditFlag ?? undefined,
  }))
}

/** Flag entries that might fail IRS scrutiny. */
export function flagAudit(entries: MileageLogEntry[]): MileageLogEntry[] {
  return entries.map((e) => {
    let flag: string | undefined
    if (!e.placeOrDescription?.trim()) flag = 'Missing place or description'
    if (e.miles <= 0) flag = (flag ? flag + '; ' : '') + 'Zero or negative miles'
    if (!e.purpose) flag = (flag ? flag + '; ' : '') + 'Missing purpose'
    return { ...e, auditFlag: flag ?? e.auditFlag }
  })
}

/** Export to CSV (IRS-friendly columns). */
export function exportCSV(entries: MileageLogEntry[], filename = 'mileage-log.csv'): void {
  const headers = ['Date', 'Vehicle', 'Start Odometer', 'End Odometer', 'Miles', 'Purpose', 'Place/Description', 'Audit Flag']
  const rows = entries.map((e) => [
    e.date,
    e.vehicleDescription,
    e.startOdometer != null ? Math.round(e.startOdometer) : '',
    e.endOdometer != null ? Math.round(e.endOdometer) : '',
    Math.round(e.miles),
    PURPOSE_LABELS[e.purpose] ?? e.purpose,
    e.placeOrDescription,
    e.auditFlag ?? '',
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Export to PDF with table (IRS-proof format). */
export function exportPDF(entries: MileageLogEntry[], title = 'Mileage Log'): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' })
  doc.setFontSize(14)
  doc.text(title, 0.5, 0.6)
  doc.setFontSize(10)
  doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 0.5, 0.9)

  const body = entries.map((e) => [
    e.date,
    e.vehicleDescription,
    e.startOdometer != null ? String(Math.round(e.startOdometer)) : '',
    e.endOdometer != null ? String(Math.round(e.endOdometer)) : '',
    String(Math.round(e.miles)),
    PURPOSE_LABELS[e.purpose] ?? e.purpose,
    e.placeOrDescription.slice(0, 40),
    e.auditFlag ?? '',
  ])

  autoTable(doc, {
    startY: 1.1,
    head: [['Date', 'Vehicle', 'Start Odom', 'End Odom', 'Miles', 'Purpose', 'Place/Description', 'Audit']],
    body,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 23, 42] },
  })

  doc.save('mileage-log.pdf')
}
