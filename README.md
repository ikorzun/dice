# Dice Snake 3×3

Portrait-first mobile dice puzzle built from the v0.3 handoff: eight dice and one gold ×2 cell on a
3×3 board, two irreversible four-die "snake" hands, two shared rerolls, category scoring that ignores
pip sums, an exact safe-bank guard, seeded level generation and a transparent rule-based difficulty policy.

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
- `docs/ANALYSIS.md` – handoff review: verified claims, weak spots, what was strengthened, open questions.
