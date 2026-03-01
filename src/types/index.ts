/** Vehicle from Tesla, Smartcar, or manual entry */
export interface Vehicle {
  id: string
  userId: string
  provider: 'tesla' | 'smartcar' | 'manual'
  displayName: string
  vin?: string
  year?: number
  make?: string
  model?: string
  teslaVehicleId?: string
  smartcarVehicleId?: string
  odometerLastSync?: string // ISO
  odometerMiles?: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

/** Single trip (IRS log row when purpose/place filled) */
export interface Trip {
  id: string
  vehicleId: string
  userId: string
  startTime: string
  endTime: string
  startOdometer: number
  endOdometer: number
  miles: number
  startLat?: number
  startLng?: number
  endLat?: number
  endLng?: number
  purpose: TripPurpose
  notes?: string
  source: 'tesla' | 'gps' | 'manual' | 'imported'
  confidence: number
  syncedAt?: string | null
  auditFlag?: string | null
  createdAt: string
  updatedAt: string
}

export type TripPurpose = 'business' | 'personal' | 'medical' | 'charity'

/** IRS-proof log row for export */
export interface MileageLogEntry {
  date: string
  vehicleDescription: string
  startOdometer: number
  endOdometer: number
  miles: number
  purpose: TripPurpose
  placeOrDescription: string
  auditFlag?: string
}

/** Offline queue item */
export interface PendingTrip {
  id: string
  payload: Partial<Trip>
  createdAt: string
}

/** Tesla Fleet API – vehicle summary */
export interface TeslaVehicleSummary {
  id: string
  vin: string
  display_name: string
  state: string
  odometer?: number
}
