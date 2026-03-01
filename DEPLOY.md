# 배포 가이드: GitHub → Coolify

## 1. GitHub 첫 배포

### 1) 저장소 초기화 및 첫 커밋 (이미 했다면 생략)

```bash
cd /Users/sanghyunlee/mongoori/mileage-tracker-pwa
git init
git add .
git commit -m "Initial commit: Mileage Tracker PWA + midnight sync server"
```

### 2) GitHub에 새 저장소 만들기

- [GitHub](https://github.com/new) 접속 → **New repository**
- Repository name: 예) `mileage-tracker-pwa`
- Public, **Create repository** (README 추가 안 해도 됨)

### 3) 원격 추가 후 푸시

GitHub에서 만든 저장소 URL을 사용합니다 (본인 계정/조직 이름으로 바꾸세요).

```bash
git remote add origin https://github.com/YOUR_USERNAME/mileage-tracker-pwa.git
git branch -M main
git push -u origin main
```

또는 SSH:

```bash
git remote add origin git@github.com:YOUR_USERNAME/mileage-tracker-pwa.git
git branch -M main
git push -u origin main
```

---

## 2. Coolify 배포 (두 서비스)

이 레포는 **PWA(프론트)** 와 **자정 스냅샷 서버** 가 같이 있어서, Coolify에서는 **서비스 2개**로 올리면 됩니다.

### 서비스 1: PWA (정적 사이트)

1. Coolify에서 **New Resource** → **Application** → **GitHub** (또는 Git) 연결 후 이 저장소 선택.
2. **Build**  
   - Build Pack: **Nixpacks** 또는 **Dockerfile**  
   - Nixpacks 사용 시: **Root directory** 비우거나 `.`  
     - Nixpacks가 Vite 프로젝트 인식해서 `npm run build` 후 정적 파일 서빙하도록 설정됨.  
   - 또는 **Static** 빌드로 두고, Build Command: `npm ci && npm run build`, Publish directory: `dist`.
3. **Environment** (Coolify에서 추가)  
   - `VITE_TESLA_CLIENT_ID` = (Tesla 앱 Client ID)  
   - `VITE_TESLA_REDIRECT_URI` = `https://당신의PWA도메인/auth/tesla/callback`
4. 도메인 설정 후 Deploy.  
   → PWA는 `https://your-pwa-domain` 으로 접속.

### 서비스 2: 자정 스냅샷 서버 (Midnight Sync)

1. Coolify에서 **New Resource** → **Application** → 같은 GitHub 저장소 선택.
2. **Root directory**: `server` 로 설정 (이 레포 안의 `server/` 폴더만 사용).
3. **Build**  
   - Build Pack: **Dockerfile**  
   - Dockerfile path: `Dockerfile` (또는 `server/Dockerfile` 이면 root 가 `server` 이므로 `Dockerfile`)
4. **Environment**  
   - `TESLA_CLIENT_ID` = (PWA와 동일한 Tesla Client ID)  
   - `TZ` = `America/New_York` 또는 `America/Los_Angeles` 또는 `Asia/Seoul` (자정 기준 시간대)
5. **Volume**  
   - Container path: `/app/data`  
   - 원하는 호스트 경로 또는 Coolify에서 생성한 볼륨 연결 (토큰·스냅샷 유지용).
6. **Port**: 3131 (서버 기본 포트).  
   Coolify에서 도메인/포트 매핑 (예: `http://192.168.1.188:3131` 또는 내부용만 쓸 경우 포트만 노출).
7. Deploy.

### PWA에서 서버 주소 설정

- PWA **설정** → **Home server (midnight sync)** 에서  
  서버 URL을 `http://192.168.1.188:3131` 또는 Coolify에서 준 서버 URL로 입력 후 **Register with server** 한 번 실행.

---

## 요약

| 단계 | 내용 |
|------|------|
| 1 | 로컬에서 `git init` → `git add .` → `git commit` |
| 2 | GitHub에 새 저장소 생성 후 `git remote add origin` → `git push` |
| 3 | Coolify에 **Application** 2개: (1) PWA 정적 빌드, (2) `server/` Dockerfile 로 자정 스냅샷 서버 |
| 4 | PWA 설정에서 서버 URL 입력 후 Register |

이후 서버가 매일 자정에 Tesla 스냅샷을 쌓고, PWA를 열면 서버 스냅샷이 자동으로 내려와서 합쳐집니다.
