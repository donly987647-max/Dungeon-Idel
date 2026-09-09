# Dungeon-Idel

몬스터를 영입해 인간 지역에 장기 파견하는 서버 지속형 방치 RPG 전용 레포지토리입니다.

## Canonical project

이 레포를 이 프로젝트의 유일한 기준본으로 사용합니다. `Topdown-roguelite`에는 더 이상 이 게임 신규 개발을 반영하지 않습니다.

## Current version

- Game: `v0.6.0`
- Frontend: `index.html`, `app.css`, `app.js`
- Authentication: Supabase Auth 기반 `아이디 + 비밀번호`
- Backend: Supabase Postgres + Edge Functions
- Server simulation: DB scheduler가 브라우저가 닫혀 있어도 활성 원정을 계속 처리
- Account save: Supabase Auth user UUID별 독립 진행 데이터

## Public game

- Web host Edge Function: `dungeon-idel`
- Game API Edge Function: `dungeon-idel-api`

## Account flow

1. 사용자가 아이디와 비밀번호로 회원가입
2. 서버에서 Supabase Auth 계정을 생성하고 아이디를 계정 UUID와 연결
3. 로그인 후 JWT 세션으로 게임 API 인증
4. 해당 계정 UUID의 몬스터/원정/전리품/재화만 로드
5. 다른 기기에서도 같은 아이디/비밀번호로 동일한 진행상황 이용

현재 아이디는 3~20자의 영문, 숫자, 밑줄(`_`)을 허용하며 비밀번호는 8~72자입니다. 내부적으로 로그인용 가상 이메일 식별자를 사용하지만 플레이어 UI에는 이메일을 요구하지 않습니다.

## Core gameplay

- 초기 몬스터: 슬라임 `보글` 1마리
- 초기 숙소 수용량: 1
- 후보 도착: 서버 시간 기준 4시간마다
- 사냥터: 산골 마을 → 농촌 길목 → 변경 초소
- 사냥터 클릭 → 몬스터 선택 → 서버 지속 사냥
- 경험치/레벨/킬/골드: 서버에 즉시 반영
- 아이템: 원정별 미수령 전리품으로 누적 후 플레이어가 일괄 수령
- 사냥 관전: 픽셀 자동전투 화면 제공

## Backend source

- `supabase/functions/dungeon-idel-api/`
- `supabase/functions/dungeon-idel/`

서비스 역할 키는 클라이언트에 노출하지 않습니다. 계정 생성과 게임 상태 변경은 서버 Edge Function을 통해 처리합니다.
