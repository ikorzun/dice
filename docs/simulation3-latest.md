# Auto Hand (mode 3) — simulation report
seed 20261031 · 300 generator levels per tier (level index tier … tier+7) · 3 hands · 3 shared rerolls · bonuses start off, the bots switch them on · 2026-11-01T10:55:34.454Z

Bots: **naive** switches every bonus on, holds exactly the best hand's dice and rerolls once per hand (while rerolls ≥ hands left), then plays. **Greedy** (`playGreedyBot3`, margin 20, strong 150) evaluates every hold mask of the dice by the exact expected best hand after one reroll and rerolls while the best mask beats the standing hand by 20; conditional bonuses always on, ×2 any and joker on for the last hand or when the hand without them already totals 150. Both maximize score and ignore the target.

## A. Tiers: layout and bonus kinds

| Tier | Layout | Bonus kinds placed (share of bonus cells) | Mean opening best (as generated) |
|---|---|---|---|
| 1 | 8 dice · 1 bonus · 0 block | x2_any 22.0%, x3_straight 19.3%, x3_pairs 20.7%, x3_trips 21.0%, joker 17.0% | 101.7 |
| 2 | 7 dice · 1 bonus · 1 block | x2_any 11.3%, x3_straight 23.0%, x3_pairs 23.0%, x3_trips 20.7%, joker 22.0% | 83.4 |
| 3 | 6 dice · 2 bonus · 1 block | x2_any 16.3%, x3_straight 15.8%, x3_pairs 24.3%, x3_trips 23.3%, joker 20.2% | 57.4 |
| 4 | 6 dice · 1 bonus · 2 block | x2_any 18.0%, x3_straight 11.3%, x3_pairs 13.7%, x3_trips 27.3%, joker 29.7% | 54.9 |
| 5 | 6 dice · 1 bonus · 2 block | x2_any 16.0%, x3_straight 20.3%, x3_pairs 12.0%, x3_trips 20.0%, joker 31.7% | 63.6 |

## B. Score distributions per tier (quantiles for adaptive difficulty)

| Tier | Bot | Mean ± 95% CI | p5 | p10 | p20 | p25 | p30 | p40 | p50 | p60 | p70 | p75 | p80 | p90 | p95 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | naive | 490.4 ± 15.3 | 310 | 330 | 376 | 400 | 410 | 440 | 464 | 499 | 560 | 590 | 627 | 696 | 735 |
| 1 | greedy | 595.9 ± 14.8 | 408 | 430 | 478 | 482 | 514 | 544 | 599 | 640 | 681 | 700 | 720 | 780 | 800 |
| 2 | naive | 426.6 ± 15.0 | 229 | 262 | 322 | 340 | 352 | 381 | 406 | 440 | 478 | 490 | 543 | 633 | 680 |
| 2 | greedy | 529.5 ± 16.2 | 336 | 366 | 410 | 426 | 444 | 465 | 500 | 570 | 609 | 636 | 664 | 730 | 780 |
| 3 | naive | 431.3 ± 18.3 | 198 | 234 | 288 | 310 | 334 | 377 | 420 | 460 | 505 | 529 | 590 | 660 | 733 |
| 3 | greedy | 549.5 ± 21.3 | 232 | 290 | 410 | 435 | 460 | 501 | 548 | 602 | 660 | 680 | 710 | 792 | 870 |
| 4 | naive | 348.7 ± 12.8 | 187 | 208 | 251 | 261 | 274 | 310 | 336 | 368 | 418 | 436 | 443 | 500 | 556 |
| 4 | greedy | 410.3 ± 16.1 | 192 | 230 | 294 | 318 | 334 | 360 | 390 | 435 | 485 | 515 | 546 | 612 | 655 |
| 5 | naive | 348.1 ± 14.5 | 172 | 202 | 240 | 254 | 270 | 302 | 330 | 365 | 400 | 424 | 445 | 521 | 603 |
| 5 | greedy | 426.3 ± 17.9 | 160 | 217 | 294 | 318 | 340 | 378 | 415 | 460 | 520 | 552 | 580 | 645 | 695 |

pX is the score that X% of levels stay below; the win rate at target T is the share of levels scoring ≥ T.

## C. Targets

Criterion (owner, 31.10.2026): greedy win rate ≈75% at tier 1 stepping down evenly to ≈40% at tier 5. Suggested target = the multiple of 10 whose greedy win rate is closest to the goal.

