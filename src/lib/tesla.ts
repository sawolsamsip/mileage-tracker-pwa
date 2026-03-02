/**
 * Tesla Fleet API integration (OAuth 2.0 + vehicle data).
 * Use Tesla's fleet-api auth or Smartcar as fallback for non-fleet vehicles.
 * @see https://developer.tesla.com/docs/fleet-api
 */

import { randomUUID } from '@/lib/uuid'

const TESLA_FLEET_ORIGIN = 'https://fleet-api.prd.na.vn.cloud.tesla.com'
/** In dev we proxy through Vite to avoid CORS; in prod we call Fleet API directly. */
const TESLA_FLEET_BASE =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? '/api/tesla-fleet'
    : TESLA_FLEET_ORIGIN

const TESLA_TOKEN_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? '/api/tesla-auth/oauth2/v3/token'
    : 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token'

export interface TeslaTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  created_at: number
}

export interface TeslaVehicle {
  id: number
  vin: string
  display_name: string
  state: string
  vehicle_config?: { car_type: string }
}

export interface VehicleDataResponse {
  response: {
    odometer?: number
    drive_state?: { latitude: number; longitude: number; heading: number; speed: number | null }
  }
}

/** Whether Tesla OAuth is configured. In prod server has TESLA_CLIENT_ID; in dev we check .env. */
export function isTeslaOAuthConfigured(): boolean {
  if (import.meta.env.PROD) return true
  return Boolean((import.meta.env.VITE_TESLA_CLIENT_ID ?? '').trim())
}

const CLIENT_ID_ERR =
  'Set TESLA_CLIENT_ID in the server environment (e.g. Coolify Environment), or VITE_TESLA_CLIENT_ID in .env for local dev.'

/** Build Tesla Fleet API auth URL (PKCE). Store code_verifier in sessionStorage for callback. Throws if client_id not set. */
export async function getTeslaAuthUrl(): Promise<{ url: string; codeVerifier: string }> {
  let clientId: string
  if (import.meta.env.PROD) {
    const configRes = await fetch('/api/tesla/config')
    const config = (await configRes.json().catch(() => ({}))) as { clientId?: string }
    clientId = (config.clientId ?? '').trim()
  } else {
    clientId = (import.meta.env.VITE_TESLA_CLIENT_ID ?? '').trim()
  }
  if (!clientId) throw new Error(CLIENT_ID_ERR)
  const redirectUri = (import.meta.env.VITE_TESLA_REDIRECT_URI ?? '').trim() || `${window.location.origin}/auth/tesla/callback`
  const state = randomUUID()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier))
  sessionStorage.setItem('tesla_code_verifier', codeVerifier)
  sessionStorage.setItem('tesla_state', state)
  localStorage.setItem('tesla_code_verifier', codeVerifier)
  localStorage.setItem('tesla_state', state)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid offline_access vehicle_device_data vehicle_cmds',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return {
    url: `https://auth.tesla.com/oauth2/v3/authorize?${params}`,
    codeVerifier,
  }
}

/** Exchange auth code for tokens. In production uses same-origin proxy to avoid CORS. */
export async function exchangeTeslaCode(code: string): Promise<TeslaTokens> {
  const redirectUri = (import.meta.env.VITE_TESLA_REDIRECT_URI ?? '').trim() || `${window.location.origin}/auth/tesla/callback`
  const codeVerifier = sessionStorage.getItem('tesla_code_verifier') ?? localStorage.getItem('tesla_code_verifier')
  if (!codeVerifier) throw new Error('Missing code_verifier')

  if (import.meta.env.PROD) {
    const res = await fetch('/api/tesla/exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || `Token exchange: ${res.status}`)
    return data as TeslaTokens
  }

  const clientId = import.meta.env.VITE_TESLA_CLIENT_ID ?? ''
  const bodyFleet = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
    audience: TESLA_FLEET_ORIGIN,
  })
  let res = await fetch(TESLA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyFleet,
  })
  if (res.status === 400) {
    const bodyAuth = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    })
    const authUrl = '/api/tesla-auth-consumer/oauth2/v3/token'
    res = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyAuth,
    })
  }
  if (!res.ok) throw new Error(`Tesla token error: ${await res.text()}`)
  return res.json()
}

