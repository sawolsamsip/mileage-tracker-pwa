# Mileage Tracker PWA

IRS-proof mileage & trip tracking with Tesla integration. PWA with offline support.

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
# Edit .env: set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_TESLA_CLIENT_ID (and optionally VITE_TESLA_REDIRECT_URI for local)
npm install
npm run dev
```

Open http://localhost:5174

## Build

```bash
npm run build
```

Output: `dist/`. Production build can show a PWA/Workbox “early exit” error in some CI/sandbox environments; running `npm run build` on a normal machine or with full permissions usually succeeds.

## Deploy (Vercel)

1. Connect the repo to Vercel.
2. Set root directory to `mileage-tracker-pwa` (or run from this folder).
3. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TESLA_CLIENT_ID`, `VITE_TESLA_REDIRECT_URI` (e.g. `https://your-app.vercel.app/auth/tesla/callback`).
4. Deploy. `vercel.json` rewrites all routes to `index.html` for SPA + auth callbacks.

## Env

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_TESLA_CLIENT_ID` | Tesla Fleet API client ID |
| `VITE_TESLA_REDIRECT_URI` | Callback URL (default: `{origin}/auth/tesla/callback`) |
| `VITE_SMARTCAR_CLIENT_ID` | Optional; Smartcar token exchange requires a backend |

## Features

- **Dashboard**: Today’s miles, trip count, quick add vehicle, recent trips (UI in place; data wiring to Supabase/IndexedDB can be extended).
- **Trips**: Voice input for purpose/notes, list of trips (auto or manual).
- **Vehicles**: Connect Tesla (OAuth callback implemented), Connect Smartcar (callback only; server needed for token exchange), manual vehicle (UI only).
- **Reports**: IRS mileage log export (PDF/CSV), audit flags, EV tax incentive summary.
- **Settings**: Notifications, data & backup, privacy copy.
- **Offline**: IndexedDB cache, pending trips sync when back online, PWA installable.
