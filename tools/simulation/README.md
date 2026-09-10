# 게임 서버 시뮬레이션

이 디렉터리는 서비스 프런트엔드의 의존성이 아닌 개발용 테스트 환경이다.
실제 서버의 PostgreSQL 함수, 정적 정의, 트리거와 인덱스를 PGlite에 복원한다.
테스트 계정과 파티는 메모리 안에서 새로 만든다. 운영 이용자 데이터나 API 키는 사용하지 않는다.

```sh
npm ci --prefix tools/simulation
node tools/build-campaign.mjs
node tools/build-campaign-runtime.mjs
npm test --prefix tools/simulation
BALANCE_SAMPLES=30 node tools/simulation/balance.mjs
node tools/simulation/progression.mjs
```

`campaign.test.mjs`는 획득 경로, 실제 확률 판정, 500전투 후 1.5% 보스 조우·전적·반복 출현,
생존자 XP, 적 회복, 내부 함수 접근 권한, 초기 회사 생성 원자성,
9종 영입과 후보/실제 능력치 일치를 검증한다.

`balance.mjs`는 실제 전투 함수로 다섯 보스를 처치한다. 각 조건에서
시드를 고정하고 트랜잭션을 되돌려 누적 XP와 이전 실험의 결과가 다음
실험에 영향을 주지 않는다. 준비된 파티와 8레벨 낮은 무장 없는 파티를
비교한다. 전직은 실제 서버 함수를 거치며, 전설 장비는 가정하지 않는다.
출력에는 콘텐츠·전투·몬스터 원본의 SHA-256과 실험 조건을 기록한다.
실제 프런트엔드의 강화 반영 능력치와 보스 대응력 계산 코드도 실행해서,
화면에서 안정권으로 판단한 조건이 서버 전투 표본에서 크게 어긋나는지 검사한다.

`economy.test.mjs`는 26개 제작법의 제작·판매·정산과 시설 결제, 소유권,
창고 공간 부족 시 물품 보존, 자동 처리와 중복 수령 방지를 확인한다.

`progression.mjs`는 실제 회사 초기화의 슬라임 및 무료 영입부터 다섯 챕터를
진행한다. 50개 일반 전투마다 수거·제작·판매·정산을 수행하고 수익으로
숙소·공방·창고를 확장한다. 누적 HP와 실제 전직을 사용하며 장비는 미착용이다.
사망자나 전직 기회가 생기면 복귀한다. 작업 마감 시각만 행동 시간만큼
이동해 시간을 진행하며 보상은 실제 SQL로 처리한다. 시드 `PROGRESSION_SEED`,
챕터별 전투 상한 `PROGRESSION_LIMIT`을 지정할 수 있다. 적극적인 조작을
가정한 단일 시드 검증이며 사용자 지연과 오프라인 스케줄링은 포함하지 않는다.

`campaign-ui.test.mjs`는 로컬 웹 서버와 합성 API 응답으로 챕터 도감,
500전투/1.5% 안내, 보스 전적 갱신, 파티 선택·출정·부상 안내, 다음 업무와
360·390·768·1280px 레이아웃을 검사한다. 기본 주소는 `http://127.0.0.1:8125`이고
Chrome 설치가 필요하다. 서버를 실행한 뒤 `npm run test:ui --prefix tools/simulation`.

한계: 이 보스 실험은 최대 체력에서 시작한다. 연속 진행·경제·화면 검사는 별도 스크립트에서 수행한다.
모든 파티 조합과 장비 획득 대기 시간 전체 분포는 검증하지 않는다. PGlite의 합성
auth.uid는 소유권 분기만 검사하므로 실제 배포의 인증/RLS 전체 검증을
대체하지 않는다.

스키마 복원 출처:

- `docs/system-baseline-v0142.json`: 운영 정적 정의·함수·컬럼·제약
- `docs/system-schema-metadata-v0142.json`: 운영 인덱스와 정확한 트리거 정의
- `supabase/migrations/*_v015_*.sql`: 개발 중인 업그레이드

기존 마이그레이션에는 파일 시각과 실제 적용 순서가 다른 이력이 있어,
테스트는 검증된 v0.14.2 스냅샷에 v0.15 변경을 적용한다. 새로 비어 있는
Supabase 프로젝트를 만드는 설치 검증과는 범위가 다르다.

## v0.16 검사

현재 기본 테스트는 과거 마이그레이션 회귀와 `idle.test.mjs`, `defense.test.mjs`를 함께 실행한다.
`idle-ui.test.mjs`가 현재 화면 검사다. 과거 `campaign-ui.test.mjs`는 v0.15 동작 기록으로 남긴다.
`node tools/build-idle-v016.mjs`로 현재 카탈로그·로스터와 단일 신규 마이그레이션을 생성한다.
`IDLE_SEEDS=.217,.641 IDLE_ACTIONS=24000 node tools/simulation/idle-progression.mjs`로
각 시드의 13시간 20분 방치/빈번한 조작을 비교한다. 여러 프로세스로 나눌 때는
`IDLE_REPORT_SUFFIX=-217`처럼 결과 파일 접미사를 지정한다. 이 프로브는 단위 검사보다 오래 걸린다.
PGlite에는 autovacuum 작업자가 없어 500행동마다 VACUUM으로 오래된 행 버전을 정리한다.
게임 시각·난수 상태·아이템·전투 기록을 수정하지 않는 데이터베이스 유지 작업이다.
방어 XP 없음, 미출정 필터, 전멸 보상 없음, 보스 중단·단계 선택, 최대 육성 한계,
설비 비용·중복 결제 방지, 창고 보상 보존·중복 지급 방지와 내부 RPC 권한을 검사한다.
