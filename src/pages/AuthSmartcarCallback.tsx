import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Car, AlertCircle } from 'lucide-react'

export default function AuthSmartcarCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [hasCode] = useState(() => !!searchParams.get('code'))
  const [error] = useState(() => searchParams.get('error_description') || searchParams.get('error') || null)

  useEffect(() => {
    if (error) return
    if (!hasCode) return
    // Smartcar token exchange requires client_secret and must be done server-side.
    // Redirect to vehicles after a short message.
    const t = setTimeout(() => navigate('/vehicles', { replace: true }), 4000)
    return () => clearTimeout(t)
  }, [hasCode, error, navigate])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] p-4">
        <AlertCircle className="h-12 w-12 text-[var(--warning)]" />
        <p className="text-center text-slate-300">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/vehicles', { replace: true })}
          className="rounded-lg bg-[var(--accent)]/20 px-4 py-2 text-sm font-medium text-[var(--accent)]"
        >
          Back to Vehicles
        </button>
      </div>
    )
  }

  if (hasCode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] p-4">
        <Car className="h-12 w-12 text-[var(--accent)]" />
        <p className="text-center text-slate-300">
          Smartcar connection requires a server to exchange the code for tokens. Use Tesla or add a manual vehicle for now.
        </p>
        <p className="text-xs text-slate-500">Redirecting to Vehicles…</p>
        <button
          type="button"
          onClick={() => navigate('/vehicles', { replace: true })}
          className="rounded-lg bg-[var(--accent)]/20 px-4 py-2 text-sm font-medium text-[var(--accent)]"
        >
          Go to Vehicles
        </button>
      </div>
    )
  }

  useEffect(() => {
    const t = setTimeout(() => navigate('/vehicles', { replace: true }), 2000)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] p-4">
      <Car className="h-12 w-12 text-slate-500" />
      <p className="text-slate-400">No code received. Redirecting…</p>
    </div>
  )
}
