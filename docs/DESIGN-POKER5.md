# Дизайн режима Poker 5: глубокий разбор и решение

Итог дизайн-панели: 5 независимых рулсетов, 3 судьи (адвокат казуального игрока, старший дизайнер головоломок, внедряющий инженер), синтез. Дата: 31 октября 2026.

## Что принято в прототипе (решения владельца продукта имеют приоритет)

- **Золотая клетка ×2 остаётся** (8 костей + ×2 в углу), как попросил владелец; панель предпочла 9 костей и ×2-значок, этот вариант доступен переключателем в HELP («Gold ×2 cell replaces one die») для сравнения.
- Принято из рекомендации: таблица очков `poker5_v2` (покер 50, каре 30, стрит 25, фулл-хаус 20, тройка 10, две пары 5, пара 2, ничего 0; малый стрит выключен и доступен как эксперимент), **два** общих реролла (паритет с 4+4), **конец уровня при достижении цели** со звёздами за экономию рук (флаг в HELP), превью с «leaves a b c» (что остаётся), метка STAYS на оставшихся костях после банка, строка «LEFT ON THE TABLE» на экране итога, подпись «REROLL n» (сколько костей изменится), «NO MATCH 0» в предупреждающем стиле, подсказка с учётом качества переноса.
- Не принято пока: цели 60/75/90/100/110 рассчитаны панелью для 9 костей; для варианта с золотой клеткой цели пересчитаны симуляцией отдельно (см. `docs/simulation5-latest.md`).

## Счёт судей

| Рулсет | Сумма баллов (3 судьи × 5 критериев) |
|---|---|
| Poker 5: Play Five, Keep Four | 117 |
| Poker 5 - Carry | 112 |
| Spend Five, Keep Four | 105 |
| Poker 5 — Cash Five, Carry Four, Gold Lands Where You Lift | 92 |
| Poker 5 — Four Anchors (corners fixed, cross live) | 79 |

Победители по судьям: Poker 5: Play Five, Keep Four, Poker 5 - Carry, Poker 5: Play Five, Keep Four.

## Прямой ответ: что такое остальные кости

They are the CARRY, and they need no rule of their own. A hand always spends exactly five dice; the four you did not trace stay exactly where they are, with the same faces and the same hold rings, and only the five cells you played receive fresh seeded dice the moment you lift your finger. So every hand after the first is "your four plus five new", and the animation (five dice tumble, four stand still) is the whole explanation. This answers both of the owner's instincts without adding anything a casual player must learn: the four ARE "random fixed dice" (rolled earlier, not rerolled unless unheld), but the player fixes them by choosing which five to play, so a fixed die is never dealt against them; and they ARE a "positive bonus", measurable exactly: in the worked example two four-of-a-kind snakes both score 30, but the one that leaves 6-6-6 gives a 46.1% chance of four of a kind or better on the refill, the one that leaves only 6-6 gives 22.4% (exact over all 7776 refills, reproduced with the prototype's own geometry). Bonus faces, sealed dice, corner anchors and a routed gold die are kept as later-tier flags, not base rules. Pips still never count.

## Открытые вопросы

