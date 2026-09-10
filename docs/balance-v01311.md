# v0.13.11 Simulation-Based Balance Pass

This pass intentionally does **not** use production player progression as a tuning input.
It reproduces the current rules in a deterministic Monte Carlo regression simulator and changes only the points that create a clear progression reversal, party-growth penalty, or offline-cap penalty.

## Metrics reviewed separately

- Combat survival and boss clear probability
- XP per hour / party-size XP scaling
- Material inflow per hour
- Crafting material value and combined craft+sale throughput
- Chapter unlock speed
- Offline cargo saturation
- Enhancement-stone sink sanity
- Softlock and runaway thresholds at 10m / 30m / 1h / 4h / 8h / 24h / 72h

## Changes applied

### 1. Evolution no longer resets level to 1
Before: reaching the evolution gate could make the monster immediately weaker in practical chapter progression.
Now: evolution preserves the current level. The target evolution form name is written directly at evolution time.

### 2. Party XP scaling
Old per-monster XP:
`floor(base_xp / party_size)`

New per-monster XP:
`ceil(base_xp * (1 + 0.10 * (party_size - 1)) / party_size)`

The solo rate is unchanged. A larger party still grows each individual more slowly than solo play, but total team growth no longer drops simply because another monster was added.

### 3. Offline cargo capacity
Old: fixed 3,000 pending items per hunting site regardless of the number of active parties.

New:
`min(9000, 3000 + 1500 * (active_parties - 1))`

Examples:
- 1 active party: 3,000
- 2 active parties: 4,500
- 3 active parties: 6,000
- 4 active parties: 7,500
- 5+ active parties: capped at 9,000

This scales sub-linearly so adding parties remains useful without making unattended stockpile growth linear.

## Regression results

Representative Monte Carlo results with the same seeds before/after where applicable:

| Metric | Result |
|---|---:|
| Chapter 1 median clear | 4.02 h |
| Chapter 2 old median clear | 15.24 h |
| Chapter 2 v0.13.11 median clear | 6.32 h |
| Chapter 3 v0.13.11 median clear | 8.93 h |
| Chapter 1 XP/h | ~4,790 |
| Chapter 2 XP/h per normal party member | ~3,431 |
| Chapter 3 XP/h per normal party member | ~4,518 |
| Chapter 1 material inflow | ~303/h |
| Chapter 2 material inflow | ~327/h |
| Chapter 3 material inflow | ~210/h |
| 1-party cargo fill time | ~9.2–14.3 h |
| 3-party cargo fill time | ~6.1–9.5 h |
| Combined craft+sale throughput | ~655 gold/h across current recipes |
| +5 enhancement reach before destruction | ~92% |
| +5 median stones on successful path | 22 |

### Time-window checks

The regression suite explicitly runs 10m, 30m, 1h, 4h, 8h, 24h and 72h windows.
Broad expected behavior:

- No canonical chapter clears inside 1 hour.
- Chapter 1 begins clearing around the 4-hour window and is stable by 8 hours.
- Chapter 2 is not guaranteed by 4 hours but is normally resolved by the 8–24 hour band.
- Chapter 3 can still require repeated boss cycles, but the canonical setup resolves inside 24 hours.
- No tested material stream fills a single-party cargo cap in under roughly 9 hours.
- Three parties at one site do not collapse the offline window to roughly 3 hours anymore.

## Deliberately not changed

The simulation did not justify changing these values in this pass:

- Normal-enemy combat coefficients
- Boss power values
- 500 normal-win boss gate
- Material drop tables
- Recipe material costs
- Recipe craft/sale times
- Enhancement probabilities or stone costs

Those values remain as-is until a future regression identifies a specific failure against the thresholds.

## Running the regression

```bash
python tools/balance_sim_v01311.py
```

Exit code `0` means all balance guardrails pass. A failed guardrail exits non-zero so the script can be wired into CI later.
