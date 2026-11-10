import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RUN3, runLift, runTarget, runAim, percentileOf, typicalChance, candidates, chooseRecipe, generateRunLevel, recipeById,
} from '../src/engine/run3.js';
import { BONUS_UNLOCKS, UNLOCK_LEVEL, unlockedKinds, newKind } from '../src/engine/levels3.js';
import { UP_LIFT } from '../src/engine/uplift3.js';
import { RECIPE_QUANTILES } from '../src/engine/recipes3.js';
import { MIN_DICE } from '../src/engine/auto.js';
import { createRng } from '../src/engine/rng.js';

test('the run never ends: every level asks for more than the one before, faster and faster', () => {
  let step = 0;
  for (let n = 1; n < 120; n++) {
    const a = runTarget(n);
    const b = runTarget(n + 1);
    assert.ok(Number.isInteger(a / 10) && a > 0, `level ${n}: ${a}`);
    assert.ok(b > a, `level ${n + 1} asks ${b}, not more than ${a}`);
    if (n % 10 === 0) { assert.ok(b - a >= step, `the steps shrink at level ${n}`); step = b - a; }
  }
});

test('the targets are the spec\'s table of sixty levels, then 3.8% a level', () => {
  assert.equal(RUN3.targets.length, 60);
  for (let n = 1; n <= 60; n++) assert.equal(runTarget(n), RUN3.targets[n - 1]);
  const anchors = { 1: 240, 5: 350, 10: 560, 15: 820, 20: 1150, 25: 1550, 30: 2050, 40: 3400, 50: 5200, 60: 7600 };
  for (const [n, t] of Object.entries(anchors)) assert.equal(runTarget(Number(n)), t, `level ${n}`);
  assert.equal(runTarget(61), 7890);
  assert.equal(runTarget(0), 240);
});

test('the lift a level is grown with assumes an upgrade after every level before it, past the table too', () => {
  const last = UP_LIFT.length - 1;
  assert.equal(runLift(1), 1);
  assert.equal(runLift(last), UP_LIFT[last]);
  const step = UP_LIFT[last] - UP_LIFT[last - 1];
  assert.ok(Math.abs(runLift(last + 10) - (UP_LIFT[last] + 10 * step)) < 1e-9);
});

test('the aim: almost sure on the first two levels (the tutorial runs on level 1), then lower and lower', () => {
  assert.equal(runAim(1), RUN3.aimFirst);
  assert.equal(runAim(2), RUN3.aimFirst);
  assert.equal(runAim(3), RUN3.aimStart);
  for (let n = 3; n < 60; n++) assert.ok(runAim(n + 1) < runAim(n) && runAim(n + 1) > RUN3.aimFloor);
  assert.ok(Math.abs(runAim(3000) - RUN3.aimFloor) < 1e-9);
});

test('percentiles: the quantiles themselves, monotone between and beyond them', () => {
  const r = recipeById(RUN3.firstRecipe);
  RECIPE_QUANTILES.forEach((p, k) => assert.ok(Math.abs(percentileOf(r.naive, r.naive[k]) - p) < 1e-9));
  let prev = 0;
  for (let s = 0; s <= 1500; s += 25) {
    const p = percentileOf(r.naive, s);
    assert.ok(p >= prev && p > 0 && p < 1);
    prev = p;
  }
});

test('a level depends on the run seed and its number only: never on the bank or upgrades it carries', () => {
  for (const n of [1, 2, 4, 6, 9, 17]) {
    const plain = generateRunLevel({ runSeed: 'same', levelIndex: n });
    const carried = generateRunLevel({ runSeed: 'same', levelIndex: n, bank: ['joker', 'x2_any'], ups: { straight: 3, pair: 1 } });
    for (const key of ['layout', 'faces', 'target', 'recipe', 'seed']) assert.deepEqual(carried[key], plain[key], `level ${n}: ${key}`);
    assert.deepEqual(carried.bank, ['joker', 'x2_any']);
    assert.deepEqual(carried.ups, { straight: 3, pair: 1 });
    assert.deepEqual(generateRunLevel({ runSeed: 'same', levelIndex: n }), plain);
  }
});

test('level 1 is the first board: eight dice and the ×2 in the corner', () => {
  const level = generateRunLevel({ runSeed: 'first', levelIndex: 1 });
  assert.equal(level.recipe, RUN3.firstRecipe);
  assert.deepEqual(level.layout.map((c) => c.type), [...Array(8).fill('die'), 'bonus']);
  assert.equal(level.layout[8].kind, 'x2_any');
  assert.equal(level.target, runTarget(1));
});

test('the ten heroes open at their levels, and only there is a new one dealt', () => {
  assert.equal(BONUS_UNLOCKS.length, 10);
  assert.deepEqual(BONUS_UNLOCKS.map((k) => UNLOCK_LEVEL[k]), [1, 2, 3, 4, 6, 7, 11, 16, 21, 26]);
  assert.deepEqual(unlockedKinds(1), ['x2_any']);
  assert.deepEqual(unlockedKinds(5), ['x2_any', 'x3_straight', 'x3_pairs', 'x3_trips']);
  assert.equal(unlockedKinds(26).length, 10);
  assert.deepEqual([1, 2, 5, 8, 11, 26, 27].map(newKind), [null, 'x3_straight', null, null, 'x3_kinds', 'x3_sixes', null]);
});

test('every level keeps six dice and at most two cards of different opened kinds; a level that opens a hero deals it beside the Knight', () => {
  for (let s = 0; s < 40; s++) {
    for (let n = 2; n <= 30; n++) {
      const level = generateRunLevel({ runSeed: `kinds${s}`, levelIndex: n });
      const kinds = level.layout.filter((c) => c.type === 'bonus').map((c) => c.kind);
      assert.ok(level.layout.filter((c) => c.type === 'die').length >= MIN_DICE);
      assert.ok(kinds.length <= RUN3.maxBonuses && new Set(kinds).size === kinds.length);
      assert.ok(kinds.every((k) => unlockedKinds(n).includes(k)));
      if (newKind(n)) assert.deepEqual(kinds.slice().sort(), ['x2_any', newKind(n)].sort(), `level ${n}`);
      assert.deepEqual(recipeById(level.recipe).kinds.slice().sort(), kinds.slice().sort());
    }
  }
});

test('the layout drawn fits the level\'s aim about as well as the best candidate', () => {
  for (const n of [2, 3, 6, 10, 15, 25]) {
    const fit = (r) => Math.abs(Math.log((1 - typicalChance(r, n)) / (1 - runAim(n))));
    const best = Math.min(...candidates(n).map(fit));
    for (let s = 0; s < 30; s++) {
      const recipe = chooseRecipe(n, createRng(`fit${n}/${s}`));
      assert.ok(fit(recipe) <= best + RUN3.near + 1e-12, `level ${n}: ${recipe.id}`);
    }
  }
});

test('the level carries the modelled chance for the log', () => {
  const level = generateRunLevel({ runSeed: 'chance', levelIndex: 7 });
  assert.equal(level.chance, typicalChance(recipeById(level.recipe), 7));
  assert.ok(level.chance > 0 && level.chance < 1);
});
