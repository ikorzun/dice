# Poker 5 — simulation report
seed 20261030 · table pips · hands 3 · rerolls 2 · small straight false · end on target true · gold cell yes (8 dice) · 2026-10-31T08:50:14.935Z

## A. Fresh boards (1200): score per level

Best opening snake: mean 46.7, median 45, p90 64.
Naive bot: mean 179.5 ± 2.5, median 179, p10 126, p25 147, p75 206, p90 232.
Greedy bot: mean 238.9 ± 3.7, median 229, p10 166, p25 196, p75 273, p90 330.

| Target T | P(naive ≥ T) | P(greedy ≥ T) |
|---|---|---|
| 20 | 100.0% | 100.0% |
| 30 | 100.0% | 100.0% |
| 40 | 100.0% | 100.0% |
| 50 | 100.0% | 100.0% |
| 60 | 100.0% | 100.0% |
| 70 | 99.9% | 100.0% |
| 80 | 99.9% | 100.0% |
| 90 | 99.3% | 99.9% |
| 100 | 98.3% | 99.8% |
| 120 | 92.5% | 99.7% |
| 140 | 81.2% | 97.1% |
| 160 | 64.7% | 92.0% |
| 180 | 49.8% | 84.0% |
| 200 | 30.8% | 72.5% |
| 220 | 16.7% | 57.6% |
| 240 | 7.8% | 43.4% |
| 260 | 4.8% | 32.1% |
| 300 | 1.5% | 15.2% |

## B. Generator per tier (200 levels per tier)

| Tier | Target | Mean opening best | Fallbacks | Naive win rate | Greedy win rate |
|---|---|---|---|---|---|
| 1 | 100 | 35.5 | 0 | 99.0% | 100.0% |
| 2 | 140 | 44.0 | 0 | 84.5% | 96.5% |
| 3 | 180 | 44.6 | 0 | 45.0% | 80.0% |
| 4 | 220 | 44.3 | 0 | 19.0% | 56.0% |
| 5 | 260 | 44.6 | 0 | 1.5% | 33.5% |

Runtime: 55.7 s
