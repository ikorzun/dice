# Auto Hand — adaptive generator check
seed adapt-1 · 100 runs × 30 levels per player · adapt-1/recipes-1/400 · aim 75.0% · 2026-11-01T20:25:08.849Z

Target ladder: L1 340 · L2 360 · L3 360 · L5 380 · L10 430 · L15 460 · L20 460 · L30 460. Level 1 is fixed (8 dice + ×2); from level 2 the layout follows the player's skill.

| Player | Win rate L2–10 | L11–20 | L21–30 | Mean predicted win | Final skill (mean) | Mean dice / blocks / bonuses | Hands with help | Win rate when helped |
|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 54.1% | 47.9% | 48.4% | 53.3% | 0.60 | 6.90 / 0.24 / 1.86 | 0.0% | — |
| naive | 62.9% | 60.8% | 59.3% | 65.2% | 0.69 | 6.83 / 0.32 / 1.85 | 0.7% | 8.6% |
| greedy | 78.3% | 75.8% | 76.3% | 74.6% | 0.99 | 6.47 / 0.79 / 1.74 | 2.8% | 12.1% |

## Layouts each player gets most (share of levels 2–30)

- **lazy (no rerolls)**: 7d0x:x3_straight+x3_trips 38.8%, 7d0x:x2_any+x3_straight 9.8%, 7d0x:x3_straight+x3_pairs 5.9%, 7d0x:x3_straight+joker 4.0%, 7d0x:x3_straight+refund 3.7%, 6d1x:x3_straight+joker 3.2%, 6d1x:x2_any+x3_straight 3.0%, 7d1x:x3_straight 2.9%
- **naive**: 7d0x:x3_straight+x3_trips 28.4%, 7d0x:x2_any+x3_straight 8.5%, 7d0x:x3_straight+x3_pairs 6.8%, 6d1x:x3_straight+joker 4.2%, 6d1x:x2_any+x3_straight 4.2%, 6d1x:x3_straight+refund 3.7%, 6d1x:x3_straight+x3_pairs 3.4%, 7d0x:x3_straight+joker 3.3%
- **greedy**: 6d1x:x3_straight+x3_pairs 10.3%, 6d1x:x2_any+x3_straight 10.3%, 6d2x:x3_straight 4.8%, 6d1x:x3_straight+x3_trips 4.8%, 6d1x:x3_straight+refund 4.6%, 6d2x:x3_trips 3.8%, 7d0x:x3_straight+x3_trips 3.7%, 6d1x:x2_any+x3_trips 3.4%

Recipe ids: `<dice>d<blocks>x:<bonus kinds>`. Runtime: 4.4 s
