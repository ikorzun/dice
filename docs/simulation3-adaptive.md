# Auto Hand — adaptive generator check
seed adapt-1 · 100 runs × 25 levels per player · adapt-1/recipes-1/400 · aim 75.0% · 2026-11-02T20:04:00.996Z

Target ladder (grown with the expected upgrades): L1 340 · L2 370 · L3 380 · L5 430 · L10 560 · L15 680 · L20 760 · L25 840. Level 1 is fixed (8 dice + ×2); from level 2 the layout follows the player's skill.

| Player | Win rate L2–10 | L11–20 | L21–30 | Mean predicted win | Final skill (mean) | Mean dice / blocks / bonuses | Hands with help | Win rate when helped |
|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 48.4% | 39.7% | 35.6% | 42.7% | 0.69 | 6.83 / 0.32 / 1.85 | 0.0% | — |
| naive | 65.1% | 63.8% | 62.2% | 66.2% | 0.83 | 6.67 / 0.52 / 1.81 | 0.0% | — |
| greedy | 77.2% | 74.5% | 75.2% | 74.3% | 1.07 | 6.40 / 0.93 / 1.67 | 1.4% | 5.5% |
| greedy, no upgrades | 61.0% | 28.8% | 9.4% | 33.6% | 0.97 | 6.42 / 0.89 / 1.68 | 7.4% | 3.1% |

## Layouts each player gets most (share of levels 2–30)

- **lazy (no rerolls)**: 7d0x:x3_straight+x3_trips 30.7%, 7d0x:x2_any+x3_straight 7.9%, 7d0x:x3_straight+x3_pairs 7.3%, 6d1x:x2_any+x3_straight 5.1%, 6d1x:x3_straight+joker 4.1%, 7d1x:x3_straight 4.0%, 7d0x:x3_straight+joker 4.0%, 7d0x:x3_straight+refund 4.0%
- **naive**: 7d0x:x3_straight+x3_trips 13.4%, 6d1x:x2_any+x3_straight 7.9%, 7d0x:x2_any+x3_straight 5.7%, 6d1x:x3_straight+joker 5.7%, 6d1x:x3_straight+refund 5.2%, 7d0x:x3_straight+x3_pairs 5.0%, 6d1x:x3_straight+x3_pairs 4.3%, 7d1x:x3_straight 3.5%
- **greedy**: 6d1x:x2_any+x3_straight 10.4%, 6d1x:x3_straight+x3_pairs 9.5%, 6d2x:x3_straight 7.3%, 6d1x:x3_straight+x3_trips 5.4%, 6d1x:x3_straight+refund 5.3%, 6d2x:x3_trips 4.2%, 6d1x:x2_any+refund 3.3%, 6d1x:x3_straight+joker 2.8%
- **greedy, no upgrades**: 6d1x:x2_any+x3_straight 10.8%, 6d1x:x3_straight+x3_pairs 7.9%, 6d2x:x3_straight 7.2%, 6d1x:x3_straight+refund 6.3%, 6d1x:x3_straight+x3_trips 5.0%, 6d2x:x3_trips 3.8%, 6d1x:x3_pairs+x3_trips 3.1%, 6d1x:x3_straight+joker 3.0%

Recipe ids: `<dice>d<blocks>x:<bonus kinds>`. Runtime: 71.0 s
