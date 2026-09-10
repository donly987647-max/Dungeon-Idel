# Chapter artwork — v0.15

## Enemy and item atlases

- `enemies.png`: 25 enemies in a 5×5 atlas (each row: four normal enemies, then boss; chapter order 1–5). Built-in generation selected from `exec-90694a0c-1ba8-494e-947d-a706d32034d8.png`. The original has an alpha channel. Later layout edits were discarded because they baked a checkerboard into the background. CSS selects cells without modifying image pixels.
- `items.png`: 16 inventory icons in a 4×4 atlas. First ten are the two legendary items of each chapter in order; the remaining six are wood, cloth, coins, crossbow, shield and enhancement crystal. Built-in generation from `exec-c4ea1f37-6efb-4b77-a96f-b56828a699cb.png`.

Enemy atlas prompt:
> Use case: stylized-concept. Asset type: one production sprite atlas for a witty monster-company fantasy RPG. Create EXACTLY 25 full-body HUMAN enemy sprites arranged in an exact uniform 5-column by 5-row grid, square 1536x1536 canvas, each cell identical size, each character centered within its own cell with generous empty margins. Transparent background, no shadows outside each sprite, no floor, no grid lines, no text, no labels. Cohesive exquisite 16-bit pixel art, chunky stepped pixels, plum outlines, amber highlights, rich readable silhouettes. Three-quarter view facing left; short chibi proportions, expressive faces. All characters are separate and fit entirely in their cells. Left-to-right row 1: village youth with sling, lumberjack with axe, hunter with bow and green hood, militia captain with round shield, BOSS elderly village chief holding brass handbell and shield. Row 2: farmer with sickle and straw hat, huge porter with crates on back, caravan escort with shortbow, brown leather town guard with spear, BOSS mercenary commander in red cloak with huge curved sword and scroll. Row 3: nervous recruit with sword, steel crossbowman, blue heavy armored sentry with keys, junior knight with blue plume, BOSS royal deputy knight with blue cape and enormous greatsword. Row 4: purple tower-shield guard, tax wizard with stamp-topped staff and documents, court healer in cream and violet robes with songbook, elite silver castle knight with polearm, BOSS imposing castle lord in dark violet plate with long cape and massive gate-cutting sword. Row 5: white-gold royal guard, red-gold court fire mage with crystal staff, richly dressed treasurer with gold ledger, graying veteran hero with sword and pension scroll, BOSS magnificent golden champion with winged helmet and radiant holy greatsword. Humorous corporate world hints via blank scrolls and stamps, but these enemies remain heroic humans. Each boss in column five is visibly more elaborate. Uniform cell spacing is critical for CSS sprite slicing. No writing anywhere, no logos or watermark.

Item atlas prompt:
> Use case: stylized-concept. One square production inventory icon atlas for a humorous monster-company fantasy RPG. EXACTLY 16 isolated item icons, uniform 4 by 4 grid, square canvas, every icon centered in the central 65 percent of its cell with generous margin. High detail true 16-bit pixel art, chunky stepped pixels, sharp plum outlines and amber metallic highlights, no soft 3D render. Flat solid deep plum background #211b2b in all empty space, no checkerboard, no cell borders, no labels, no writing, no UI. Left to right row 1: ornate brass handbell with skull-shaped handle; brown leather vest with mirrored silver front plate; crimson mercenary curved sword with torn contract ribbons; ancient rolled parchment contract tied by golden chain. Row 2: broad blue knight greatsword with red wax seal on hilt; massive blue-silver plate armor with locked chest plate; huge violet castle gate-cutting greatsword; glowing golden vacation ticket with tiny wing ornaments and a red wax seal, no letters. Row 3: radiant white-gold holy sword emerging from a torn blank resignation parchment; spectacular horned monster CEO golden seal stamp with purple crystal; bundle of rough wood scraps; folded coarse cloth. Row 4: open pouch full of old copper coins; polished crossbow with steel bolt; round wooden shield with iron rim; glowing violet enhancement crystal. First ten are legendary equipment so they should be notably ornate and distinct. All 16 icons fully within their equal cells, no touching edges, no text or watermarks.

Generated with the built-in `image_gen` tool on 2026-09-10. Original PNG outputs
were inspected and copied into this directory without image edits. Each chapter cover is
1536 × 1024. `scripts/campaign-v015.js` consumes the five images as chapter covers.
The source generation directory is
`/Users/lusti/.codex/generated_images/01a08ae1-028d-7e60-8f37-e18a61f10740/`.

## village.png — 산골 마을

Source: `exec-cebeee6b-c9b3-4ccb-afbc-fe8f175cd383.png`

