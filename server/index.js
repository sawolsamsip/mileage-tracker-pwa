/**
 * Midnight Tesla odometer sync server.
 * Deploy on Coolify (e.g. 192.168.1.188). Register tokens from the PWA; server runs sync at 00:00 daily.
 */
import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import webPush from 'web-push'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const PORT = Number(process.env.PORT) || 3131
const STATIC_DIR = process.env.STATIC_DIR ? resolve(__dirname, process.env.STATIC_DIR) : null
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data')
const STATE_FILE = join(DATA_DIR, 'state.json')
const SNAPSHOTS_FILE = join(DATA_DIR, 'snapshots.json')
const PUSH_SUBSCRIPTIONS_FILE = join(DATA_DIR, 'push-subscriptions.json')

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

async function loadPushSubscriptions() {
  await ensureDataDir()
  if (!existsSync(PUSH_SUBSCRIPTIONS_FILE)) return []
  const raw = await readFile(PUSH_SUBSCRIPTIONS_FILE, 'utf8')
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function savePushSubscriptions(subs) {
  await ensureDataDir()
  await writeFile(PUSH_SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2), 'utf8')
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

/** Public config: client ID for OAuth (same value as TESLA_CLIENT_ID). */
app.get('/api/tesla/config', (_, res) => {
  try {
    const clientId = (process.env.TESLA_CLIENT_ID ?? '').trim()
    res.json({ clientId })
  } catch {
    res.json({ clientId: '' })
  }
})

/** Proxy Tesla OAuth token exchange (avoids CORS when callback runs in browser). */
app.post('/api/tesla/exchange-token', async (req, res) => {
  try {
    const { code, code_verifier, redirect_uri } = req.body || {}
    if (!code || !code_verifier || !redirect_uri) {
      return res.status(400).json({ error: 'Need code, code_verifier, redirect_uri' })
    }
    const clientId = getClientId()
    const bodyFleet = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirect_uri,
      code,
      code_verifier: code_verifier,
      audience: TESLA_FLEET_ORIGIN,
    })
    let tokenRes = await fetch(TESLA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyFleet,
    })
    if (tokenRes.status === 400) {
      const bodyAuth = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirect_uri,
        code,
        code_verifier: code_verifier,
      })
      tokenRes = await fetch('https://auth.tesla.com/oauth2/v3/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyAuth,
      })
    }
    const text = await tokenRes.text()
    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({ error: text || 'Tesla token error' })
    }
    res.json(JSON.parse(text))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** Proxy Tesla token refresh (server uses TESLA_CLIENT_ID). */
app.post('/api/tesla/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body || {}
    if (!refresh_token) {
      return res.status(400).json({ error: 'Need refresh_token' })
    }
    const clientId = getClientId()
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token,
      audience: TESLA_FLEET_ORIGIN,
    })
    const r = await fetch(TESLA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const text = await r.text()
    if (!r.ok) {
      return res.status(r.status).json({ error: text || 'Tesla refresh error' })
    }
    res.json(JSON.parse(text))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** Proxy Tesla Fleet API vehicles list (avoids CORS). */
app.get('/api/tesla/vehicles', async (req, res) => {
  try {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization header' })
    }
    const r = await fetch(`${TESLA_FLEET_ORIGIN}/api/1/vehicles`, {
      headers: { Authorization: auth },
    })
    const text = await r.text()
    if (!r.ok) {
      return res.status(r.status).json({ error: text || 'Tesla vehicles error' })
    }
    res.json(JSON.parse(text))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** Proxy Tesla Fleet API vehicle_data (odometer etc., avoids CORS). */
app.get('/api/tesla/vehicles/:id/vehicle_data', async (req, res) => {
  try {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization header' })
    }
    const { id } = req.params
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
    const r = await fetch(`${TESLA_FLEET_ORIGIN}/api/1/vehicles/${id}/vehicle_data${qs}`, {
      headers: { Authorization: auth },
    })
    const text = await r.text()
    if (r.status === 408) {
      return res.status(408).json({ timedOut: true })
    }
    if (!r.ok) {
      return res.status(r.status).send(text || 'Tesla vehicle_data error')
    }
    res.setHeader('Content-Type', 'application/json').send(text)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** Proxy Tesla Fleet API telemetry (optional odometer fallback, avoids CORS). */
app.get('/api/tesla/vehicles/:id/telemetry', async (req, res) => {
  try {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization header' })
    }
    const { id } = req.params
    const r = await fetch(`${TESLA_FLEET_ORIGIN}/api/1/vehicles/${id}/telemetry`, {
      headers: { Authorization: auth },
    })
    const text = await r.text()
    if (!r.ok) {
      return res.status(r.status).send(text || 'Tesla telemetry error')
    }
    res.setHeader('Content-Type', 'application/json').send(text)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

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

const VAPID_PUBLIC = (process.env.VAPID_PUBLIC_KEY ?? '').trim()
const VAPID_PRIVATE = (process.env.VAPID_PRIVATE_KEY ?? '').trim()
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webPush.setVapidDetails('mailto:support@mongoori.com', VAPID_PUBLIC, VAPID_PRIVATE)
}

app.get('/api/push-config', (_, res) => {
  if (!VAPID_PUBLIC) return res.status(503).json({ error: 'Push not configured (missing VAPID_PUBLIC_KEY)' })
  res.json({ vapidPublicKey: VAPID_PUBLIC })
})

app.post('/api/push-subscribe', express.json(), async (req, res) => {
  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return res.status(503).json({ error: 'Push not configured' })
    }
    const subscription = req.body?.subscription
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Need subscription object with endpoint' })
    }
    const subs = await loadPushSubscriptions()
    const key = subscription.endpoint
    if (!subs.find((s) => s.endpoint === key)) {
      subs.push(subscription)
      await savePushSubscriptions(subs)
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/push-unsubscribe', express.json(), async (req, res) => {
  try {
    const endpoint = req.body?.endpoint
    if (!endpoint) return res.status(400).json({ error: 'Need endpoint' })
    const subs = (await loadPushSubscriptions()).filter((s) => s.endpoint !== endpoint)
    await savePushSubscriptions(subs)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

async function sendPushToAll(payload) {
  if (!VAPID_PRIVATE) return
  const subs = await loadPushSubscriptions()
  const body = JSON.stringify(payload)
  const results = await Promise.allSettled(
    subs.map((sub) => webPush.sendNotification(sub, body))
  )
  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length > 0) {
    const toRemove = failed
      .map((r, i) => (r.status === 'rejected' && r.reason?.statusCode === 410 ? subs[i] : null))
      .filter(Boolean)
    if (toRemove.length > 0) {
      const endpoints = new Set(toRemove.map((s) => s.endpoint))
      const kept = (await loadPushSubscriptions()).filter((s) => !endpoints.has(s.endpoint))
      await savePushSubscriptions(kept)
    }
  }
}

if (STATIC_DIR) {
  app.use(express.static(STATIC_DIR))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(join(STATIC_DIR, 'index.html'))
  })
}

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

// Weekly summary push: Monday 8:00
cron.schedule('0 8 * * 1', async () => {
  try {
    await sendPushToAll({
      title: 'Mileage Tracker Pro',
      body: 'Your weekly mileage summary is ready. Open the app to view Reports.',
      url: '/reports',
    })
  } catch (e) {
    console.error('[cron] Weekly push failed:', e)
  }
})

app.listen(PORT, () => {
  console.log(`Mileage midnight sync listening on port ${PORT}`)
  console.log('Register from PWA: POST /api/register with tokens + vehicles')
  console.log('Fetch snapshots: GET /api/snapshots')
})
