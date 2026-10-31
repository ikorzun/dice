# Poker 5 — simulation report
seed 20261030 · table pips · hands 3 · rerolls 2 · small straight false · end on target true · gold cell yes (8 dice) · 2026-10-31T08:57:39.647Z

## A. Fresh boards (1000): score per level

Best opening snake: mean 77.1, median 75, p90 120.
Naive bot: mean 294.2 ± 4.9, median 291, p10 192, p25 237, p75 345, p90 395.
Greedy bot: mean 398.5 ± 6.7, median 389, p10 267, p25 330, p75 451, p90 558.

| Target T | P(naive ≥ T) | P(greedy ≥ T) |
|---|---|---|
| 20 | 100.0% | 100.0% |
| 30 | 100.0% | 100.0% |
| 40 | 100.0% | 100.0% |
| 50 | 100.0% | 100.0% |
| 60 | 100.0% | 100.0% |
| 70 | 100.0% | 100.0% |
| 80 | 100.0% | 100.0% |
| 90 | 100.0% | 100.0% |
| 100 | 100.0% | 100.0% |
| 120 | 99.8% | 100.0% |
| 140 | 99.0% | 99.8% |
| 160 | 97.6% | 99.6% |
| 180 | 93.2% | 99.3% |
| 200 | 87.9% | 98.4% |
| 220 | 80.9% | 96.5% |
| 240 | 74.0% | 93.6% |
| 260 | 65.6% | 91.6% |
| 300 | 45.7% | 83.0% |

## B. Generator per tier (200 levels per tier)

| Tier | Target | Mean opening best | Fallbacks | Naive win rate | Greedy win rate |
|---|---|---|---|---|---|
| 1 | 140 | 49.4 | 0 | 99.0% | 100.0% |
| 2 | 180 | 58.3 | 0 | 95.0% | 99.5% |
| 3 | 220 | 69.7 | 0 | 76.5% | 95.5% |
| 4 | 260 | 71.0 | 0 | 63.5% | 89.0% |
| 5 | 300 | 74.6 | 0 | 46.5% | 82.5% |

Runtime: 54.8 s
