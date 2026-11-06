# Dice Snake 3×3

Portrait-first mobile dice puzzle on a 3×3 board with two modes in one page: **Snake 4+4** (two
irreversible four-die snakes, gold ×2 corner, exact safe-bank guard) and **Poker 5** (five-die poker
snakes, refills, three hands). Pip-based scoring with rarity multipliers, seeded levels, rule-based
tiers, an example-based tutorial, four visual looks and optional 3D physics dice.

No build step is required for development: `index.html` loads the ES modules directly.

```
npm test          # exhaustive math / geometry / state-machine tests (node:test)
npm run sim       # Monte Carlo balance report -> docs/simulation-latest.md
npm run build     # dist/index.html (standalone) + dist/artifact.html (claude.ai artifact fragment)
npm run smoke     # Playwright: phone viewports, gestures, screenshots in dist/shots
npm run serve     # python3 -m http.server 8080  -> open http://localhost:8080/
```

`dist/index.html` is self-contained and can be opened from disk or dropped on any static host.

Layout:

- `src/engine/` – pure rules: `rng` (seeded, exactly uniform dice), `scoring` (four-die categories),
  `geometry` (3×3 graph, eligible sets, partitions, safe-first lookup), `solver` (exact two-hand optimum),
  `game` (immutable state transitions), `levels` (seeded generation, tiers), `bot` (balancing bots).
- `src/ui/` – rendering, pointer gestures, effects, local event log.
- `test/` – invariants required by handoff §8.
- `scripts/` – simulation, build, smoke.
- `docs/ANALYSIS.md` – handoff review; `docs/RESEARCH.md`, `docs/DESIGN-POKER5.md` – research and
  design of Poker 5; `docs/ART-PRODUCTION.md` – art pipeline; `docs/MODE3-PLAN.md` – next mode.
- `CLAUDE.md` – conventions for Claude Code sessions.

Local setup:

```
git clone -b claude/dice-snake-3x3-prototype https://github.com/ikorzun/dice.git DICE
cd DICE && npm test && npm run build && npm run serve
```
