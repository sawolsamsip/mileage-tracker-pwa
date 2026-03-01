# Mileage Tracker – Midnight Sync Server

집 서버(Coolify 등)에 올려 두면 **매일 자정(00:00)**에 Tesla API를 호출해 주행거리 스냅샷을 저장합니다. PWA에서 이 서버에 토큰을 등록하고, 스냅샷을 가져와서 합치면 IRS용으로 정확한 일별 기록을 유지할 수 있습니다.

## Coolify 배포 (192.168.1.188)

1. 이 폴더(`server/`)를 Git 저장소에 넣거나 Coolify에서 소스로 지정합니다.
2. **Build**: Dockerfile 사용. Context를 `server/`로 두거나, 프로젝트 루트에서 `docker build -f server/Dockerfile server/`로 빌드.
3. **Environment**:
   - `TESLA_CLIENT_ID`: PWA에서 쓰는 Tesla OAuth Client ID (동일한 값)
   - `PORT`: 3131 (기본값)
   - `DATA_DIR`: `/app/data` (볼륨 마운트 권장)
4. **Volume**: `/app/data` 를 마운트해서 토큰·스냅샷이 컨테이너 재시작 후에도 유지되도록 합니다.
5. **Timezone**: 자정 크론은 서버 로컬 시간 기준입니다. 필요하면 컨테이너에 `TZ=Asia/Seoul` 등을 설정하세요.

## API

- **POST /api/register**  
  PWA에서 Tesla 토큰과 차량 목록을 등록합니다.  
  Body: `{ "access_token", "refresh_token", "expires_at", "vehicles": [ { "id", "displayName" } ] }`

- **GET /api/snapshots**  
  서버에 쌓인 오도미터 스냅샷 목록을 반환합니다. PWA가 이걸 받아 IndexedDB에 병합합니다.

- **GET /api/health**  
  서버 상태 확인.

## 보안

- 집 내부용(192.168.x.x)으로 쓰면 됩니다. 외부에 열 경우 HTTPS와 인증(API 키 등) 추가를 권장합니다.
