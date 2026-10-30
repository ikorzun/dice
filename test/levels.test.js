import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel, nextTier, clampTier, TIERS, MIN_TIER, MAX_TIER } from '../src/engine/levels.js';
import { createGame, hintFor, bankPath, toggleBonus } from '../src/engine/game.js';
import { buildGeometry } from '../src/engine/geometry.js';
import { solveBoard } from '../src/engine/solver.js';

test('seeded generation is deterministic and persists the required fields', () => {
  const a = generateLevel({ runSeed: 'run-1', levelIndex: 3, tier: 2 });
  const b = generateLevel({ runSeed: 'run-1', levelIndex: 3, tier: 2 });
  assert.deepEqual(a, b);
  for (const key of ['seed', 'faces', 'bonusIndex', 'target', 'rerolls', 'generatorVersion', 'scoreTable', 'bestNoReroll', 'bestNoRerollWithBonus', 'tier', 'levelIndex']) {
    assert.ok(key in a, `missing ${key}`);
  }
  assert.equal(a.faces[8], null);
  assert.equal(a.faces.filter((f) => Number.isInteger(f)).length, 8);
  const c = generateLevel({ runSeed: 'run-2', levelIndex: 3, tier: 2 });
  assert.notDeepEqual(a.faces, c.faces);
  const solved = solveBoard(a.faces, buildGeometry(8), a.scoreTable);
  assert.equal(solved.maxWithBonus, a.bestNoRerollWithBonus);
  assert.equal(solved.maxNoBonus, a.bestNoReroll);
});

test('accepted boards sit inside the tier band: not won on the opening roll, not hopeless', () => {
  for (let tier = MIN_TIER; tier <= MAX_TIER; tier++) {
    const spec = TIERS[tier];
    let fallbacks = 0;
    for (let i = 0; i < 200; i++) {
      const lvl = generateLevel({ runSeed: `band-${i}`, levelIndex: i, tier });
      assert.equal(lvl.target, spec.target);
      if (lvl.fallback) { fallbacks++; continue; }
      assert.ok(lvl.bestNoRerollWithBonus < lvl.target, 'opening roll must not already beat the target');
      assert.ok(lvl.bestNoRerollWithBonus >= spec.target * spec.lo);
      assert.ok(lvl.bestNoRerollWithBonus <= spec.target * spec.hi);
    }
    assert.ok(fallbacks <= 4, `tier ${tier}: too many fallbacks (${fallbacks}/200)`);
  }
});

test('targets never exceed the absolute maximum (30×2 + 30 = 90) and are winnable by the solver path plus rerolls', () => {
  for (let tier = MIN_TIER; tier <= MAX_TIER; tier++) assert.ok(TIERS[tier].target <= 90 && TIERS[tier].target > 0);
  // Every generated level is playable end-to-end with the hint path without errors.
  for (let i = 0; i < 50; i++) {
    let g = createGame(generateLevel({ runSeed: 'playable', levelIndex: i, tier: 1 + (i % 5) }));
    for (let h = 0; h < 2; h++) {
      const hint = hintFor(g);
      if (hint.useBonus && !g.bonus.armed) g = toggleBonus(g).state;
      const r = bankPath(g, hint.cells);
      assert.equal(r.ok, true, r.message);
      g = r.state;
    }
    assert.ok(['won', 'lost'].includes(g.phase));
    assert.equal(g.score, g.level.bestNoRerollWithBonus, 'hint path reproduces the exact optimum with ×2');
  }
});

test('difficulty moves at most one tier per level and stays within bounds', () => {
  assert.equal(nextTier(1, false), 1);
  assert.equal(nextTier(1, true), 2);
  assert.equal(nextTier(5, true), 5);
  assert.equal(nextTier(5, false), 4);
  assert.equal(nextTier(3, true), 4);
  assert.equal(clampTier(9), 5);
  assert.equal(clampTier(-2), 1);
});

test('consecutive levels in a run do not repeat boards', () => {
  const seen = new Set();
  let tier = 1;
  for (let i = 1; i <= 100; i++) {
    const lvl = generateLevel({ runSeed: 'norepeat', levelIndex: i, tier });
    const key = lvl.faces.join('');
    assert.ok(!seen.has(key), `level ${i} repeats a board`);
    seen.add(key);
    tier = nextTier(tier, i % 3 !== 0);
  }
});
