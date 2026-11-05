# Dice Snake — notes for Claude Code sessions

Portrait-mobile dice puzzle on a 3×3 grid, plain HTML/CSS/JS, no build step for development.
Three rule sets live in one page: **Snake 4+4** (`src/engine/game.js`), **Poker 5**
(`src/engine/poker.js`) and **Auto Hand** (`src/engine/auto.js` + `hands.js`, the run's curve
in `run3.js`; rules, calibration and next steps in `docs/MODE3-PLAN.md`). Since the owner's
Figma mockup (file `0mTCxjPtORKQzV7EZ6kTfE`, section DARK, node 1285:1548) the screen shows Auto
Hand only, as an endless run that a missed target ends; the other modes keep their code and engines but have no tab
(`#tabs` hidden, `app.modeId` forced to `auto`). Mockup art lives in `assets/ui/`, the font
(Basteleur Bold, OFL) in `assets/fonts/`; the build inlines both into `dist/`. The screen is one
of two mockups (phone column, or desktop/landscape with the board left of a panel: `body.wide`)
scaled by `--k`, picked by `fitBoard` in `app.js` for the bigger board: write every size as
`calc(Npx * var(--k, 1))`, board sizes with `--kb`.

## Commands

```
npm test          # node:test suites in test/ (must stay green)
npm run build     # dist/index.html (standalone) + dist/artifact.html (claude.ai fragment)
npm run smoke     # Playwright: phone viewports + desktop, the Auto Hand screen, screenshots in dist/shots
npm run sim       # Snake 4+4 balance report -> docs/simulation-latest.md
node scripts/montecarlo5.mjs --table=pips --out=docs/simulation5-pips.md   # Poker 5
npm run sim3      # Auto Hand tiers, bots, experiments -> docs/simulation3-latest.md
node scripts/recipes3.mjs --levels=400       # Auto Hand layout table -> src/engine/recipes3.js (generated)
node scripts/run3-sim.mjs --runs=400 --out=docs/simulation3-run.md  # the run's curve: how far the bots get
node scripts/upgrades3.mjs                   # combination upgrades: point shares + expected lift -> src/engine/uplift3.js (generated)
node scripts/model-to-js.mjs                 # die model GLB -> src/ui/dice-model.js (generated)
node scripts/bake-faces.mjs                  # die faces with their matcaps -> assets/dice/ (after any model, matcap or colour change)
python3 scripts/audio.py sfx [name ...]      # sound effects via ElevenLabs (key in the macOS keychain) -> assets/sfx/
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
- The won level's moment (`playWin` in `app.js`, `shards.js`, the characters' `win` acts in `puppets.js`) is built to
  GPT's spec in `art/ai/2026-11-04-win-production` (local, not in git; MODE3-PLAN §20): times are ms from PLAY,
  `finishLevel` runs first so a reload shows the cleared screen, a tap skips to the pick. The lost run's moment
  (`playLoss`, `holdLine` in `shards.js`; `art/ai/2026-11-04-loss-production`, §21) mirrors it: `finishLevel(board)`
  keeps the board as played in `lastEnd.board` (the engine has refilled it), never call `render()` during the moment.
  The act strip (`acts.js`, `renderAct`; `art/ai/2026-11-05-acts-production`, §22) is worked out from the level and
  the record; it adds no height to the column. Visual work goes through GPT first (tools in `art/ai/tools`, local).
- Before pushing: `npm test`, `npm run build`, `npm run smoke`.

## Documents

- `docs/ANALYSIS.md` — review of the original handoff, weak spots, decisions.
- `docs/RESEARCH.md` — similar games and practices with sources.
- `docs/DESIGN-POKER5.md` — design panel synthesis for Poker 5 and the decisions taken.
- `docs/ART-PRODUCTION.md` — engine choice, animation capabilities, asset breakdown, prompts.
- `docs/MODE3-PLAN.md` — Auto Hand rules (owner's decisions), calibration, adaptive difficulty, status.
- `docs/RESEARCH-BALATRO.md` — Balatro deep dive and what it means for the modes.
- `docs/RESEARCH-DICE-ANIMATION.md` — dice animation options; prototypes in `prototypes/dice-anim/`.
- `docs/RESEARCH-CHARACTER-ANIMATION.md` — bonus character animation: why the sprite-warp looks bad, options, the cutout-rig plan.
- `docs/simulation*.md` — balance reports.
