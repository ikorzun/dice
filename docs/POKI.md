# DICEFOOL на Poki — требования, что сделано, решения владельцу

Сборка: `npm run build` → `dist/poki/` (страница с SDK Poki в `<head>`, three.js, `acts/` и `portal/` рядом).
Слой SDK — `src/ui/platform.js` (ветка `PokiSDK`), проверка — блок «Poki build» в `scripts/smoke.mjs`.
Ничего не отправлено в Poki for Developers, аккаунтов и заявок нет.

Источники (читаны 18.11.2026):
- SDK: https://developers.poki.com/guide/sdk-html5
- Требования и качество: https://developers.poki.com/guide/requirements-quality
- Превью: https://developers.poki.com/guide/game-thumbnail
- Страница игры, анимированное превью: https://developers.poki.com/guide/your-game-page
- Быстрый доступ, загрузка по этапам, портрет: https://developers.poki.com/guide/easy-access
- Размер: https://developers.poki.com/guide/web-game-engines («начальная загрузка ≤ 5 МБ, всего 8 МБ»; страница требований числа не даёт, сторонние гайды пишут 8 МБ)

## Требования и отметки

| Требование (источник) | Состояние |
|---|---|
| Скрипт `game-cdn.poki.com/scripts/v2/poki-sdk.js` в `<head>`, `PokiSDK.init()`, играть дальше при любом ответе (SDK) | ✅ `setupPoki`: init с таймаутом 10 с, при ошибке и без SDK игра идёт |
| `gameLoadingFinished()` (SDK) | ✅ `gameReady`: когда первый экран принимает касания |
| `gameplayStart` на первом вводе игрока, не на загрузке (requirements) | ✅ уровень «хочет» старта, ввод (pointerdown) запускает |
| `gameplayStop` при любом прерывании: конец уровня, пауза/скрытая вкладка (requirements) | ✅ конец уровня (победа и поражение), `visibilitychange` |
| События не дважды подряд, ни одного во время рекламы (requirements) | ✅ флаги `playing`/`ad`; smoke проверяет |
| `commercialBreak` только при возврате в игру, перед `gameplayStart` (SDK, requirements) | ✅ в `onNext` (тап с итога уровня), там же, где межстраничная Playgama; `gameplayStart` ждёт конца паузы |
| Звук выключен во время рекламы (requirements) | ✅ колбэк `commercialBreak` → `setHostSilent` + пауза таймеров (`holdGame`); после рекламы возврат |
| `rewardedBreak` | ➖ в игре нет награды за рекламу; не используется (см. решения) |
| Реклама только Poki, без своих таймеров, без сплэшей и исходящих ссылок (requirements) | ✅ ссылок в игре нет. ✅ сплэш-портал убран в Poki-сборке (владелец, 18.11): сборка вырезает его элемент, доска открывается сразу; в остальных сборках он на месте |
| Все внешние запросы блокируются; шрифты, библиотеки внутри сборки (requirements) | ✅ Google Fonts убраны, three.js в `vendor/`, сборка падает, если что-то указывает наружу; smoke ловит запросы вне папки |
| Сохранения: localStorage в try/catch (инкогнито) (requirements) | ✅ `platform.js` уже так пишет; у Poki нет облачного хранилища, сохранения — в localStorage iframe |
| Нет покупок внутри игры (requirements) | ✅ валюта в игре — «колокола» за игру, не за деньги |
| Мобильные: портрет и/или ландшафт на весь экран, плюс планшеты (requirements, easy-access) | ✅ портрет — основной (Poki его особо поощряет), ландшафт и десктоп — свои макеты |
| Десктоп: кадр 16:9, масштаб к 640×360 / 836×470 / 1031×580 (requirements) | ⚠️ у игры десктопный макет Figma не точно 16:9, в рамке Poki поля. Проверить в Poki Inspector |
| Размер, загрузка < 10 с (requirements, web-game-engines) | см. ниже |
| Катсцены пропускаемы (requirements) | ✅ в Poki-сборке сплэша нет |
| Убрать отладку (requirements) | ✅ `?dev` скрыт; `window.__diceSnake` — тестовый крючок, можно убрать в Poki-сборке (решение) |
| Превью 628×628 + анимированное (thumbnail, your-game-page) | список ниже |

## Проверки (18.11.2026, без звука)

