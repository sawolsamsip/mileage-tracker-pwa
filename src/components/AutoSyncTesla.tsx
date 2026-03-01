/**
 * - On app load: if we haven't synced today, run a background sync (capture odometer for today).
 * - Schedule a sync at local midnight (00:00) every day while the app is open (IRS-accurate daily snapshot).
 */
import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { getTeslaTokens, TESLA_VEHICLES_KEY } from '@/pages/AuthTeslaCallback'
import { getCache, setCache } from '@/lib/db'
import { syncOdometerFromTesla } from '@/lib/teslaOdometerSync'
import { getServerUrl, fetchServerSnapshots } from '@/lib/serverSync'

const AUTO_SYNC_CACHE_KEY = 'lastAutoSyncDate'

function loadVehicles(): { id: string; displayName: string }[] {
  try {
    const raw = localStorage.getItem(TESLA_VEHICLES_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** Milliseconds until next local midnight (00:00:00.000). */
function msUntilNextMidnight(): number {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  return next.getTime() - now.getTime()
}

function runSyncAndReschedule(): void {
  const tokens = getTeslaTokens()
  const vehicles = loadVehicles().filter((v) => v.id?.startsWith('tesla-'))
  if (!tokens || tokens.expires_at < Date.now() || vehicles.length === 0) {
    scheduleNextMidnight()
    return
  }
  syncOdometerFromTesla(tokens.access_token, vehicles).then(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    setCache(AUTO_SYNC_CACHE_KEY, today)
    scheduleNextMidnight()
  })
}

let midnightTimerId: ReturnType<typeof setTimeout> | null = null

function scheduleNextMidnight(): void {
  if (midnightTimerId != null) clearTimeout(midnightTimerId)
  const ms = msUntilNextMidnight()
  midnightTimerId = setTimeout(() => {
    midnightTimerId = null
    runSyncAndReschedule()
  }, ms)
}

export default function AutoSyncTesla() {
  const didRun = useRef(false)

  // Sync once when app loads if we haven't synced today
  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    const today = format(new Date(), 'yyyy-MM-dd')
    const serverUrl = getServerUrl()
    if (serverUrl) {
      fetchServerSnapshots(serverUrl).catch(() => {})
    }
    getCache<string>(AUTO_SYNC_CACHE_KEY).then((last) => {
      if (last === today) {
        scheduleNextMidnight()
        return
      }
      const tokens = getTeslaTokens()
      const vehicles = loadVehicles().filter((v) => v.id?.startsWith('tesla-'))
      if (!tokens || tokens.expires_at < Date.now() || vehicles.length === 0) {
        scheduleNextMidnight()
        return
      }

      syncOdometerFromTesla(tokens.access_token, vehicles).then((results) => {
        const anySuccess = results.some((r) => r.odometer != null)
        if (anySuccess) setCache(AUTO_SYNC_CACHE_KEY, today)
        scheduleNextMidnight()
      })
    })
  }, [])

  useEffect(() => {
    return () => {
      if (midnightTimerId != null) clearTimeout(midnightTimerId)
      midnightTimerId = null
    }
  }, [])

  return null
}