/** Refresh Tesla access token. In production uses same-origin proxy (server uses TESLA_CLIENT_ID). */
export async function refreshTeslaToken(refreshToken: string): Promise<TeslaTokens> {
  if (import.meta.env.PROD) {
    const res = await fetch('/api/tesla/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || `Token refresh: ${res.status}`)
    return data as TeslaTokens
  }
  const clientId = import.meta.env.VITE_TESLA_CLIENT_ID ?? ''
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
  if (!res.ok) throw new Error(`Tesla refresh error: ${await res.text()}`)
  return res.json()
}

/** List vehicles for the authenticated user. In production uses same-origin proxy to avoid CORS. */
export async function listTeslaVehicles(accessToken: string): Promise<TeslaVehicle[]> {
  const url = import.meta.env.PROD ? '/api/tesla/vehicles' : `${TESLA_FLEET_BASE}/api/1/vehicles`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Tesla vehicles: ${res.status}`)
  }
  const data = await res.json()
  return data.response ?? []
}


/** Odometer above this is treated as wrong unit or bad data. */
export const MAX_REASONABLE_ODOMETER_MILES = 2_000_000
const METERS_PER_MILE = 1609.344

/** Format odometer for display; returns "—" if value is unreasonably large (bad data). */
export function formatOdometerMiles(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value) || value < 0 || value > MAX_REASONABLE_ODOMETER_MILES) return "—"
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi`
}

/** Normalize odometer to miles. API may return miles or meters; reject impossible values. */
function toMiles(value: number): number | undefined {
  if (!Number.isFinite(value) || value < 0) return undefined
  if (value <= MAX_REASONABLE_ODOMETER_MILES) return value
  const fromMeters = value / METERS_PER_MILE
  if (fromMeters >= 0 && fromMeters <= MAX_REASONABLE_ODOMETER_MILES) return fromMeters
  const fromMm = value / (METERS_PER_MILE * 1000)
  if (fromMm >= 0 && fromMm <= MAX_REASONABLE_ODOMETER_MILES) return fromMm
  return undefined
}

/** Extract total odometer from vehicle_data response. Use only documented path (vehicle_state.odometer) so each vehicle gets its own value, not a shared field. */
function extractOdometerFromVehicleData(data: unknown): number | undefined {
  const raw = (data as Record<string, unknown>)?.response as Record<string, unknown> | undefined
  if (!raw) return undefined
  const vs = (raw.vehicle_state ?? raw.vehicleState) as Record<string, unknown> | undefined
  const odo = vs?.odometer
  if (typeof odo === 'number' && Number.isFinite(odo)) return toMiles(odo)
  if (typeof raw.odometer === 'number' && Number.isFinite(raw.odometer)) return toMiles(raw.odometer as number)
  return undefined
}

/** Result from getTeslaVehicleData; timedOut means Tesla returned 408 (vehicle sleeping). */
export type TeslaVehicleDataResult = VehicleDataResponse['response'] & { timedOut?: boolean }

/** Base URL for vehicle API. Use same-origin proxy whenever Tesla Fleet would be cross-origin (avoids CORS). */
function vehicleDataBase(vehicleId: string): string {
  const proxyPath = `/api/tesla/vehicles/${vehicleId}`
  if (typeof window === 'undefined') return `${TESLA_FLEET_BASE}/api/1/vehicles/${vehicleId}`
  if (window.location.origin !== new URL(TESLA_FLEET_ORIGIN).origin) return proxyPath
  return `${TESLA_FLEET_BASE}/api/1/vehicles/${vehicleId}`
}

/** Get vehicle data (odometer, drive state). Handles 408 (timeout). Uses vehicle_data only (telemetry often 404). */
export async function getTeslaVehicleData(
  accessToken: string,
  vehicleId: string
): Promise<TeslaVehicleDataResult> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  let odometer: number | undefined
  let drive_state: unknown
  let timedOut = false
  const base = vehicleDataBase(vehicleId)

  const doVehicleData = async (url: string): Promise<{ ok: boolean; data: unknown; timedOut?: boolean }> => {
    const r = await fetch(url, { headers })
    if (r.status === 408) return { ok: false, data: null, timedOut: true }
    if (!r.ok) throw new Error(`Tesla vehicle data: ${await r.text()}`)
    return { ok: true, data: await r.json() as unknown }
  }

  let res = await doVehicleData(`${base}/vehicle_data?endpoints=drive_state,vehicle_state`)
  if (res.timedOut) timedOut = true
  if (res.ok && res.data) {
    odometer = extractOdometerFromVehicleData(res.data)
    const raw = (res.data as Record<string, unknown>)?.response as Record<string, unknown> | undefined
    if (raw) drive_state = raw.drive_state ?? raw.driveState
  }

  if (odometer == null && res.ok) {
    res = await doVehicleData(`${base}/vehicle_data`)
    if (res.ok && res.data) odometer = extractOdometerFromVehicleData(res.data)
  }

  return { odometer, drive_state, timedOut: timedOut || undefined } as TeslaVehicleDataResult
}

function generateCodeVerifier(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return base64UrlEncode(arr)
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder()
    return crypto.subtle.digest('SHA-256', enc.encode(plain))
  }
  const { sha256: sha256Lib } = await import('js-sha256')
  return sha256Lib.arrayBuffer(plain)
}
