# Mileage Tracker PWA

**v1.0.2** — IRS-ready mileage logging and reports with Tesla integration. PWA with offline support.

- **Requirements**: Node 18+, Tesla Fleet API OAuth Client ID

## Usage

1. **Connect Tesla**  
   Vehicles → Connect Tesla → Sign in with Tesla; vehicles are registered.
2. **Daily snapshots**  
   - Open the app at least once per day to record that day’s odometer automatically.  
   - **Midnight auto-record**: Deploy the app (e.g. on Coolify); in Settings leave **Server URL** empty and click **Register with server** once. The server will take a snapshot at 00:00 daily (see [DEPLOY.md](DEPLOY.md)).
3. **Fetch server snapshots**  
   In Settings use **Fetch server snapshots** to pull server-recorded data into the app (also runs automatically on app load when a server URL is set or same origin).
4. **Reports**  
   Export IRS-style PDF/CSV from Reports.

## Stack

- **React 19** + **TypeScript** + **Vite 6**
- **Tailwind CSS 4**
- **Supabase** (optional backend)
- **IndexedDB** (idb) for offline cache
- **vite-plugin-pwa** (Workbox) for service worker
- **Tesla Fleet API** (OAuth2 PKCE) & **Smartcar** (OAuth; token exchange needs server)

## Local dev

```bash
cp .env.example .env
# Set VITE_TESLA_CLIENT_ID in .env. For local, VITE_TESLA_REDIRECT_URI can be http://localhost:5174/auth/tesla/callback
npm install
npm run dev
```

Open http://localhost:5174

## Build

```bash
npm run build
```

Output: `dist/`. Production build may show a PWA/Workbox “early exit” error in some CI/sandbox environments; run `npm run build` on a normal machine or with full permissions if needed.

## Deploy (Vercel)

1. Connect the repo to Vercel.
2. Set root directory to this folder.
3. Add env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TESLA_CLIENT_ID`, `VITE_TESLA_REDIRECT_URI` (e.g. `https://your-app.vercel.app/auth/tesla/callback`).
4. Deploy. `vercel.json` rewrites routes to `index.html` for SPA and auth callbacks.

## Env (PWA)

| Variable | Description |
|----------|-------------|
| `VITE_TESLA_CLIENT_ID` | Tesla Fleet API OAuth client ID (required) |
| `VITE_TESLA_REDIRECT_URI` | Callback URL (default: `{origin}/auth/tesla/callback`) |
| `VITE_SUPABASE_URL` | (optional) Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | (optional) Supabase anon key |
| `VITE_SMARTCAR_CLIENT_ID` | (optional) Smartcar token exchange requires a backend |

## Deploy (single server)

The root **Dockerfile** builds the PWA and runs one Node server that serves the static app and the midnight snapshot API (port **3131**). One Coolify Application is enough.

- Coolify & GitHub: [DEPLOY.md](DEPLOY.md)
- Server API details: [server/README.md](server/README.md)

## Features

- **Dashboard**: Today’s miles, trip count, recent trips.
- **Trips**: Voice input, manual/auto trip list.
- **Vehicles**: Tesla OAuth, Smartcar (server required), manual vehicles.
- **Reports**: IRS-style PDF/CSV, EV tax incentive summary.
- **Settings**: Notifications, data & backup, **Home server (midnight sync)**.
- **Offline**: IndexedDB cache, PWA installable.
