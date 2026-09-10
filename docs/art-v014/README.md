# v0.14.0 — 몬스터도 출근합니다

## Art direction

A humorous underground monster corporation: plum stone, amber lamps, jade slime, brass signage and paper documents. The artwork shows employees doing recognisable office jobs; labels, state, and actions remain accessible HTML. Existing monster evolution/combat sprites remain the source of character identity.

## Assets

Built-in `image_gen` generated five original 1536×1024 scenes. Full PNG originals are retained locally in `assets/art-v014/`; the production site uses WebP siblings encoded with `cwebp -q 84`. Total WebP transfer is about 1.5 MB across all five scenes, with below-the-fold images loaded lazily. No new image polling or DOM observers were added.

- `headquarters.webp`: login and headquarters. Slime stamps paperwork, goblin carries files, imp delivers coffee.
- `recruitment.webp`: recruiting, personnel banner, recruiting card. Nervous applicants and an impossibly long resume.
- `dormitory.webp`: quarters and quarters card. Oversized troll bunk, slime bath, imp reading.
- `workshop.webp`: production and forge. Golem smith makes a tiny sword with imp quality control.
- `shop.webp`: shop and warehouse. Mimic cash register and secondhand hero equipment.
- `monster-seal.svg`: native pixel-grid company emblem with horns, fangs, and a bow tie; navigation and favicon.

Generation prompt set: [prompts.md](prompts.md). Original PNGs are omitted from Git to avoid shipping duplicate source images.

## Implementation

`app.js` renders facility art, visible status text and original data-action controls. `officeScene` decorates only facility overview sheets; equipment detail and production quantity controls retain their existing layout. `ui-v014.css` scopes new presentation to the app, facility cards, auth, and sheets. It overrides legacy 50px image constraints and grid row collapse. Auth form inputs support zoom and keyboard focus, the auth status message has a live region, and reduced motion is respected.

During browser verification an existing bootstrap error was found: the stability script executes before `app.js` and attempted to read `S` while the document was interactive. Its interval interception still installs first, while its state-dependent initialization now waits until `DOMContentLoaded`, after all deferred application scripts. This restores the intended renderer wrapper and state poll registration.

## Verification scope

Browser checks use local synthetic game data with `session=null`; no player account or production game state is changed by these checks. Coverage includes 360px and 390px layouts, desktop login and HQ, six facility entry points, personnel navigation, modal return navigation, alerts, image loading, horizontal overflow and bootstrap errors. All application JavaScript is syntax checked. Live authentication and server-side purchases/combat are outside this visual change's verification scope.
