# Auto Hand (mode 3) — simulation report
seed 20261031 · 300 generator levels per tier (level index tier … tier+7) · 3 hands · 3 shared rerolls · bonuses start off, the bots switch them on · 2026-11-03T14:05:16.774Z

Bots: **naive** switches every bonus on, holds exactly the best hand's dice and rerolls once per hand (while rerolls ≥ hands left), then plays. **Greedy** (`playGreedyBot3`, margin 20, strong 150) evaluates every hold mask of the dice by the exact expected best hand after one reroll and rerolls while the best mask beats the standing hand by 20; conditional bonuses always on, ×2 any and joker on for the last hand or when the hand without them already totals 150. Both maximize score and ignore the target.

## A. Tiers: layout and bonus kinds

| Tier | Layout | Bonus kinds placed (share of bonus cells) | Mean opening best (as generated) |
|---|---|---|---|
| 1 | 8 dice · 1 bonus · 0 block | x2_any 17.7%, x3_straight 16.0%, x3_pairs 15.3%, x3_trips 17.3%, joker 17.3% | 101.4 |
| 2 | 7 dice · 1 bonus · 1 block | x2_any 5.7%, x3_straight 18.3%, x3_pairs 16.3%, x3_trips 19.7%, joker 19.7% | 83.6 |
| 3 | 6 dice · 2 bonus · 1 block | x2_any 15.8%, x3_straight 12.5%, x3_pairs 20.2%, x3_trips 20.5%, joker 14.8% | 59.4 |
| 4 | 6 dice · 1 bonus · 2 block | x2_any 13.0%, x3_straight 8.3%, x3_pairs 11.0%, x3_trips 22.7%, joker 23.0% | 58.7 |
| 5 | 6 dice · 1 bonus · 2 block | x2_any 12.0%, x3_straight 14.3%, x3_pairs 13.7%, x3_trips 12.7%, joker 20.3% | 65.6 |

## B. Score distributions per tier (quantiles for adaptive difficulty)

| Tier | Bot | Mean ± 95% CI | p5 | p10 | p20 | p25 | p30 | p40 | p50 | p60 | p70 | p75 | p80 | p90 | p95 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | naive | 483.8 ± 12.0 | 315 | 354 | 392 | 408 | 427 | 460 | 480 | 504 | 550 | 560 | 576 | 615 | 640 |
| 1 | greedy | 541.1 ± 9.5 | 410 | 440 | 466 | 480 | 500 | 520 | 545 | 560 | 590 | 605 | 620 | 640 | 660 |
| 2 | naive | 429.8 ± 11.0 | 276 | 314 | 344 | 365 | 376 | 395 | 425 | 455 | 480 | 493 | 515 | 560 | 580 |
| 2 | greedy | 463.2 ± 9.4 | 326 | 360 | 415 | 426 | 440 | 460 | 480 | 480 | 495 | 515 | 520 | 560 | 580 |
| 3 | naive | 469.8 ± 14.6 | 275 | 302 | 352 | 375 | 395 | 438 | 478 | 510 | 549 | 562 | 584 | 624 | 650 |
| 3 | greedy | 529.6 ± 15.3 | 266 | 380 | 435 | 460 | 478 | 520 | 540 | 566 | 595 | 600 | 624 | 660 | 740 |
| 4 | naive | 354.5 ± 10.8 | 204 | 235 | 268 | 286 | 302 | 330 | 354 | 380 | 410 | 425 | 440 | 475 | 495 |
| 4 | greedy | 398.9 ± 11.0 | 216 | 263 | 322 | 335 | 360 | 388 | 405 | 430 | 460 | 480 | 480 | 519 | 540 |
| 5 | naive | 358.1 ± 11.7 | 189 | 225 | 268 | 285 | 300 | 335 | 357 | 389 | 415 | 430 | 440 | 480 | 536 |
| 5 | greedy | 405.1 ± 10.8 | 226 | 281 | 328 | 350 | 365 | 400 | 420 | 440 | 465 | 480 | 480 | 516 | 558 |

pX is the score that X% of levels stay below; the win rate at target T is the share of levels scoring ≥ T.

## C. Targets

Criterion (owner, 31.10.2026): greedy win rate ≈75% at tier 1 stepping down evenly to ≈40% at tier 5. Suggested target = the multiple of 10 whose greedy win rate is closest to the goal.

| Tier | Goal (greedy) | Suggested target | Greedy win rate there | Naive win rate there | Current TIERS3 target | Greedy win rate | Naive win rate |
|---|---|---|---|---|---|---|---|
| 1 | 75.0% | 490 | 73.0% | 48.3% | 490 | 73.0% | 48.3% |
| 2 | 66.3% | 450 | 65.0% | 42.0% | 440 | 72.3% | 47.0% |
| 3 | 57.5% | 530 | 56.0% | 33.3% | 500 | 67.7% | 43.0% |
| 4 | 48.8% | 410 | 48.7% | 31.0% | 420 | 47.0% | 28.3% |
| 5 | 40.0% | 440 | 42.3% | 20.7% | 430 | 46.3% | 25.0% |

