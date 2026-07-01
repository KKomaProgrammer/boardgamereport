# BoardLab Studio

보드게임부 활동 발표를 위해 만든 Cloudflare Pages 기반 협업 제작 사이트입니다. SPA가 아니라 URL별 폴더를 분리했고, 보안이 필요한 요청은 `/functions/api/`의 Pages Functions로 처리합니다.

## 포함된 화면

- `/` 메인 랜딩
- `/login/` Google 로그인 + 이메일/비밀번호 로그인
- `/signup/` 회원가입
- `/nickname/` 가입 직후 닉네임 설정
- `/dashboard/` 프로젝트 목록과 새 프로젝트 생성
- `/project/` 프로젝트 개요
- `/project/video/` 영상 콘티 제작
- `/project/ppt/` PPT 제작
- `/project/boardgame/` 보드게임 직접 제작
- `/project/team/` 닉네임 검색 초대, 권한, AI 사용 설정
- `/project/share/` 4자리/커스텀 공유 링크 생성
- `/settings/account/` ID, 비밀번호, 닉네임 변경
- `/notifications/` 초대와 공동 작업 알림
- `/s/:slug/` 공유 결과물 보기

## 바로 보기

환경변수를 넣지 않으면 프론트엔드는 데모 모드로 작동합니다. 데모 모드에서는 localStorage로 화면 흐름을 확인할 수 있습니다.

```bash
npm install
npm run dev
```

## Supabase 연결

1. Supabase 프로젝트를 만듭니다.
2. `supabase/schema.sql`을 SQL Editor에서 실행합니다.
3. Supabase Auth에서 Email/Password 로그인을 켭니다.
4. Google 로그인을 쓰려면 Supabase Auth Provider에서 Google OAuth Client ID/Secret을 넣고, Site URL과 Redirect URL을 Cloudflare Pages 도메인으로 설정합니다.
5. Cloudflare Pages 환경변수에 아래 값을 넣습니다.

```txt
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=public-anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key
APP_SECRET=32자_이상_랜덤_문자열
AI_ENDPOINT=선택_자체_AI_프록시
AI_API_KEY=선택
TURNSTILE_SECRET_KEY=선택
```

`SUPABASE_SERVICE_ROLE_KEY`, `APP_SECRET`, `AI_API_KEY`는 절대 프론트엔드에 넣지 말고 Cloudflare Pages 환경변수로만 보관하세요.

## 배포

Cloudflare Pages에서 이 폴더를 그대로 연결하거나, Wrangler로 배포합니다.

```bash
npm run deploy
```

Cloudflare Pages Functions는 `/functions` 디렉터리의 파일 구조로 라우팅됩니다. 예를 들어 `functions/api/projects/save.js`는 `/api/projects/save` 요청을 처리합니다.

## 보안 구조

- 프론트엔드는 화면 표시와 입력만 담당합니다.
- 프로젝트 저장, 초대, 권한 변경, 공유 링크 생성, AI 요청은 `/functions/api/`를 통과합니다.
- Functions는 Bearer 토큰으로 Supabase Auth 사용자를 확인합니다.
- 프로젝트 문서 JSON은 `APP_SECRET` 기반 AES-GCM으로 암호화한 뒤 DB에 저장합니다.
- 닉네임은 검색을 위해 공개 프로필로 분리하고, 이메일은 검색 결과에 노출하지 않습니다.
- Supabase RLS 정책을 포함했습니다.

## 아직 실제 운영 전 보강 권장 항목

- Turnstile 검증과 IP/계정별 rate limit KV 적용
- 문서 동시 편집 충돌 처리 고도화
- Supabase Realtime Presence/Broadcast UI 연결
- PDF/PPTX 실제 파일 내보내기
- 공유 링크 비밀번호 입력 UI 보강
