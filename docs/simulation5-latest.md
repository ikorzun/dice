# Poker 5 — simulation report
seed 20261030 · hands 3 · rerolls 3 · small straight true · gold cell yes (8 dice) · 2026-10-31T05:30:33.177Z

## A. Fresh boards (1500): score per level

Best opening snake: mean 18.5, median 20, p90 30.
Naive bot: mean 83.9 ± 0.9, median 85, p10 60, p25 70, p75 95, p90 105.
Greedy bot: mean 109.8 ± 1.4, median 105, p10 80, p25 90, p75 130, p90 150.

| Target T | P(naive ≥ T) | P(greedy ≥ T) |
|---|---|---|
| 20 | 100.0% | 100.0% |
| 30 | 100.0% | 100.0% |
| 40 | 99.9% | 99.7% |
| 50 | 97.0% | 98.7% |
| 60 | 97.0% | 97.3% |
| 70 | 88.1% | 95.7% |
| 80 | 68.2% | 90.3% |
| 90 | 41.9% | 80.6% |
| 100 | 20.1% | 62.5% |
| 120 | 3.0% | 36.3% |
| 150 | 0.3% | 13.4% |

## B. Generator per tier (250 levels per tier)

| Tier | Target | Mean opening best | Fallbacks | Naive win rate | Greedy win rate |
|---|---|---|---|---|---|
| 1 | 40 | 13.7 | 0 | 100.0% | 98.8% |
| 2 | 55 | 16.5 | 0 | 96.0% | 98.0% |
| 3 | 70 | 18.3 | 0 | 89.2% | 96.0% |
| 4 | 85 | 17.8 | 0 | 53.2% | 78.8% |
| 5 | 100 | 17.8 | 0 | 18.0% | 64.0% |

Runtime: 57.7 s