| Tier | Goal (greedy) | Suggested target | Greedy win rate there | Naive win rate there | Current TIERS3 target | Greedy win rate | Naive win rate |
|---|---|---|---|---|---|---|---|
| 1 | 75.0% | 490 | 74.0% | 41.7% | 490 | 74.0% | 41.7% |
| 2 | 66.3% | 450 | 67.7% | 35.3% | 440 | 72.0% | 40.0% |
| 3 | 57.5% | 510 | 57.7% | 29.0% | 500 | 60.0% | 30.7% |
| 4 | 48.8% | 400 | 48.3% | 32.0% | 420 | 43.3% | 29.3% |
| 5 | 40.0% | 460 | 40.0% | 18.3% | 430 | 47.3% | 23.0% |

Suggested targets are not monotone non-decreasing over the tiers.
Tiers 4 and 5 share a layout and differ only by target.
TIERS3 targets were set from a larger run of this script (`--tierLevels=1000 --seed=check1000`); a 300-level sample suggests targets within about 10 points of them.

### Win rate over a range of targets (naive / greedy)

| Target | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---|---|---|---|---|---|
| 200 | 100.0% / 100.0% | 98.7% / 98.7% | 94.7% / 95.7% | 92.3% / 93.7% | 90.3% / 91.0% |
| 225 | 99.7% / 99.7% | 95.3% / 98.7% | 91.3% / 95.3% | 87.0% / 90.7% | 83.7% / 89.0% |
| 250 | 98.3% / 99.7% | 92.0% / 98.7% | 87.0% / 94.0% | 80.7% / 87.3% | 76.3% / 86.7% |
| 275 | 96.7% / 99.3% | 87.3% / 98.0% | 82.3% / 92.0% | 69.3% / 83.7% | 68.3% / 82.3% |
| 300 | 96.0% / 99.0% | 84.7% / 97.0% | 77.3% / 89.3% | 62.0% / 79.3% | 60.3% / 79.3% |
| 325 | 91.3% / 99.0% | 79.3% / 95.7% | 72.0% / 87.0% | 54.3% / 73.0% | 53.7% / 72.7% |
| 350 | 84.7% / 98.3% | 71.7% / 92.3% | 65.3% / 85.0% | 46.3% / 65.0% | 44.0% / 68.0% |
| 375 | 80.0% / 98.0% | 62.7% / 88.3% | 61.0% / 81.7% | 37.7% / 55.0% | 36.7% / 61.7% |
| 400 | 75.0% / 96.0% | 54.0% / 83.3% | 53.3% / 80.7% | 32.0% / 48.3% | 30.0% / 55.0% |
| 425 | 65.3% / 91.0% | 46.0% / 76.3% | 48.7% / 77.7% | 27.3% / 42.7% | 24.3% / 48.7% |
| 450 | 55.3% / 86.0% | 35.3% / 67.7% | 41.7% / 71.3% | 17.7% / 36.7% | 19.0% / 42.7% |
| 475 | 49.0% / 80.3% | 30.7% / 58.3% | 36.0% / 65.3% | 12.0% / 32.3% | 16.3% / 37.0% |
| 500 | 39.7% / 73.3% | 23.7% / 50.0% | 30.7% / 60.0% | 10.0% / 27.3% | 12.3% / 32.7% |
| 525 | 34.0% / 63.3% | 20.7% / 45.3% | 26.3% / 55.0% | 6.7% / 22.7% | 9.3% / 27.7% |
| 550 | 30.7% / 59.7% | 18.7% / 43.3% | 22.7% / 49.7% | 5.7% / 19.7% | 7.7% / 25.3% |
| 575 | 25.7% / 55.3% | 17.0% / 39.0% | 21.0% / 46.0% | 4.0% / 16.7% | 6.7% / 21.0% |
| 600 | 23.7% / 49.7% | 15.7% / 32.3% | 17.0% / 41.3% | 3.3% / 12.0% | 5.0% / 16.7% |
| 625 | 20.3% / 41.3% | 12.3% / 27.0% | 14.7% / 36.0% | 2.0% / 7.3% | 4.3% / 11.7% |
| 650 | 16.0% / 37.3% | 7.3% / 22.3% | 10.7% / 31.0% | 1.0% / 5.3% | 3.3% / 8.7% |
| 675 | 12.3% / 33.7% | 5.0% / 17.0% | 7.7% / 26.3% | 0.3% / 3.3% | 2.0% / 6.0% |
| 700 | 9.7% / 26.3% | 3.7% / 13.3% | 6.7% / 21.3% | 0.0% / 2.0% | 1.7% / 4.7% |
| 725 | 7.3% / 17.3% | 2.3% / 10.3% | 5.0% / 17.3% | 0.0% / 1.0% | 0.7% / 3.0% |
| 750 | 3.7% / 14.3% | 1.0% / 8.0% | 4.0% / 13.3% | 0.0% / 0.3% | 0.3% / 1.3% |
| 775 | 2.7% / 11.3% | 0.0% / 5.3% | 2.3% / 11.0% | 0.0% / 0.0% | 0.0% / 0.3% |
| 800 | 2.0% / 6.3% | 0.0% / 4.3% | 1.7% / 8.7% | 0.0% / 0.0% | 0.0% / 0.3% |
| 825 | 0.3% / 3.0% | 0.0% / 2.7% | 0.7% / 6.7% | 0.0% / 0.0% | 0.0% / 0.0% |
| 850 | 0.0% / 1.7% | 0.0% / 1.7% | 0.3% / 6.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| 875 | 0.0% / 1.0% | 0.0% / 1.0% | 0.3% / 4.7% | 0.0% / 0.0% | 0.0% / 0.0% |
| 900 | 0.0% / 0.0% | 0.0% / 0.0% | 0.3% / 3.3% | 0.0% / 0.0% | 0.0% / 0.0% |

