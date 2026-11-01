# Auto Hand — adaptive generator check
seed adapt-1 · 100 runs × 30 levels per player · adapt-1/recipes-1/400 · aim 75.0% · 2026-11-01T22:26:26.093Z

Target ladder: L1 340 · L2 360 · L3 360 · L5 380 · L10 430 · L15 460 · L20 460 · L30 460. Level 1 is fixed (8 dice + ×2); from level 2 the layout follows the player's skill.

| Player | Win rate L2–10 | L11–20 | L21–30 | Mean predicted win | Final skill (mean) | Mean dice / blocks / bonuses | Hands with help | Win rate when helped |
|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 51.7% | 50.0% | 45.6% | 52.7% | 0.58 | 6.88 / 0.25 / 1.87 | 0.0% | — |
| naive | 64.7% | 62.2% | 61.5% | 67.0% | 0.70 | 6.77 / 0.38 / 1.85 | 0.0% | — |
| greedy | 78.4% | 75.4% | 76.3% | 74.6% | 0.98 | 6.46 / 0.84 / 1.70 | 2.9% | 11.1% |

## Layouts each player gets most (share of levels 2–30)

- **lazy (no rerolls)**: 7d0x:x3_straight+x3_trips 37.8%, 7d0x:x2_any+x3_straight 11.4%, 7d0x:x3_straight+x3_pairs 6.3%, 6d1x:x2_any+x3_straight 4.2%, 7d0x:x3_straight+joker 4.0%, 7d0x:x3_straight+refund 3.6%, 7d1x:x3_straight 2.6%, 6d1x:x3_straight+joker 2.1%
- **naive**: 7d0x:x3_straight+x3_trips 25.2%, 7d0x:x2_any+x3_straight 11.4%, 6d1x:x2_any+x3_straight 7.1%, 7d0x:x3_straight+x3_pairs 6.7%, 7d1x:x3_straight 3.8%, 7d0x:x3_straight+joker 3.6%, 6d1x:x3_straight+refund 3.4%, 6d2x:x3_straight 3.0%
- **greedy**: 6d1x:x2_any+x3_straight 11.4%, 6d1x:x3_straight+x3_pairs 8.7%, 6d2x:x3_straight 7.8%, 6d1x:x3_straight+refund 4.9%, 7d0x:x3_straight+x3_trips 4.1%, 6d2x:x3_trips 3.8%, 6d1x:x3_straight+x3_trips 3.2%, 6d1x:x2_any+x3_trips 2.9%

Recipe ids: `<dice>d<blocks>x:<bonus kinds>`. Runtime: 4.2 s
