# v0.13.7 asset validation

Generated pixel assets are stored as real PNG files under `assets/` and are loaded by `scripts/sprites-v0137.js`.

- `generated-monsters-v0137.png`: 3x3 base monster atlas (9 families)
- `generated-items-v0137.png`: 4x4 item atlas
- `generated-monster-attack-v0137.png`: 4-frame x 8-family attack atlas
- `generated-monster-hurt-v0137.png`: 4-frame x 8-family hurt atlas

The Mimic uses its generated static sprite plus a dedicated transform/recoil fallback motion because the current generated attack/hurt atlas contains 8 animated families. Combat animation is event-driven from the real server battle turn state, not a decorative loop.
