import { useState, useEffect, useCallback } from 'react'
import { getOdometerSnapshotsByVehicle } from '@/lib/db'
import { TESLA_VEHICLES_KEY } from '@/pages/AuthTeslaCallback'
import { format } from 'date-fns'

function loadTeslaVehicles(): { id: string }[] {
  try {
    const raw = localStorage.getItem(TESLA_VEHICLES_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as { id: string }[]
    return list.filter((v) => v.id?.startsWith('tesla-'))
  } catch {
    return []
  }
}

/** Returns dates (yyyy-MM-dd) in the given year that have no Tesla snapshot for any vehicle. */
export function useMissingDays(year: number): { missingDates: string[]; loading: boolean; refresh: () => void } {
  const [missingDates, setMissingDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const vehicles = loadTeslaVehicles()
      if (vehicles.length === 0) {
        setMissingDates([])
        return
      }
      const today = new Date()
      const start = new Date(year, 0, 1)
      const end = year < today.getFullYear() ? new Date(year, 11, 31) : today
      const rangeDates = new Set<string>()
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        rangeDates.add(format(d, 'yyyy-MM-dd'))
      }
      const hasSnapshot = new Set<string>()
      for (const v of vehicles) {
        const rows = await getOdometerSnapshotsByVehicle(v.id)
        rows
          .filter((r) => r.date.startsWith(String(year)))
          .forEach((r) => hasSnapshot.add(r.date))
      }
      const missing = Array.from(rangeDates).filter((d) => !hasSnapshot.has(d)).sort()
      setMissingDates(missing)
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { missingDates, loading, refresh }
}
