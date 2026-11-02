# Auto Hand (mode 3) — simulation report
seed 20261031 · 300 generator levels per tier (level index tier … tier+7) · 3 hands · 3 shared rerolls · bonuses start off, the bots switch them on · 2026-11-02T18:38:40.845Z

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
| 1 | naive | 464.6 ± 11.3 | 304 | 335 | 374 | 392 | 405 | 440 | 464 | 485 | 520 | 525 | 560 | 600 | 630 |
| 1 | greedy | 530.1 ± 9.5 | 399 | 420 | 460 | 478 | 482 | 518 | 525 | 560 | 580 | 600 | 605 | 640 | 640 |
| 2 | naive | 401.7 ± 11.8 | 239 | 273 | 306 | 318 | 336 | 366 | 394 | 440 | 471 | 480 | 490 | 531 | 565 |
| 2 | greedy | 447.6 ± 9.0 | 306 | 341 | 392 | 405 | 418 | 440 | 460 | 480 | 480 | 492 | 510 | 540 | 560 |
| 3 | naive | 401.3 ± 15.4 | 192 | 221 | 273 | 300 | 320 | 351 | 390 | 438 | 494 | 515 | 530 | 590 | 632 |
| 3 | greedy | 477.0 ± 16.1 | 227 | 282 | 360 | 384 | 410 | 446 | 498 | 520 | 550 | 566 | 585 | 640 | 680 |
| 4 | naive | 327.2 ± 11.9 | 163 | 199 | 247 | 258 | 271 | 295 | 321 | 342 | 375 | 400 | 420 | 469 | 520 |
| 4 | greedy | 368.2 ± 12.3 | 154 | 228 | 276 | 299 | 318 | 346 | 375 | 405 | 435 | 445 | 458 | 505 | 534 |
| 5 | naive | 325.0 ± 12.6 | 173 | 194 | 228 | 243 | 258 | 282 | 304 | 337 | 384 | 412 | 434 | 480 | 520 |
| 5 | greedy | 372.5 ± 12.3 | 181 | 223 | 282 | 298 | 315 | 355 | 374 | 410 | 440 | 456 | 480 | 500 | 535 |

pX is the score that X% of levels stay below; the win rate at target T is the share of levels scoring ≥ T.

## C. Targets

Criterion (owner, 31.10.2026): greedy win rate ≈75% at tier 1 stepping down evenly to ≈40% at tier 5. Suggested target = the multiple of 10 whose greedy win rate is closest to the goal.

| Tier | Goal (greedy) | Suggested target | Greedy win rate there | Naive win rate there | Current TIERS3 target | Greedy win rate | Naive win rate |
|---|---|---|---|---|---|---|---|
| 1 | 75.0% | 470 | 75.7% | 48.7% | 490 | 69.3% | 39.7% |
| 2 | 66.3% | 430 | 65.3% | 41.7% | 440 | 61.0% | 40.0% |
| 3 | 57.5% | 460 | 57.7% | 34.3% | 500 | 49.7% | 29.0% |
| 4 | 48.8% | 370 | 50.7% | 31.0% | 420 | 36.7% | 21.3% |
| 5 | 40.0% | 410 | 41.0% | 25.0% | 430 | 34.7% | 20.3% |

Suggested targets are not monotone non-decreasing over the tiers.
Tiers 4 and 5 share a layout and differ only by target.
TIERS3 targets were set from a larger run of this script (`--tierLevels=1000 --seed=check1000`); a 300-level sample suggests targets within about 10 points of them.

### Win rate over a range of targets (naive / greedy)

