# Auto Hand — adaptive generator check
seed adapt-1 · 100 runs × 30 levels per player · adapt-1/recipes-1/400 · aim 75.0% · 2026-11-02T18:38:36.313Z

Target ladder: L1 340 · L2 360 · L3 360 · L5 380 · L10 430 · L15 460 · L20 460 · L30 460. Level 1 is fixed (8 dice + ×2); from level 2 the layout follows the player's skill.

| Player | Win rate L2–10 | L11–20 | L21–30 | Mean predicted win | Final skill (mean) | Mean dice / blocks / bonuses | Hands with help | Win rate when helped |
|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 49.1% | 47.4% | 47.9% | 55.6% | 0.63 | 6.87 / 0.29 / 1.85 | 0.0% | — |
| naive | 64.6% | 64.4% | 62.9% | 69.9% | 0.76 | 6.72 / 0.45 / 1.83 | 0.0% | — |
| greedy | 73.6% | 74.3% | 73.5% | 74.9% | 1.01 | 6.45 / 0.85 / 1.71 | 1.4% | 12.8% |

## Layouts each player gets most (share of levels 2–30)

- **lazy (no rerolls)**: 7d0x:x3_straight+x3_trips 32.2%, 7d0x:x2_any+x3_straight 9.4%, 7d0x:x3_straight+x3_pairs 6.7%, 7d0x:x3_straight+joker 4.7%, 6d1x:x3_straight+joker 3.9%, 6d1x:x2_any+x3_straight 3.8%, 7d0x:x3_straight+refund 3.8%, 7d1x:x3_straight 3.6%
- **naive**: 7d0x:x3_straight+x3_trips 16.4%, 7d0x:x2_any+x3_straight 7.6%, 6d1x:x2_any+x3_straight 6.6%, 7d0x:x3_straight+x3_pairs 5.6%, 6d1x:x3_straight+refund 5.2%, 6d1x:x3_straight+joker 4.6%, 7d1x:x3_straight 4.2%, 7d0x:x3_straight+joker 3.8%
- **greedy**: 6d1x:x2_any+x3_straight 9.6%, 6d1x:x3_straight+x3_pairs 8.1%, 6d1x:x3_straight+refund 6.7%, 6d2x:x3_straight 6.0%, 6d1x:x3_straight+x3_trips 4.9%, 6d2x:x3_trips 3.6%, 6d1x:x3_straight+joker 3.1%, 6d1x:x3_pairs+x3_trips 3.0%

Recipe ids: `<dice>d<blocks>x:<bonus kinds>`. Runtime: 4.4 s
