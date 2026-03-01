/**
 * Smartcar OAuth + vehicle data (alternative to Tesla Fleet for non-fleet vehicles).
 * @see https://smartcar.com/docs
 */

const SMARTCAR_AUTH = 'https://connect.smartcar.com/oauth/authorize'
const SMARTCAR_API = 'https://api.smartcar.com/v2.0'

export function getSmartcarAuthUrl(): string {
  const clientId = import.meta.env.VITE_SMARTCAR_CLIENT_ID ?? ''
  const redirectUri = import.meta.env.VITE_SMARTCAR_REDIRECT_URI ?? `${window.location.origin}/auth/smartcar/callback`
  const state = crypto.randomUUID()
  sessionStorage.setItem('smartcar_state', state)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'required:read_odometer read_vehicle_info',
    state,
    approval_prompt: 'force',
  })
  return `${SMARTCAR_AUTH}?${params}`
}

export async function getSmartcarOdometer(accessToken: string, vehicleId: string): Promise<number> {
  const res = await fetch(`${SMARTCAR_API}/vehicles/${vehicleId}/odometer`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Smartcar odometer: ${await res.text()}`)
  const data = await res.json()
  return data.distance ?? 0
}