| Target | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---|---|---|---|---|---|
| 200 | 100.0% / 100.0% | 99.7% / 98.7% | 93.0% / 96.7% | 89.7% / 92.0% | 87.3% / 93.0% |
| 225 | 100.0% / 100.0% | 98.3% / 98.7% | 88.0% / 95.3% | 83.7% / 90.3% | 80.3% / 89.7% |
| 250 | 100.0% / 100.0% | 94.0% / 97.7% | 84.7% / 94.0% | 78.3% / 86.7% | 73.7% / 87.7% |
| 275 | 98.7% / 99.3% | 89.0% / 96.3% | 79.3% / 91.3% | 68.0% / 80.7% | 64.0% / 81.7% |
| 300 | 96.0% / 99.3% | 82.3% / 95.0% | 75.0% / 88.7% | 58.3% / 74.3% | 51.7% / 74.3% |
| 325 | 91.3% / 98.7% | 73.7% / 92.7% | 69.0% / 85.7% | 48.0% / 67.3% | 43.7% / 66.3% |
| 350 | 87.0% / 98.3% | 64.3% / 89.3% | 61.7% / 82.7% | 38.3% / 59.0% | 37.0% / 60.7% |
| 375 | 79.7% / 97.3% | 57.3% / 84.0% | 53.3% / 76.0% | 30.0% / 50.0% | 30.7% / 49.7% |
| 400 | 73.3% / 94.3% | 48.0% / 77.0% | 47.7% / 71.3% | 25.3% / 42.3% | 26.7% / 45.0% |
| 425 | 64.0% / 88.3% | 42.0% / 67.3% | 41.7% / 66.7% | 19.0% / 34.0% | 21.7% / 36.3% |
| 450 | 55.0% / 81.3% | 37.0% / 57.3% | 37.7% / 59.7% | 11.3% / 24.3% | 15.0% / 26.7% |
| 475 | 47.7% / 75.3% | 29.3% / 47.3% | 33.0% / 54.0% | 9.3% / 18.7% | 10.3% / 22.0% |
| 500 | 37.0% / 66.3% | 18.0% / 23.3% | 29.0% / 49.7% | 6.0% / 11.0% | 6.3% / 10.0% |
| 525 | 25.3% / 50.7% | 11.0% / 14.3% | 21.7% / 38.3% | 4.0% / 6.0% | 3.7% / 5.3% |
| 550 | 21.0% / 44.7% | 6.3% / 8.3% | 16.3% / 30.0% | 2.3% / 3.3% | 3.0% / 3.7% |
| 575 | 16.3% / 30.7% | 4.3% / 3.0% | 11.3% / 23.7% | 1.7% / 1.3% | 2.7% / 1.7% |
| 600 | 12.0% / 25.3% | 3.0% / 0.3% | 9.0% / 18.3% | 1.0% / 0.7% | 1.7% / 1.0% |
| 625 | 5.3% / 13.7% | 2.7% / 0.0% | 6.0% / 10.7% | 0.7% / 0.3% | 0.7% / 0.3% |
| 650 | 2.7% / 3.3% | 2.3% / 0.0% | 1.0% / 7.7% | 0.3% / 0.0% | 0.7% / 0.3% |
| 675 | 2.7% / 3.0% | 0.7% / 0.0% | 1.0% / 6.3% | 0.0% / 0.0% | 0.7% / 0.3% |
| 700 | 1.0% / 2.0% | 0.0% / 0.0% | 0.7% / 4.0% | 0.0% / 0.0% | 0.3% / 0.3% |
| 725 | 0.3% / 0.3% | 0.0% / 0.0% | 0.3% / 3.7% | 0.0% / 0.0% | 0.0% / 0.0% |
| 750 | 0.0% / 0.3% | 0.0% / 0.0% | 0.3% / 3.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| 775 | 0.0% / 0.0% | 0.0% / 0.0% | 0.3% / 2.7% | 0.0% / 0.0% | 0.0% / 0.0% |
| 800 | 0.0% / 0.0% | 0.0% / 0.0% | 0.3% / 2.3% | 0.0% / 0.0% | 0.0% / 0.0% |
| 825 | 0.0% / 0.0% | 0.0% / 0.0% | 0.3% / 1.7% | 0.0% / 0.0% | 0.0% / 0.0% |
| 850 | 0.0% / 0.0% | 0.0% / 0.0% | 0.3% / 1.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| 875 | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 1.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| 900 | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 1.0% | 0.0% / 0.0% | 0.0% / 0.0% |

## D. Played hands

Share of played hands by category, all tiers pooled (share of points in brackets).

