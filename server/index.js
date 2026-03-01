/**
 * Midnight Tesla odometer sync server.
 * Deploy on Coolify (e.g. 192.168.1.188). Register tokens from the PWA; server runs sync at 00:00 daily.
 */
import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const PORT = Number(process.env.PORT) || 3131
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data')
const STATE_FILE = join(DATA_DIR, 'state.json')
const SNAPSHOTS_FILE = join(DATA_DIR, 'snapshots.json')

const TESLA_FLEET_ORIGIN = 'https://fleet-api.prd.na.vn.cloud.tesla.com'
const TESLA_TOKEN_URL = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token'
const MAX_REASONABLE_ODOMETER_MILES = 2_000_000
const METERS_PER_MILE = 1609.344

function toMiles(value) {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined
  if (value <= MAX_REASONABLE_ODOMETER_MILES) return value
  const fromMeters = value / METERS_PER_MILE
  if (fromMeters >= 0 && fromMeters <= MAX_REASONABLE_ODOMETER_MILES) return fromMeters
  const fromMm = value / (METERS_PER_MILE * 1000)
  if (fromMm >= 0 && fromMm <= MAX_REASONABLE_ODOMETER_MILES) return fromMm
  return undefined
}

function extractOdometer(data) {
  const raw = data?.response
  if (!raw) return undefined
  const vs = raw.vehicle_state ?? raw.vehicleState
  const odo = vs?.odometer ?? raw.odometer
  if (typeof odo === 'number' && Number.isFinite(odo)) return toMiles(odo)
  return undefined
}

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
}

async function loadState() {
  await ensureDataDir()
  if (!existsSync(STATE_FILE)) return null
  const raw = await readFile(STATE_FILE, 'utf8')
  return JSON.parse(raw)
}

async function saveState(state) {
  await ensureDataDir()
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
}

async function loadSnapshots() {
  await ensureDataDir()
  if (!existsSync(SNAPSHOTS_FILE)) return []
  const raw = await readFile(SNAPSHOTS_FILE, 'utf8')
  return JSON.parse(raw)
}

async function saveSnapshots(snapshots) {
  await ensureDataDir()
  await writeFile(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2), 'utf8')
}

function getClientId() {
  const id = process.env.TESLA_CLIENT_ID ?? ''
  if (!id.trim()) throw new Error('TESLA_CLIENT_ID env is required for token refresh')
  return id.trim()
}

async function refreshAccessToken(refreshToken) {
  const clientId = getClientId()
  const res = await fetch(TESLA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
      audience: TESLA_FLEET_ORIGIN,
    }),
  })
  if (!res.ok) throw new Error(`Tesla refresh: ${await res.text()}`)
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: data.expires_in ?? 3600,
  }
}

async function getTeslaOdometer(accessToken, vehicleId) {
  const url = `${TESLA_FLEET_ORIGIN}/api/1/vehicles/${vehicleId}/vehicle_data?endpoints=vehicle_state`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 408) return { timedOut: true }
  if (!res.ok) throw new Error(`Tesla API: ${await res.text()}`)
  const data = await res.json()
  const odometer = extractOdometer(data)
  return { odometer: odometer ?? undefined, timedOut: false }
}

function todayUTC() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

async function runMidnightSync() {
  const state = await loadState()
  if (!state?.refresh_token || !Array.isArray(state.vehicles) || state.vehicles.length === 0) {
    console.log('[midnight] No tokens/vehicles registered, skip sync')
    return
  }
  let accessToken = state.access_token
  const expiresAt = state.expires_at ?? 0
  if (Date.now() >= expiresAt - 60_000) {
    try {
      const refreshed = await refreshAccessToken(state.refresh_token)
      accessToken = refreshed.access_token
      const newState = {
        ...state,
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: Date.now() + refreshed.expires_in * 1000,
      }
      await saveState(newState)
    } catch (e) {
      console.error('[midnight] Token refresh failed:', e.message)
      return
    }
  }
  const date = todayUTC()
  const snapshots = await loadSnapshots()
  const byId = new Map(snapshots.map((s) => [s.id, s]))
  for (let i = 0; i < state.vehicles.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2500))
    const v = state.vehicles[i]
    const teslaId = (v.id || '').replace(/^tesla-/, '')
    if (!teslaId) continue
    try {
      const { odometer, timedOut } = await getTeslaOdometer(accessToken, teslaId)
      if (timedOut) {
        console.log(`[midnight] ${v.displayName || v.id} timeout (vehicle sleeping)`)
        continue
      }
      if (odometer == null || !Number.isFinite(odometer)) {
        console.log(`[midnight] ${v.displayName || v.id} no odometer`)
        continue
      }
      const id = `${v.id}_${date}`
      const existing = byId.get(id)
      const first = existing ? Math.min(existing.firstOdometer, odometer) : odometer
      const last = existing ? Math.max(existing.lastOdometer, odometer) : odometer
      const row = {
        id,
        vehicleId: v.id,
        date,
        firstOdometer: first,
        lastOdometer: last,
        updatedAt: new Date().toISOString(),
      }
      byId.set(id, row)
      console.log(`[midnight] ${v.displayName || v.id} ${odometer} mi`)
    } catch (e) {
      console.error(`[midnight] ${v.displayName || v.id} error:`, e.message)
    }
  }
  await saveSnapshots(Array.from(byId.values()))
}

const app = express()
app.use(cors({ origin: true }))
app.use(express.json())

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'mileage-midnight-sync' }))

app.post('/api/register', async (req, res) => {
  try {
    const { access_token, refresh_token, expires_at, vehicles } = req.body || {}
    if (!access_token || !refresh_token || !Array.isArray(vehicles) || vehicles.length === 0) {
      return res.status(400).json({ error: 'Need access_token, refresh_token, and non-empty vehicles' })
    }
    const state = {
      access_token,
      refresh_token,
      expires_at: Number(expires_at) || Date.now() + 8 * 3600 * 1000,
      vehicles: vehicles.map((v) => ({ id: v.id, displayName: v.displayName || v.id })),
      updatedAt: new Date().toISOString(),
    }
    await saveState(state)
    res.json({ ok: true, message: 'Registered for midnight sync' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/snapshots', async (_, res) => {
  try {
    const snapshots = await loadSnapshots()
    res.json(snapshots)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

await ensureDataDir()

// Run every day at 00:00 server local time
cron.schedule('0 0 * * *', async () => {
  console.log('[cron] Running midnight sync')
  try {
    await runMidnightSync()
  } catch (e) {
    console.error('[cron] Midnight sync failed:', e)
  }
})

app.listen(PORT, () => {
  console.log(`Mileage midnight sync listening on port ${PORT}`)
  console.log('Register from PWA: POST /api/register with tokens + vehicles')
  console.log('Fetch snapshots: GET /api/snapshots')
})
