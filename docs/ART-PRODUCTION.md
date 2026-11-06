# Dice Snake — арт-продакшн: движок, анимация, ассеты, промпты

Версия 1 · 31 октября 2026 · основа для генерации ассетов в ChatGPT и для переноса их в игру.

## 1. Коротко

- **Движок на старте: веб (HTML/CSS/JS), как сейчас.** Правила живут в чистом JS-модуле с 53 тестами и не зависят от рендера. Рендер — DOM + CSS 3D для костей, Canvas 2D для частиц. Этого хватает на 60 fps для 9 костей на среднем телефоне, игра открывается по ссылке, собирается в один файл, обновляется за секунды.
- **Движок для продакшена: PixiJS 8 (WebGL) поверх того же JS-ядра, упаковка Capacitor (iOS/Android) или PWA.** Переход нужен, когда появятся спрайтшиты, шейдеры (свечение, чернильное растекание) и больше 30–40 анимируемых слоёв одновременно. Unity/Godot — только если потребуются стор-специфичные вещи (3D-физика костей, нативные SDK), и тогда JS-тесты становятся спецификацией для порта.
- **Ассеты делаем «конструктором», а не мокапами:** тело кости без точек + одна точка (pip), чтобы собирать любые грани; 9-slice рамки и панели; отдельные спрайты частиц. Так один стиль закрывает оба режима и все состояния, а генерация даёт изолированные элементы на прозрачном фоне, которые сразу вставляются в CSS/Canvas.
- **Один стиль за раз.** Сначала «стиль-лист» (один референс-кадр), потом все ассеты с его референсом, чтобы материалы и свет совпадали.

## 2. Движок: сравнение и решение

| Критерий | DOM + CSS 3D + Canvas (сейчас) | PixiJS 8 / Phaser 3 (WebGL) | Godot 4 / Unity |
|---|---|---|---|
| Дистрибуция | Ссылка, PWA, один HTML-файл | Ссылка, PWA, Capacitor в сторы | Только сторы (web-экспорт тяжёлый) |
| 60 fps на среднем Android | Да при 9 костях, анимируем только transform/opacity | Да, сотни спрайтов и частиц | Да |
| 3D-кости | CSS-куб из 6 граней, кувырок через rotateX/Y | Псевдо-3D спрайтшит или three.js | Настоящая физика бросков |
| Шейдеры (свечение, растекание чернил, пергаментная рябь) | Нет (только CSS-фильтры, дорого) | Да | Да |
| Текст и доступность | Нативный DOM, идеальная чёткость, озвучка экрана | Bitmap/Canvas текст, нужна забота | Движковый UI |
| Пайплайн ассетов | PNG/SVG, border-image для 9-slice | Атласы (TexturePacker), спрайтшиты, Spine/Lottie | Импорт в редактор |
| Размер сборки | ~140 KB сейчас | +400–900 KB библиотеки | Десятки МБ |
| Риск переноса правил | 0 (то же ядро) | 0 (то же ядро) | Порт на C#/GDScript по тестам |
| Когда выбирать | Гипотезы, плейтесты, первые 2–3 месяца | Полировка, богатые эффекты | Стор-требования, 3D-физика |

Решение: **стадия 1 — DOM/CSS/Canvas (уже есть), стадия 2 — PixiJS с тем же ядром**, упаковка Capacitor. Критерии перехода на стадию 2: нужны шейдерные эффекты, больше 3 одновременных частичных систем, спрайтшитовые анимации длиннее 12 кадров, или замер показывает просадки ниже 50 fps на целевом устройстве (Pixel 6a / iPhone 12 класса).

## 3. Что умеет анимация на стадии 1 (и как это используем)

