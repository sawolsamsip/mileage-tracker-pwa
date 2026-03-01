/**
 * Home server (Coolify) integration: register Tesla tokens for midnight sync, fetch server snapshots into IndexedDB.
 */
import {
  getOdometerSnapshotsByVehicle,
  putOdometerSnapshot,
  type OdometerSnapshotRow,
} from '@/lib/db'

export const SERVER_URL_KEY = 'mileage_server_url'

export function getServerUrl(): string {
  return (typeof localStorage !== 'undefined' && localStorage.getItem(SERVER_URL_KEY)) || ''
}

export function setServerUrl(url: string): void {
  if (typeof localStorage === 'undefined') return
  if (url.trim()) localStorage.setItem(SERVER_URL_KEY, url.trim())
  else localStorage.removeItem(SERVER_URL_KEY)
}

function baseUrl(url: string): string {
  const u = url.trim().replace(/\/+$/, '')
  return u || ''
}

/** Register current Tesla tokens and vehicles with the home server so it can run midnight sync. */
export async function registerWithServer(
  serverUrl: string,
  payload: {
    access_token: string
    refresh_token: string
    expires_at: number
    vehicles: { id: string; displayName: string }[]
  }
): Promise<void> {
  const base = baseUrl(serverUrl)
  if (!base) throw new Error('Server URL is required')
  const res = await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Server returned ${res.status}`)
  }
}

/** Fetch snapshots from server and merge into IndexedDB (keep min first, max last per id). */
export async function fetchServerSnapshots(serverUrl: string): Promise<{ merged: number }> {
  const base = baseUrl(serverUrl)
  if (!base) throw new Error('Server URL is required')
  const res = await fetch(`${base}/api/snapshots`)
  if (!res.ok) throw new Error(`Server snapshots: ${res.status}`)
  const rows = (await res.json()) as OdometerSnapshotRow[]
  let merged = 0
  for (const row of rows) {
    if (!row?.id || !row.vehicleId || !row.date || typeof row.firstOdometer !== 'number' || typeof row.lastOdometer !== 'number')
      continue
    const existing = await getOdometerSnapshotsByVehicle(row.vehicleId).then((list) =>
      list.find((r) => r.date === row.date)
    )
    const first = existing ? Math.min(existing.firstOdometer, row.firstOdometer) : row.firstOdometer
    const last = existing ? Math.max(existing.lastOdometer, row.lastOdometer) : row.lastOdometer
    await putOdometerSnapshot({
      id: row.id,
      vehicleId: row.vehicleId,
      date: row.date,
      firstOdometer: first,
      lastOdometer: last,
      updatedAt: row.updatedAt || new Date().toISOString(),
    })
    merged++
  }
  return { merged }
}

export async function checkServerHealth(serverUrl: string): Promise<boolean> {
  const base = baseUrl(serverUrl)
  if (!base) return false
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}
