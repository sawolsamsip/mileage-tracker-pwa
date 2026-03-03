/**
 * Tesla odometer sync: store daily snapshots and derive mileage (mongoori-rides style).
 * Tesla API does not provide trip history; we get current odometer and build daily miles from snapshots.
 */

import { getTeslaVehicleData, MAX_REASONABLE_ODOMETER_MILES } from '@/lib/tesla'
import {
  putOdometerSnapshot,
  getOdometerSnapshotsByVehicle,
} from '@/lib/db'
import type { Trip } from '@/types'
import { format, parseISO } from 'date-fns'

function dateOnly(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? parseISO(isoOrDate) : isoOrDate
  return format(d, 'yyyy-MM-dd')
}

/** Record or update odometer for a vehicle on a given date. */
export async function recordOdometerSnapshot(
  vehicleId: string,
  date: string,
  odometer: number
): Promise<void> {
  const id = `${vehicleId}_${date}`
  const existing = await getOdometerSnapshotsByVehicle(vehicleId).then((rows) =>
    rows.find((r) => r.date === date)
  )
  const first = existing ? Math.min(existing.firstOdometer, odometer) : odometer
  const last = existing ? Math.max(existing.lastOdometer, odometer) : odometer
  await putOdometerSnapshot({
    id,
    vehicleId,
    date,
    firstOdometer: first,
    lastOdometer: last,
    updatedAt: new Date().toISOString(),
  })
}

/** Fetch current odometer from Tesla for each vehicle and save as today's snapshot. Optional onProgress for UI. */
export async function syncOdometerFromTesla(
  accessToken: string,
  vehicles: { id: string; displayName: string }[],
  onProgress?: (index: number, total: number) => void
): Promise<{ vehicleId: string; odometer?: number; error?: string; timedOut?: boolean }[]> {
  const today = dateOnly(new Date())
  const results: { vehicleId: string; odometer?: number; error?: string; timedOut?: boolean }[] = []
  for (let i = 0; i < vehicles.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1000))
    const v = vehicles[i]
    const tid = v.id.replace(/^tesla-/, '')
    try {
      const data = await getTeslaVehicleData(accessToken, tid)
      const odometer = data?.odometer
      if (odometer != null) {
        await recordOdometerSnapshot(v.id, today, odometer)
        results.push({ vehicleId: v.id, odometer })
      } else {
        results.push({
          vehicleId: v.id,
          error: data?.timedOut ? 'Request timeout (vehicle may be sleeping)' : 'No odometer in response',
          timedOut: data?.timedOut,
        })
      }
    } catch (e) {
      results.push({ vehicleId: v.id, error: (e as Error).message })
    }
    onProgress?.(i + 1, vehicles.length)
  }
  return results
}

/** One day's mileage derived from odometer snapshots. */
export interface DailyMiles {
  date: string
  startOdometer: number
  endOdometer: number
  miles: number
}

/** Get today's driven miles from snapshot (lastOdometer - firstOdometer for today), or undefined if none. */
export async function getTodayMilesFromSnapshot(vehicleId: string): Promise<number | undefined> {
  const rows = await getOdometerSnapshotsByVehicle(vehicleId)
  const today = format(new Date(), 'yyyy-MM-dd')
  const row = rows.find((r) => r.date === today)
  if (!row || row.lastOdometer > MAX_REASONABLE_ODOMETER_MILES || row.firstOdometer > MAX_REASONABLE_ODOMETER_MILES)
    return undefined
  const miles = Math.max(0, row.lastOdometer - row.firstOdometer)
  return miles > 0 ? miles : undefined
}

/** Get daily miles for a vehicle from stored snapshots (for IRS log / reports). Skips rows with invalid odometer. */
export async function getDailyMilesByVehicle(vehicleId: string): Promise<DailyMiles[]> {
  const rows = await getOdometerSnapshotsByVehicle(vehicleId)
  return rows
    .filter(
      (r) =>
        Number.isFinite(r.firstOdometer) &&
        Number.isFinite(r.lastOdometer) &&
        r.firstOdometer <= MAX_REASONABLE_ODOMETER_MILES &&
        r.lastOdometer <= MAX_REASONABLE_ODOMETER_MILES
    )
    .map((r) => ({
      date: r.date,
      startOdometer: r.firstOdometer,
      endOdometer: r.lastOdometer,
      miles: Math.max(0, r.lastOdometer - r.firstOdometer),
    }))
    .filter((d) => d.miles > 0)
}

/** Convert daily miles + vehicle info into Trip-like records for list/export. Default purpose business. */
export function dailyMilesToTrips(
  daily: DailyMiles[],
  vehicleId: string,
  displayName: string,
  userId: string
): Trip[] {
  return daily.map((d) => ({
    id: `tesla-daily-${vehicleId}-${d.date}`,
    vehicleId,
    userId,
    startTime: `${d.date}T00:00:00.000Z`,
    endTime: `${d.date}T23:59:59.999Z`,
    startOdometer: d.startOdometer,
    endOdometer: d.endOdometer,
    miles: d.miles,
    purpose: 'business' as const,
    notes: `Tesla sync: ${displayName}`,
    source: 'tesla',
    confidence: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
}