| Приём | Технология | Где в игре |
|---|---|---|
| Кувырок кости в 3D | CSS-куб: 6 граней в `transform-style: preserve-3d`, `perspective` на доске, ключевые кадры `rotateX/Y/Z` с подскоком и приземлением | REROLL: подъём, 1–2 оборота, стук, дрожание |
| Задержка каскадом | `animation-delay` по индексу кости (45–60 мс) | REROLL, пополнение в Poker 5 |
| Падение новых костей | keyframes с `translateY(-45%) scale(.55)` → отскок (cubic-bezier с перелётом) | Refill после банка |
| Линия пути | SVG polyline, `stroke-dasharray` для прорисовки, `drop-shadow` свечение; текстурный мазок через `stroke` паттерн | Трассировка змейки, подсказка, туториал |
| «Призрачный палец» | Web Animations API по точкам клеток | Туториал |
| Раскрытие категории | Масштаб + подъём + затухание, печать («stamp») через `scale(1.6→1)` с резким easing | Банк руки: FULL HOUSE +20 |
| Частицы | Canvas 2D-слой поверх доски: 100–300 частиц, `requestAnimationFrame` | Чернильные капли, угольки, золотые искры, пыль |
| Микро-отклик | `transform: scale(.95)` 100–120 мс, `box-shadow` смена, хаптика `navigator.vibrate` (Android), Capacitor Haptics (iOS) | Тап, холд, арм ×2 |
| Мерцание света | Анимация прозрачности радиального градиента 2–3 с | Факел в Keep, свеча в Tavern |
| Прокрутка свитка | `clip-path: inset()` + `scaleY` | Панели итога и помощи |
| Lottie (по желанию) | lottie-web, JSON от дизайнера | Восковая печать, лента, фанфара |

Правила производительности: анимируем только `transform` и `opacity`; `will-change: transform` на кости только на время броска; никаких `filter: blur` на больших слоях; фон — один статичный слой; `prefers-reduced-motion` отключает кувырок и частицы (оставляем мгновенные состояния).

## 4. Разбор на ассеты

Общие требования к генерации: изолированный объект, **прозрачный фон**, ортографический вид сверху (кости, плитки, панели) или фронтально (иконки), свет сверху-слева, без текста кроме указанного, 1024×1024 для квадратных, без перспективы. Имена файлов: `{style}/{category}_{name}_{state}@2x.png` (SVG — где возможно). Стили: `manuscript`, `tavern`, `keep`, (`reliquary` как кандидат).

### 4.1 Кости (ядро)

| Ассет | Спецификация | Состояния | Как встраиваем |
|---|---|---|---|
| Тело кости без точек | 1024×1024, скруглённый куб сверху, фаска и материал (кость/гранит/чернёное дерево), прозрачный фон | normal, held (накладка: лента/скоба/печать), cut-off (красная накладка), empty slot (углубление в доске) | `background-image` клетки; точки рисуем CSS (`.face i`) |
| Точка (pip) | SVG или 256×256 PNG, одна точка с тенью/вдавленностью | — | 9 позиций через существующую сетку |
| Боковые грани куба (для 3D-кувырка) | 1024×1024, 4 боковые + нижняя, тот же материал | — | CSS-куб; опционально |
| Накладка HOLD | 1024×1024, лента/скоба/сургуч через кость, с надписью-слотом | — | Поверх кости, `.held` |
| Накладка CUT OFF | 1024×1024, красный крест/обрыв цепи | — | `.stranded` |
| Пустой слот | 1024×1024, углубление в подносе/камне/пергаменте | — | `.empty` |

### 4.2 Бонус ×2

| Ассет | Спецификация | Состояния |
|---|---|---|
| Плитка ×2 | 1024×1024: сусальная плитка / золотая монета / щит с гербом; знак «×2» встроен | ready (блеск), armed (свечение, пульсация — делаем в CSS), used (потускнение) |

### 4.3 Доска и фон

| Ассет | Спецификация |
|---|---|
| Рамка доски | 9-slice 1024×1024, углы с орнаментом (узлы, латунные уголки, кованые заклёпки), центр прозрачный; указать толщину краёв для `border-image-slice` |
| Поверхность доски | 1024×1024 бесшовная (кожа подноса, камень, пергамент) |
| Фон экрана | 1080×2340 портрет, тёмные зоны под HUD и кнопки, без мелких деталей по центру; отдельный слой виньетки/света 1080×1080 |

### 4.4 HUD и панели