Suggested targets are not monotone non-decreasing over the tiers.
Tiers 4 and 5 share a layout and differ only by target.
TIERS3 targets were set from a larger run of this script (`--tierLevels=1000 --seed=check1000`); a 300-level sample suggests targets within about 10 points of them.

### Win rate over a range of targets (naive / greedy)

| Target | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---|---|---|---|---|---|
| 200 | 99.3% / 100.0% | 100.0% / 98.3% | 99.0% / 97.3% | 95.7% / 96.3% | 93.3% / 96.7% |
| 225 | 99.3% / 99.7% | 100.0% / 98.0% | 98.7% / 96.3% | 90.3% / 94.7% | 90.0% / 95.0% |
| 250 | 99.0% / 99.7% | 97.7% / 97.3% | 98.0% / 96.3% | 85.3% / 92.3% | 85.3% / 93.0% |
| 275 | 98.3% / 99.7% | 95.0% / 96.3% | 95.0% / 94.3% | 78.0% / 87.7% | 78.3% / 90.0% |
| 300 | 96.7% / 99.0% | 91.7% / 95.7% | 90.3% / 93.7% | 70.3% / 83.3% | 70.0% / 84.7% |
| 325 | 93.3% / 98.7% | 86.3% / 95.0% | 85.0% / 93.0% | 62.7% / 78.3% | 63.3% / 80.7% |
| 350 | 90.3% / 98.0% | 78.7% / 91.3% | 80.0% / 92.3% | 51.3% / 72.0% | 52.3% / 75.0% |
| 375 | 85.0% / 97.7% | 70.7% / 88.3% | 75.0% / 90.0% | 42.3% / 65.3% | 43.3% / 65.3% |
| 400 | 77.7% / 96.3% | 58.3% / 83.3% | 68.3% / 87.0% | 35.7% / 52.3% | 35.7% / 60.0% |
| 425 | 70.0% / 92.3% | 50.7% / 75.7% | 61.7% / 81.3% | 25.7% / 43.0% | 27.0% / 47.3% |
| 450 | 61.3% / 88.0% | 42.0% / 65.0% | 55.3% / 76.7% | 17.7% / 34.0% | 18.3% / 35.3% |
| 475 | 55.0% / 79.3% | 34.7% / 56.0% | 50.7% / 71.7% | 10.0% / 26.0% | 13.0% / 29.0% |
| 500 | 43.3% / 70.7% | 24.0% / 28.3% | 43.0% / 67.7% | 4.7% / 13.3% | 7.7% / 13.0% |
| 525 | 34.7% / 56.0% | 16.7% / 19.0% | 35.3% / 57.7% | 3.0% / 6.3% | 6.0% / 7.7% |
| 550 | 30.0% / 49.3% | 11.3% / 13.3% | 29.7% / 47.0% | 1.7% / 3.7% | 4.7% / 5.7% |
| 575 | 20.3% / 36.0% | 6.0% / 5.7% | 21.3% / 37.7% | 1.0% / 2.3% | 2.3% / 1.7% |
| 600 | 12.7% / 29.0% | 4.0% / 2.3% | 16.3% / 28.0% | 1.0% / 1.3% | 1.7% / 1.0% |
| 625 | 7.0% / 18.3% | 2.3% / 0.7% | 9.3% / 19.3% | 1.0% / 0.3% | 0.7% / 0.0% |
| 650 | 4.7% / 5.3% | 2.3% / 0.7% | 5.0% / 12.3% | 0.3% / 0.0% | 0.7% / 0.0% |
| 675 | 3.7% / 4.7% | 1.3% / 0.7% | 3.7% / 9.0% | 0.0% / 0.0% | 0.3% / 0.0% |
| 700 | 2.0% / 1.7% | 1.3% / 0.7% | 3.3% / 7.0% | 0.0% / 0.0% | 0.3% / 0.0% |
| 725 | 1.3% / 0.0% | 0.7% / 0.0% | 2.3% / 5.7% | 0.0% / 0.0% | 0.0% / 0.0% |
| 750 | 1.0% / 0.0% | 0.0% / 0.0% | 2.0% / 4.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| 775 | 0.7% / 0.0% | 0.0% / 0.0% | 1.7% / 3.7% | 0.0% / 0.0% | 0.0% / 0.0% |
| 800 | 0.7% / 0.0% | 0.0% / 0.0% | 1.3% / 3.3% | 0.0% / 0.0% | 0.0% / 0.0% |
| 825 | 0.7% / 0.0% | 0.0% / 0.0% | 1.3% / 2.7% | 0.0% / 0.0% | 0.0% / 0.0% |
| 850 | 0.3% / 0.0% | 0.0% / 0.0% | 0.3% / 1.3% | 0.0% / 0.0% | 0.0% / 0.0% |
| 875 | 0.3% / 0.0% | 0.0% / 0.0% | 0.3% / 1.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| 900 | 0.0% / 0.0% | 0.0% / 0.0% | 0.3% / 0.7% | 0.0% / 0.0% | 0.0% / 0.0% |