| Bot | pair | two_pairs | small_straight | three_kind | full_house | straight | four_kind | five_kind |
|---|---|---|---|---|---|---|---|---|
| naive | 0.2% (0.1%) | 16.3% (10.6%) | 4.1% (1.4%) | 3.8% (2.2%) | 38.3% (37.9%) | 23.3% (34.1%) | 9.1% (7.6%) | 4.9% (6.2%) |
| greedy | 1.6% (0.2%) | 15.5% (9.9%) | 3.2% (0.9%) | 3.8% (1.9%) | 33.2% (33.3%) | 29.6% (38.8%) | 6.1% (4.6%) | 7.0% (10.2%) |

Straights against of-a-kind hands (pair, two pairs, three, full house, four, five) per tier: share of hands / share of points.

| Tier | Naive: straights | Naive: of-a-kind | Greedy: straights | Greedy: of-a-kind |
|---|---|---|---|---|
| 1 | 34.3% / 42.2% | 65.7% / 57.8% | 44.1% / 46.4% | 55.9% / 53.6% |
| 2 | 25.8% / 34.7% | 74.2% / 65.3% | 33.6% / 41.3% | 66.4% / 58.7% |
| 3 | 19.5% / 30.3% | 80.5% / 69.7% | 23.5% / 34.8% | 76.5% / 65.2% |
| 4 | 17.8% / 28.6% | 82.2% / 71.4% | 23.5% / 33.5% | 76.5% / 66.5% |
| 5 | 19.5% / 31.8% | 80.5% / 68.2% | 24.1% / 35.7% | 75.9% / 64.3% |

## E. Bonus usage

| Bot | Kind | Placed | Used | Used on hand 1 / 2 / 3 |
|---|---|---|---|---|
| naive | x2_any | 240 | 100.0% | 100.0% / 0.0% / 0.0% |
| naive | x3_straight | 246 | 50.4% | 41.9% / 29.8% / 28.2% |
| naive | x3_pairs | 290 | 96.6% | 72.1% / 23.2% / 4.6% |
| naive | x3_trips | 340 | 96.2% | 69.4% / 22.0% / 8.6% |
| naive | joker | 330 | 95.8% | 72.5% / 21.5% / 6.0% |
| greedy | x2_any | 240 | 100.0% | 44.2% / 13.3% / 42.5% |
| greedy | x3_straight | 246 | 78.5% | 85.0% / 10.4% / 4.7% |
| greedy | x3_pairs | 290 | 97.9% | 73.6% / 23.9% / 2.5% |
| greedy | x3_trips | 340 | 97.9% | 89.2% / 9.0% / 1.8% |
| greedy | joker | 330 | 85.2% | 4.3% / 0.4% / 95.4% |

- naive: 34.5% of hands use a bonus; 10.6% of those stack two or more. Tier 3 (two bonuses): every bonus spent on one hand in 52.3% of levels.
- greedy: 38.0% of hands use a bonus; 10.3% of those stack two or more. Tier 3 (two bonuses): every bonus spent on one hand in 52.3% of levels.

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
| — | rules: bonuses add up, straight ×8 | 530.1 | 447.6 | 477.0 | 368.2 | 372.5 | 29.6% / 38.8% | 1.16 | 0.70 | 52.3% |
| a | stacking: multiply (first rule) | 530.1 | 447.6 | 510.8 | 368.2 | 372.5 | 29.5% / 38.0% | 1.16 | 0.48 | 51.7% |
| a | stacking: single best bonus | 530.1 | 447.6 | 484.8 | 368.2 | 372.5 | 29.5% / 38.7% | 1.16 | 0.89 | 8.7% |
| b | category-first table | 500.1 | 425.5 | 454.3 | 361.1 | 361.5 | 17.3% / 19.3% | 1.30 | 0.69 | 61.7% |
| c | straight ×5 (pips of Poker 5) | 481.0 | 424.8 | 428.7 | 337.6 | 340.6 | 15.3% / 16.6% | 1.54 | 1.04 | 55.0% |
| c | straight ×10 | 556.8 | 493.0 | 494.3 | 406.8 | 412.4 | 35.1% / 50.8% | 0.97 | 0.57 | 47.0% |

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

Runtime: 14.7 s