| Ассет | Спецификация |
|---|---|
| Плашка SCORE / TARGET | 9-slice 512×256 (вертикальные края), вариант с лентой/баннером |
| Лента уровня (LEVEL · TIER) | 9-slice 768×192 |
| Медальон руки (HAND 1/3) | 256×256, три состояния заполнения |
| Пипсы рероллов | 128×128 ×2 (полный/пустой): монетка, свеча, руна |
| Панель итога уровня (LEVEL CLEARED / TARGET MISSED) | 9-slice 1024×1024 свиток/пергамент/каменная плита; заголовок-лента 1024×256 ×2 (победа/поражение) |
| Панель помощи и онбординга | та же 9-slice панель |
| Полоса туториала (coach) | 9-slice 1024×192 с местом под номер шага |

### 4.5 Кнопки и иконки

| Ассет | Спецификация | Состояния |
|---|---|---|
| Кнопка primary (REROLL) | 9-slice 1024×256 | normal, pressed, disabled |
| Кнопка secondary (BANK LAST 4, RETRY) | 9-slice 1024×256 | normal, pressed, disabled |
| Кнопка small (HINT, PATH MODE, LOOK, HELP) | 9-slice 512×192 | normal, pressed, active |
| Вкладка режима (SNAKE 4+4 / POKER 5) | 9-slice 768×160 | active, inactive |
| Иконки 24/32 px (SVG) | reroll (стаканчик), hint (фонарь), path (перо/палец), look (палитра), help (свиток), hold (замок/скоба), ×2, cut-off (разорванная цепь), undo, close | моно-цвет, заливка из токена |

### 4.6 Путь и эффекты

| Ассет | Спецификация | Использование |
|---|---|---|
| Мазок пути | бесшовный 512×128 (чернила/уголь/золотая нить) + концы 128×128 | SVG stroke-паттерн |
| Нумерованные бейджи 1–5 | 128×128 (сургучная капля, монетка, гвоздь) | `.order` |
| Частицы | 128×128 каждая: капля чернил, уголёк, искра, пылинка, лепесток золота | Canvas-слой |
| Печать банка | 512×512 восковая печать / чернильный штамп + вариант «×2» | Раскрытие категории |
| Лента категории | 9-slice 1024×256 для текста FULL HOUSE +20 | Поверх доски |
| Призрачный палец | 256×256 перчатка/рука с пером | Туториал |

### 4.7 Типографика (без генерации, лицензия SIL OFL)

| Роль | Manuscript | Tavern | Keep |
|---|---|---|---|
| Заголовки | Uncial Antiqua | Pirata One | MedievalSharp |
| Цифры и метки (табличные цифры!) | Cinzel | Cinzel | Cinzel |
| Текст | IM Fell English | IM Fell English | IM Fell English |

### 4.8 Звук (следующий этап)

Шейк и бросок костей, стук при приземлении, тик при добавлении кости в путь, глухой удар/печать при банке, звон монеты для ×2, короткая фанфара победы, низкий аккорд поражения. Формат OGG + M4A, до 200 КБ на звук.

## 5. Порядок генерации в ChatGPT

1. **Стиль-лист.** Один кадр со всеми ключевыми материалами рядом: кость, бонус-плитка, уголок рамки, кнопка, иконка, фон. Промпт ниже (5.1). Выбираем лучший, он становится референсом для всех последующих запросов («в том же стиле, что на приложенном изображении»).
2. **Кости и бонус** (4.1–4.2) — самое важное, 70 % ощущения игры.
3. **Рамка, поверхность, фон** (4.3).
4. **Кнопки и панели** (4.4–4.5).
5. **Эффекты** (4.6).
6. Проверка на телефоне: контраст точек на кости не ниже 4.5:1, читаемость цифр HUD при 11–12 px, узнаваемость состояний HOLD/CUT OFF с расстояния вытянутой руки.

Что генерация делает плохо и что берём не из неё: последовательности кадров (кувырок) — делаем CSS-кубом; текст — только шрифты; бесшовные текстуры — просить явно «seamless tile», проверять в редакторе; одинаковый свет между ассетами — всегда прикладывать стиль-лист.

### 5.1 Промпты (вставлять по одному; просить 2–3 вариации)

Стиль-лист:

```
Style sheet for a medieval mobile dice game, single image, flat lay on {parchment with ink stains / dark oak tavern table in candlelight / grey castle stone with torchlight}. Items side by side: one blank six-sided die carved from {ivory / bone / granite} with soft bevels, one single black pip, one gold "x2" tile ({gold-leaf square / gold coin / small heraldic shield}), one ornate frame corner ({Celtic knotwork / brass corner with rivets / wrought-iron corner}), one wide button plate ({ink-outlined parchment / brass plate / gold-trimmed stone}), one small round icon badge. Consistent light from top-left, orthographic top-down view, no text, no hands, no photo realism of people, clean edges, high detail.
```

