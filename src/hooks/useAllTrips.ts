import { useState, useEffect, useCallback } from 'react'
import type { Trip } from '@/types'
import { getOfflineTrips } from '@/lib/db'
import { getDailyMilesByVehicle, dailyMilesToTrips } from '@/lib/teslaOdometerSync'
import { TESLA_VEHICLES_KEY } from '@/pages/AuthTeslaCallback'

const USER_ID_LOCAL = 'local'

function loadTeslaVehiclesFromStorage(): { id: string; displayName: string }[] {
  try {
    const raw = localStorage.getItem(TESLA_VEHICLES_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as { id: string; displayName: string }[]
    return list
  } catch {
    return []
  }
}

/** Combined trips: IndexedDB (manual/gps) + Tesla daily miles from odometer snapshots. */
export function useAllTrips(): { trips: Trip[]; loading: boolean; refresh: () => void } {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [offline, teslaVehicles] = await Promise.all([
        getOfflineTrips(),
        Promise.resolve(loadTeslaVehiclesFromStorage()),
      ])
      const byId = new Map<string, Trip>()
      offline.forEach((t) => byId.set(t.id, t))
      for (const v of teslaVehicles) {
        const daily = await getDailyMilesByVehicle(v.id)
        const fromTesla = dailyMilesToTrips(daily, v.id, v.displayName, USER_ID_LOCAL)
        fromTesla.forEach((t) => byId.set(t.id, t))
      }
      const merged = Array.from(byId.values()).sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
      setTrips(merged)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { trips, loading, refresh }
}
