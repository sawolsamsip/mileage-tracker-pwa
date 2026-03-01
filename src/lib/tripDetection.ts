/**
 * Trip detection: Geolocation + motion awareness.
 * Battery-optimized: longer intervals when idle, shorter when motion suggests driving.
 */

export interface GeoPosition {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}

export interface TripSegment {
  start: GeoPosition
  end: GeoPosition
  startTime: number
  endTime: number
  miles?: number // filled if we have odometer
}

const MOTION_THRESHOLD = 0.2 // minimal movement to consider "driving"
const IDLE_INTERVAL_MS = 5 * 60 * 1000   // 5 min when idle
const ACTIVE_INTERVAL_MS = 45 * 1000     // 45 s when likely driving
const MIN_TRIP_MILES = 0.1

let watchId: number | null = null
let lastPosition: GeoPosition | null = null
let lastMotion = 0
let segmentStart: GeoPosition | null = null
let segmentStartTime = 0
let onSegmentComplete: ((segment: TripSegment) => void) | null = null

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function handlePosition(pos: GeolocationPosition) {
  const geo: GeoPosition = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? 0,
    timestamp: pos.timestamp,
  }
  if (!lastPosition) {
    lastPosition = geo
    segmentStart = geo
    segmentStartTime = geo.timestamp
    return
  }
  const miles = haversineMiles(lastPosition.lat, lastPosition.lng, geo.lat, geo.lng)
  lastPosition = geo
  if (miles >= MIN_TRIP_MILES && segmentStart && onSegmentComplete) {
    const segment: TripSegment = {
      start: segmentStart,
      end: geo,
      startTime: segmentStartTime,
      endTime: geo.timestamp,
      miles,
    }
    onSegmentComplete(segment)
    segmentStart = geo
    segmentStartTime = geo.timestamp
  }
}

function setPollInterval(ms: number) {
  if (watchId != null && navigator.geolocation.clearWatch) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
  const options: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: Math.min(ms * 0.5, 60000),
    timeout: 15000,
  }
  watchId = navigator.geolocation.watchPosition(handlePosition, () => {}, options)
}

/** Start trip detection. Call stopTripDetection() when leaving app or to save battery. */
export function startTripDetection(callback: (segment: TripSegment) => void): () => void {
  onSegmentComplete = callback
  lastPosition = null
  segmentStart = null
  setPollInterval(IDLE_INTERVAL_MS)

  if (typeof DeviceMotionEvent !== 'undefined' && typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
    (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> })
      .requestPermission()
      .then((p) => p === 'granted' && setPollInterval(ACTIVE_INTERVAL_MS))
      .catch(() => {})
  }

  let lastLat = 0, lastLng = 0
  const motionCheck = () => {
    if (lastPosition) {
      const d = haversineMiles(lastLat, lastLng, lastPosition.lat, lastPosition.lng)
      if (d > MOTION_THRESHOLD) {
        lastMotion = Date.now()
        setPollInterval(ACTIVE_INTERVAL_MS)
      }
      lastLat = lastPosition.lat
      lastLng = lastPosition.lng
    }
    if (Date.now() - lastMotion > 10 * 60 * 1000) setPollInterval(IDLE_INTERVAL_MS)
  }
  const motionInterval = setInterval(motionCheck, 60 * 1000)

  return () => {
    clearInterval(motionInterval)
    onSegmentComplete = null
    if (watchId != null && navigator.geolocation.clearWatch) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
  }
}

export function stopTripDetection(): void {
  if (watchId != null && navigator.geolocation.clearWatch) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
  onSegmentComplete = null
}
