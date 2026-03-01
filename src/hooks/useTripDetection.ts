import { useEffect, useRef, useCallback } from 'react'
import { startTripDetection, type TripSegment } from '@/lib/tripDetection'
import type { TripPurpose } from '@/types'

export function useTripDetection(
  vehicleId: string | null,
  onTrip: (segment: TripSegment, purpose: TripPurpose) => void
) {
  const onTripRef = useRef(onTrip)
  onTripRef.current = onTrip

  const callback = useCallback((segment: TripSegment) => {
    if (!vehicleId) return
    onTripRef.current(segment, 'business') // default; user can edit later
  }, [vehicleId])

  useEffect(() => {
    if (!vehicleId) return
    return startTripDetection(callback)
  }, [vehicleId, callback])
}
