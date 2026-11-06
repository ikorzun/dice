import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreHand, pipsScore, classify } from '../src/engine/scoring.js';
import { scoreHand5 } from '../src/engine/scoring5.js';
import { buildGeometry } from '../src/engine/geometry.js';
import { solveBoard, makeFastEvaluator } from '../src/engine/solver.js';
import { createRng } from '../src/engine/rng.js';
import { rollFaces } from '../src/engine/levels.js';

test('pip scoring, four dice: sum of the matching dice × a rarity multiplier', () => {
  assert.deepEqual(scoreHand([3, 3, 3, 1], 'pips'), { category: 'three_kind', label: 'THREE OF A KIND', points: 36, formula: '9 × 4' });
  assert.equal(scoreHand([6, 6, 3, 1], 'pips').points, 24);
  assert.equal(scoreHand([1, 1, 3, 6], 'pips').points, 4);
  assert.equal(scoreHand([2, 2, 5, 5], 'pips').points, 42);
  assert.equal(scoreHand([4, 4, 4, 4], 'pips').points, 96);
  assert.equal(scoreHand([1, 2, 3, 4], 'pips').points, 50);
  assert.equal(scoreHand([3, 4, 5, 6], 'pips').points, 90);
  assert.equal(scoreHand([1, 2, 4, 6], 'pips').points, 0);
  assert.equal(pipsScore([5, 5, 2, 5], classify([5, 5, 2, 5])).formula, '15 × 4');
});

test('pip scoring, five dice: full house and straight use all five dice × 5, five of a kind × 8', () => {
  assert.equal(scoreHand5([5, 5, 5, 5, 5], 'pips').points, 200);
  assert.equal(scoreHand5([4, 4, 4, 4, 1], 'pips').points, 96);
  assert.deepEqual(scoreHand5([2, 2, 5, 5, 5], 'pips').formula, '19 × 5');
  assert.equal(scoreHand5([2, 2, 5, 5, 5], 'pips').points, 95);
  assert.equal(scoreHand5([1, 2, 3, 4, 5], 'pips').points, 75);
  assert.equal(scoreHand5([2, 3, 4, 5, 6], 'pips').points, 100);
  assert.equal(scoreHand5([1, 2, 3, 4, 4], 'pips', { smallStraight: true }).points, 30);
  assert.equal(scoreHand5([3, 3, 3, 1, 2], 'pips').points, 36);
  assert.equal(scoreHand5([2, 2, 6, 6, 3], 'pips').points, 48);
  assert.equal(scoreHand5([6, 6, 3, 5, 1], 'pips').points, 24);
  assert.equal(scoreHand5([1, 2, 4, 5, 6], 'pips').points, 0);
});

test('fast evaluator agrees with solveBoard under pip scoring', () => {
  const g = buildGeometry(8);
  const fast = makeFastEvaluator(g, 'pips', 2);
  const rng = createRng('pips-fast');
  for (let n = 0; n < 2000; n++) {
    const faces = rollFaces(rng, 8);
    const solved = solveBoard(faces, g, 'pips');
    assert.equal(fast.maxNoBonus(faces), solved.maxNoBonus);
    assert.equal(fast.maxWithBonus(faces), solved.maxWithBonus);
  }
});
