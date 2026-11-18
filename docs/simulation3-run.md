# Auto Hand — the run (a missed target ends it)
seed run-1 · 400 runs per player · one device a player · bots sell old · run-3/recipes-1/400 · aim {"aimFirst":0.99,"aimStart":0.99,"aimFade":60,"aimFloor":0.93,"near":1} · 2026-11-18T09:37:19.532Z

Targets: L1 200 · L2 220 · L3 250 · L5 300 · L10 480 · L15 700 · L20 980 · L25 1320 · L30 1740 · L40 2890 · L50 4420 · L60 6460.

"Reached" is the level the run ended on. Minutes at a rough 55 s per level played.

| Player | Median reached | Mean | 10–90 % | Reach L5 | Reach L10 | Reach L20 | Reach L30 | Reach L45 | Reach L60 | Median minutes |
|---|---|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 11 | 12.2 | 5–20 | 90.3% | 68.5% | 11.3% | 0.5% | 0.0% | 0.0% | 10.1 |
| naive (typical) | 20 | 20.0 | 11–29 | 99.8% | 94.3% | 54.0% | 8.3% | 0.0% | 0.0% | 18.3 |
| greedy (strong) | 25 | 24.2 | 16–32 | 99.3% | 97.0% | 74.8% | 25.5% | 0.5% | 0.0% | 22.9 |

## Pass rate by level (runs that got there)

| Level | Target | Aim (model) | lazy (no rerolls) | naive (typical) | greedy (strong) |
|---|---|---|---|---|---|
| 1 | 200 | 99.0% | 100.0% (400) | 100.0% (400) | 100.0% (400) |
| 2 | 220 | 99.0% | 92.0% (400) | 99.8% (400) | 99.5% (400) |
| 3 | 250 | 99.0% | 99.7% (368) | 100.0% (399) | 99.7% (398) |
| 4 | 270 | 98.9% | 98.4% (367) | 100.0% (399) | 100.0% (397) |
| 5 | 300 | 98.8% | 88.4% (361) | 97.5% (399) | 99.0% (397) |
| 6 | 320 | 98.7% | 99.7% (319) | 100.0% (389) | 100.0% (393) |
| 7 | 360 | 98.6% | 92.5% (318) | 99.5% (389) | 100.0% (393) |
| 8 | 390 | 98.5% | 96.6% (294) | 99.2% (387) | 99.0% (393) |
| 9 | 430 | 98.4% | 96.5% (284) | 98.2% (384) | 99.7% (389) |
| 10 | 480 | 98.3% | 88.3% (274) | 97.1% (377) | 99.2% (388) |
| 11 | 510 | 98.3% | 81.4% (242) | 96.4% (366) | 97.7% (385) |
| 12 | 550 | 98.2% | 95.9% (197) | 99.7% (353) | 100.0% (376) |
| 13 | 600 | 98.1% | 96.3% (189) | 100.0% (352) | 99.7% (376) |
| 14 | 650 | 98.0% | 95.1% (182) | 98.9% (352) | 99.2% (375) |
| 15 | 700 | 97.9% | 82.7% (173) | 93.7% (348) | 97.3% (372) |
| 16 | 750 | 97.8% | 62.2% (143) | 81.9% (326) | 92.3% (362) |
| 17 | 800 | 97.8% | 82.0% (89) | 92.5% (267) | 96.7% (334) |
| 18 | 850 | 97.7% | 82.2% (73) | 93.9% (247) | 96.6% (323) |
| 19 | 910 | 97.6% | 75.0% (60) | 93.1% (232) | 95.8% (312) |
| 20 | 980 | 97.5% | 51.1% (45) | 76.9% (216) | 88.0% (299) |
| 21 | 1040 | 97.4% | 91.3% (23) | 98.2% (166) | 97.0% (263) |
| 22 | 1110 | 97.4% | 66.7% (21) | 87.1% (163) | 94.5% (255) |
| 23 | 1170 | 97.3% | — (14) | 88.0% (142) | 93.4% (241) |
| 24 | 1240 | 97.2% | — (13) | 89.6% (125) | 96.0% (225) |
| 25 | 1320 | 97.2% | — (11) | 79.5% (112) | 92.1% (216) |
| 26 | 1390 | 97.1% | — (9) | 83.1% (89) | 91.0% (199) |
| 27 | 1470 | 97.0% | — (6) | 77.0% (74) | 91.7% (181) |
| 28 | 1560 | 97.0% | — (4) | 71.9% (57) | 81.3% (166) |
| 29 | 1650 | 96.9% | — (2) | 80.5% (41) | 75.6% (135) |
| 30 | 1740 | 96.8% | — (2) | 36.4% (33) | 58.8% (102) |
| 31 | 1840 | 96.8% | — (1) | — (12) | 71.7% (60) |
| 32 | 1930 | 96.7% | — (1) | — (7) | 79.1% (43) |
| 33 | 2030 | 96.6% | — (1) | — (5) | 82.4% (34) |
| 34 | 2130 | 96.6% | — | — (5) | 75.0% (28) |
| 35 | 2240 | 96.5% | — | — (4) | 38.1% (21) |
| 36 | 2360 | 96.5% | — | — (1) | — (8) |
| 37 | 2480 | 96.4% | — | — | — (6) |
| 38 | 2610 | 96.3% | — | — | — (4) |
| 39 | 2750 | 96.3% | — | — | — (4) |
| 40 | 2890 | 96.2% | — | — | — (4) |
| 41 | 3020 | 96.2% | — | — | — (2) |
| 42 | 3150 | 96.1% | — | — | — (2) |
| 43 | 3280 | 96.1% | — | — | — (2) |
| 44 | 3430 | 96.0% | — | — | — (2) |
| 45 | 3570 | 96.0% | — | — | — (2) |
| 46 | 3730 | 95.9% | — | — | — (1) |
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
| lazy (no rerolls) | 87.5% (377) | 80.5% (195) | 94.0% (184) | 70.2% (94) | 66.7% (15) | 100.0% (1) | — | — | — | 16.6 | 2.5 | 32.2 |
| naive (typical) | 93.5% (478) | 90.2% (337) | 96.3% (321) | 85.9% (234) | 79.8% (104) | 38.5% (13) | 0.0% (2) | — | — | 13.9 | 3.6 | 34.2 |
| greedy (strong) | 96.3% (540) | 95.9% (389) | 95.5% (380) | 87.6% (275) | 84.1% (170) | 77.5% (40) | 33.3% (6) | 0.0% (1) | — | 16.4 | 3.8 | 35.2 |

