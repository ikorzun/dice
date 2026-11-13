# Dice Snake — notes for Claude Code sessions

Portrait-mobile dice puzzle on a 3×3 grid, plain HTML/CSS/JS, no build step for development.
Three rule sets live in one page: **Snake 4+4** (`src/engine/game.js`), **Poker 5**
(`src/engine/poker.js`) and **Auto Hand** (`src/engine/auto.js` + `hands.js`, the run's curve
in `run3.js`; rules, calibration and next steps in `docs/MODE3-PLAN.md`). Since the owner's
Figma mockup (file `0mTCxjPtORKQzV7EZ6kTfE`, section DARK, node 1285:1548) the screen shows Auto
Hand only, as an endless run that a missed target ends; the other modes keep their code and engines but have no tab
(`#tabs` hidden, `app.modeId` forced to `auto`). This branch (`claude/dicefool-portals`) is the owner's portals redesign
(MODE3-PLAN §38): his portraits (`New img/Characters`, packed by `scripts/portraits.py` into `assets/ui/portraits/`) are
the ten heroes of the cards and the nine keepers of every fifth level, still pictures that come alive only in their acts
(`hero-acts.js`, animated AVIF in `assets/ui/acts/`, files beside the page, never inlined: a card when it appears on the board,
is switched on or is played, a keeper on his notification; MODE3-PLAN §38); the cards follow Figma 1339:2155 «Cards»
(§41: each hero's own colours, arch and back, the acting look, the bank's small card; §39 before it); after PLAY a played card stays as it lies and takes the acting look, its hero over the whole card, while he acts (§43), and its act opens with a wave of liquid glass running out of the card across the board, bending what it passes while the dice stay (§53, Upwell's air jump's bend: copies of the cells in nested masked bands; `art/check-bend.mjs`, local); a card's popup (a new kind, a long press) follows Figma 1340:923 / 1333:1761 (§42). The acts' AVIFs carry a full frame every 12 (`pack.py` through libavif's `avifenc`, never Pillow): with only the first one, Safari fell further behind with every frame and the game took the picture away before the act ended (§43). Every start of the page opens with a 3 s portal
splash over the game, which waits under it (Figma 1333:1876, §40, `runSplash`; pictures by `scripts/splash.py`; tests end
it with `__diceSnake.endSplash()`); after it comes the board, with no title even on a first visit (its tutorial is on
the board, the rules are How's pages). The tutorial follows the owner's four mockups (Figma 1340:1340, 1340:1566,
1392:2485, 1392:2641; §46): a notification over the header row, no SKIP, what a step does not use at 20 %
(`data-coach` on `#app`), a «Tap» glow on the cell to tap; on the desktop and a sideways phone his three more (1392:2866,
1392:3100, 1392:3183): the notification in the panel tile's header row, words from the left, LEVEL unseen and no hand's
dice row through the first hand (`data-tutorial`, released only when the board is still), the counter lit; `art/check-tutorial.mjs` (local) walks it in both engines. A keeper's level opens with his notification as Apple's (§48): a banner at the top clear of the board (the panel tile's header row on the desktop, growing only upward), his bust on its bottom edge, his name and his rule in one font at two sizes; it holds the screen as his card did (a clear cover, `#bossCover`, owner 13.11.2026: «верни») and goes by itself or at a tap anywhere (`bossLeaves`); `art/check-keeper.mjs` (local) measures every keeper in both engines. Animation is rigid and smooth, like paper cutouts or animatronics: no squash and
stretch (owner, 11.11.2026). Mockup art lives in `assets/ui/`, the font
(Basteleur Bold, OFL) in `assets/fonts/`; the build inlines both into `dist/`. The screen is one
of two mockups (phone column, or desktop/landscape with the board left of a panel: `body.wide`)
scaled by `--k`, picked by `fitBoard` in `app.js` for the bigger board: write every size as
`calc(Npx * var(--k, 1))`, board sizes with `--kb`. A phone held sideways (a window under 500 px high, `body.side`, §49)
drops the desktop mockup's frame: the board and the panel keep the mockup's proportions, centred, as tall as the safe area.

## Commands

```
npm test          # node:test suites in test/ (must stay green)
npm run build     # dist/index.html (standalone), dist/artifact.html (claude.ai fragment), dist/playgama/ (with the Bridge)
npm run smoke     # Playwright: phone viewports + desktop, the Auto Hand screen, screenshots in dist/shots
npm run sim       # Snake 4+4 balance report -> docs/simulation-latest.md
node scripts/montecarlo5.mjs --table=pips --out=docs/simulation5-pips.md   # Poker 5
npm run sim3      # Auto Hand tiers, bots, experiments -> docs/simulation3-latest.md
node scripts/recipes3.mjs --levels=400       # Auto Hand layout table -> src/engine/recipes3.js (generated)
node scripts/run3-sim.mjs --runs=400 --out=docs/simulation3-run.md  # the run's curve: how far the bots get, to level 60
node scripts/upgrades3.mjs                   # combination upgrades: point shares + expected lift -> src/engine/uplift3.js (generated)
node scripts/model-to-js.mjs                 # die model GLB -> src/ui/dice-model.js (generated)
node scripts/bake-faces.mjs                  # die faces with their matcaps -> assets/dice/ (after any model, matcap or colour change)
python3 scripts/audio.py sfx [name ...]      # sound effects via ElevenLabs (key in the macOS keychain) -> assets/sfx/
python3 scripts/audio.py build name ...      # build effects again from their takes, no credits (SHAPE: chosen take, tuning, high-pass; DERIVED: the keepers' sounds made from other takes)
npm run serve     # python3 -m http.server 8080 -> http://localhost:8080/ (prototypes/dice-anim/ too)
```

Playwright must be installed locally for `npm run smoke` (`npm i --no-save playwright && npx playwright install chromium`).
Locally the CDN loads, so the 3D throw runs in the smoke; it waits for `app.busy` instead of fixed delays.

## Architecture rules

- `src/engine/*` is pure: no DOM, immutable state transitions, every action returns
  `{ ok, state?, code?, message? }`. Dice come from `rng.js` (seeded, rejection-sampled).
- Each mode exposes the same action shape (`create / toggleHold / reroll / toggleBonus /
  previewPath / bankPath / hintFor / snapshot / restore`) so `src/ui/app.js` drives it through
  the `MODES` registry. Add a mode by adding an engine module, a `MODES` entry and smoke steps.
- Scoring tables: `scoring.js` (4 dice) and `scoring5.js` (5 dice). Default table is `pips`
  (sum of the matching dice × rarity multiplier: pair 2, two pairs 3, trips 4, straight and
  full house 5, four 6, five 8). Flat tables remain as experiments.
- Level targets are per table (`levels.js` / `levels5.js`); recalibrate with the simulation
  scripts after any scoring or economy change. Auto Hand: the game plays `generateRunLevel`
  (`run3.js`: one target ladder for everyone; the layout is drawn from `recipes3.js` by the run seed
  and the level number, never from how the player did); tier levels (`levels3.js`) are the bots'
  reference. Regenerate `recipes3.js` after any rule change, then recheck the curve with `run3-sim`.
- `scripts/build.mjs` bundles modules into per-module scopes; it validates import names and
  module order. Dynamic `import()` of CDN URLs (three.js in `src/ui/dice3d.js`) is
  left untouched and must keep its CSS fallback.
- The won level's moment (`playWin` in `app.js`, `shards.js`; the cards stay still while their heroes act, §43) is built to
  GPT's spec in `art/ai/2026-11-04-win-production` (local, not in git; MODE3-PLAN §20): times are ms from PLAY,
  `finishLevel` runs first so a reload shows the cleared screen, a tap skips to the pick. The lost run's moment
  (`playLoss`, `holdLine` in `shards.js`; `art/ai/2026-11-04-loss-production`, §21) mirrors it: `finishLevel(board)`
  keeps the board as played in `lastEnd.board` (the engine has refilled it), never call `render()` during the moment.
  The play screen is the owner's base and nothing else (MODE3-PLAN §33): a fact goes where it changes a tap (`acts.js`: the pick, the receipt, How's THIS RUN page) or comes by an event and leaves by itself; never add a line, count or icon beside the base, and `npm run smoke` checks every text on it against a list. Name things in words, don't invent icons (the strip of nodes of §22 was an unreadable rebus). GPT Image draws pictures only (tools in `art/ai/tools`, local); design, rules, animation and texts are mine, never GPT's (owner, 10.11.2026: «gpt нужен только для картинок»).
- The run's economy lives in `shop3.js` (bells, doors, two shelves: a thing and a +1, fit to the player), `things3.js` (the pocket's things, step 2 of the portals: the owner's objects, pictures by `scripts/things.py`, each rule data with its number by stars, read in the count, the bells and a keeper's level; MODE3-PLAN §54; and the portal after every keeper, step 3: `portalOf` draws its ring, hands and thing from the seed, the depth's rarities, the pocket and the device's gallery `st.gallery`, `playPortal` plays it over the cleared screen before the pick and keeps it in `lastEnd.portal` until TAKE, a place given up, LEAVE +3 or a star; pictures by `scripts/portal.py`, 1000 px files beside the page as the acts; `art/check-portal.mjs` (local); §55; the gallery, step 3b: `CATALOGUE` of the spec's 59 things, `STARTERS`, `shopPool` (the shelf takes the starters and the device's finds of earlier runs, `st.runGallery`), the page `openGallery` from How's GALLERY, `art/check-gallery.mjs` (local); §56; the other seventeen that change only the count, step 3c: the centre die, each joker and card in a hand, five held dice, a card's own number (BRAIN BOOST, PATIENT BEADS, ALL SEEING, +4 at most on a card), bells for a reroll left, a pair or a straight played and a keeper's whole pay ×N (PAIR CHIME wears the money bell, the owner's word); rules short enough for every screen, `art/check-long-rules.mjs` (local); §57) and `bosses3.js` (a keeper every fifth level, from the seed alone; each rule is data, never read by the keeper's id); `hands.js` counts their `rules`, `auto.js` applies them. The heroes open by level (`levels3.js` UNLOCK_LEVEL), the targets are a table (`run3.js`), medals are gone. Offers may look at the player; targets and layouts never do. Rules and numbers: MODE3-PLAN §25–29.
- The shop's screen follows Apple's HIG, the owner's yardstick for UI (MODE3-PLAN §44): one surface, one tile, shared edges, yellow for money and BUY alone, the row as the target, 44 px targets, nothing that is not a control looks like one. `art/check-shop.mjs` (local) measures it in both engines; read HIG as `developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`. The other screens outside his mockups follow, group by group (§45; all four groups done 12.11: the cleared level `art/check-cleared.mjs`, the receipt and best runs `art/check-receipt.mjs`, How and settings `art/check-how.mjs`, the toasts and keeper card `art/check-overlays.mjs`; the coach is his mockups' since, §46): yellow means bells and BUY in the whole game, one primary button a screen as a white capsule (his popup's PLAY), a dark capsule for the second, lime on the board alone; restyle only, the same texts and flows. The owner's four rules from the live shop (12.11.2026, «Применимо везде»): nothing untappable looks like a tappable row (no surface, no frame); no "why offered" tags; a row's picture has no tile behind it and fills its box edge to edge, 20 px from the words; headings and names in classic case (`sentence`, a keeper's name `titled`), small grey labels and buttons in capitals as in his mockups.
- `src/ui/board.js`: best runs on the device, Playgama's table when the Bridge has one. `dist/playgama/` is the only build that loads the Bridge.
- Pixel effects (MODE3-PLAN §47), off unless the address has `?fx` (asked to judge them critically, I found their pixel look foreign to the game's drawn effects; the owner decides): pixelfx (MIT) is vendored into `vendor/pixelfx/` by `scripts/pixelfx.py` (import lines only, for the build), and `src/ui/pixel-fx.js` plays an effect once in a small pixelated canvas (2 px a pixel on the phone, growing with the board), on three of the owner's four moments: a passed record's fireworks under the cleared screen's words, a purchase's and an upgrade's burst (the keeper's sigil went with his card, §48); none under «reduce motion». Effects with their own pixel lettering stay out. `art/check-fx.mjs` (local) checks them.
- `src/ui/platform.js`: the Bridge's required steps on Playgama (start after `initialize()`, one `storage.get`, saves only at progress moments via `persist(true)`, silence on the platform's pause and mute, `game_ready`, an interstitial in `onNext`); the browser's localStorage everywhere else. Never call `localStorage` directly. The Playgama build loads nothing from outside but the Bridge: three.js ships in `vendor/three/` (MIT).
- Both orientations and every window (MODE3-PLAN §34): the level end and the shop fit themselves to the window (`fitOverlay`), the rules go two-column in low wide windows, text between levels stays ≥ 11 px; `art/check-side.mjs` (local) measures the sideways fill. `npm run smoke` checks the sideways phone, a square, a tablet and a low desktop window, and the Playgama build against a stand-in Bridge. `?dev` shows the developer's settings.
- Before pushing: `npm test`, `npm run build`, `npm run smoke`.

## Documents

- `docs/ANALYSIS.md` — review of the original handoff, weak spots, decisions.
- `docs/RESEARCH.md` — similar games and practices with sources.
- `docs/DESIGN-POKER5.md` — design panel synthesis for Poker 5 and the decisions taken.
- `docs/ART-PRODUCTION.md` — engine choice, animation capabilities, asset breakdown, prompts.
- `docs/MODE3-PLAN.md` — Auto Hand rules (owner's decisions), calibration, adaptive difficulty, status.
- `docs/LORE.md` — characters and lore: why these, their tie to the dice, verdicts, lore by carrier (rule, motion, sound), the owner's open decisions.
- `docs/RESEARCH-BALATRO.md` — Balatro deep dive and what it means for the modes.
- `docs/RESEARCH-DICE-ANIMATION.md` — dice animation options; prototypes in `prototypes/dice-anim/`.
- `docs/RESEARCH-CHARACTER-ANIMATION.md` — bonus character animation: why the sprite-warp looks bad, options, the cutout-rig plan.
- `docs/simulation*.md` — balance reports.
