# Mileage Tracker PWA

**v1.0.0** — IRS용 주행 기록·리포트 + Tesla 연동 PWA. 오프라인 지원.

- **요구사항**: Node 18+, Tesla Fleet API용 OAuth Client ID

## 사용 방법

1. **Tesla 연결**  
   Vehicles → Connect Tesla → Tesla 로그인 후 차량이 등록됩니다.
2. **일별 스냅샷**  
   - 앱을 하루에 한 번이라도 열면 그날 오도미터가 자동 기록됩니다.  
   - **자정 자동 기록**: 설정 → Home server에 서버 URL 입력 후 **Register with server** 한 번 하면, 집 서버가 매일 00:00에 스냅샷을 찍어 둡니다. (서버 배포는 `server/` 참고.)
3. **서버 스냅샷 가져오기**  
   설정에서 **Fetch server snapshots**로 서버에 쌓인 기록을 앱으로 가져옵니다. (앱을 열 때도 자동으로 한 번 가져옵니다.)
4. **리포트**  
   Reports에서 IRS 스타일 PDF/CSV 내보내기.

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
# .env 에 VITE_TESLA_CLIENT_ID 필수. VITE_TESLA_REDIRECT_URI 는 로컬이면 http://localhost:5174/auth/tesla/callback
npm install
npm run dev
```

브라우저에서 http://localhost:5174

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

## Env (PWA)

| Variable | Description |
|----------|-------------|
| `VITE_TESLA_CLIENT_ID` | Tesla Fleet API OAuth client ID (필수) |
| `VITE_TESLA_REDIRECT_URI` | 콜백 URL (기본: `{origin}/auth/tesla/callback`) |
| `VITE_SUPABASE_URL` | (선택) Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | (선택) Supabase anon key |
| `VITE_SMARTCAR_CLIENT_ID` | (선택) Smartcar는 토큰 교환용 서버 필요 |

## Midnight sync 서버

`server/` 에 있는 소규모 Node 서버를 Coolify 등에 올려 두면, 매일 00:00(서버 타임존)에 Tesla API를 호출해 오도미터 스냅샷을 저장합니다. PWA에서 토큰을 등록해 두면 앱을 열지 않아도 일별 기록이 쌓입니다.

- 상세: [server/README.md](server/README.md)
- Coolify·GitHub 배포: [DEPLOY.md](DEPLOY.md)

## Features

- **Dashboard**: 오늘 주행, 트립 수, 최근 트립.
- **Trips**: 음성 입력, 수동/자동 트립 목록.
- **Vehicles**: Tesla OAuth 연결, Smartcar(서버 필요), 수동 차량.
- **Reports**: IRS 스타일 PDF/CSV, EV 세금 인센티브 요약.
- **Settings**: 알림, 데이터 백업, **Home server (midnight sync)** 설정.
- **Offline**: IndexedDB 캐시, PWA 설치 가능.
