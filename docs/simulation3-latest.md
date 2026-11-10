# Auto Hand (mode 3) — simulation report
seed 20261031 · 300 generator levels per tier (level index tier … tier+7) · 3 hands · 3 shared rerolls · bonuses start off, the bots switch them on · 2026-11-10T10:09:18.007Z

Bots: **naive** switches every bonus on, holds exactly the best hand's dice and rerolls once per hand (while rerolls ≥ hands left), then plays. **Greedy** (`playGreedyBot3`, margin 20, strong 150) evaluates every hold mask of the dice by the exact expected best hand after one reroll and rerolls while the best mask beats the standing hand by 20; conditional bonuses always on, ×2 any and joker on for the last hand or when the hand without them already totals 150. A level ends once its target is reached, and the greedy bot plays for it (since 03.11.2026), so each tier's scores bunch just past its target and the win rates at higher targets read low.

## A. Tiers: layout and bonus kinds

| Tier | Layout | Bonus kinds placed (share of bonus cells) | Mean opening best (as generated) |
|---|---|---|---|
| 1 | 8 dice · 1 bonus · 0 block | x2_any 17.7%, x3_straight 16.0%, x3_pairs 15.3%, x3_trips 17.3%, joker 17.3% | 101.4 |
| 2 | 8 dice · 1 bonus · 0 block | x2_any 5.7%, x3_straight 18.3%, x3_pairs 16.3%, x3_trips 19.7%, joker 19.7% | 107.2 |
| 3 | 7 dice · 2 bonus · 0 block | x2_any 15.8%, x3_straight 12.5%, x3_pairs 20.2%, x3_trips 20.5%, joker 14.8% | 84.9 |
| 4 | 8 dice · 1 bonus · 0 block | x2_any 13.0%, x3_straight 8.3%, x3_pairs 11.0%, x3_trips 22.7%, joker 23.0% | 104.3 |
| 5 | 7 dice · 2 bonus · 0 block | x2_any 16.8%, x3_straight 15.2%, x3_pairs 17.2%, x3_trips 13.7%, joker 16.7% | 89.2 |

## B. Score distributions per tier (quantiles for adaptive difficulty)

| Tier | Bot | Mean ± 95% CI | p5 | p10 | p20 | p25 | p30 | p40 | p50 | p60 | p70 | p75 | p80 | p90 | p95 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | naive | 483.8 ± 12.0 | 315 | 354 | 392 | 408 | 427 | 460 | 480 | 504 | 550 | 560 | 576 | 615 | 640 |
| 1 | greedy | 526.8 ± 8.1 | 400 | 430 | 479 | 480 | 490 | 518 | 525 | 550 | 560 | 570 | 595 | 624 | 640 |
| 2 | naive | 489.4 ± 10.4 | 330 | 374 | 411 | 425 | 440 | 473 | 482 | 515 | 545 | 560 | 565 | 616 | 640 |
| 2 | greedy | 518.4 ± 8.0 | 406 | 430 | 460 | 480 | 480 | 504 | 520 | 535 | 560 | 562 | 580 | 610 | 640 |
| 3 | naive | 551.3 ± 14.0 | 352 | 390 | 440 | 463 | 480 | 528 | 560 | 580 | 610 | 640 | 645 | 710 | 760 |
| 3 | greedy | 572.4 ± 11.2 | 415 | 442 | 502 | 528 | 560 | 570 | 586 | 603 | 625 | 640 | 640 | 670 | 700 |
| 4 | naive | 476.8 ± 10.3 | 330 | 359 | 400 | 413 | 425 | 455 | 480 | 500 | 524 | 550 | 560 | 600 | 620 |
| 4 | greedy | 507.6 ± 8.9 | 375 | 415 | 440 | 457 | 464 | 484 | 505 | 520 | 555 | 560 | 573 | 610 | 640 |
| 5 | naive | 531.0 ± 14.1 | 328 | 365 | 426 | 440 | 471 | 500 | 540 | 570 | 600 | 615 | 640 | 680 | 725 |
| 5 | greedy | 578.1 ± 11.9 | 381 | 450 | 518 | 534 | 558 | 567 | 595 | 605 | 630 | 640 | 640 | 685 | 735 |

pX is the score that X% of levels stay below; the win rate at target T is the share of levels scoring ≥ T.

## C. Targets

Criterion (owner, 31.10.2026): greedy win rate ≈75% at tier 1 stepping down evenly to ≈40% at tier 5. Suggested target = the multiple of 10 whose greedy win rate is closest to the goal.

| Tier | Goal (greedy) | Suggested target | Greedy win rate there | Naive win rate there | Current TIERS3 target | Greedy win rate | Naive win rate |
|---|---|---|---|---|---|---|---|
| 1 | 75.0% | 480 | 79.3% | 54.3% | 490 | 70.7% | 48.3% |
| 2 | 66.3% | 490 | 67.7% | 48.7% | 490 | 67.7% | 48.7% |
| 3 | 57.5% | 580 | 56.0% | 41.3% | 560 | 70.3% | 50.7% |
| 4 | 48.8% | 510 | 49.0% | 35.0% | 490 | 59.3% | 42.3% |
| 5 | 40.0% | 610 | 38.3% | 25.7% | 560 | 68.0% | 45.3% |

