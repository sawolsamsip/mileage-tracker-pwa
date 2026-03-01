import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeTeslaCode, listTeslaVehicles, type TeslaTokens } from '@/lib/tesla'
import type { Vehicle } from '@/types'
import { Zap, AlertCircle } from 'lucide-react'

const TESLA_TOKENS_KEY = 'tesla_tokens'
export const TESLA_VEHICLES_KEY = 'tesla_vehicles'

export function saveTeslaTokens(tokens: TeslaTokens): void {
  const expiresAt = Date.now() + (tokens.expires_in * 1000)
  localStorage.setItem(TESLA_TOKENS_KEY, JSON.stringify({ ...tokens, expires_at: expiresAt }))
}

export function getTeslaTokens(): (TeslaTokens & { expires_at: number }) | null {
  const raw = localStorage.getItem(TESLA_TOKENS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as TeslaTokens & { expires_at: number }
  } catch {
    return null
  }
}

export default function AuthTeslaCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const savedState = sessionStorage.getItem('tesla_state') ?? localStorage.getItem('tesla_state')
    // Don't remove code_verifier yet – exchangeTeslaCode() needs it

    if (!code) {
      setStatus('error')
      setMessage('No authorization code received.')
      return
    }
    if (state !== savedState) {
      setStatus('error')
      setMessage('Invalid state. Please try connecting again.')
      return
    }

    exchangeTeslaCode(code)
      .then(async (tokens) => {
        sessionStorage.removeItem('tesla_state')
        sessionStorage.removeItem('tesla_code_verifier')
        localStorage.removeItem('tesla_state')
        localStorage.removeItem('tesla_code_verifier')
        saveTeslaTokens(tokens)
        const vehicles = await listTeslaVehicles(tokens.access_token)
        const list: Pick<Vehicle, 'id' | 'displayName' | 'provider' | 'teslaVehicleId' | 'vin'>[] = vehicles.map((v) => ({
          id: `tesla-${v.id}`,
          displayName: v.display_name || v.vin?.slice(-6) || String(v.id),
          provider: 'tesla' as const,
          teslaVehicleId: String(v.id),
          vin: v.vin,
        }))
        localStorage.setItem(TESLA_VEHICLES_KEY, JSON.stringify(list))
        setStatus('ok')
        setTimeout(() => navigate('/vehicles?tesla=connected', { replace: true }), 1500)
      })
      .catch((err: Error) => {
        sessionStorage.removeItem('tesla_state')
        sessionStorage.removeItem('tesla_code_verifier')
        localStorage.removeItem('tesla_state')
        localStorage.removeItem('tesla_code_verifier')
        setStatus('error')
        const msg = err.message || 'Failed to connect Tesla account.'
        const friendly =
          msg === 'Load failed' || msg.includes('Failed to fetch') || msg.includes('Could not connect')
            ? 'Network request failed. Make sure the dev server is running and try again.'
            : msg
        setMessage(friendly)
      })
  }, [searchParams, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] p-4">
      {status === 'loading' && (
        <>
          <Zap className="h-12 w-12 animate-pulse text-[var(--accent)]" />
          <p className="text-slate-300">Connecting your Tesla account…</p>
        </>
      )}
      {status === 'ok' && (
        <>
          <Zap className="h-12 w-12 text-[var(--success)]" />
          <p className="text-slate-300">Connected. Redirecting to Vehicles…</p>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-12 w-12 text-[var(--warning)]" />
          <p className="text-center text-slate-300">{message}</p>
          <button
            type="button"
            onClick={() => navigate('/vehicles', { replace: true })}
            className="rounded-lg bg-[var(--accent)]/20 px-4 py-2 text-sm font-medium text-[var(--accent)]"
          >
            Back to Vehicles
          </button>
        </>
      )}
    </div>
  )
}