Prompt:
> Use case: stylized-concept. Asset type: original landscape pixel-art chapter environment for the Korean monster-company idle RPG 'Hero Extermination Inc.' Chapter 1: secluded mountain village. Create a polished 16-bit pixel art scene, wide landscape 1536x1024. A tiny medieval human village with crooked wooden cottages, torchlit palisade, logs and laundry between green pine mountains at dusky sunset. In foreground two very small cute monster office employees, a green goblin with a clipboard and a purple slime carrying a loot sack, are secretly surveying it like an acquisition target. Witty and mischievous, rich handcrafted spritework, visibly crisp stepped pixels, restrained deep plum shadows, warm amber lights and moss green. Layered foreground/midground/background; focal village in upper-middle; lower third quiet dark terrain for UI overlay. No writing, letters, logos, watermark or UI. Fill full frame, no border.

## small-country.png — 변두리 소국

Source: `exec-965d4e6c-d86d-4dfd-b972-f25ed0cf3a58.png`

Prompt:
> Use case: stylized-concept. Original environment for a humorous Korean monster-company idle RPG. Chapter 2 '변두리 소국': an impoverished tiny border principality with sprawling golden wheat fields, a modest stone keep, patched red banners with no symbols, creaking windmill, crowded trade carts crossing a toll bridge. A comically tiny crown-shaped roof ornament on the keep suggests a king with very little budget. Two tiny monster employees, a goblin carrying account ledgers and a mimic cargo chest, watch from foreground haystacks. High quality 16-bit pixel art, crisp pixel clusters, layered landscape, 1536x1024 wide. Consistent palette deep plum shadows, amber golden sunlight and dusty russet accents. Village and keep focal point upper-middle, calm darker lower third for overlay. No text, letters, typography, UI, watermark, borders.

## small-kingdom.png — 작은 왕국

Source: `exec-0820974d-110b-43c5-bdf8-c7fc40898bd6.png`

Prompt:
> Use case: stylized-concept. Original 16-bit pixel-art environment for Korean monster-company RPG, chapter 3 '작은 왕국' small organized human kingdom. Wide 1536x1024 composition with crisp pixel clusters and elaborate layered medieval city detail. A compact fortified royal city, blue slate rooftops, tidy barracks, double stone walls and a graceful modest royal palace on a hill. Cold blue morning mist and cyan river contrast with amber torch lights and deep plum shadows. Tiny ranks of knights drilling in a courtyard emphasize organization. In very small foreground silhouettes a stone golem carries a monster company briefcase and an imp examines the walls with spyglass, humorous corporate invasion feel. Main city centered in upper-middle, lower third darker foreground for game UI overlays. No text, no letters, no UI, no watermarks, no frames.

## castle.png — 거대한 성

Source: `exec-1dffbf1c-d33d-4a1e-a790-8270be44a2ce.png`

Prompt:
> Use case: stylized-concept. Original 16-bit pixel-art game environment, wide 1536x1024. Chapter 4 '거대한 성', a truly gigantic and intimidating medieval fortress filling upper three quarters: multiple concentric battlements, immense spires, massive drawbridge over a deep moat, huge purple banners without symbols, warm windows and enormous iron portcullis. Moody violet twilight and silvery rain clouds, plum shadows, warm amber candles. The castle dwarfs tiny siege carts. In lower-left foreground a tiny goblin corporate surveyor unfolds a ridiculously long blank parchment acquisition checklist while a stone golem holds an umbrella; witty monster-company theme. Densely detailed handcrafted stepped pixels, clear architectural layers, atmospheric perspective. Lower foreground dark and quiet enough for UI overlay. No lettering, no words, no logos, no watermark, no border, no actual interface.

## hero-kingdom.png — 용사 왕국

Source: `exec-5aa071ff-8f87-4581-a5f1-68e9b35fcbb1.png`

Prompt:
> Use case: stylized-concept. Original 16-bit pixel-art environment for final chapter '용사 왕국' in humorous monster company RPG. A magnificent heroic human capital with radiant ivory and gold towers, enormous winged knight statues, crimson banners without lettering, grand circular palace and avenue full of tiny elite heroes. Dramatic rose-red sunset behind golden spires, burgundy and deep plum shadows, glimmering warm windows. Epic final destination, far grander and more magical than a normal medieval castle. On dark foreground balcony a small purple imp in a suit and a green goblin hold a rolled-up blank acquisition contract and a giant rubber stamp, plotting a hostile takeover. Crisp stepped pixel clusters, polished hand-crafted 16-bit detail, wide 1536x1024, layered landscape and strong silhouette. Main kingdom in upper-middle, darker foreground lower third for overlay. No text, letters, words, logo, watermark, borders or UI.

## 배포 파일

생성된 PNG를 `cwebp -lossless -exact`로 WebP 포맷으로 변환했다. RGBA 바이트가 원본과 동일함을 검사했다. 화면은 `.webp`를 사용한다. PNG 원본은 로컬 `artifacts/art-v015-originals/`에 보관한다.
