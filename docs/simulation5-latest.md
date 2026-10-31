# Poker 5 — simulation report
seed 20261030 · hands 3 · rerolls 3 · small straight true · gold cell yes (8 dice) · 2026-10-31T00:49:11.986Z

## A. Fresh boards (1500): score per level

Best opening snake: mean 19.8, median 20, p90 40.
Naive bot: mean 89.7 ± 1.2, median 85, p10 60, p25 70, p75 105, p90 125.
Greedy bot: mean 128.4 ± 1.9, median 125, p10 80, p25 106, p75 160, p90 180.

| Target T | P(naive ≥ T) | P(greedy ≥ T) |
|---|---|---|
| 20 | 100.0% | 100.0% |
| 30 | 100.0% | 99.8% |
| 40 | 100.0% | 99.3% |
| 50 | 96.7% | 97.7% |
| 60 | 96.6% | 96.4% |
| 70 | 88.4% | 94.0% |
| 80 | 65.3% | 90.7% |
| 90 | 46.9% | 85.3% |
| 100 | 34.9% | 80.2% |
| 120 | 12.6% | 57.8% |
| 150 | 2.2% | 33.3% |

## B. Generator per tier (250 levels per tier)

| Tier | Target | Mean opening best | Fallbacks | Naive win rate | Greedy win rate |
|---|---|---|---|---|---|
| 1 | 40 | 13.8 | 0 | 100.0% | 99.6% |
| 2 | 55 | 16.6 | 0 | 96.4% | 94.4% |
| 3 | 70 | 16.0 | 0 | 82.8% | 92.4% |
| 4 | 90 | 19.3 | 0 | 46.8% | 86.8% |
| 5 | 110 | 18.4 | 0 | 18.0% | 68.0% |

Runtime: 57.4 s
