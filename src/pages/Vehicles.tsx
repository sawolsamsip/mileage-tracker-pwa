import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Car, Plus, Zap, RefreshCw } from 'lucide-react'
import { getTeslaAuthUrl, isTeslaOAuthConfigured } from '@/lib/tesla'
import { getSmartcarAuthUrl } from '@/lib/smartcar'
import { getTeslaTokens, TESLA_VEHICLES_KEY } from '@/pages/AuthTeslaCallback'
import { getTeslaVehicleData, formatOdometerMiles } from '@/lib/tesla'
import { syncOdometerFromTesla, getTodayMilesFromSnapshot } from '@/lib/teslaOdometerSync'

type VehicleRow = { id: string; displayName: string; provider: string; odometerMiles?: number }

function loadVehiclesFromStorage(): VehicleRow[] {
  try {
    const raw = localStorage.getItem(TESLA_VEHICLES_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as { id: string; displayName: string; teslaVehicleId?: string }[]
    return list.map((v) => ({ id: v.id, displayName: v.displayName, provider: 'tesla', odometerMiles: undefined }))
  } catch {
    return []
  }
}

export default function Vehicles() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [vehicles, setVehicles] = useState<VehicleRow[]>(loadVehiclesFromStorage)
  const [odometerCache, setOdometerCache] = useState<Record<string, number>>({})
  const [todayMilesCache, setTodayMilesCache] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [teslaConfigError, setTeslaConfigError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null)

  const [showTeslaSuccess, setShowTeslaSuccess] = useState(false)
  const justConnected = searchParams.get('tesla') === 'connected'
  useEffect(() => {
    if (justConnected) {
      setSearchParams({}, { replace: true })
      setVehicles(loadVehiclesFromStorage())
      setShowTeslaSuccess(true)
      const t = setTimeout(() => setShowTeslaSuccess(false), 5000)
      return () => clearTimeout(t)
    }
  }, [justConnected, setSearchParams])

  useEffect(() => {
    const tokens = getTeslaTokens()
    if (!tokens || tokens.expires_at < Date.now()) return
    const list = loadVehiclesFromStorage().filter((v) => v.provider === 'tesla')
    if (list.length === 0) return
    setLoading(true)
    Promise.all(
      list.map(async (v) => {
        const id = v.id.replace('tesla-', '')
        try {
          const data = await getTeslaVehicleData(tokens.access_token, id)
          return { id: v.id, miles: data?.odometer }
        } catch {
          return { id: v.id, miles: undefined }
        }
      })
    )
      .then((results) => {
        const next: Record<string, number> = {}
        results.forEach((r) => { if (r.miles != null) next[r.id] = r.miles })
        setOdometerCache((prev) => ({ ...prev, ...next }))
      })
      .finally(() => setLoading(false))
  }, [vehicles.length])

  useEffect(() => {
    const list = loadVehiclesFromStorage().filter((v) => v.provider === 'tesla')
    if (list.length === 0) return
    Promise.all(list.map(async (v) => ({ id: v.id, miles: await getTodayMilesFromSnapshot(v.id) })))
      .then((results) => {
        const next: Record<string, number> = {}
        results.forEach((r) => { if (r.miles != null) next[r.id] = r.miles })
        setTodayMilesCache(next)
      })
  }, [vehicles.length, syncStatus])

  const connectTesla = async () => {
    if (!isTeslaOAuthConfigured()) {
      setTeslaConfigError('Set TESLA_CLIENT_ID in the server environment (e.g. Coolify Environment), or VITE_TESLA_CLIENT_ID in .env for local dev. Get your Client ID from Tesla Developer.')
      return
    }
    setTeslaConfigError(null)
    try {
      const { url } = await getTeslaAuthUrl()
      window.location.href = url
    } catch (e) {
      setTeslaConfigError((e as Error).message)
    }
  }

  const connectSmartcar = () => {
    window.location.href = getSmartcarAuthUrl()
  }

  const syncFromTesla = async () => {
    const tokens = getTeslaTokens()
    if (!tokens || tokens.expires_at < Date.now()) {
      setSyncStatus('Tesla session expired. Connect Tesla again.')
      return
    }
    const list = loadVehiclesFromStorage().filter((v) => v.provider === 'tesla')
    if (list.length === 0) {
      setSyncStatus('No Tesla vehicles connected.')
      return
    }
    setSyncing(true)
    setSyncProgress({ current: 0, total: list.length })
    setSyncStatus(
      `Syncing 0 / ${list.length} vehicle(s)… This can take 10–30 seconds depending on Tesla response time.`
    )
    try {
      const results = await syncOdometerFromTesla(tokens.access_token, list, (index, total) => {
        setSyncProgress({ current: index, total })
        setSyncStatus(`Syncing ${index} / ${total} vehicle(s)…`)
      })
      const ok = results.filter((r) => r.odometer != null).length
      const anyTimeout = results.some((r) => r.timedOut)
      const err = results.find((r) => r.error)
      if (ok > 0) {
        setSyncStatus(anyTimeout ? `Odometer synced for ${ok} vehicle(s). Some timed out (try again for the rest).` : `Odometer synced for ${ok} vehicle(s). Check Trips.`)
      } else if (anyTimeout) {
        setSyncStatus('Vehicles are not responding (likely sleeping). Wait a few minutes and try Sync again, or add trips manually in Trips.')
      } else if (err?.error?.includes('No odometer')) {
        setSyncStatus('Odometer not available from Tesla for this account/region. You can still add trips manually in Trips.')
      } else if (err) {
        setSyncStatus(`${err.error ?? err.vehicleId} Try again later.`)
      } else {
        setSyncStatus('Odometer synced for 0 vehicle(s). Check Trips or add trips manually.')
      }
      const next: Record<string, number> = {}
      results.forEach((r) => { if (r.odometer != null) next[r.vehicleId] = r.odometer })
      setOdometerCache((prev) => ({ ...prev, ...next }))
      Promise.all(list.map(async (v) => ({ id: v.id, miles: await getTodayMilesFromSnapshot(v.id) })))
        .then((res) => {
          const today: Record<string, number> = {}
          res.forEach((r) => { if (r.miles != null) today[r.id] = r.miles })
          setTodayMilesCache((prev) => ({ ...prev, ...today }))
        })
    } catch (e) {
      setSyncStatus((e as Error).message)
    } finally {
      setSyncing(false)
      setSyncProgress(null)
    }
  }

  const syncStatusColor =
    !syncStatus || syncStatus.startsWith('Syncing ')
      ? 'text-slate-400'
      : syncStatus.startsWith('Odometer synced')
        ? 'text-[var(--success)]'
        : 'text-[var(--warning)]'

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Vehicles</h2>
      {showTeslaSuccess && (
        <p className="rounded-lg bg-[var(--success)]/20 px-3 py-2 text-sm text-[var(--success)]">
          Tesla connected. Your vehicles are listed below.
        </p>
      )}

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <Car className="mx-auto h-12 w-12 text-slate-500" />
          <p className="mt-2 text-sm text-slate-400">No vehicles yet</p>
          <p className="mt-1 text-xs text-slate-500">Connect Tesla or Smartcar for automatic odometer & trip data.</p>
        </div>
      ) : (
        <>
          {vehicles.some((v) => v.provider === 'tesla') && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-sm text-slate-400">
                Sync today&apos;s odometer from Tesla to build daily mileage. Check Trips and Reports after syncing.
              </p>
              <button
                type="button"
                onClick={syncFromTesla}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)]/20 px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing && syncProgress
                  ? `Syncing ${syncProgress.current}/${syncProgress.total}`
                  : 'Sync from Tesla'}
              </button>
              {syncStatus && (
                <p className={`text-sm ${syncStatusColor}`}>
                  {syncStatus}
                </p>
              )}
            </div>
          )}
          <ul className="space-y-2">
          {vehicles.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200">{v.displayName}</span>
                <span className="text-sm text-slate-500">{v.provider}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                {(odometerCache[v.id] ?? v.odometerMiles) != null && (
                  <span className="text-[var(--accent)]">
                    Total: {formatOdometerMiles(odometerCache[v.id] ?? v.odometerMiles)}
                  </span>
                )}
                {todayMilesCache[v.id] != null && todayMilesCache[v.id] > 0 && (
                  <span className="text-slate-400">Today: {Math.round(todayMilesCache[v.id])} mi</span>
                )}
                {loading && odometerCache[v.id] == null && v.provider === 'tesla' && (
                  <span className="text-xs text-slate-500">…</span>
                )}
              </div>
            </li>
          ))}
        </ul>
        </>
      )}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
          <Plus className="h-4 w-4" />
          Add vehicle
        </h3>
        {teslaConfigError && (
          <p className="mb-3 rounded-lg bg-[var(--warning)]/20 px-3 py-2 text-sm text-[var(--warning)]">
            {teslaConfigError}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={connectTesla}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)]/20 px-4 py-2 text-sm font-medium text-[var(--accent)]"
          >
            <Zap className="h-4 w-4" />
            Connect Tesla
          </button>
          <button
            type="button"
            onClick={connectSmartcar}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-slate-300"
          >
            Connect Smartcar
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-slate-400"
          >
            Add manual vehicle
          </button>
        </div>
      </section>
    </div>
  )
}
