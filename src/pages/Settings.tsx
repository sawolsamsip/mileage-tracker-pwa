import { useState, useEffect } from 'react'
import { Bell, Database, Shield, Server, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { getServerUrl, setServerUrl, registerWithServer, fetchServerSnapshots, checkServerHealth } from '@/lib/serverSync'
import { getTeslaTokens, TESLA_VEHICLES_KEY } from '@/pages/AuthTeslaCallback'

function loadVehicles(): { id: string; displayName: string }[] {
  try {
    const raw = localStorage.getItem(TESLA_VEHICLES_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export default function Settings() {
  const [serverUrl, setServerUrlState] = useState('')
  const [serverOk, setServerOk] = useState<boolean | null>(null)
  const [serverBusy, setServerBusy] = useState(false)
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  useEffect(() => {
    setServerUrlState(getServerUrl())
  }, [])

  useEffect(() => {
    const url = getServerUrl() || serverUrl
    checkServerHealth(url).then(setServerOk)
  }, [serverUrl])

  const handleSaveUrl = () => {
    setServerUrl(serverUrl)
    setServerMessage('URL saved.')
    setTimeout(() => setServerMessage(null), 3000)
    checkServerHealth(serverUrl).then(setServerOk)
  }

  const handleRegister = async () => {
    const url = getServerUrl() ?? serverUrl
    const tokens = getTeslaTokens()
    if (!tokens || tokens.expires_at < Date.now()) {
      setServerMessage('Connect Tesla in Vehicles first and ensure token is valid.')
      return
    }
    const vehicles = loadVehicles().filter((v) => v.id?.startsWith('tesla-'))
    if (vehicles.length === 0) {
      setServerMessage('No Tesla vehicles. Connect Tesla in Vehicles first.')
      return
    }
    setServerBusy(true)
    setServerMessage(null)
    try {
      await registerWithServer(url, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at,
        vehicles,
      })
      setServerMessage('Registered. Server will sync at midnight (00:00) daily.')
    } catch (e) {
      setServerMessage((e as Error).message)
    } finally {
      setServerBusy(false)
    }
  }

  const handleFetchSnapshots = async () => {
    const url = getServerUrl() ?? serverUrl
    setServerBusy(true)
    setServerMessage(null)
    try {
      const { merged } = await fetchServerSnapshots(url)
      setServerMessage(`Fetched and merged ${merged} snapshot(s) from server.`)
    } catch (e) {
      setServerMessage((e as Error).message)
    } finally {
      setServerBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Settings</h2>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
          <Server className="h-4 w-4" />
          Home server (midnight sync)
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Leave empty to use the same origin (single-server deploy). Only set a URL if the API runs on a different host (e.g. another server).
        </p>
        <div className="flex flex-col gap-2">
          <input
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrlState(e.target.value)}
            onBlur={handleSaveUrl}
            placeholder="Leave empty to use current origin"
            className="w-full rounded-lg border border-[var(--border)] bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <div className="flex flex-wrap gap-2 items-center">
            {serverOk === true && <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="h-3.5 w-3.5" /> Server reachable</span>}
            {serverOk === false && <span className="flex items-center gap-1 text-xs text-amber-400"><XCircle className="h-3.5 w-3.5" /> Server unreachable</span>}
            <button
              type="button"
              onClick={handleRegister}
              disabled={serverBusy}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Register with server
            </button>
            <button
              type="button"
              onClick={handleFetchSnapshots}
              disabled={serverBusy}
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Fetch server snapshots
            </button>
          </div>
          {serverMessage && <p className="text-xs text-slate-400">{serverMessage}</p>}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
          <Bell className="h-4 w-4" />
          Notifications
        </h3>
        <p className="text-xs text-slate-500">Enable push notifications for trip reminders and weekly summary (when implemented).</p>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-400">
          <input type="checkbox" className="rounded border-[var(--border)]" />
          Push notifications
        </label>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
          <Database className="h-4 w-4" />
          Data & backup
        </h3>
        <p className="text-xs text-slate-500">Trips are stored in Supabase and cached offline in IndexedDB. Export from Reports.</p>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
          <Shield className="h-4 w-4" />
          Privacy
        </h3>
        <p className="text-xs text-slate-500">Location data is used only for trip detection. Tesla/Smartcar data is used for odometer and trip sync.</p>
      </section>
    </div>
  )
}
