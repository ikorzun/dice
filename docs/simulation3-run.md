# Auto Hand — the run (a missed target ends it)
seed run-1 · 400 runs per player · one device a player · bots sell old · run-3/recipes-1/400 · aim {"aimFirst":0.99,"aimStart":0.99,"aimFade":60,"aimFloor":0.93,"near":1} · 2026-11-18T17:08:24.633Z

Targets: L1 200 · L2 220 · L3 250 · L5 300 · L10 480 · L15 700 · L20 980 · L25 1320 · L30 1740 · L40 2890 · L50 4420 · L60 6460.

"Reached" is the level the run ended on. Minutes at a rough 55 s per level played.

| Player | Median reached | Mean | 10–90 % | Reach L5 | Reach L10 | Reach L20 | Reach L30 | Reach L45 | Reach L60 | Median minutes |
|---|---|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 12 | 12.3 | 5–20 | 91.8% | 69.5% | 10.0% | 0.3% | 0.0% | 0.0% | 11.0 |
| naive (typical) | 19 | 19.7 | 11–28 | 99.8% | 96.0% | 48.0% | 7.2% | 0.0% | 0.0% | 17.4 |
| greedy (strong) | 25 | 23.5 | 14–32 | 99.5% | 94.3% | 69.8% | 23.0% | 0.0% | 0.0% | 22.9 |

## Pass rate by level (runs that got there)

| Level | Target | Aim (model) | lazy (no rerolls) | naive (typical) | greedy (strong) |
|---|---|---|---|---|---|
| 1 | 200 | 99.0% | 100.0% (400) | 100.0% (400) | 100.0% (400) |
| 2 | 220 | 99.0% | 92.0% (400) | 99.8% (400) | 99.5% (400) |
| 3 | 250 | 99.0% | 99.7% (368) | 100.0% (399) | 100.0% (398) |
| 4 | 270 | 98.9% | 100.0% (367) | 100.0% (399) | 100.0% (398) |
| 5 | 300 | 98.8% | 94.8% (367) | 99.5% (399) | 97.7% (398) |
| 6 | 320 | 98.7% | 99.1% (348) | 100.0% (397) | 100.0% (389) |
| 7 | 360 | 98.6% | 90.7% (345) | 99.0% (397) | 99.5% (389) |
| 8 | 390 | 98.5% | 95.2% (313) | 99.2% (393) | 99.0% (387) |
| 9 | 430 | 98.4% | 93.3% (298) | 98.5% (390) | 98.4% (383) |
| 10 | 480 | 98.3% | 86.7% (278) | 95.8% (384) | 98.4% (377) |
| 11 | 510 | 98.3% | 84.2% (241) | 96.2% (368) | 97.8% (371) |
| 12 | 550 | 98.2% | 96.1% (203) | 99.7% (354) | 100.0% (363) |
| 13 | 600 | 98.1% | 93.8% (195) | 98.0% (353) | 99.4% (363) |
| 14 | 650 | 98.0% | 89.1% (183) | 98.6% (346) | 99.2% (361) |
| 15 | 700 | 97.9% | 84.0% (163) | 94.4% (341) | 98.6% (358) |
| 16 | 750 | 97.8% | 54.7% (137) | 84.5% (322) | 92.4% (353) |
| 17 | 800 | 97.8% | 74.7% (75) | 90.1% (272) | 94.8% (326) |
| 18 | 850 | 97.7% | 89.3% (56) | 91.4% (245) | 97.1% (309) |
| 19 | 910 | 97.6% | 80.0% (50) | 85.7% (224) | 93.0% (300) |
| 20 | 980 | 97.5% | 55.0% (40) | 74.0% (192) | 91.0% (279) |
| 21 | 1040 | 97.4% | 81.8% (22) | 100.0% (142) | 94.9% (254) |
| 22 | 1110 | 97.4% | — (18) | 86.6% (142) | 95.9% (241) |
| 23 | 1170 | 97.3% | — (15) | 92.7% (123) | 93.9% (231) |
| 24 | 1240 | 97.2% | — (9) | 86.0% (114) | 96.8% (217) |
| 25 | 1320 | 97.2% | — (9) | 82.7% (98) | 93.3% (210) |
| 26 | 1390 | 97.1% | — (7) | 79.0% (81) | 90.8% (196) |
| 27 | 1470 | 97.0% | — (4) | 79.7% (64) | 86.5% (178) |
| 28 | 1560 | 97.0% | — (3) | 68.6% (51) | 84.4% (154) |
| 29 | 1650 | 96.9% | — (1) | 82.9% (35) | 70.8% (130) |
| 30 | 1740 | 96.8% | — (1) | 51.7% (29) | 71.7% (92) |
| 31 | 1840 | 96.8% | — | — (15) | 71.2% (66) |
| 32 | 1930 | 96.7% | — | — (7) | 68.1% (47) |
| 33 | 2030 | 96.6% | — | — (4) | 75.0% (32) |
| 34 | 2130 | 96.6% | — | — (1) | 58.3% (24) |
| 35 | 2240 | 96.5% | — | — (1) | — (14) |
| 36 | 2360 | 96.5% | — | — | — (3) |
| 37 | 2480 | 96.4% | — | — | — (3) |
| 38 | 2610 | 96.3% | — | — | — (2) |
| 39 | 2750 | 96.3% | — | — | — (2) |
| 40 | 2890 | 96.2% | — | — | — (1) |
| 41 | 3020 | 96.2% | — | — | — |
| 42 | 3150 | 96.1% | — | — | — |
| 43 | 3280 | 96.1% | — | — | — |
| 44 | 3430 | 96.0% | — | — | — |
| 45 | 3570 | 96.0% | — | — | — |
| 46 | 3730 | 95.9% | — | — | — |
| 47 | 3890 | 95.9% | — | — | — |
| 48 | 4060 | 95.8% | — | — | — |
| 49 | 4230 | 95.8% | — | — | — |
| 50 | 4420 | 95.7% | — | — | — |
| 51 | 4590 | 95.7% | — | — | — |
| 52 | 4770 | 95.7% | — | — | — |
| 53 | 4960 | 95.6% | — | — | — |
| 54 | 5140 | 95.6% | — | — | — |
| 55 | 5350 | 95.5% | — | — | — |
| 56 | 5550 | 95.5% | — | — | — |
| 57 | 5760 | 95.4% | — | — | — |
| 58 | 5980 | 95.4% | — | — | — |
| 59 | 6220 | 95.4% | — | — | — |
| 60 | 6460 | 95.3% | — | — | — |

