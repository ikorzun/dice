# Dice Snake — notes for Claude Code sessions

Portrait-mobile dice puzzle on a 3×3 grid, plain HTML/CSS/JS, no build step for development.
Three rule sets live in one page: **Snake 4+4** (`src/engine/game.js`), **Poker 5**
(`src/engine/poker.js`) and **Auto Hand** (`src/engine/auto.js` + `hands.js`, adaptive levels
in `adapt3.js`; rules, calibration and next steps in `docs/MODE3-PLAN.md`). Since the owner's
Figma mockup (file `0mTCxjPtORKQzV7EZ6kTfE`, section DARK, node 1285:1548) the screen shows Auto
Hand only, as a run of 25 levels; the other modes keep their code and engines but have no tab
(`#tabs` hidden, `app.modeId` forced to `auto`). Mockup art lives in `assets/ui/`, the font
(Basteleur Bold) in `assets/fonts/`; the build inlines both into `dist/`.

## Commands

```
npm test          # node:test suites in test/ (must stay green)
npm run build     # dist/index.html (standalone) + dist/artifact.html (claude.ai fragment)
npm run smoke     # Playwright: phone viewports + desktop, the Auto Hand screen, screenshots in dist/shots
npm run sim       # Snake 4+4 balance report -> docs/simulation-latest.md
node scripts/montecarlo5.mjs --table=pips --out=docs/simulation5-pips.md   # Poker 5
npm run sim3      # Auto Hand tiers, bots, experiments -> docs/simulation3-latest.md
node scripts/recipes3.mjs --levels=400       # Auto Hand layout table -> src/engine/recipes3.js (generated)
node scripts/adapt3-sim.mjs --runs=100 --out=docs/simulation3-adaptive.md  # adaptive levels check
node scripts/model-to-js.mjs                 # die model GLB -> src/ui/dice-model.js (generated)
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
  scripts after any scoring or economy change. Auto Hand: the game plays `generateAdaptiveLevel`
  (`adapt3.js`, target ladder + layout chosen from the run's history and `recipes3.js`); tier
  levels (`levels3.js`) are the bots' reference. Regenerate `recipes3.js` after any rule change.
- `scripts/build.mjs` bundles modules into per-module scopes; it validates import names and
  module order. Dynamic `import()` of CDN URLs (three.js in `src/ui/dice3d.js`) is
  left untouched and must keep its CSS fallback.
- Before pushing: `npm test`, `npm run build`, `npm run smoke`.

## Documents

- `docs/ANALYSIS.md` — review of the original handoff, weak spots, decisions.
- `docs/RESEARCH.md` — similar games and practices with sources.
- `docs/DESIGN-POKER5.md` — design panel synthesis for Poker 5 and the decisions taken.
- `docs/ART-PRODUCTION.md` — engine choice, animation capabilities, asset breakdown, prompts.
- `docs/MODE3-PLAN.md` — Auto Hand rules (owner's decisions), calibration, adaptive difficulty, status.
- `docs/RESEARCH-BALATRO.md` — Balatro deep dive and what it means for the modes.
- `docs/RESEARCH-DICE-ANIMATION.md` — dice animation options; prototypes in `prototypes/dice-anim/`.
- `docs/simulation*.md` — balance reports.