## The bank (one card on the board, 17.11.2026)

Kept cards play from the row while the board holds no card, one a hand. "Blocked": levels begun with kept cards whose card on the board was never played, so the bank stayed shut. "Lasts": kept cards at a start ÷ the cards that leave a level (played, sold, or replaced by a card past three), the levels a card stays in the bank. "Past three": cards a won level carried past the bank's three, each a choice that sells one card for half (MODE3-PLAN §62). "Sold": at the doors, by --sell. "Age": whole levels every kept card had already waited at every level's start, played later or not. "Waited": whole levels a kept card spent in the bank before the level it was played on (the played ones only).

| Player | Levels with kept cards | Kept cards at a start | Played a level | Lasts, levels | Age, mean | Age 3+ | Blocked levels | Waited, mean | Waited 3+ | Past three a run | Their bells a run | Sold a run | Sale bells a run |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lazy (no rerolls) | 2094 | 1.24 | 0.36 | 2.0 | 0.57 | 1.0% | 22.3% | 0.49 | 0.9% | 0.01 | 0.0 | 1.38 | 3.3 |
| naive (typical) | 3409 | 1.25 | 0.29 | 2.1 | 0.67 | 1.7% | 21.3% | 0.57 | 1.3% | 0.01 | 0.0 | 2.53 | 6.0 |
| greedy (strong) | 3409 | 1.16 | 0.20 | 2.3 | 0.75 | 2.1% | 18.1% | 0.61 | 1.5% | 0.01 | 0.0 | 2.58 | 6.1 |

## Layouts the strong player met most (levels 2 on)

8d0x:x3_trips 20.3%, 8d0x:x3_straight 15.4%, 8d0x:x2_any 12.3%, 8d0x:joker 10.7%, 8d0x:x4_any 8.9%, 8d0x:x3_pairs 8.0%, 8d0x:x3_kinds 7.5%, 8d0x:refund 6.2%, 8d0x:x3_small 4.5%, 8d0x:x3_sixes 3.2%, 9d0x:- 3.0%

- Levels 2–10: 8d0x:x3_pairs 19.6%, 8d0x:x3_trips 18.9%, 8d0x:joker 17.4%, 8d0x:x3_straight 15.2%, 8d0x:refund 14.3%, 8d0x:x2_any 8.6%, 9d0x:- 5.9%
- Levels 11–20: 8d0x:x3_trips 31.8%, 8d0x:x2_any 22.4%, 8d0x:x3_kinds 17.5%, 8d0x:x3_small 10.3%, 8d0x:x3_straight 9.1%, 8d0x:joker 8.9%
- Levels 21–30: 8d0x:x4_any 40.1%, 8d0x:x3_straight 27.6%, 8d0x:x3_sixes 13.8%, 8d0x:x3_trips 3.7%, 8d0x:x3_kinds 3.7%, 8d0x:joker 2.2%, 9d0x:- 2.0%, 8d0x:refund 1.9%, 8d0x:x2_any 1.9%, 8d0x:x3_small 1.6%, 8d0x:x3_pairs 1.4%
- Levels 31 on: 9d0x:- 11.7%, 8d0x:x3_sixes 11.7%, 8d0x:refund 11.2%, 8d0x:x4_any 11.2%, 8d0x:x3_straight 10.3%, 8d0x:x3_trips 9.9%, 8d0x:x3_small 9.9%, 8d0x:x3_pairs 9.0%, 8d0x:joker 7.2%, 8d0x:x2_any 4.9%, 8d0x:x3_kinds 3.1%

Recipe ids: `<dice>d<blocks>x:<bonus kinds>`. Runtime: 521.4 s