## D. Played hands

Share of played hands by category, all tiers pooled (share of points in brackets).

| Bot | pair | two_pairs | small_straight | three_kind | full_house | straight | four_kind | five_kind |
|---|---|---|---|---|---|---|---|---|
| naive | 0.2% (0.1%) | 10.7% (8.0%) | 2.2% (0.8%) | 2.0% (1.3%) | 40.8% (37.6%) | 26.6% (35.0%) | 10.1% (8.6%) | 7.3% (8.7%) |
| greedy | 0.5% (0.1%) | 12.9% (8.6%) | 2.2% (0.6%) | 2.1% (1.0%) | 31.9% (31.2%) | 34.5% (40.8%) | 5.6% (4.2%) | 10.3% (13.5%) |

Straights against of-a-kind hands (pair, two pairs, three, full house, four, five) per tier: share of hands / share of points.

| Tier | Naive: straights | Naive: of-a-kind | Greedy: straights | Greedy: of-a-kind |
|---|---|---|---|---|
| 1 | 33.7% / 39.9% | 66.3% / 60.1% | 44.4% / 45.3% | 55.6% / 54.7% |
| 2 | 30.2% / 37.8% | 69.8% / 62.2% | 39.5% / 44.2% | 60.5% / 55.8% |
| 3 | 25.2% / 32.4% | 74.8% / 67.6% | 31.3% / 38.3% | 68.7% / 61.7% |
| 4 | 21.2% / 29.6% | 78.8% / 70.4% | 27.5% / 35.3% | 72.5% / 64.7% |
| 5 | 23.0% / 33.4% | 77.0% / 66.6% | 29.9% / 39.6% | 70.1% / 60.4% |

## E. Bonus usage

| Bot | Kind | Placed | Used | Used on hand 1 / 2 / 3 |
|---|---|---|---|---|
| naive | x2_any | 240 | 100.0% | 100.0% / 0.0% / 0.0% |
| naive | x3_straight | 246 | 50.4% | 39.5% / 35.5% / 25.0% |
| naive | x3_pairs | 290 | 97.9% | 71.8% / 21.8% / 6.3% |
| naive | x3_trips | 340 | 95.9% | 73.0% / 19.0% / 8.0% |
| naive | joker | 330 | 95.8% | 74.4% / 18.7% / 7.0% |
| greedy | x2_any | 240 | 100.0% | 47.9% / 15.8% / 36.3% |
| greedy | x3_straight | 246 | 80.5% | 80.8% / 14.1% / 5.1% |
| greedy | x3_pairs | 290 | 97.2% | 75.9% / 19.9% / 4.3% |
| greedy | x3_trips | 340 | 98.8% | 88.4% / 8.6% / 3.0% |
| greedy | joker | 330 | 83.9% | 3.6% / 1.1% / 95.3% |

- naive: 34.9% of hands use a bonus; 9.7% of those stack two or more. Tier 3 (two bonuses): every bonus spent on one hand in 48.7% of levels.
- greedy: 38.9% of hands use a bonus; 9.8% of those stack two or more. Tier 3 (two bonuses): every bonus spent on one hand in 50.0% of levels.

## F. Hold plans: exact EV of one reroll

Exact over every outcome of the rerolled dice (method of RESEARCH-BALATRO §5.2), scored by the engine's `bestHand`; positions do not matter, no bonuses unless stated.

| Scoring | 8 dice: hold 6-6-6, reroll 5 | 8 dice: hold 6-6, reroll 6 | 8 dice: hold 2-3-4-5, reroll 4 | 8 dice: hold 3-4-5-6, reroll 4 | of-a-kind ÷ best straight draw |
|---|---|---|---|---|---|
| rules (straight ×8) | 156.6 | 129.5 | 135.1 | 129.5 | 1.16 |
| pips of Poker 5 (straight ×5) | 154.3 | 123.2 | 94.1 | 100.3 | 1.54 |

## G. Experiments (the rules are the first row)

The same generator levels, greedy bot only, with the engine scoring by `bestHand(…, options)` (`config.handOptions`). Dominance: exact EV of holding 6-6-6 divided by the best straight-draw hold (≈1 means no dominant plan), and the share of straights among greedy plays.