- End on target (default true, short levels, stars by hands used) versus always playing three hands (flag): the first makes the hand-1 reroll stack plus armed x2 end tiers 1-3 in one hand for skilled players; the second lengthens levels to about 45 s. Decide after the first playtest from the hands-used and duration logs.
- Table variant: 50/30/25/20/10/5/2/0 (Yahtzee-familiar 50) versus 60/40/25/20/10/5/2/0 (steeper top, stronger incentive to break a made full house and hunt with a held trip). Both partitions are the same 7776; only the incentive differs.
- Straight above full house follows the dice odds (240 < 300) but contradicts card-poker habit; expect 'the table is wrong' comments. Keep both odds columns visible; if testers still object, swap to full house 25 / straight 20 and re-run the simulation.
- Targets 60/75/90/100/110 are bot-calibrated (naive 91.5, greedy 112.2 per level) with no human data; humans will land between the bots at first, so tiers 4-5 may need a +/-5 move after 50 human levels.
- x2 as a badge (auto-applies, safe for novices, a fixed rule 'arm on 30+' for experts) versus a routed gold die (spatial, conflicts with the carry, never auto-applies): which does the owner want in the side-by-side?
- Reroll economy: 2 shared rerolls (parity with Snake 4+4) versus 1 per hand (removes the hand-1 stack, adds a hold decision to every hand).
- Should carried dice be auto-held after a bank (opt-in setting) so a player cannot wreck a planned carry by forgetting to hold before REROLL? The 'REROLL changes n dice' label is the default mitigation.
- If testers still say 'a pair of 1s equals a pair of 6s' after Poker 5, the cheapest concession is Yatzy-style pips for one pair and two pairs only (6-6 = 12); it costs mental arithmetic and breaks the 'match values, not big numbers' line, so it is off until asked for twice.
- Level length: three hands with two rerolls is about 40 s versus about 30 s for Snake 4+4; a 2-hand variant is one config change if sessions feel long, at the cost of one carry decision per level.
- Confound in the A/B: Snake 4+4 keeps its stranding guard, so part of any clarity gain is 'no rejections' rather than 'five-dice hands'. A later control with the guard relaxed (allow any first hand, forfeit the second) would isolate hand size.
- Dead bottom rows: one pair and two pairs are the best snake on 0.01% and 7.6% of fresh boards; Sage Solitaire's answer is to drop a too-common hand. Keep the familiar eight-row ladder for now, revisit if the chart feels long.
- Carry visibility: the engineer and casual judges both warn the only new idea is invisible unless the refill animation, the 'leaves' preview and the STAYS tag sell it; the depth signals in the A/B plan are the check, and the gold-die toggle the fallback if the carry is never read.

## План A/B против Snake 4+4

Design: within-subject, counterbalanced. Each tester plays 10 levels in one tab, then 10 in the other; half start with Snake 4+4, half with Poker 5. Both tabs use the same run seed per tester so boards are reproducible and sessions can be replayed from logs. Portrait phone, no coaching beyond the in-app lines, 12-20 testers; the product owner's own sessions are logged but analysed separately. Each tab is played with its current defaults (Snake 4+4: 8 dice, 2 hands, 2 rerolls, gold corner x2, guard; Poker 5: 9 dice, 3 hands, 2 rerolls, badge x2, carry, end on target). Note for the owner: this compares two rule families, not one variable; hand size, board size, hand count, guard and end rule all move together, which is what the clarity complaint is about.