Suggested targets are not monotone non-decreasing over the tiers.
Tiers sharing a layout: 1, 2, 4; 3, 5.
TIERS3 targets differ from this sample's suggestions by up to 50 points. Since the boards lost their locks (09.11.2026) each layout keeps one target; recalibrating would move UP_SHARES (scripts/upgrades3.mjs plays these tiers) and so the run's curve.

### Win rate over a range of targets (naive / greedy)

| Target | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---|---|---|---|---|---|
| 200 | 99.3% / 100.0% | 100.0% / 100.0% | 100.0% / 99.0% | 100.0% / 100.0% | 99.7% / 99.7% |
| 225 | 99.3% / 100.0% | 100.0% / 99.7% | 99.7% / 98.7% | 99.7% / 100.0% | 99.3% / 99.7% |
| 250 | 99.0% / 100.0% | 100.0% / 99.7% | 99.7% / 98.0% | 99.7% / 100.0% | 98.3% / 99.3% |
| 275 | 98.3% / 100.0% | 99.7% / 99.7% | 99.7% / 97.7% | 99.3% / 100.0% | 97.7% / 99.0% |
| 300 | 96.7% / 100.0% | 98.0% / 99.3% | 98.7% / 97.3% | 97.3% / 99.7% | 96.3% / 98.0% |
| 325 | 93.3% / 100.0% | 96.3% / 99.0% | 97.0% / 97.3% | 96.0% / 98.3% | 95.0% / 97.3% |
| 350 | 90.3% / 99.0% | 92.3% / 99.0% | 95.7% / 97.3% | 91.3% / 96.7% | 93.0% / 96.7% |
| 375 | 85.0% / 97.7% | 89.7% / 97.7% | 94.0% / 97.0% | 86.3% / 95.0% | 89.3% / 95.0% |
| 400 | 77.7% / 95.0% | 84.7% / 95.3% | 89.0% / 96.3% | 80.7% / 93.0% | 86.3% / 94.3% |
| 425 | 70.0% / 91.0% | 75.7% / 90.7% | 83.7% / 93.3% | 71.0% / 87.3% | 80.3% / 92.0% |
| 450 | 61.3% / 85.7% | 66.7% / 84.7% | 77.7% / 89.3% | 62.3% / 78.3% | 73.3% / 90.0% |
| 475 | 55.0% / 80.0% | 59.7% / 78.0% | 72.7% / 86.3% | 52.7% / 68.3% | 69.0% / 86.3% |
| 500 | 43.3% / 68.0% | 45.7% / 63.7% | 65.7% / 80.7% | 40.0% / 55.3% | 60.7% / 82.3% |
| 525 | 34.7% / 50.7% | 34.3% / 45.3% | 60.7% / 75.7% | 29.7% / 38.7% | 53.7% / 75.7% |
| 550 | 30.0% / 40.3% | 29.0% / 35.0% | 53.7% / 72.0% | 25.0% / 32.3% | 47.3% / 70.7% |
| 575 | 20.3% / 24.7% | 18.0% / 21.7% | 42.7% / 58.7% | 17.0% / 19.7% | 38.7% / 58.3% |
| 600 | 12.7% / 17.7% | 14.0% / 14.3% | 33.3% / 45.7% | 10.7% / 13.0% | 30.0% / 47.7% |
| 625 | 7.0% / 9.0% | 6.0% / 7.0% | 27.7% / 30.0% | 4.7% / 6.7% | 21.3% / 30.7% |
| 650 | 4.7% / 1.3% | 1.3% / 0.0% | 19.3% / 14.7% | 2.0% / 1.7% | 13.7% / 16.0% |
| 675 | 3.7% / 0.7% | 1.0% / 0.0% | 15.3% / 9.7% | 1.7% / 1.3% | 11.0% / 12.0% |
| 700 | 2.0% / 0.3% | 0.3% / 0.0% | 10.3% / 6.0% | 0.0% / 1.0% | 8.3% / 8.7% |
| 725 | 1.3% / 0.0% | 0.3% / 0.0% | 6.7% / 2.7% | 0.0% / 0.3% | 5.0% / 5.7% |
| 750 | 1.0% / 0.0% | 0.3% / 0.0% | 6.0% / 2.0% | 0.0% / 0.3% | 4.3% / 4.0% |
| 775 | 0.7% / 0.0% | 0.3% / 0.0% | 4.3% / 1.0% | 0.0% / 0.0% | 2.7% / 3.3% |
| 800 | 0.7% / 0.0% | 0.3% / 0.0% | 2.7% / 0.7% | 0.0% / 0.0% | 2.3% / 3.0% |
| 825 | 0.7% / 0.0% | 0.3% / 0.0% | 2.3% / 0.7% | 0.0% / 0.0% | 1.0% / 1.0% |
| 850 | 0.3% / 0.0% | 0.3% / 0.0% | 1.7% / 0.3% | 0.0% / 0.0% | 0.7% / 0.3% |
| 875 | 0.3% / 0.0% | 0.0% / 0.0% | 1.3% / 0.0% | 0.0% / 0.0% | 0.3% / 0.3% |
| 900 | 0.0% / 0.0% | 0.0% / 0.0% | 1.0% / 0.0% | 0.0% / 0.0% | 0.3% / 0.3% |

