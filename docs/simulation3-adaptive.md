# Auto Hand — adaptive generator check
seed adapt-1 · 100 runs × 30 levels per player · adapt-1/recipes-1/400 · aim 75.0% · 2026-11-01T10:56:57.098Z

Target ladder: L1 340 · L2 360 · L3 360 · L5 380 · L10 430 · L15 460 · L20 460 · L30 460. Level 1 is fixed (8 dice + ×2); from level 2 the layout follows the player's skill.

| Player | Win rate L2–10 | L11–20 | L21–30 | Mean predicted win | Final skill (mean) | Mean dice / blocks / bonuses | Hands with help | Win rate when helped |
|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 55.6% | 51.5% | 51.7% | 55.5% | 0.63 | 6.91 / 0.25 / 1.83 | 0.0% | — |
| naive | 64.6% | 60.5% | 60.3% | 65.7% | 0.72 | 6.81 / 0.36 / 1.83 | 0.4% | 7.9% |
| greedy | 78.8% | 77.0% | 76.2% | 74.6% | 0.99 | 6.43 / 0.87 / 1.70 | 2.5% | 11.4% |

## Layouts each player gets most (share of levels 2–30)

- **lazy (no rerolls)**: 7d0x:x3_straight+x3_trips 37.1%, 7d0x:x2_any+x3_straight 10.4%, 7d0x:x3_straight+x3_pairs 6.8%, 7d0x:x3_straight+joker 5.0%, 6d1x:x3_straight+joker 4.4%, 6d1x:x2_any+x3_straight 3.8%, 8d0x:x3_straight 3.5%, 7d1x:x3_straight 3.0%
- **naive**: 7d0x:x3_straight+x3_trips 28.1%, 7d0x:x2_any+x3_straight 8.7%, 7d0x:x3_straight+x3_pairs 6.9%, 6d1x:x2_any+x3_straight 5.8%, 6d1x:x3_straight+x3_pairs 5.7%, 6d1x:x3_straight+joker 4.8%, 7d0x:x3_straight+joker 4.5%, 7d1x:x3_straight 3.4%
- **greedy**: 6d1x:x3_straight+x3_pairs 13.0%, 6d1x:x2_any+x3_straight 12.9%, 6d2x:x3_straight 6.6%, 6d1x:x2_any+x3_trips 5.3%, 6d1x:x3_straight+x3_trips 5.2%, 7d0x:x3_straight+x3_trips 4.7%, 6d2x:x3_trips 4.2%, 6d1x:x3_straight+joker 3.7%

Recipe ids: `<dice>d<blocks>x:<bonus kinds>`. Runtime: 9.7 s
