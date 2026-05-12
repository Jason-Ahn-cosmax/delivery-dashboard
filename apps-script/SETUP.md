# 백엔드 설치 가이드 (Google Sheets + Apps Script)

이 가이드를 끝까지 따라하면:
- 매월 본인 PC에서 엑셀을 업로드하면 → Google Sheet에 자동 반영
- 동료들은 동일한 URL에 접속해 최신 데이터 조회

소요 시간: **15분 정도**. 1회만 설정하면 됩니다.

---

## 1. Google Sheet 생성

1. https://sheets.new 에 접속 (새 시트 자동 생성)
2. 시트 제목을 `delivery-dashboard-data` 같이 알아보기 쉽게 변경
3. 이 시트는 **데이터 저장소**이므로 코드는 자동으로 들어갑니다. 직접 셀에 입력할 필요 없음

## 2. Apps Script 프로젝트 생성 및 코드 붙여넣기

1. 위 시트에서 메뉴 → **확장 프로그램** → **Apps Script** 클릭
2. 새 탭에서 Apps Script 편집기가 열림. 기본 `Code.gs`에 `function myFunction() {}` 같은 코드가 있으면 **전체 선택 → 삭제**
3. 이 저장소의 [`apps-script/Code.gs`](./Code.gs) 내용을 **전체 복사 → 붙여넣기**
4. 상단에 프로젝트 이름이 "이름 없는 프로젝트"로 되어 있으면 클릭해서 `delivery-dashboard-backend`로 변경
5. **💾 저장** 아이콘 (Ctrl+S)

## 3. 업로드 토큰 생성 (1회)

업로드 권한을 가진 사람에게 나눠줄 비밀번호 같은 것입니다.

1. Apps Script 편집기 상단의 **함수 선택** 드롭다운에서 `setUploadToken_` 선택
2. **▶ 실행** 클릭
3. 첫 실행 시 권한 동의 화면이 나오면:
   - "권한 검토" → 본인 구글 계정 선택
   - "이 앱은 Google에서 확인하지 않았습니다" → **고급** → **'delivery-dashboard-backend'(으)로 이동(안전하지 않음)** 클릭 (본인이 만든 코드라 안전합니다)
   - 권한 허용
4. 하단 **실행 로그**에 다음과 같이 나옴:
   ```
   NEW upload token: a1b2c3d4e5f6g7h8i9j0
   Share this with admins who will upload Excel files.
   ```
5. **이 토큰 문자열을 메모해두세요.** 나중에 엑셀 업로드할 때 사용합니다.
   - 잊으면 `showUploadToken_` 함수를 실행해서 다시 볼 수 있음
   - 유출 시 `setUploadToken_`을 다시 실행해 새 토큰 발급

## 4. 시트 초기화

1. 함수 드롭다운에서 `setup` 선택
2. **▶ 실행**
3. 실행 로그에 `Setup complete. Sheets ready: raw_data, meta` 확인
4. Google Sheet 탭으로 돌아가면 `raw_data`, `meta` 시트가 생성되어 있음

## 5. 웹 앱으로 배포

1. Apps Script 편집기 우측 상단 **배포 → 새 배포** 클릭
2. 톱니바퀴(⚙) → **웹 앱** 선택
3. 설정:
   - **설명**: `delivery-dashboard v1` (자유)
   - **다음 사용자로 실행**: `나` (본인 계정)
   - **액세스 권한이 있는 사용자**: **`모든 사용자`** ← 중요
     - 이렇게 해야 동료들이 별도 로그인 없이 데이터 조회 가능
     - 업로드는 토큰으로 보호되므로 익명 쓰기는 불가능
4. **배포** 클릭
5. "엑세스 승인" 화면이 나오면 본인 계정으로 권한 허용
6. 배포 완료 화면에 표시되는 **웹 앱 URL** 복사 (예: `https://script.google.com/macros/s/AKfycb.../exec`)

## 6. HTML에 백엔드 URL 연결

1. 이 저장소의 [`delivery-dashboard.html`](../delivery-dashboard.html) 파일을 편집
2. 파일 상단에서 다음 줄을 찾기:
   ```js
   const BACKEND_URL = '';
   ```
3. 따옴표 사이에 5번에서 복사한 URL을 붙여넣기:
   ```js
   const BACKEND_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
4. 저장
5. git 커밋 + push:
   ```bash
   git add delivery-dashboard.html
   git commit -m "Connect to Apps Script backend"
   git push
   ```

## 7. 개인 repo로 미러링 + GitHub Pages

조직 정책상 일반 멤버는 GlobalSCMTeam repo를 public으로 전환할 수 없습니다. 회사망에서 Vercel은 차단되지만 `*.github.io`는 허용되므로, **본인 개인 GitHub 계정에 public repo를 만들어 거기서 Pages 호스팅**합니다.

```
[조직 repo] GlobalSCMTeam/delivery-dashboard (private — 운영 기록용)
   ↓ git push personal
[개인 repo] Jason-Ahn-cosmax/delivery-dashboard (public — Pages 호스팅용)
   ↓ Pages 자동 빌드
[배포 URL]  https://jason-ahn-cosmax.github.io/delivery-dashboard/
```

이 단계는 한 번만 설정하면 됩니다. 이후 push는 한 줄 명령으로 양쪽에 동시 반영됩니다. 자세한 명령은 별도 가이드(또는 운영자에게 문의)를 따르면 됩니다.

## 8. 동료들에게 공유

- **조회용 URL**: Vercel이 준 URL (예: `https://delivery-dashboard.vercel.app`)을 그대로 공유
- **업로드 권한자**: 같은 URL + 3단계의 업로드 토큰을 별도로 전달 (Slack DM, 이메일 등)
- 업로드 권한자가 페이지에서 처음 엑셀 업로드를 시도하면 토큰 입력 프롬프트가 뜸. 한 번 입력하면 브라우저에 저장되어 다음부터는 묻지 않음

---

## 운영 메모

| 항목 | 방법 |
|---|---|
| 새 사람에게 업로드 권한 주기 | 토큰만 알려주면 됨 |
| 권한자 변경 시 토큰 회수 | Apps Script에서 `setUploadToken_` 다시 실행 → 새 토큰 발급 → 새 권한자에게 전달 (기존 권한자의 브라우저에 저장된 토큰은 무효화됨) |
| Apps Script 코드 변경 | 코드 수정 후 **배포 → 배포 관리 → 편집 (연필 아이콘) → 버전: 새 버전 → 배포**. URL은 동일하게 유지됨 |
| 데이터 백업 | Google Sheet 자체가 곧 백업. 추가로 시트에서 `파일 → 다운로드 → Excel` 가능 |
| 서버 동기화 안 됨 | Upload 탭 상단 배너에서 "서버에서 다시 불러오기" 클릭, 또는 브라우저 개발자도구 콘솔에서 에러 확인 |
| 비용 | 전부 무료. Google Sheets API 일일 한도(쿼터)에 도달할 일은 사실상 없음 |

## 보안 모델 요약

- 조회: 누구나 URL을 알면 가능 (회사 데이터 노출이 부담스러우면 Apps Script 배포 시 "Google 계정이 있는 모든 사용자"로 변경하면 로그인 강제됨)
- 업로드: 토큰을 아는 사람만 가능
- 코드 저장소: 데이터 없음(시트에 있음) → public이어도 무방