## Keepers and the shop

| Player | THE EATER | RED EYE | THE CONVICT | IRON WARDEN | OLD HORNS | LOOSE GRIP | THE GOLDEN KNIGHT | THE GOLDEN MACHINE | THE GOLDEN BONES | Bells a door | Things a run | Gallery a run |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 93.7% (383) | 79.5% (195) | 95.4% (175) | 74.2% (89) | 50.0% (16) | — | — | — | — | 16.1 | 2.5 | 29.5 |
| naive (typical) | 95.6% (472) | 90.3% (341) | 96.5% (316) | 85.2% (209) | 79.2% (96) | 70.0% (10) | — | — | — | 13.0 | 3.6 | 34.0 |
| greedy (strong) | 96.2% (529) | 96.0% (376) | 97.0% (372) | 93.0% (258) | 86.8% (152) | 80.6% (36) | 0.0% (6) | — | — | 15.6 | 3.7 | 35.1 |

## The bank (one card on the board, 17.11.2026)

Kept cards play from the row while the board holds no card, one a hand. "Blocked": levels begun with kept cards whose card on the board was never played, so the bank stayed shut. "Lasts": kept cards at a start ÷ the cards that leave a level (played, sold, or replaced by a card past three), the levels a card stays in the bank. "Past three": cards a won level carried past the bank's three, each a choice that sells one card for half (MODE3-PLAN §62). "Sold": at the doors, by --sell. "Age": whole levels every kept card had already waited at every level's start, played later or not. "Waited": whole levels a kept card spent in the bank before the level it was played on (the played ones only).

| Player | Levels with kept cards | Kept cards at a start | Played a level | Lasts, levels | Age, mean | Age 3+ | Blocked levels | Waited, mean | Waited 3+ | Past three a run | Their bells a run | Sold a run | Sale bells a run |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 1581 | 1.15 | 0.73 | 1.4 | 0.32 | 0.2% | 0.0% | 0.24 | 0.0% | 0.00 | 0.0 | 0.31 | 0.7 |
| naive (typical) | 2491 | 1.11 | 0.63 | 1.5 | 0.40 | 0.3% | 0.0% | 0.22 | 0.0% | 0.00 | 0.0 | 0.66 | 1.4 |
| greedy (strong) | 2230 | 1.05 | 0.54 | 1.5 | 0.47 | 0.6% | 0.0% | 0.14 | 0.2% | 0.00 | 0.0 | 0.74 | 1.6 |

## Layouts the strong player met most (levels 2 on)

8d0x:x3_trips 20.3%, 8d0x:x3_straight 15.1%, 8d0x:x2_any 12.3%, 8d0x:joker 10.7%, 8d0x:x4_any 8.9%, 8d0x:x3_pairs 8.2%, 8d0x:x3_kinds 7.7%, 8d0x:refund 6.1%, 8d0x:x3_small 4.5%, 8d0x:x3_sixes 3.2%, 9d0x:- 2.9%

- Levels 2–10: 8d0x:x3_pairs 19.6%, 8d0x:x3_trips 19.1%, 8d0x:joker 17.2%, 8d0x:x3_straight 15.3%, 8d0x:refund 14.3%, 8d0x:x2_any 8.5%, 9d0x:- 5.9%
- Levels 11–20: 8d0x:x3_trips 31.8%, 8d0x:x2_any 22.4%, 8d0x:x3_kinds 17.6%, 8d0x:x3_small 10.4%, 8d0x:x3_straight 9.0%, 8d0x:joker 8.8%
- Levels 21–30: 8d0x:x4_any 41.1%, 8d0x:x3_straight 26.5%, 8d0x:x3_sixes 14.2%, 8d0x:x3_kinds 4.3%, 8d0x:x3_trips 3.4%, 8d0x:x3_small 1.9%, 8d0x:joker 1.9%, 8d0x:x2_any 1.8%, 9d0x:- 1.8%, 8d0x:refund 1.6%, 8d0x:x3_pairs 1.4%
- Levels 31 on: 8d0x:joker 11.9%, 8d0x:x3_pairs 10.8%, 9d0x:- 10.3%, 8d0x:refund 10.3%, 8d0x:x4_any 9.3%, 8d0x:x3_sixes 8.8%, 8d0x:x3_trips 8.8%, 8d0x:x2_any 8.2%, 8d0x:x3_small 7.7%, 8d0x:x3_straight 7.2%, 8d0x:x3_kinds 6.7%

Recipe ids: `<dice>d<blocks>x:<bonus kinds>`. Runtime: 730.5 s
