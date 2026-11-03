# Auto Hand — adaptive generator check
seed adapt-1 · 100 runs × 25 levels per player · adapt-1/recipes-1/400 · aim 73.0% · bank kept · 2026-11-03T19:19:54.658Z

Target ladder (grown with the expected upgrades): L1 340 · L2 370 · L3 380 · L5 430 · L10 560 · L15 670 · L20 750 · L25 820. Level 1 is fixed (8 dice + ×2); from level 2 the layout follows the player's skill.

| Player | Win rate L2–10 | L11–20 | L21–30 | Mean predicted win | Final skill (mean) | Mean dice / blocks / bonuses | Hands with help | Win rate when helped |
|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 48.7% | 42.1% | 37.0% | 49.8% | 0.44 | 6.59 / 0.65 / 1.76 | 0.0% | — |
| naive | 65.8% | 62.1% | 60.4% | 67.5% | 0.78 | 6.42 / 0.95 / 1.63 | 0.0% | — |
| greedy | 77.9% | 73.7% | 73.6% | 74.2% | 1.07 | 6.33 / 1.25 / 1.43 | 1.4% | 3.9% |
| greedy, no upgrades | 62.8% | 31.1% | 11.2% | 35.3% | 1.00 | 6.35 / 1.16 / 1.49 | 7.5% | 2.4% |

## Layouts each player gets most (share of levels 2–30)

- **lazy (no rerolls)**: 7d0x:x3_straight+x3_trips 19.5%, 6d1x:x2_any+x3_straight 7.0%, 6d2x:x3_straight 5.4%, 6d1x:x3_straight+x3_trips 5.3%, 6d1x:x3_straight+x3_pairs 4.6%, 7d0x:x2_any+x3_straight 4.4%, 7d0x:x3_straight+x3_pairs 3.7%, 6d1x:x3_straight+joker 2.8%
- **naive**: 6d2x:x3_straight 11.7%, 6d1x:x2_any+x3_straight 9.7%, 7d0x:x3_straight+x3_trips 7.2%, 6d1x:x3_straight+x3_pairs 5.4%, 6d1x:x3_straight+x3_trips 4.6%, 6d2x:x3_trips 4.0%, 6d1x:x3_straight+joker 3.0%, 7d1x:x2_any 2.8%
- **greedy**: 6d2x:x3_straight 16.1%, 6d1x:x2_any+x3_straight 15.8%, 6d2x:x3_pairs 4.9%, 6d2x:x3_trips 4.0%, 6d1x:joker+refund 4.0%, 6d1x:x3_straight+x3_trips 3.8%, 6d2x:refund 3.3%, 6d2x:joker 3.2%
- **greedy, no upgrades**: 6d2x:x3_straight 16.0%, 6d1x:x2_any+x3_straight 13.6%, 6d2x:x3_trips 4.7%, 6d2x:x3_pairs 3.8%, 7d1x:x2_any 3.4%, 6d1x:x2_any+refund 3.4%, 6d1x:x3_straight+x3_pairs 3.3%, 6d1x:x3_straight+x3_trips 3.2%

Recipe ids: `<dice>d<blocks>x:<bonus kinds>`. Runtime: 144.7 s