## D. Played hands

Share of played hands by category, all tiers pooled (share of points in brackets).

| Bot | pair | two_pairs | small_straight | three_kind | full_house | straight | four_kind | five_kind |
|---|---|---|---|---|---|---|---|---|
| naive | 0.0% (0.0%) | 8.4% (7.4%) | 0.2% (0.1%) | 0.3% (0.3%) | 33.9% (31.4%) | 37.0% (41.8%) | 8.9% (6.8%) | 11.3% (12.3%) |
| greedy | 0.0% (0.0%) | 9.4% (7.7%) | 0.3% (0.1%) | 0.1% (0.0%) | 30.1% (28.7%) | 42.1% (45.5%) | 5.2% (3.4%) | 12.8% (14.6%) |

Straights against of-a-kind hands (pair, two pairs, three, full house, four, five) per tier: share of hands / share of points.

| Tier | Naive: straights | Naive: of-a-kind | Greedy: straights | Greedy: of-a-kind |
|---|---|---|---|---|
| 1 | 33.7% / 39.9% | 66.3% / 60.1% | 45.6% / 49.0% | 54.4% / 51.0% |
| 2 | 40.2% / 43.9% | 59.8% / 56.1% | 44.1% / 47.2% | 55.9% / 52.8% |
| 3 | 35.8% / 40.5% | 64.2% / 59.5% | 35.9% / 39.4% | 64.1% / 60.6% |
| 4 | 40.6% / 43.6% | 59.4% / 56.4% | 44.6% / 45.3% | 55.4% / 54.7% |
| 5 | 34.5% / 41.1% | 65.5% / 58.9% | 39.8% / 46.9% | 60.2% / 53.1% |

## E. Bonus usage

| Bot | Kind | Placed | Used | Used on hand 1 / 2 / 3 |
|---|---|---|---|---|
| naive | x2_any | 305 | 100.0% | 100.0% / 0.0% / 0.0% |
| naive | x3_straight | 294 | 66.7% | 43.9% / 38.8% / 17.3% |
| naive | x3_pairs | 352 | 97.7% | 70.9% / 27.0% / 2.0% |
| naive | x3_trips | 384 | 99.5% | 81.4% / 15.4% / 3.1% |
| naive | joker | 369 | 87.8% | 67.6% / 20.4% / 12.0% |
| greedy | x2_any | 305 | 100.0% | 66.9% / 17.7% / 15.4% |
| greedy | x3_straight | 294 | 90.1% | 86.4% / 12.1% / 1.5% |
| greedy | x3_pairs | 352 | 96.9% | 68.0% / 27.9% / 4.1% |
| greedy | x3_trips | 384 | 99.5% | 99.2% / 0.5% / 0.3% |
| greedy | joker | 369 | 75.9% | 16.1% / 5.7% / 78.2% |

- naive: 38.3% of hands use a bonus; 19.8% of those stack two or more. Tier 3 (two bonuses): every bonus spent on one hand in 54.7% of levels.
- greedy: 41.0% of hands use a bonus; 20.9% of those stack two or more. Tier 3 (two bonuses): every bonus spent on one hand in 55.7% of levels.

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
| — | rules: bonuses add up, straight ×8 | 526.8 | 518.4 | 572.4 | 507.6 | 578.1 | 42.1% / 45.5% | 1.16 | 0.70 | 55.7% |
| a | stacking: multiply (first rule) | 526.8 | 518.4 | 612.4 | 507.6 | 616.7 | 42.4% / 45.1% | 1.16 | 0.48 | 57.3% |
| a | stacking: single best bonus | 526.8 | 518.4 | 581.3 | 507.6 | 569.6 | 41.7% / 45.6% | 1.16 | 0.89 | 8.7% |
| b | category-first table | 499.2 | 506.2 | 584.4 | 501.8 | 575.5 | 24.9% / 21.0% | 1.30 | 0.69 | 61.7% |
| c | straight ×5 (pips of Poker 5) | 479.4 | 480.1 | 550.2 | 477.0 | 541.8 | 17.6% / 17.1% | 1.54 | 1.04 | 53.0% |
| c | straight ×10 | 548.1 | 545.0 | 611.4 | 538.4 | 610.7 | 49.6% / 58.5% | 0.97 | 0.57 | 53.7% |

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

Runtime: 33.2 s
