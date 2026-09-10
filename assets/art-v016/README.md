# v0.16 사내 몬스터 아트

게임의 기존 자주색 본사·황동·양피지 분위기에 맞춘 9계열 × 3단계 아틀라스.
계약관리 슬라임, 특급 배달 고블린, 현장 철거 트롤, 구급 만드라고라,
결재 픽시, 화로 임프, 전등 위습, 금고 골렘, 택배 미믹 순서의 3×3 배열이다.
원본을 잘라 재저장하지 않고 CSS background-position으로 각 셀을 표시한다.
분기 보직은 색과 인장으로 구별하며 대기·공격·피격·회복·부활을 CSS로 애니메이션한다.

이미지는 imagegen으로 생성·수정했다. 최종 배포 파일은 모두 실제 RGBA 투명 PNG다.
원본은 생성 이미지 디렉터리에 그대로 보존했다.

| 파일 | 생성 원본 |
|---|---|
| monsters-base.png | exec-2412e309-9ff3-4d66-892e-5b16cadfec09.png |
| monsters-tier1.png | exec-2e5a89f1-d471-4336-b54f-79603114adff.png |
| monsters-tier2.png | exec-c20a0225-ebdf-4aee-9fd0-01649a1aabab.png |

프롬프트 방향: warm hand-painted chibi dark office fantasy, burgundy and brass,
9 characters in a fixed 3×3 sprite grid, transparent alpha, recognizable office
props (pen, satchel, hammer, medicine, bell, boiler, lamp, safe, parcel).
1차 전직은 전문 보직 장비, 최종 전직은 검정·버건디 벨벳과 왕관·황금 직인.
불투명 체크 배경으로 출력된 중간 시안은 배포하지 않는다.