## D. Played hands

Share of played hands by category, all tiers pooled (share of points in brackets).

| Bot | pair | two_pairs | three_kind | full_house | straight | four_kind | five_kind |
|---|---|---|---|---|---|---|---|
| naive | 0.8% (0.2%) | 17.7% (11.5%) | 4.6% (2.3%) | 40.3% (39.7%) | 20.4% (30.5%) | 10.4% (8.6%) | 5.8% (7.3%) |
| greedy | 3.6% (0.4%) | 18.7% (10.9%) | 4.1% (1.5%) | 32.7% (34.0%) | 28.7% (39.1%) | 5.6% (4.1%) | 6.6% (9.8%) |

Straights against of-a-kind hands (pair, two pairs, three, full house, four, five) per tier: share of hands / share of points.

| Tier | Naive: straights | Naive: of-a-kind | Greedy: straights | Greedy: of-a-kind |
|---|---|---|---|---|
| 1 | 28.1% / 36.5% | 71.9% / 63.5% | 41.7% / 45.7% | 58.3% / 54.3% |
| 2 | 23.0% / 32.2% | 77.0% / 67.8% | 31.7% / 41.4% | 68.3% / 58.6% |
| 3 | 16.3% / 26.6% | 83.7% / 73.4% | 23.6% / 34.5% | 76.4% / 65.5% |
| 4 | 16.3% / 24.7% | 83.7% / 75.3% | 20.3% / 30.5% | 79.7% / 69.5% |
| 5 | 18.1% / 30.4% | 81.9% / 69.6% | 26.4% / 41.5% | 73.6% / 58.5% |

## E. Bonus usage

| Bot | Kind | Placed | Used | Used on hand 1 / 2 / 3 |
|---|---|---|---|---|
| naive | x2_any | 300 | 100.0% | 100.0% / 0.0% / 0.0% |
| naive | x3_straight | 317 | 41.0% | 49.2% / 33.1% / 17.7% |
| naive | x3_pairs | 354 | 97.7% | 70.5% / 23.1% / 6.4% |
| naive | x3_trips | 407 | 97.3% | 73.0% / 17.2% / 9.8% |
| naive | joker | 422 | 97.6% | 72.3% / 21.4% / 6.3% |
| greedy | x2_any | 300 | 100.0% | 43.0% / 14.7% / 42.3% |
| greedy | x3_straight | 317 | 80.1% | 84.3% / 9.4% / 6.3% |
| greedy | x3_pairs | 354 | 98.9% | 74.0% / 20.6% / 5.4% |
| greedy | x3_trips | 407 | 98.0% | 91.0% / 6.8% / 2.3% |
| greedy | joker | 422 | 87.0% | 5.7% / 0.8% / 93.5% |

- naive: 32.0% of hands use a bonus; 9.8% of those stack two or more. Tier 3 (two bonuses): every bonus spent on one hand in 47.3% of levels.
- greedy: 34.1% of hands use a bonus; 8.9% of those stack two or more. Tier 3 (two bonuses): every bonus spent on one hand in 45.7% of levels.

## F. Hold plans: exact EV of one reroll

Exact over every outcome of the rerolled dice (method of RESEARCH-BALATRO §5.2), scored by the engine's `bestHand`; positions do not matter, no bonuses unless stated.

| Scoring | 8 dice: hold 6-6-6, reroll 5 | 8 dice: hold 6-6, reroll 6 | 8 dice: hold 2-3-4-5, reroll 4 | 8 dice: hold 3-4-5-6, reroll 4 | of-a-kind ÷ best straight draw |
|---|---|---|---|---|---|
| rules (straight ×8) | 156.6 | 129.5 | 135.1 | 129.2 | 1.16 |
| pips of Poker 5 (straight ×5) | 154.3 | 123.2 | 94.1 | 100.1 | 1.54 |

## G. Experiments (the rules are the first row)

