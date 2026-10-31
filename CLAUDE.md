# Dice Snake — notes for Claude Code sessions

Portrait-mobile dice puzzle on a 3×3 grid, plain HTML/CSS/JS, no build step for development.
Two modes live in one page (tabs): **Snake 4+4** (`src/engine/game.js`) and **Poker 5**
(`src/engine/poker.js`); a third, **Auto Hand**, is planned in `docs/MODE3-PLAN.md`.

## Commands

```
npm test          # node:test suites in test/ (must stay green)
npm run build     # dist/index.html (standalone) + dist/artifact.html (claude.ai fragment)
npm run smoke     # Playwright: phone viewports, both tabs, screenshots in dist/shots
npm run sim       # Snake 4+4 balance report -> docs/simulation-latest.md
node scripts/montecarlo5.mjs --table=pips --out=docs/simulation5-pips.md   # Poker 5
npm run serve     # python3 -m http.server 8080 -> http://localhost:8080/
```

Playwright must be installed locally for `npm run smoke` (`npm i -D playwright && npx playwright install chromium`).

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
  scripts after any scoring or economy change.
- `scripts/build.mjs` bundles modules into per-module scopes; it validates import names and
  module order. Dynamic `import()` of CDN URLs (three.js, cannon-es in `src/ui/dice3d.js`) is
  left untouched and must keep its CSS fallback.
- Before pushing: `npm test`, `npm run build`, `npm run smoke`.

## Documents

- `docs/ANALYSIS.md` — review of the original handoff, weak spots, decisions.
- `docs/RESEARCH.md` — similar games and practices with sources.
- `docs/DESIGN-POKER5.md` — design panel synthesis for Poker 5 and the decisions taken.
- `docs/ART-PRODUCTION.md` — engine choice, animation capabilities, asset breakdown, prompts.
- `docs/MODE3-PLAN.md` — implementation plan for the Auto Hand mode (open questions inside).
- `docs/simulation*.md` — balance reports.
