# Mileage Tracker PWA – Architecture

## High-level architecture

- **Screens**: Dashboard, Trips, Vehicles, Reports, Settings
- **Data**: Supabase (auth, vehicles, trips, logs) + IndexedDB (offline queue, cache)
- **Integrations**: Tesla Fleet API / Smartcar (OAuth → odometer, trip data)
- **Detection**: Browser Geolocation + motion detection + Tesla polling (battery-optimized intervals)
- **Export**: IRS-proof PDF/CSV (jsPDF + autotable), audit flagging

## Screens

| Screen      | Purpose |
|------------|---------|
| Dashboard  | Multi-vehicle summary, today’s miles, quick start/stop trip, recent trips |
| Trips      | List/filter trips, edit purpose, classify (business/personal), merge/split |
| Vehicles   | Add/link Tesla or manual vehicle, odometer sync, default vehicle |
| Reports    | Date range, IRS export (PDF/CSV), audit report, EV tax incentive summary |
| Settings   | Units, classification rules, Tesla/Smartcar connect, notifications, backup |

## Data models

### Vehicle
- `id`, `userId`, `provider` (tesla | smartcar | manual)
- `displayName`, `vin`, `year`, `make`, `model`
- `teslaVehicleId` / `smartcarVehicleId` (nullable)
- `odometerLastSync`, `odometerMiles`, `isDefault`

### Trip
- `id`, `vehicleId`, `userId`
- `startTime`, `endTime`, `startOdometer`, `endOdometer`, `miles`
- `startLat`, `startLng`, `endLat`, `endLng`
- `purpose` (business | personal | medical | charity), `notes`
- `source` (tesla | gps | manual | imported), `confidence` (0–1)
- `syncedAt` (null = pending upload), `auditFlag` (e.g. missing purpose)

### MileageLog (IRS log entry)
- Derived or stored: date, vehicle, start/end odometer, miles, purpose, place
- Export includes all IRS-required fields; audit flags highlight gaps.

## Folder structure

```
src/
├── main.tsx
├── App.tsx
├── index.css
├── lib/
│   ├── supabase.ts
│   ├── db.ts              # IndexedDB (offline queue, cache)
│   ├── tesla.ts           # Tesla Fleet API client
│   ├── smartcar.ts        # Smartcar OAuth + API
│   ├── tripDetection.ts   # Geolocation + motion + polling
│   └── exportLogs.ts      # PDF/CSV IRS export
├── hooks/
│   ├── useVoiceInput.ts   # Voice for purpose
│   └── useTripDetection.ts
├── services/
│   ├── backgroundSync.ts  # Sync pending trips when back online
│   └── notificationService.ts
├── types/
│   └── index.ts
├── components/
│   ├── layout/
│   ├── ui/
│   └── ...
└── pages/
    ├── Dashboard.tsx
    ├── Trips.tsx
    ├── Vehicles.tsx
    ├── Reports.tsx
    └── Settings.tsx
```

## Battery & accuracy

- **Polling**: Tesla odometer every 5–15 min when app in foreground; 30+ min in background (or on motion).
- **Motion**: Use DeviceMotion/Geolocation to trigger “likely driving” and increase poll frequency only then.
- **Cross-verify**: Compare Tesla odometer delta vs GPS-derived distance; flag discrepancies for review.
- **No missed trips**: Background sync retries; import from Google/Apple location history for retrospective reconstruction.

## Improvements

- **Voice input**: “Log trip as business – client meeting” → purpose + notes.
- **EV tax incentive tracker**: Track eligible miles/dates for federal/state EV credits; surface in Reports.
