import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Trip, PendingTrip } from '@/types'
import { randomUUID } from '@/lib/uuid'

const DB_NAME = 'mileage-tracker-db'
const DB_VERSION = 2

/** Daily odometer snapshot per vehicle (mongoori-rides style) for Tesla auto mileage. */
export interface OdometerSnapshotRow {
  id: string // `${vehicleId}_${date}`
  vehicleId: string
  date: string // YYYY-MM-DD
  firstOdometer: number
  lastOdometer: number
  updatedAt: string
}

interface MileageDB extends DBSchema {
  trips: { key: string; value: Trip }
  pending: { key: string; value: PendingTrip; indexes: { 'by-created': string } }
  cache: { key: string; value: { key: string; value: unknown; updatedAt: string } }
  odometer_snapshots: { key: string; value: OdometerSnapshotRow; indexes: { 'by-vehicle-date': string } }
}

let db: IDBPDatabase<MileageDB> | null = null

export async function getDB() {
  if (db) return db
  db = await openDB<MileageDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('trips')) {
        database.createObjectStore('trips', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('pending')) {
        const pending = database.createObjectStore('pending', { keyPath: 'id' })
        pending.createIndex('by-created', 'createdAt')
      }
      if (!database.objectStoreNames.contains('cache')) {
        database.createObjectStore('cache', { keyPath: 'key' })
      }
      if (!database.objectStoreNames.contains('odometer_snapshots')) {
        const store = database.createObjectStore('odometer_snapshots', { keyPath: 'id' })
        store.createIndex('by-vehicle-date', ['vehicleId', 'date'])
      }
    },
  })
  return db
}

export async function saveTripOffline(trip: Trip): Promise<void> {
  const database = await getDB()
  await database.put('trips', trip)
}

export async function getOfflineTrips(): Promise<Trip[]> {
  const database = await getDB()
  return database.getAll('trips')
}

export async function deleteTripOffline(id: string): Promise<void> {
  const database = await getDB()
  await database.delete('trips', id)
}

export async function addPendingTrip(payload: Partial<Trip>): Promise<void> {
  const database = await getDB()
  const item: PendingTrip = {
    id: randomUUID(),
    payload,
    createdAt: new Date().toISOString(),
  }
  await database.add('pending', item)
}

export async function getPendingTrips(): Promise<PendingTrip[]> {
  const database = await getDB()
  const all = await database.getAllFromIndex('pending', 'by-created')
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function removePendingTrip(id: string): Promise<void> {
  const database = await getDB()
  await database.delete('pending', id)
}

export async function setCache<T>(key: string, value: T): Promise<void> {
  const database = await getDB()
  await database.put('cache', { key, value, updatedAt: new Date().toISOString() })
}

export async function getCache<T>(key: string): Promise<T | undefined> {
  const database = await getDB()
  const row = await database.get('cache', key)
  return row?.value as T | undefined
}

export async function putOdometerSnapshot(row: OdometerSnapshotRow): Promise<void> {
  const database = await getDB()
  await database.put('odometer_snapshots', { ...row, updatedAt: new Date().toISOString() })
}

export async function getOdometerSnapshotsByVehicle(vehicleId: string): Promise<OdometerSnapshotRow[]> {
  const database = await getDB()
  const all = await database.getAll('odometer_snapshots')
  return all.filter((r) => r.vehicleId === vehicleId).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getAllOdometerSnapshots(): Promise<OdometerSnapshotRow[]> {
  const database = await getDB()
  return database.getAll('odometer_snapshots')
}
