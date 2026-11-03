# Auto Hand — adaptive generator check
seed adapt-1 · 100 runs × 25 levels per player · adapt-1/recipes-1/400 · aim 73.0% · 2026-11-03T14:12:47.858Z

Target ladder (grown with the expected upgrades): L1 340 · L2 370 · L3 380 · L5 430 · L10 560 · L15 670 · L20 750 · L25 820. Level 1 is fixed (8 dice + ×2); from level 2 the layout follows the player's skill.

| Player | Win rate L2–10 | L11–20 | L21–30 | Mean predicted win | Final skill (mean) | Mean dice / blocks / bonuses | Hands with help | Win rate when helped |
|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 54.4% | 47.5% | 41.8% | 51.7% | 0.72 | 6.64 / 0.57 / 1.79 | 0.0% | — |
| naive | 67.1% | 62.7% | 62.0% | 67.2% | 0.84 | 6.48 / 0.86 / 1.67 | 0.0% | — |
| greedy | 77.9% | 75.1% | 75.0% | 74.2% | 1.10 | 6.30 / 1.25 / 1.45 | 1.5% | 2.5% |
| greedy, no upgrades | 61.3% | 31.2% | 12.2% | 34.9% | 0.99 | 6.34 / 1.18 / 1.49 | 7.8% | 2.5% |

## Layouts each player gets most (share of levels 2–30)

- **lazy (no rerolls)**: 7d0x:x3_straight+x3_trips 21.6%, 6d1x:x3_straight+x3_trips 6.1%, 7d0x:x2_any+x3_straight 6.0%, 6d1x:x2_any+x3_straight 5.4%, 6d2x:x3_straight 4.9%, 6d1x:x3_straight+x3_pairs 4.4%, 7d0x:x3_straight+x3_pairs 3.6%, 7d0x:x3_straight+joker 2.8%
- **naive**: 6d2x:x3_straight 10.1%, 6d1x:x2_any+x3_straight 8.2%, 7d0x:x3_straight+x3_trips 8.1%, 6d1x:x3_straight+x3_trips 5.5%, 6d1x:x3_straight+x3_pairs 4.8%, 6d2x:x3_trips 3.9%, 7d1x:x2_any 3.0%, 7d0x:x2_any+x3_straight 2.9%
- **greedy**: 6d1x:x2_any+x3_straight 17.5%, 6d2x:x3_straight 16.8%, 6d2x:x3_pairs 4.7%, 6d2x:x3_trips 4.3%, 6d1x:joker+refund 3.6%, 6d2x:joker 3.2%, 6d2x:refund 3.1%, 6d1x:x3_straight+x3_trips 2.9%
- **greedy, no upgrades**: 6d2x:x3_straight 16.0%, 6d1x:x2_any+x3_straight 14.2%, 6d2x:x3_trips 4.7%, 6d2x:x3_pairs 4.0%, 6d1x:x2_any+refund 3.5%, 7d1x:x2_any 3.5%, 6d1x:x3_straight+x3_pairs 3.2%, 6d2x:refund 3.1%

Recipe ids: `<dice>d<blocks>x:<bonus kinds>`. Runtime: 136.2 s