| Axis | Variant | Greedy mean T1 | T2 | T3 | T4 | T5 | Straights: hands / points | EV 6-6-6 ÷ straight draw (8 dice, no bonus) | Same, 6 dice with ×2 any + ×3 straight on | Tier 3: all bonuses on one hand |
|---|---|---|---|---|---|---|---|---|---|---|
| — | rules: bonuses add up, straight ×8 | 541.1 | 463.2 | 529.6 | 398.9 | 405.1 | 34.5% / 40.8% | 1.16 | 0.70 | 50.0% |
| a | stacking: multiply (first rule) | 541.1 | 463.2 | 565.5 | 398.9 | 405.1 | 34.7% / 40.3% | 1.16 | 0.48 | 51.0% |
| a | stacking: single best bonus | 541.1 | 463.2 | 522.4 | 398.9 | 405.1 | 34.1% / 41.0% | 1.16 | 0.89 | 11.0% |
| b | category-first table | 535.2 | 451.1 | 510.3 | 393.5 | 401.7 | 19.9% / 18.9% | 1.30 | 0.69 | 60.3% |
| c | straight ×5 (pips of Poker 5) | 503.8 | 430.3 | 481.6 | 358.0 | 361.1 | 16.2% / 16.4% | 1.54 | 1.04 | 56.3% |
| c | straight ×10 | 573.2 | 508.5 | 554.2 | 426.8 | 441.4 | 42.2% / 54.7% | 0.97 | 0.57 | 46.0% |

Hold-plan EVs per variant:

| Variant | 8 dice: hold 6-6-6, reroll 5 | 8 dice: hold 6-6, reroll 6 | 8 dice: hold 2-3-4-5, reroll 4 | 8 dice: hold 3-4-5-6, reroll 4 | 6 dice, ×2+×3 straight: hold 6-6-6, reroll 3 | 6 dice, ×2+×3 straight: hold 2-3-4-5, reroll 2 | 6 dice, ×2+×3 straight: hold 3-4-5-6, reroll 2 |
|---|---|---|---|---|---|---|---|
| rules: bonuses add up, straight ×8 | 156.6 | 129.5 | 135.1 | 129.5 | 247.8 | 356.2 | 273.9 |
| stacking: multiply (first rule) | 156.6 | 129.5 | 135.1 | 129.5 | 247.8 | 514.0 | 371.7 |
| stacking: single best bonus | 156.6 | 129.5 | 135.1 | 129.5 | 247.8 | 277.3 | 225.0 |
| category-first table | 130.3 | 101.8 | 100.1 | 96.6 | 206.2 | 299.4 | 245.0 |
| straight ×5 (pips of Poker 5) | 154.3 | 123.2 | 94.1 | 100.3 | 247.8 | 237.9 | 200.6 |
| straight ×10 | 159.0 | 134.6 | 164.4 | 150.2 | 247.8 | 435.1 | 322.8 |

Notes:
- (a) Stacking only changes a hand that fits two multiplier bonuses at once, which needs the two bonus cells of tier 3; the joker is a wild face, not a multiplier, and is unaffected. With "single" only the largest bonus is used and burnt; the other stays on the board.
- (c) Only the straight multiplier changes (rules ×8, Poker 5 ×5); full house stays ×5, four ×6.
- (b) How the category-first table was chosen: score = category base + pip sum, no multiplier (the base already prices rarity). base = round(K ÷ p), p = exact chance to make the category on 8 dice with one reroll from the best hold for it, so going for any category has the same first-order EV (fair odds, the Poker Squares principle of RESEARCH.md); K = 52.7 makes the mean best hand of a fresh 8-die board equal the pips table's. Odds behind it (and on 6 dice, where tiers 3–5 play and the table is mispriced):

| Category | 8 dice fresh | 8 dice, one reroll | Base | 6 dice fresh | 6 dice, one reroll |
|---|---|---|---|---|---|
| pair | 100.0% | 100.0% | 53 | 98.5% | 100.0% |
| two_pairs | 93.2% | 99.6% | 53 | 55.6% | 84.8% |
| small_straight | 48.7% | 81.0% | 66 | 27.0% | 59.3% |
| three_kind | 70.7% | 95.4% | 55 | 36.7% | 73.3% |
| full_house | 63.9% | 94.3% | 56 | 17.0% | 53.6% |
| straight | 26.4% | 61.9% | 85 | 9.3% | 30.9% |
| four_kind | 18.3% | 59.3% | 89 | 5.2% | 27.0% |
| five_kind | 2.8% | 23.1% | 229 | 0.4% | 5.2% |

Mean best hand of a fresh 8-die board: pips 104.7, category-first 92.2.

Runtime: 18.3 s
