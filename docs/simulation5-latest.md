# Poker 5 — simulation report
seed 20261030 · hands 3 · rerolls 3 · small straight true · 2026-10-30T23:55:10.905Z

## A. Fresh boards (1500): score per level

Best opening snake: mean 23.9, median 20, p90 40.
Naive bot: mean 99.5 ± 1.3, median 95, p10 70, p25 80, p75 115, p90 130.
Greedy bot: mean 146.1 ± 1.8, median 145, p10 106, p25 120, p75 170, p90 186.

| Target T | P(naive ≥ T) | P(greedy ≥ T) |
|---|---|---|
| 20 | 100.0% | 100.0% |
| 30 | 100.0% | 100.0% |
| 40 | 100.0% | 100.0% |
| 50 | 99.1% | 99.8% |
| 60 | 99.1% | 99.3% |
| 70 | 95.8% | 98.5% |
| 80 | 81.7% | 97.6% |
| 90 | 62.9% | 95.4% |
| 100 | 49.5% | 92.3% |
| 120 | 21.9% | 78.5% |
| 150 | 3.3% | 47.7% |

## B. Generator per tier (250 levels per tier)

| Tier | Target | Mean opening best | Fallbacks | Naive win rate | Greedy win rate |
|---|---|---|---|---|---|
| 1 | 40 | 16.2 | 0 | 100.0% | 99.6% |
| 2 | 55 | 19.1 | 0 | 99.2% | 100.0% |
| 3 | 70 | 18.4 | 0 | 95.6% | 98.0% |
| 4 | 90 | 22.5 | 0 | 65.6% | 95.2% |
| 5 | 110 | 21.9 | 0 | 31.6% | 85.6% |

Runtime: 211.0 s
