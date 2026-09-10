# 용사 박멸 주식회사 · 전체 아이템 픽셀 아트

현재 `content/campaign-v016.json`의 아이템 정의 206종과 별도 제작 완제품 26종, 총 232종입니다. 기존 장비도 보유 계정에서 표시할 수 있도록 모두 포함합니다.

- 제작: 내장 `image_gen.imagegen`, 시트별 개별 프롬프트로 생성한 투명 PNG.
- 프롬프트 및 이름별 좌표: `manifest.json`의 `sheets[].prompt`, `items`.
- 게임용 파일: `items-01.webp`부터 `items-10.webp`까지. 각 750×750. 기본 5×5 셀을 사용하며 일부 원본의 간격 차이는 `sourceRect`로 보정해 그림이 잘리지 않게 표시합니다.
- 패키징: 원본을 보존하고 nearest-neighbor 리사이즈 후 WebP quality 88, alpha 유지. 232개 개별 다운로드 대신 필요한 시트를 공유합니다.
- 연결: `scripts/item-art-v017.js` → `app.js`의 `itemAsset` / `itemSvg`. 창고, 장비, 강화, 제작·판매, 드롭 및 수거 보상에 같은 매핑을 사용합니다.
- 생성 원본은 작업 공간의 `artifacts/v017/items-*.png`에 보관합니다. 게임 배포에는 최적화한 WebP만 포함합니다.

검증: 232개 고유 좌표, 모든 카탈로그/제작 출력 포함, 각 셀의 실제 그림·투명 배경, 10개 시트 로드, 모바일 실제 아이콘 표시.
