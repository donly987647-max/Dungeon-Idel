# Dungeon-Idel

몬스터 길드형 서버 지속 사냥 게임 전용 레포지토리입니다.

## Canonical project

이 레포를 이 프로젝트의 유일한 기준본으로 사용합니다. `Topdown-roguelite` 레포에는 더 이상 몬스터 길드 신규 개발을 반영하지 않습니다.

## Current version

- Game: `v0.5.0`
- Frontend: static HTML/CSS/JavaScript
- Backend: Supabase Postgres + Edge Function
- Server simulation: active expeditions are ticked by the database scheduler even while the browser is closed

## Core gameplay

- 몬스터 영입: 슬라임 / 고블린 / 트롤
- 초기 몬스터: 슬라임 `보글` 1마리
- 초기 숙소 수용량: 1
- 신규 후보 도착 주기: 4시간
- 인간 지역을 사냥터로 사용
- 첫 사냥터: 산골 마을
- 몬스터를 사냥터에 파견하면 자동 전투 지속
- 경험치/레벨/처치/골드는 서버 진행에 따라 반영
- 드롭 아이템은 원정별 미수령 전리품으로 누적
- 플레이어가 원하는 시점에 전리품을 일괄 수령
- 사냥터를 열어 현재 자동전투를 관전 가능

## Structure

- `index.html` — 앱 셸
- `app.css` — 모바일 픽셀 UI 스타일
- `app.js` — 클라이언트 UI, 사냥/영입/전리품 상호작용
- `supabase/functions/monster-guild-api/` — 서버 API Edge Function
- `docs/` — 기획 및 게임 규칙 문서

## Security

브라우저에는 Supabase publishable key만 사용합니다. DB 쓰기 권한과 secret/service-role key는 Edge Function 내부에서만 사용합니다.
