import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADAPT3, targetFor, percentileOf, skillFrom, skillSample, winChance, candidates, generateAdaptiveLevel, recipeById,
} from '../src/engine/adapt3.js';
import { RECIPES3, RECIPE_QUANTILES } from '../src/engine/recipes3.js';
import { BONUS_UNLOCKS } from '../src/engine/levels3.js';
import { createAutoGame, toggleHold, playHand, diceCells } from '../src/engine/auto.js';
import { playGreedyBot3 } from '../src/engine/bot3.js';
import { createRng } from '../src/engine/rng.js';

const seq = (values) => { let k = 0; return () => values[k++ % values.length]; };

test('the target ladder: an easy first level, low unlock levels, then a capped ramp', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(targetFor), [340, 360, 360, 370, 380]);
  assert.equal(targetFor(6), 390);
  assert.equal(targetFor(10), 430);
  assert.equal(targetFor(40), 460);
  for (let l = 1; l < 40; l++) assert.ok(targetFor(l + 1) >= targetFor(l));
});

test('percentileOf follows the quantile table, stays in (0, 1) and never decreases', () => {
  for (const r of RECIPES3) {
    let prev = 0;
    for (let s = 0; s <= 4000; s += 7) {
      const p = percentileOf(r, s);
      assert.ok(p > 0 && p < 1);
      assert.ok(p >= prev - 1e-12, `${r.id} at ${s}`);
      prev = p;
    }
    r.greedy.forEach((q, k) => { if (r.greedy.indexOf(q) === k && r.greedy.lastIndexOf(q) === k) assert.ok(Math.abs(percentileOf(r, q) - RECIPE_QUANTILES[k]) < 1e-9); });
  }
});

test('skill is an average of score ratios, nudged by wins above or below the prediction', () => {
  assert.equal(skillFrom([]), ADAPT3.startSkill);
  const r = recipeById(ADAPT3.firstRecipe);
  const ratio = skillSample(r, r.greedy[RECIPE_QUANTILES.indexOf(0.5)] * 1.2);
  assert.ok(Math.abs(ratio - 1.2) < 1e-9);
  const plain = skillFrom([{ mode: 'auto', ratio }]);
  assert.ok(Math.abs(plain - (ADAPT3.startSkill + ADAPT3.alpha * (1.2 - ADAPT3.startSkill))) < 1e-9);
  assert.ok(skillFrom([{ mode: 'auto', ratio, won: true, predictedWin: 0.5 }]) > plain);
  assert.ok(skillFrom([{ mode: 'auto', ratio, won: false, predictedWin: 0.5 }]) < plain);
  assert.equal(skillFrom([{ mode: 'poker5', ratio: 3 }]), ADAPT3.startSkill); // other modes do not count
});

test('the win chance falls with the target and rises with the skill', () => {
  const r = recipeById('8d1x:-');
  assert.ok(winChance(r, 300, 1) > winChance(r, 450, 1));
  assert.ok(winChance(r, 400, 1.2) > winChance(r, 400, 0.8));
});

test('candidates: at most two bonus dice of different unlocked kinds, the newly unlocked kind on its level, six dice or more', () => {
  for (let level = 1; level <= 12; level++) {
    const list = candidates(level);
    assert.ok(list.length > 0);
    const open = BONUS_UNLOCKS.slice(0, Math.min(level, BONUS_UNLOCKS.length));
    for (const r of list) {
      assert.ok(r.dice >= 6 && r.dice + r.blocks + r.kinds.length === 9);
      assert.ok(r.kinds.length <= ADAPT3.maxBonuses && new Set(r.kinds).size === r.kinds.length);
      assert.ok(r.kinds.every((k) => open.includes(k)));
      if (level >= 2 && level <= BONUS_UNLOCKS.length) assert.ok(r.kinds.includes(BONUS_UNLOCKS[level - 1]));
    }
  }
});