The same generator levels, greedy bot only, with the engine scoring by `bestHand(…, options)` (`config.handOptions`). Dominance: exact EV of holding 6-6-6 divided by the best straight-draw hold (≈1 means no dominant plan), and the share of straights among greedy plays.

| Axis | Variant | Greedy mean T1 | T2 | T3 | T4 | T5 | Straights: hands / points | EV 6-6-6 ÷ straight draw (8 dice, no bonus) | Same, 6 dice with ×2 any + ×3 straight on | Tier 3: all bonuses on one hand |
|---|---|---|---|---|---|---|---|---|---|---|
| — | rules: bonuses add up, straight ×8 | 595.9 | 529.5 | 549.5 | 410.3 | 426.3 | 28.7% / 39.1% | 1.16 | 0.70 | 45.7% |
| a | stacking: multiply (first rule) | 595.9 | 529.5 | 614.0 | 410.3 | 426.3 | 28.2% / 38.7% | 1.16 | 0.49 | 51.7% |
| a | stacking: single best bonus | 595.9 | 529.5 | 517.5 | 410.3 | 426.3 | 28.4% / 39.1% | 1.16 | 0.90 | 19.3% |
| b | category-first table | 565.5 | 471.1 | 476.0 | 388.1 | 381.5 | 19.3% / 21.5% | 1.31 | 0.71 | 60.7% |
| c | straight ×5 (pips of Poker 5) | 520.6 | 442.6 | 460.0 | 365.3 | 366.4 | 15.7% / 17.9% | 1.54 | 1.06 | 50.7% |
| c | straight ×10 | 672.5 | 585.1 | 602.7 | 451.0 | 480.0 | 34.1% / 51.5% | 0.97 | 0.57 | 42.0% |

Hold-plan EVs per variant:

| Variant | 8 dice: hold 6-6-6, reroll 5 | 8 dice: hold 6-6, reroll 6 | 8 dice: hold 2-3-4-5, reroll 4 | 8 dice: hold 3-4-5-6, reroll 4 | 6 dice, ×2+×3 straight: hold 6-6-6, reroll 3 | 6 dice, ×2+×3 straight: hold 2-3-4-5, reroll 2 | 6 dice, ×2+×3 straight: hold 3-4-5-6, reroll 2 |
|---|---|---|---|---|---|---|---|
| rules: bonuses add up, straight ×8 | 156.6 | 129.5 | 135.1 | 129.2 | 247.8 | 352.9 | 251.8 |
| stacking: multiply (first rule) | 156.6 | 129.5 | 135.1 | 129.2 | 247.8 | 510.7 | 349.6 |
| stacking: single best bonus | 156.6 | 129.5 | 135.1 | 129.2 | 247.8 | 274.0 | 202.9 |
| category-first table | 130.2 | 101.2 | 99.2 | 93.3 | 205.5 | 287.6 | 221.5 |
| straight ×5 (pips of Poker 5) | 154.3 | 123.2 | 94.1 | 100.1 | 247.8 | 234.6 | 178.4 |
| straight ×10 | 159.0 | 134.6 | 164.4 | 150.0 | 247.8 | 431.8 | 300.7 |

Notes:
- (a) Stacking only changes a hand that fits two multiplier bonuses at once, which needs the two bonus cells of tier 3; the joker is a wild face, not a multiplier, and is unaffected. With "single" only the largest bonus is used and burnt; the other stays on the board.
- (c) Only the straight multiplier changes (rules ×8, Poker 5 ×5); full house stays ×5, four ×6.
- (b) How the category-first table was chosen: score = category base + pip sum, no multiplier (the base already prices rarity). base = round(K ÷ p), p = exact chance to make the category on 8 dice with one reroll from the best hold for it, so going for any category has the same first-order EV (fair odds, the Poker Squares principle of RESEARCH.md); K = 52.7 makes the mean best hand of a fresh 8-die board equal the pips table's. Odds behind it (and on 6 dice, where tiers 3–5 play and the table is mispriced):

| Category | 8 dice fresh | 8 dice, one reroll | Base | 6 dice fresh | 6 dice, one reroll |
|---|---|---|---|---|---|
| pair | 100.0% | 100.0% | 53 | 98.5% | 100.0% |
| two_pairs | 93.2% | 99.6% | 53 | 55.6% | 84.8% |
| three_kind | 70.7% | 95.4% | 55 | 36.7% | 73.3% |
| full_house | 63.9% | 94.3% | 56 | 17.0% | 53.6% |
| straight | 26.4% | 61.9% | 85 | 9.3% | 30.9% |
| four_kind | 18.3% | 59.3% | 89 | 5.2% | 27.0% |
| five_kind | 2.8% | 23.1% | 229 | 0.4% | 5.2% |

Mean best hand of a fresh 8-die board: pips 104.6, category-first 90.8.

Runtime: 17.2 s
