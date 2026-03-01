/**
 * Background sync: flush pending trips from IndexedDB to Supabase when back online.
 */

import { getPendingTrips, removePendingTrip } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export async function flushPendingTrips(): Promise<{ ok: number; failed: number }> {
  const pending = await getPendingTrips()
  let ok = 0
  let failed = 0
  for (const item of pending) {
    try {
      const { error } = await supabase.from('trips').upsert(item.payload as Record<string, unknown>)
      if (error) throw error
      await removePendingTrip(item.id)
      ok++
    } catch {
      failed++
    }
  }
  return { ok, failed }
}

export function registerBackgroundSync(): void {
  if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) return
  navigator.serviceWorker.ready.then((reg) => {
    (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync?.register?.('pending-trips').catch(() => {})
  })
}