test('adaptive levels: level 1 is the fixed board, levels are deterministic, a stronger player gets a harder layout', () => {
  const first = generateAdaptiveLevel({ runSeed: 'a', levelIndex: 1 });
  assert.deepEqual(first.layout[8], { type: 'bonus', kind: 'x2_any' });
  assert.equal(first.layout.filter((c) => c.type === 'die').length, 8);
  assert.equal(first.target, 340);
  const weak = Array.from({ length: 6 }, () => ({ mode: 'auto', ratio: 0.65 }));
  const strong = Array.from({ length: 6 }, () => ({ mode: 'auto', ratio: 1.15 }));
  let weakMedian = 0;
  let strongMedian = 0;
  for (let s = 0; s < 20; s++) {
    const a = generateAdaptiveLevel({ runSeed: `r${s}`, levelIndex: 9, history: weak });
    assert.deepEqual(a, generateAdaptiveLevel({ runSeed: `r${s}`, levelIndex: 9, history: weak }));
    assert.equal(a.target, targetFor(9));
    assert.ok(a.layout.filter((c) => c.type === 'die').length >= 6);
    assert.ok(a.typicalHand > 0 && a.predictedWin > 0 && a.predictedWin < 1);
    createAutoGame(a);
    weakMedian += recipeById(a.recipe).greedy[5];
    strongMedian += recipeById(generateAdaptiveLevel({ runSeed: `r${s}`, levelIndex: 9, history: strong }).recipe).greedy[5];
  }
  assert.ok(weakMedian > strongMedian * 1.3, `weak ${weakMedian} vs strong ${strongMedian}`);
});

test('help in trouble: refills may copy the largest held group when far behind; never without held dice or on tier levels', () => {
  const layout = Array.from({ length: 9 }, () => ({ type: 'die' }));
  const faces = [6, 6, 1, 2, 3, 3, 5, 4, 4];
  const level = { seed: 'h', levelIndex: 9, tier: 1, layout, faces, target: 5000, hands: 3, rerolls: 3, typicalHand: 100 };
  // the best hand is the straight 2-3-4-5-6 with the other 4; the held 4 stays and is the favoured face
  // (one die: a held pair would be a combination, and the player's hand)
  let g = createAutoGame(level);
  g = toggleHold(g, 7).state;
  const r = playHand(g, seq([1]));
  assert.equal(r.hand.help, 2);
  assert.ok(r.burned.every((i) => r.state.faces[i] === 4)); // every coin came up 1, so every refill copied the 4
  const r2 = playHand(createAutoGame(level), seq([1]));
  assert.equal(r2.hand.help, 0); // nothing held: nothing to aim at
  const { typicalHand, ...tierLevel } = level;
  assert.equal(playHand(toggleHold(createAutoGame(tierLevel), 7).state, seq([1])).hand.help, 0);
  const easy = playHand(toggleHold(createAutoGame({ ...level, target: 100 }), 7).state, seq([1]));
  assert.equal(easy.hand.help, 0); // not behind
  assert.ok(diceCells(easy.state).length === 9);
});

test('a strong bot playing adaptive levels lands near the aimed win rate', () => {
  let wins = 0;
  let levels = 0;
  for (let run = 0; run < 12; run++) {
    const history = [];
    const rng = createRng(`aim${run}`);
    for (let L = 1; L <= 16; L++) {
      const level = generateAdaptiveLevel({ runSeed: `aim${run}`, levelIndex: L, history });
      const res = playGreedyBot3(level, { rng });
      history.push({ mode: 'auto', recipe: level.recipe, ratio: skillSample(recipeById(level.recipe), res.score), won: res.won, predictedWin: level.predictedWin });
      if (L > 1) { wins += res.won ? 1 : 0; levels++; }
    }
  }
  const rate = wins / levels;
  assert.ok(rate > 0.6 && rate < 0.9, `greedy win rate ${rate}`);
});
