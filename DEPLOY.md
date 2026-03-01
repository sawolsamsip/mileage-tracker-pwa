# Deploy: GitHub → Coolify

## 1. First deploy to GitHub

### 1) Init and first commit (skip if already done)

```bash
cd mileage-tracker-pwa
git init
git add .
git commit -m "Initial commit: Mileage Tracker PWA + midnight sync server"
```

### 2) Create a new repository on GitHub

- Go to [GitHub New repository](https://github.com/new)
- Repository name: e.g. `mileage-tracker-pwa`
- Public, **Create repository** (no need to add README)

### 3) Add remote and push

Replace `YOUR_USERNAME` with your GitHub username.

```bash
git remote add origin https://github.com/YOUR_USERNAME/mileage-tracker-pwa.git
git branch -M main
git push -u origin main
```

Or with SSH:

```bash
git remote add origin git@github.com:YOUR_USERNAME/mileage-tracker-pwa.git
git branch -M main
git push -u origin main
```

---

## 2. Coolify deploy (single app)

The **PWA and midnight snapshot API** run in one container. Create **one Application** in Coolify.

1. **New Resource** → **Application** → Connect this GitHub repo.
2. **Settings**
   - **Build Pack**: **Dockerfile**
   - **Base Directory**: `/` (root)
   - **Port**: **3131**
   - **Is it a static site?**: Unchecked
3. **Build arguments** (optional). The app reads Tesla Client ID from the server at runtime, so you do **not** need `VITE_TESLA_CLIENT_ID` in build. Optionally set `VITE_TESLA_REDIRECT_URI` if you want to pin the callback URL.
4. **Environment** (runtime, required)
   - `TESLA_CLIENT_ID` = your Tesla OAuth Client ID (used for OAuth, token exchange, midnight sync)
   - `TZ` = `America/New_York` / `America/Los_Angeles` / `Asia/Seoul` etc. (timezone for midnight cron)
5. **Volume**
   - Container path: `/app/data`  
   - Mount a volume so tokens and snapshots persist across restarts.
6. Deploy.

Open the deployed URL (e.g. `http://192.168.1.188:3131`). Leave **Server URL** empty in Settings (same origin). Click **Register with server** once; the server will record odometer at 00:00 daily.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Push to GitHub |
| 2 | In Coolify, create **one Application** from this repo: Build Pack = Dockerfile, Port = **3131** |
| 3 | Set env: `TESLA_CLIENT_ID`, `TZ`; volume: `/app/data`. Build args optional. |
| 4 | In app Settings, leave server URL empty and click **Register with server** |

One server serves the web app and midnight snapshots.
