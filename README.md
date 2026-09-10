# Dungeon-Idel

몬스터 직원을 영입하고 인간 지역의 박멸 계약을 수행하는 모바일 우선 방치형 RPG **용사 박멸 주식회사**의 기준 저장소입니다.

## Canonical project

이 레포를 이 프로젝트의 유일한 기준본으로 사용합니다. `Topdown-roguelite`에는 더 이상 이 게임 신규 개발을 반영하지 않습니다.

## Current version

- Game: `v0.12.7`
- Frontend: `index.html`, `app.css`, `app.js` 및 버전별 UI/장비 스크립트
- Authentication: 사원명 + 숫자 4자리 PIN 기반 로그인/가입 UI
- Backend: Supabase Postgres + Edge Functions
- Server simulation: 서버 지속형 모집/작전/전투 진행 구조
- Account save: 계정별 독립 진행 데이터

## Production

- Vercel project: `hero-extermination-inc`
- Production URL: `https://hero-extermination-inc.vercel.app`
- Canonical branch: `main`

## Current gameplay

- 초기 몬스터 1마리 구조
- 숙소 기본 수용량 1
- 몬스터 후보 4시간 주기 갱신
- 몬스터 모집 atomic 처리
- 몬스터 상세에서 무기·방어구·장신구 장착/해제
- 창고 장비는 정보 확인용이며 장착은 몬스터 상세에서 관리
- 역할 기반 파티 구성
- 탱커 / 마법사 / 힐러 계열 종족 확장
- 박멸 작전 및 지속형 턴 전투
- 약 2초 간격의 턴 전투 표현
- 전투 HP 0 처리 및 결과 저장 보정
- 신규 전문 몬스터 로스터 v0.12.7 반영

## Main flow

1. 사원명과 PIN으로 로그인 또는 회사 등록
2. 본부에서 재화·악명·몬스터·작전·화물 상태 확인
3. 몬스터 모집 및 상세 관리
4. 장비 슬롯을 눌러 보유 장비 장착/교체/해제
5. 역할을 고려해 박멸 파티 구성
6. 인간 지역 박멸 작전 진행
7. 전투 결과와 획득 보상을 계정 진행 데이터에 반영

## Backend source

- `supabase/functions/dungeon-idel-api/`
- `supabase/functions/dungeon-idel/`
- `supabase/migrations/`

서비스 역할 키 등 서버 비밀정보는 클라이언트에 노출하지 않습니다. 계정 생성과 게임 상태 변경은 서버 API를 통해 처리합니다.

## Release note

`v0.12.7`은 신규 전문 몬스터 로스터를 추가한 릴리스입니다. 운영 클라이언트와 DB 로스터의 버전 불일치가 발생하지 않도록 릴리스 안전 패치를 함께 사용합니다.
