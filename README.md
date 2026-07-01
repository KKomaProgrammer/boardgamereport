# BoardLab Studio

보드게임부 활동 발표를 위해 만든 Cloudflare Pages 기반 협업 제작 사이트입니다. SPA가 아니라 URL별 폴더를 분리했고, 보안이 필요한 요청은 `/functions/api/`의 Pages Functions로 처리합니다.

## 주요 기능

- 영상 콘티 제작
- PPT 제작
- 보드게임 규칙, 카드, 말판, 점수표 제작
- 닉네임 기반 팀원 초대와 권한 설정
- AI 보조 기능
- 보드게임 제작용 AI 스프라이트 시트 생성
- 생성된 스프라이트 시트 자동 분할 저장
- 원본 스프라이트 시트 형태 프린트
- 공유 링크 결과물 보기

## 화면 구조

- `/` 메인 랜딩
- `/login/` 로그인
- `/signup/` 회원가입
- `/nickname/` 닉네임 설정
- `/dashboard/` 프로젝트 목록
- `/project/` 프로젝트 개요
- `/project/video/` 영상 제작
- `/project/ppt/` PPT 제작
- `/project/boardgame/` 보드게임 제작
- `/project/team/` 팀원 관리
- `/project/share/` 공유 링크 관리
- `/settings/account/` 계정 설정
- `/notifications/` 알림
- `/s/:slug/` 공유 결과물 보기

## 로그인 설정

로그인과 저장 기능은 Supabase 환경변수가 설정되어야 작동합니다. 환경변수가 없을 때 자동 데모 로그인은 실행하지 않습니다.

Google 로그인 후 `localhost`로 돌아가는 문제가 있으면 Supabase Auth의 Site URL과 Redirect URLs를 실제 Cloudflare Pages 배포 주소로 바꾸고, Cloudflare Pages 환경변수에 공개 배포 주소를 추가하세요.

## AI 설정

AI 요청은 항상 `/functions/api/ai/`를 통과합니다. 프론트엔드에는 어떤 AI 키도 넣지 않습니다.

동작 순서는 다음과 같습니다.

1. GPT를 먼저 호출합니다.
2. 크레딧, 빌링, 쿼터, 사용량 제한 계열 오류가 발생하면 Gemini로 자동 전환합니다.
3. 이미지 생성도 보드게임 스프라이트 시트 API를 통해 서버에서 처리합니다.

## 보드게임 스프라이트 시트

보드게임 제작 화면에서 AI 스프라이트 시트를 만들 수 있습니다. 생성된 큰 이미지는 사이트가 캔버스로 자동 분할하고, 분할된 조각은 프로젝트 문서 데이터에 저장됩니다. 프린트 시에는 잘린 조각이 아니라 원본 스프라이트 시트 형태로 출력됩니다.

## 배포

Cloudflare Pages에서 이 저장소를 연결합니다. `wrangler.toml`은 필요하지 않습니다.

```txt
Build command: 비워두기
Build output directory: /
```

## 보안 구조

- 프론트엔드는 화면 표시와 입력만 담당합니다.
- 프로젝트 저장, 초대, 권한 변경, 공유 링크 생성, AI 요청은 `/functions/api/`를 통과합니다.
- Functions는 Bearer 토큰으로 Supabase Auth 사용자를 확인합니다.
- 프로젝트 문서 JSON은 앱 비밀값 기반 AES-GCM으로 암호화한 뒤 DB에 저장합니다.
- 닉네임은 검색을 위해 공개 프로필로 분리하고, 이메일은 검색 결과에 노출하지 않습니다.
- Supabase RLS 정책을 포함했습니다.
