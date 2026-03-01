# Mileage Tracker – Midnight Sync Server

When deployed (e.g. on Coolify), this server runs a **daily cron at 00:00** (server timezone) that calls the Tesla API and stores odometer snapshots. Register tokens from the PWA; the app can then fetch snapshots and merge them for IRS-ready daily records.

## Coolify / Docker

- The **root** `Dockerfile` builds the PWA and runs this server in one container (port **3131**). See [DEPLOY.md](../DEPLOY.md).
- Standalone (this folder only): use `server/Dockerfile`, set **Port** to **3131**.

**Environment**

- `TESLA_CLIENT_ID`: Tesla OAuth Client ID (same as PWA)
- `PORT`: 3131 (default)
- `DATA_DIR`: `/app/data` (use a volume)
- `TZ`: e.g. `America/New_York`, `Asia/Seoul` (for midnight cron)

**Volume**: Mount `/app/data` so tokens and snapshots persist.

## API

- **POST /api/register**  
  Register Tesla tokens and vehicle list from the PWA.  
  Body: `{ "access_token", "refresh_token", "expires_at", "vehicles": [ { "id", "displayName" } ] }`

- **GET /api/snapshots**  
  Returns stored odometer snapshots. The PWA merges them into IndexedDB.

- **GET /api/health**  
  Health check.

## Security

- Suitable for home/LAN (e.g. 192.168.x.x). If exposed to the internet, use HTTPS and consider adding API auth.