Кость:

```
Blank six-sided die seen exactly from above, carved from {material}, soft rounded bevels, subtle wear, no pips, no numbers, centered, transparent background, orthographic, light from top-left, 1024x1024, in the same style as the attached style sheet.
```

Точка:

```
A single die pip: round black {ink / burnt / chiselled} dot with slight inset shadow, centered, transparent background, 256x256, same style as the attached style sheet.
```

Накладка HOLD:

```
Overlay for a held die: a {lapis-blue silk ribbon / brass clamp / iron shackle} crossing a square area diagonally, with an empty plate for a short word, transparent background, 1024x1024, top-down, same style as the attached style sheet.
```

Бонус ×2:

```
Game tile with a bold "x2" mark: {gold-leaf square with illuminated ornament / thick gold coin with embossed edge / heraldic shield split red and blue with gold trim}, three versions side by side: shiny, glowing, tarnished; transparent background, top-down, same style as the attached style sheet.
```

Рамка доски (9-slice):

```
Square decorative frame for a 3x3 game board, empty transparent center, ornate corners ({knotwork / brass corners with rivets / wrought iron with studs}), straight repeatable edges between corners, 1024x1024, transparent background, same style as the attached style sheet.
```

Фон:

```
Portrait phone background 1080x2340, {aged parchment with faint marginalia and gold vignette / dark oak table with wood grain and warm candle glow at the top / castle stone wall with torch glow at the top}, calm center area without small details, darker top and bottom bands, no text, no objects.
```

Кнопка (9-slice):

```
Wide game button plate 1024x256, {ink-outlined parchment scroll end / embossed brass plate with rivets / gold-trimmed carved stone}, empty center for text, three versions stacked: normal, pressed (darker, inset), disabled (faded); transparent background, same style as the attached style sheet.
```

Иконки:

```
Set of 10 small monochrome game icons on transparent background, uniform stroke, medieval style: dice cup, lantern, quill, palette, scroll, padlock, "x2", broken chain, curved undo arrow, cross. Arranged in a grid, each inside a 256x256 cell, no labels.
```

Частицы и печать:

```
Sprite sheet of particle elements on transparent background, each in its own 128x128 cell: ink drop, glowing ember, gold spark, dust mote, gold leaf flake. Plus one 512x512 {red wax seal / ink stamp / embossed iron stamp} with an empty center. Same style as the attached style sheet.
```

## 6. Как ассеты встают в текущий код

- Облик = набор CSS-токенов (`body[data-look="…"]`) — уже есть; добавляем токены `--die-img`, `--pip-img`, `--frame-img`, `--btn-img`, `--panel-img`.
- Кость: `.cell.die { background: var(--die-img) center/cover }`; точки остаются CSS-элементами (`.face i` с `background: var(--pip-img)`), поэтому любая грань собирается без 6 отдельных картинок.
- Рамка и панели: `border-image: var(--frame-img) 160 / 20px round` (slice по краям, указанным при генерации).
- Кнопки: `border-image` + 3 состояния через `:active` / `:disabled`.
- 3D-кувырок: клетка получает дочерний `.cube` с 6 гранями, у которых одинаковое тело кости; на время броска включаем `preserve-3d`.
- Частицы: один `<canvas>` поверх доски, спрайты из 4.6, пул 300 объектов, выключается при `prefers-reduced-motion`.
- Размеры: @2x PNG для телефонов, SVG для иконок и pip; общий бюджет ассетов на один облик — до 3 МБ, фон до 500 КБ (WebP).

## 7. Следующие шаги

1. Выбрать 1–2 облика из трёх (Manuscript / Tavern / Keep) для генерации.
2. Сгенерировать стиль-лист, прислать сюда, согласовать.
3. Кости + бонус + рамка — первая партия; встраиваю, делаю CSS-куб и частицы, присылаю сборку.
4. Кнопки, панели, иконки — вторая партия; затем звук.
5. Замер fps на целевом телефоне; решение о переходе на PixiJS по критериям из §2.
