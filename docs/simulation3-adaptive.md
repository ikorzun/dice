# Auto Hand — adaptive generator check
seed adapt-1 · 100 runs × 30 levels per player · adapt-1/recipes-1/400 · aim 75.0% · 2026-11-02T09:31:03.601Z

Target ladder: L1 340 · L2 360 · L3 360 · L5 380 · L10 430 · L15 460 · L20 460 · L30 460. Level 1 is fixed (8 dice + ×2); from level 2 the layout follows the player's skill.

| Player | Win rate L2–10 | L11–20 | L21–30 | Mean predicted win | Final skill (mean) | Mean dice / blocks / bonuses | Hands with help | Win rate when helped |
|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 48.0% | 44.6% | 46.5% | 52.8% | 0.63 | 6.82 / 0.31 / 1.86 | 0.0% | — |
| naive | 62.4% | 59.7% | 62.5% | 68.0% | 0.77 | 6.73 / 0.44 / 1.83 | 0.0% | — |
| greedy | 75.6% | 73.8% | 73.5% | 74.9% | 1.01 | 6.39 / 0.90 / 1.71 | 2.2% | 18.2% |

## Layouts each player gets most (share of levels 2–30)

- **lazy (no rerolls)**: 7d0x:x3_straight+x3_trips 35.8%, 7d0x:x2_any+x3_straight 8.2%, 6d1x:x2_any+x3_straight 7.0%, 7d0x:x3_straight+x3_pairs 5.0%, 7d0x:x3_straight+joker 3.7%, 6d1x:x3_straight+joker 3.6%, 7d0x:x3_straight+refund 3.5%, 7d0x:x2_any+x3_trips 3.3%
- **naive**: 7d0x:x3_straight+x3_trips 23.5%, 6d1x:x2_any+x3_straight 9.2%, 7d0x:x2_any+x3_straight 7.9%, 6d1x:x3_straight+joker 5.6%, 7d0x:x3_straight+x3_pairs 5.1%, 6d1x:x3_straight+x3_pairs 4.1%, 7d0x:x2_any+x3_trips 3.6%, 7d1x:x3_straight 3.4%
- **greedy**: 6d1x:x2_any+x3_straight 12.6%, 6d1x:x3_straight+refund 9.6%, 6d1x:x3_straight+x3_pairs 9.2%, 6d2x:x3_straight 6.8%, 7d0x:x3_straight+x3_trips 3.7%, 6d1x:x3_straight+x3_trips 3.6%, 6d2x:x3_trips 3.2%, 6d1x:x3_straight+joker 3.0%

Recipe ids: `<dice>d<blocks>x:<bonus kinds>`. Runtime: 3.8 s