- `npm test` 176/176; `npm run build` ок; `npm run smoke` (Chromium) — `smoke OK`, в нём блок «Poki build» со стендом SDK.
- `art/check-poki.mjs` (локальный, не в git; `BROWSER=webkit NODE_OPTIONS=--import=./art/mute.mjs`): Chromium и WebKit, телефон 402×874 и 874×402, десктоп 1280×800 — init → loaded → один start, без ошибок страницы, единственный внешний запрос — SDK Poki. Реклама между уровнями проверена только в Chromium (smoke).
- Не проверено: настоящий SDK Poki и Poki Inspector (нужна загрузка игры в Poki — без слова владельца не делал); WebKit на iOS Simulator с панелями Safari.

## Что качается до первого кадра

Измерено в `dist/poki/` (после `npm run build`):

| Часть | Вес | Когда |
|---|---|---|
| `index.html` (код, стили, шрифт, UI-картинки — всё внутри) | 3,9 МБ (gzip ≈ 2,5 МБ) | сразу |
| `vendor/three.module.min.js` | 0,66 МБ | при первом броске 3D-кубиков (динамический import, запасной CSS-вариант) |
| SDK Poki | с их CDN | сразу |
| `acts/*.avif` (19 файлов, 0,5–2,9 МБ) | 26 МБ | по требованию: появление карты, включение, розыгрыш; следующий хранитель греется заранее (`warmAct`) |
| `portal/*` | 3 МБ | по требованию (`warmPortal`, `playPortal`) |

Начальная загрузка ≈ 4,6 МБ без сжатия (≈ 2,7 МБ по сети с gzip) — под 5 МБ, под 10 с. Ленивая загрузка героев и порталов уже есть в игре, добавлять нечего. Весь `dist/poki` — 41 МБ: ⚠️ если у Poki действительно «8 МБ всего», анимации героев (26 МБ) не влезут; тогда нужна версия без `acts/` (портреты стоят неподвижно, как во фрагменте claude.ai) или пережатие. Решение владельцу; глубокая оптимизация — отдельный чат.

## Тексты карточки (английский, черновик)

- **Title:** Dicefool
- **Short description:** Roll, hold and play poker hands with magic dice. Beat every target, meet the keepers, collect strange things. How far can you go?
- **Description:** Dicefool is a dice-poker roguelike for one hand. A grid of nine dice and cards, a target to beat, and a few rerolls. Hold the dice you like, tap PLAY and watch the hand score: pairs, straights, full houses and fives all pay more. Heroes with their own tricks join the board, keepers stand guard at every fifth level, and portals hand you strange things that bend the rules. Spend your bells in the shop, build a pocket of things that fit your luck, and see how deep the run goes. One missed target ends it — then roll again.
- **Instructions:** Tap dice to hold them. Tap REROLL to roll the rest. Tap PLAY to score the hand. Reach the target before you run out of hands. Tap a card to see what it does. (Touch and mouse; no keyboard needed.)
- **Tags (предложение):** puzzle, dice, cards, roguelike, strategy, casual, poker.
- **Controls note:** touch / mouse.

## Картинки по размерам Poki (рисовать только по слову владельца)

1. Статичное превью: квадрат ≥ 628×628, во всю плоскость, без рамок, без закруглений (Poki их добавит), текста лучше нет, избегать цвета фона Poki `#83FFE7`, читаться в малом размере. Предложение: кадр доски с крупной картой героя и кубиками.
2. Анимированное превью (нужно к Soft Release, «до глобального релиза у каждой игры»): mp4, ≥ 1080×1080, квадрат, ≥ 50 fps, 4–6 с, ≤ 100 МБ, без курсора, центр действия, 2–3 сцены по 1–2 с. Запись из реальной игры: бросок → PLAY → огонь/герой на карте → итог.
3. Из загрузочного экрана: логотип студии допускается (картинка владельца).

## Список решений владельцу

1. ~~Сплэш~~ — убран в Poki-сборке по слову владельца.
2. Вес: 41 МБ в сборке из-за анимаций героев. Выкладывать с `acts/` (риск по лимиту) или без них?
3. `rewardedBreak`: в игре награды за рекламу нет. Добавить (например «ещё один ход / переброс после проигрыша»)? Правила Poki: кнопка «Продолжить» не меньше награды, награда не зелёная, значок видео. Это новая механика — только по слову владельца.
4. 16:9 на десктопе: нужен прогон в Poki Inspector (inspector.poki.dev) — он требует загрузки игры в Poki, поэтому не сделан без слова владельца.
5. Подключение игры к Poki for Developers (аккаунт, загрузка, заявка) — только сам владелец.
6. Убрать `window.__diceSnake` из Poki-сборки? (Smoke им пользуется; нужна отдельная проверка.)
7. Поведение при блокировщике рекламы: `commercialBreak` просто возвращается, игра идёт без награды, своих сообщений нет — соответствует.
