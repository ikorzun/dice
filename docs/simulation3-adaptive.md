# Auto Hand — adaptive generator check
seed adapt-1 · 100 runs × 30 levels per player · adapt-1/recipes-1/400 · aim 75.0% · 2026-11-01T23:20:49.564Z

Target ladder: L1 340 · L2 360 · L3 360 · L5 380 · L10 430 · L15 460 · L20 460 · L30 460. Level 1 is fixed (8 dice + ×2); from level 2 the layout follows the player's skill.

| Player | Win rate L2–10 | L11–20 | L21–30 | Mean predicted win | Final skill (mean) | Mean dice / blocks / bonuses | Hands with help | Win rate when helped |
|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 48.3% | 44.2% | 46.2% | 53.4% | 0.62 | 6.83 / 0.32 / 1.86 | 0.0% | — |
| naive | 62.3% | 59.1% | 60.3% | 67.3% | 0.71 | 6.75 / 0.40 / 1.84 | 0.0% | — |
| greedy | 75.6% | 73.7% | 72.7% | 74.8% | 1.00 | 6.41 / 0.91 / 1.67 | 4.3% | 11.4% |

## Layouts each player gets most (share of levels 2–30)

- **lazy (no rerolls)**: 7d0x:x3_straight+x3_trips 34.2%, 7d0x:x2_any+x3_straight 8.4%, 7d0x:x3_straight+x3_pairs 6.2%, 6d1x:x2_any+x3_straight 5.5%, 7d0x:x3_straight+joker 4.3%, 7d0x:x3_straight+refund 3.7%, 6d1x:x3_straight+refund 3.3%, 6d1x:x3_straight+joker 2.5%
- **naive**: 7d0x:x3_straight+x3_trips 24.5%, 7d0x:x2_any+x3_straight 9.8%, 6d1x:x2_any+x3_straight 7.4%, 7d0x:x3_straight+x3_pairs 6.4%, 6d1x:x3_straight+refund 4.7%, 7d0x:x3_straight+joker 3.7%, 6d1x:x3_straight+x3_pairs 3.3%, 6d2x:x3_straight 3.1%
- **greedy**: 6d1x:x2_any+x3_straight 12.0%, 6d1x:x3_straight+x3_pairs 9.1%, 6d2x:x3_straight 8.7%, 6d2x:x3_trips 4.4%, 6d1x:x3_straight+refund 4.2%, 7d0x:x3_straight+x3_trips 3.1%, 6d1x:x3_straight+x3_trips 2.8%, 6d1x:x2_any+refund 2.8%

Recipe ids: `<dice>d<blocks>x:<bonus kinds>`. Runtime: 3.9 s