Primary metrics (comprehension and friction, the owner's complaint): (1) time from level start to first accepted bank on levels 1-3; (2) rejected traces per level by code (Snake 4+4: STRANDS and LENGTH; Poker 5: LENGTH only) and the share of levels with at least one rejection; (3) help-sheet opens and HINT uses per level; (4) a two-tap in-app check after level 3 and after level 10: 'What did you just score?' (four hand names, one correct) and 'What are you trying to reach?' (the target number); (5) a one-line self-report after each tab: 'I understood what to do' and 'This was fun', both 1-5, plus the final 'Which tab would you keep?'.

Secondary metrics (pace and difficulty): level duration (start to end card), win rate per tier and the tier reached after 10 levels, retries per level, levels abandoned mid-way (app backgrounded or tab switched before the end card), levels per session when testers are free to continue, and the score distribution per tier against the bot bands (Poker 5 naive 91.5 / greedy 112.2; Snake 4+4 from docs/simulation-latest.md).

Depth signals (Poker 5 only, to see whether the carry is noticed): share of banks where the chosen snake was not the max-points snake but left a carry with more equal faces (carry-aware choice) versus the hint's recommendation; share of rerolls made with a made hand held (three of a kind or better held, the rest rerolled); x2 timing (hand index, armed versus auto, disarm count); share of levels won on hand 1 / 2 / 3; how often both rerolls were spent on hand 1 (the stack line); hold toggles per hand. Snake 4+4 mirrors: share of first hands that were the best-scoring legal snake versus the best unsafe one, gold-cell arm timing.

What to log (one JSON line per event, append-only, reproducible): common fields {ts, tester, mode, runSeed, levelIndex, tier, target, attempt, generatorVersion, settings}; events trace_start, trace_end {cells, pathOrder, count}, bank {mask, faces, category, points, multiplier, total, carryFaces, handIndex, scoreAfter, holdMaskBefore}, reject {code, count}, hold {cell, on, handIndex}, reroll {holdMask, diceChanged, rerollsLeft, handIndex, bestBefore, bestAfter}, x2_arm, x2_disarm, x2_auto {handIndex}, hint {recommendedMask, taken}, help_open, level_end {won, score, target, hands used, stars, durationMs, rerollsLeft, bestOpening}, retry, next {tierBefore, tierAfter}, survey {question, answer}. Everything needed to replay a level is the seed plus the ordered inputs, so store nothing else.

Decision rule before the owner picks a default: Poker 5 replaces Snake 4+4 as the default tab if (a) rejected traces per level fall by at least half, (b) the 'what did you just score' check is right for at least 80% of testers after level 3 and beats Snake 4+4, (c) at least 60% prefer it, and (d) abandonment and 'fun' are not worse. If Poker 5 wins on clarity but the depth signals show the carry is never used (carry-aware choices under 10% of tied banks) the next experiment is the gold-die toggle, not a rule change. If both rerolls land on hand 1 in more than 70% of levels, test rerollsPerHand: 1. Keep the Snake 4+4 tab as the control throughout.

## Альтернативы

- **Poker 5 - Carry (one reroll per hand).** Identical board, hands, carry, badge and table, but each hand comes with exactly one use-it-or-lose-it reroll (three per level) instead of two shared ones; the preview, 'leaves a b c d' line and carry-aware hint are already in the recommendation. Every hand becomes a hold decision on the carry and the simple 'hold the matched dice, reroll the rest' heuristic is nearly optimal; its author measured naive 111 -> hold-and-reroll 136 -> carry planner 146 points per level and targets 90-150. _Когда предпочесть:_ If the A/B logs show both shared rerolls spent on hand 1 in most levels (the stack line: hold trips, reroll twice, arm x2) and tiers 1-3 feel like one recipe; or if testers hoard rerolls and never spend them; or if Yahtzee players read 'one reroll per hand' as clearer than a pool. Cost: a rerollsThisHand counter and the HAND_REROLL_USED rejection; levels run about 45 s and the reroll economy no longer matches Snake 4+4, so compare by win rate and feel rather than by points.
- **Spend Five, Keep Four (gold die x2).** The same carry game with the x2 as a gold ring on one die instead of a badge: a hand routed through the gold die scores double, the ring leaves with the die when it is banked, placement is centre for easy tiers and a corner for hard ones. The bonus pulls against the carry (double the full house now for 40, or keep the gold alive for a four of a kind at 60), and the gold die sitting among your four is a visible timer. _Когда предпочесть:_ If the owner misses the spatial x2 of Snake 4+4 and wants the side-by-side to keep a bonus on the board; or if x2 telemetry shows a non-decision (always armed on hand 1, or always auto on hand 3). Ship it as goldMode: 'die' behind a settings toggle after the badge version has been played, with the pulsing ring and a last-hand coach line because gold never auto-applies; drop its +3 cash-out and keep stars.
- **Four Anchors (fixed corners) as a boss-tier mutator.** The four corner dice are rolled once and FIXED for the level (never reroll, cannot be held, refill as fixed), the five cross dice are the hold-and-reroll pocket; every five-snake contains one to three corners, so the fixed dice are never dead and the level reads like Hold'em board plus pocket. Without the pip kicker it needs no new scoring; sealedMask + sealedPersist and the FIXED tag already exist in the engine. _Когда предпочесть:_ Only as a tier-5 or boss level, never the base: when testers explicitly ask for 'random fixed dice', or when tiers 4-5 feel like plain rolling and need a twist stated in one line on the level card ('Corners are fixed'). Keep the kicker off: pips must never count, and two non-rerolling states (FIXED and HOLD) are already a lot for one session.

---

# Документ синтеза (как написан панелью)

# Poker 5 «Сыграй пять, оставь четыре»: проектное решение

## 1. Вопрос

Плейтест дал точную формулировку: «собирать пары из четырёх костей непонятно и трудно». Причины измеримы. Из 1296 бросков четырёх костей 720 дают одну пару и 288 — ничего, то есть 78 % случайных рук это «пара или пусто». Лестница из пяти категорий читается наоборот: две пары (90 исходов) реже тройки (120), но стоят вдвое меньше. И главное трение: точный страж отвергал 11 из 19 первых змеек, так что типичный опыт был «нашёл пару — получил отказ». Владелец хочет вернуть знакомую покерную логику на пяти костях и спрашивает: если рука — змейка не более чем из пяти костей на поле 3×3, чем являются остальные четыре кости? Его догадки: «положительные бонусы» или «случайные фиксированные кости».

Ограничения не обсуждаются: сетка 3×3, вертикальный телефон, чёрный фон, одно действие (нажал кость, провёл по соседям, отпустил), тап для удержания, честная воспроизводимая математика без скрытой подкрутки, короткие уровни с видимой целью, отдельная вкладка рядом со Snake 4+4 в том же прототипе.

## 2. Что могут быть «остальные четыре»: семь вариантов

**А. Положительные бонусы.** Клетки или грани вне змейки дают множитель или добавку: «звёздная грань» (Sage Solitaire), бонус по соседству (Luck be a Landlord), золотая кость x2 (дизайн «Spend Five, Keep Four»). Плюс: бонус виден заранее и объясняется одной фразой. Минус: каждый бонус — новая строка правил, а добавка в очках ломает единственность числа под пальцем. Оставляем ровно один бонус, x2.

**Б. Случайные фиксированные кости (якоря).** Четыре угла бросаются один раз и не перебрасываются, как общие кости в Yahtzee Texas Hold'em; дизайн «Four Anchors» добавлял к ним ещё и кикер в пипсах. Плюс: буквально реализует обе догадки владельца, и геометрия удачна (каждая пятиклеточная змейка содержит от одного до трёх углов, ни одна — ноль). Минус: плохой угол сдан против игрока и висит, пока его не съедят; два вида неперебрасываемых костей (FIXED и HOLD) путаются в первой сессии; кикер возвращает арифметику пипсов, против которой стоит весь проект. Все трое судей поставили этот вариант последним.

**В. Перенос (carry).** Сыгранные пять клеток получают свежие кости, четыре несыгранные остаются на месте с теми же гранями и удержаниями. Это правило любого match-3 (Dungeon Raid) и добор руки в Balatro. Плюс: правило учить не нужно, анимация объясняет сама; страж не нужен вовсе; «фиксированные кости» фиксирует сам игрок своим выбором; «бонус» измерим точно. Минус: это решение второго порядка, его надо показывать интерфейсом.

**Г. Вторая мини-рука.** Четыре оставшиеся кости оцениваются отдельной таблицей (Crag для трёх костей или пуш в духе Farkle). Минус: вторая таблица, которую нужно объяснять, и возвращение «пар из четырёх костей» — ровно того, на что жаловались.

**Д. Сброс и сжигание.** Реролл стоит запечатывания одной кости (фокус в Elder Sign), либо оставшиеся кости тратятся как валюта (трек раундов в Sagrada). Плюс: остаток становится ресурсом. Минус: ещё одно состояние кости и ещё одна экономика поверх рероллов.

**Е. Общие кости (community).** Две змейки уровня делят одну-две клетки, как борд в Hold'em. Геометрически безопасно: две пятиклеточные змейки на девяти клетках всегда пересекаются, а вторая с двумя и более новыми клетками существует всегда. Минус: нужно правило о минимуме новых клеток, и игрок должен понять, что одна кость считается дважды.

**Ж. Золото там, где поднял палец.** Самый изобретательный вариант («Gold Lands»): свежая кость под пальцем становится золотой, и направление змейки обретает смысл. Минус: x2 на каждой руке удваивает очки, а направление трассы становится скрытым следствием простого жеста; судьи назвали первые «золота» засадой.

## 3. Почему побеждает перенос

Четыре дизайна из пяти независимо пришли к переносу, и это само по себе результат: ответ на вопрос владельца — конвенция, которую игрок уже знает. Судьи (защитник казуала 39, инженер 41, пазл-дизайнер 37 из 50) выбрали базой «Play Five, Keep Four»; пазл-дизайнер предпочёл «Carry» того же семейства за инструментовку, и именно её мы прививаем: строка «leaves 6 6 2 4» в превью, ряд «LEFT ON THE TABLE» на карточке конца, подсказка, учитывающая остаток.

Точные числа, почему это работает на девяти костях. Среди 36 пятиклеточных змеек на свежей доске лучшая рука — минимум тройка в 92,4 % случаев, минимум фулл-хаус в 80,9 %, а пара — лучшая рука лишь в 0,01 % (перебор всех 6^9 = 10 077 696 досок). Игрок больше не ищет пару, он выбирает между фулл-хаусом, стритом и каре. При этом одинаковых по очкам змеек на доске обычно несколько, так что «какие четыре оставить» — живое решение на большинстве банков. В примере ниже два каре по 30 очков различаются только тем, что одно оставляет 6-6-6, а другое 6-6: шанс каре или лучше после добора 46,1 % против 22,4 % (точный перебор 7776 доборов, воспроизведён в этой сессии на геометрии прототипа).

Перенос отвечает обеим догадкам владельца, не добавляя правила: оставшиеся кости и есть «случайные фиксированные» (брошены раньше и не перебрасываются, если удержаны), но фиксирует их игрок, а не сдача; и они же «положительный бонус», потому что заготовка переносится в следующую руку. Пипсы по-прежнему не считаются: ничего в рекомендации не требует складывать грани. Спорный пункт «пара единиц равна паре шестёрок» остаётся формально верным, но на девяти костях пары почти никогда не играются, а в руках «n одинаковых» грань не важна ни в одном покере.

И это самый дешёвый вариант: в движке уже есть добор, lastRefill, флаги bonusIndex null, endOnTarget, autoBonusOnFinalHand, sealedMask; интерфейс уже рисует бейдж x2 и анимацию добора. Дельта — таблица, цели, тай-брейк подсказки, тексты и тесты, около дня работы.

## 4. Полные правила

1. Поле 3×3, девять обычных d6, клетки 0–8 построчно, соседство только по сторонам. Золотой клетки нет: все девять клеток — кости.
2. Уровень: 3 руки, 2 общих реролла, один x2, видимая цель. HUD: РУКА n/3 · РЕРОЛЛЫ ·· · x2 · СЧЁТ / ЦЕЛЬ.
3. Рука — ровно пять костей: нажать кость, провести через четыре соседние (без диагоналей и повторов), отпустить. Любая из 36 змеек легальна всегда; стража нет.
4. Отпускание на змейке короче пяти отклоняется строкой «Trace 5 dice (n/5)», доска не меняется; шестую кость трасса не принимает.
5. Превью под пальцем: «3/5», затем «FULL HOUSE 20», при взведённом или автоматическом x2 «· x2 = 40», и всегда «· leaves 6 6 2 4» — четыре грани, которые останутся. «NO MATCH 0» выводится предупреждающим стилем.
6. Оценка: пять граней — одна покерная рука по таблице; категории взаимоисключающие, побеждает старшая; пипсы не считаются; флеша нет; стрит — ровно 1-2-3-4-5 или 2-3-4-5-6; малого стрита нет.
7. Таблица: пять одинаковых 50, каре 30, стрит 25, фулл-хаус 20, тройка 10, две пары 5, пара 2, ничего 0.
8. Банк необратим; после банка пять сыгранных клеток немедленно получают свежие кости из сид-потока добора (`seed/refill/attempt n`) в порядке трассы, без удержания; четыре остальные сохраняют грань, место и удержание.
9. Удержание: тап по кости переключает кольцо HOLD; бесплатно и без лимита; удержанные кости пропускаются рероллом; удержание держится до повторного тапа или до розыгрыша кости; перенесённые кости сохраняют удержание.
10. Реролл перебрасывает все неудержанные кости (перенесённые и свежие) из потока `seed/rerolls/attempt n` и тратит один из двух рероллов уровня; кнопка показывает, сколько костей изменит («REROLL 6»); недоступна без рероллов или при девяти удержаниях.
11. x2: один на уровень, бейдж под полем там, где у Snake 4+4 стоит статус золотой клетки. Тап взводит (следующая банкованная рука удваивается, бейдж гаснет), повторный тап снимает. Если x2 не использован к третьей руке, он применяется к ней автоматически.
12. Конец уровня: как только счёт ≥ цели после любого банка — победа, оставшиеся руки и рероллы сгорают и показываются звёздами (победа первой рукой 3, второй 2, третьей 1). Если после третьего банка счёт < цели — поражение.
13. RETRY воспроизводит ту же стартовую доску с attempt+1 (новые потоки реролла и добора). NEXT применяет правило тиров: победа → тир +1, поражение → тир −1, в пределах 1–5.
14. Цели по тирам: 60 / 75 / 90 / 100 / 110. Генератор берёт первую из 32 сид-кандидатных досок, где лучшая стартовая змейка ≤ 30 (сданных пяти одинаковых не бывает).
15. HINT подсвечивает лучшую змейку с учётом x2; равные по очкам змейки ранжируются по числу одинаковых граней среди оставшихся четырёх; подсказка называет остаток.
16. Всё воспроизводимо: стартовая доска, доборы и рероллы из сидов; кости равномерны; экран помощи печатает шансы из 7776 и шансы лучшей змейки на свежей доске.
17. Запечатанные кости (sealedMask) в базовых правилах отсутствуют и остаются мутатором для старших тиров.

«Не более пяти» сведено к «ровно пять»: любой четырёхклеточный путь на 3×3 продолжается до пяти, пятая кость никогда не понижает категорию, а короткие змейки потребовали бы второй таблицы.

## 5. Таблица рук

| Рука | Очки | Исходов из 7776 | Один бросок | Лучшая змейка на свежей доске |
|---|---|---|---|---|
| Пять одинаковых | 50 | 6 | 0,08 % | 1,90 % |
| Каре | 30 | 150 | 1,93 % | 18,12 % |
| Стрит | 25 | 240 | 3,09 % | 30,11 % |
| Фулл-хаус | 20 | 300 | 3,86 % | 30,76 % |
| Тройка | 10 | 1200 | 15,43 % | 11,54 % |
| Две пары | 5 | 1800 | 23,15 % | 7,56 % |
| Пара | 2 | 3600 | 46,30 % | 0,01 % |
| Ничего | 0 | 480 | 6,17 % | 0,00 % |

Сумма 7776, категории взаимоисключающие. Стрит стоит выше фулл-хауса, потому что на костях он реже (240 против 300); обе колонки печатаются рядом с таблицей, иначе карточные игроки сочтут порядок ошибкой. «Ничего» реже пары, но остаётся на нуле по покерной традиции; на девяти костях оно никогда не лучший вариант, так что банк «ничего» — всегда промах, и превью об этом кричит.

## 6. Экономика и калибровка

Прогон ботов репозитория в этой сессии именно под этой экономикой (девять костей, 3 руки, 2 реролла, таблица выше, 1500 уровней, отбор доски ≤ 30): наивный бот — среднее 91,5 (p10 75, медиана 90, p90 110); жадный — 112,2 (p10 80, медиана 105, p90 150). Доля побед при целях 60 / 75 / 90 / 100 / 110: наивный 99,5 / 90,3 / 62,9 / 32,5 / 12,8 %; жадный 98,3 / 95,8 / 86,9 / 71,0 / 49,4 %. Лестница даёт тир 1 как обучение, тир 2 как норму, тиры 3–4 как место, где разница между «взял лучшую руку» и «подумал об остатке и рероллах» решает исход, тир 5 для упорных. Калибровка пока только ботами; после первых 50 человеческих уровней цели двигаются шагом 5.

Удержание тройки и реролл остальных шести даёт каре или лучше в 55,1 % и пять одинаковых в 11,9 % (точный перебор 46 656 исходов). Это и есть знакомая петля Yahtzee, и кнопка честно сообщает, сколько костей изменит.

Представление x2: золотой угловой клетки больше нет, поэтому x2 живёт как бейдж под полем («x2 READY · TAP TO ARM», «x2 ARMED», «x2 USED», на третьей руке «x2 AUTO»). Это самая безопасная форма для новичка: бонус нельзя потерять. Золотая кость, через которую надо провести змейку, остаётся флагом goldMode для внутреннего A/B.

## 7. Пример уровня

Тир 2, цель 75. Стартовая доска (строки сверху): 4 4 4 / 2 4 6 / 6 6 1. Две змейки дают каре по 30: 2-1-0-3-4 (4,4,4,2,4) оставляет 6,6,6,1 в клетках 5,6,7,8; 0-1-2-5-4 (4,4,4,6,4) оставляет 2,6,6,1. Превью называет остаток, подсказка предпочитает первую: шанс каре или лучше после добора 46,1 % против 22,4 %. Рука 1: 2-1-0-3-4, КАРЕ 30, счёт 30. Добор клеток 0–4: 2,3,3,5,2; доска 2 3 3 / 5 2 6 / 6 6 1. Лучшее сейчас — тройка (10). Тап по трём шестёркам (клетки 5,6,7), REROLL 6: кости 0,1,2,3,4,8 → 4,2,6,3,5,1; доска 4 2 6 / 3 5 6 / 6 6 1. Рука 2: 2-5-8-7-6 (6,6,1,6,6), КАРЕ 30, счёт 60 < 75, уровень продолжается. Добор клеток 2,5,8,7,6: 5,2,5,4,5; доска 4 2 5 / 3 5 2 / 5 4 5. Рука 3, x2 автоматический: 2-1-4-5-8 (5,2,5,2,5), ФУЛЛ-ХАУС 20 × 2 = 40; превью показывает, что 60 + 40 ≥ 75, поэтому последний реролл не тратим. Счёт 100, победа, одна звезда, следующий уровень — тир 3 (90). Грани получены движком прототипа из сида, шансы — точный перебор.

## 8. Риски

- Перенос невидим, если интерфейс его не показывает: анимация должна крутить только пять клеток, превью — называть остаток, первые уровни — помечать четыре кости тегом STAYS. Иначе режим читается как «просто кидаю кости».
- Нижние строки таблицы декоративны: пара и две пары почти никогда не лучшая змейка. Пока оставляем знакомую лестницу из восьми строк.
- Стрит выше фулл-хауса вызовет комментарии «таблица неправильная»; защита — колонка шансов.
- Узкая полоса очков при плоских номиналах (наивный p10 75, p90 110): лестница целей требует тонких шагов и человеческих данных.
- Конец по цели плюс два общих реролла делают линию «удержал тройку, перебросил дважды, взвёл x2» ответом на тиры 1–3 для умелого игрока. Это знакомая петля Yahtzee, а не баг, но если логи покажут её в большинстве уровней, пробуем один реролл на руку.
- Бейдж x2 для новичка не решение (авто), для эксперта — правило «взводи на 30+». Пространственный бонус восстанавливается флагом золотой кости.
- Реролл задевает неудержанные перенесённые кости: игрок может разрушить задуманный остаток, забыв удержать. Метка «REROLL 6» — первая защита, автоудержание остатка — запасная настройка.
- Уровень длится около 40 с против 30 с в Snake 4+4; вариант с двумя руками — одна настройка.
- Калибровка только ботами; реальные игроки окажутся между наивным и жадным.
- В сравнении вкладок движется сразу семейство правил (размер руки, число костей, число рук, страж, конец уровня); часть выигрыша в ясности даст отсутствие отказов, а не покер.

## 9. План A/B

Внутрисубъектный дизайн с чередованием порядка: каждый тестер играет 10 уровней в одной вкладке, потом 10 в другой; половина начинает со Snake 4+4. Один сид на тестера, чтобы доски воспроизводились. Главные метрики — ясность и трение: время до первого принятого банка на уровнях 1–3; отклонённые трассы на уровень по кодам (у Snake 4+4 — застревание и длина, у Poker 5 — только длина); открытия помощи и подсказки; проверка в два тапа после 3-го и 10-го уровня («что ты только что собрал?» — четыре названия рук; «какое число нужно набрать?»); самооценка «понял, что делать» и «было весело» по шкале 1–5 и финальный выбор вкладки. Второстепенные: длительность уровня, доля побед по тирам и достигнутый тир, повторы, брошенные уровни, уровни за сессию. Сигналы глубины для Poker 5: доля банков, где выбрана не самая дорогая змейка, но с лучшим остатком; доля рероллов с удержанной готовой рукой; момент x2 (рука, взведён или авто); доля побед первой, второй, третьей рукой; доля уровней, где оба реролла ушли на первую руку. Логируем построчно JSON: сид, уровень, тир, цель, попытка, события трассы, банка, отказа, удержания, реролла (маска удержаний, число изменённых костей), x2, подсказки, помощи, конца уровня (победа, счёт, звёзды, длительность) и ответы на вопросы. Решение: Poker 5 становится вкладкой по умолчанию, если отказы падают минимум вдвое, проверку «что собрал» проходят не менее 80 % и больше, чем в Snake 4+4, вкладку предпочитают не менее 60 %, а брошенные уровни и «весело» не хуже.

## 10. Альтернативы

1. **Carry с одним рероллом на руку**: та же игра, но реролл «используй или потеряй» на каждой руке. Предпочесть, если логи покажут, что оба реролла почти всегда уходят на первую руку, или если игроки копят рероллы и не тратят. Цена — иная экономика, чем у Snake 4+4.
2. **Золотая кость x2 («Spend Five, Keep Four»)**: x2 как кольцо на кости, двойная рука только при проходе через неё; бонус тянет против остатка. Предпочесть, если владельцу не хватает пространственного x2 из Snake 4+4 или если x2 оказался не-решением. Нужны пульсирующее кольцо и подсказка на последней руке, так как золото не применяется само.
3. **Четыре якоря (фиксированные углы)** только как босс-тир через sealedMask без кикера. Предпочесть, если игроки прямо просят «случайные фиксированные кости» или тиры 4–5 кажутся «просто бросанием».

## 11. Открытые вопросы

Конец по цели или всегда три руки; таблица 50/30 или 60/40; порядок стрита и фулл-хауса после реакции тестеров; человеческая калибровка целей; бейдж или золотая кость; два общих реролла или один на руку; автоудержание остатка; уступка пипсам для пары и двух пар, если жалоба повторится; длина уровня и вариант с двумя руками; отдельный контроль без стража в Snake 4+4, чтобы отделить эффект размера руки.
