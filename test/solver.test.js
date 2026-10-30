import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeometry, cellsOf } from '../src/engine/geometry.js';
import { solveBoard, makeFastEvaluator, evaluateHand } from '../src/engine/solver.js';
import { scoreHand, SCORE_TABLES } from '../src/engine/scoring.js';
import { createRng } from '../src/engine/rng.js';
import { rollFaces } from '../src/engine/levels.js';

test('solveBoard equals an independent brute force over all two-hand partitions', () => {
  const g = buildGeometry(8);
  const rng = createRng('solver-brute');
  for (let n = 0; n < 500; n++) {
    const faces = rollFaces(rng, 8);
    const solved = solveBoard(faces, g, 'spec_v03');
    let bestPlain = -1;
    let bestBonus = -1;
    for (const a of g.eligibleMasks) {
      const b = g.freeMask & ~a;
      if (!g.eligibleSet.has(b)) continue;
      const pa = scoreHand(cellsOf(a).map((i) => faces[i])).points;
      const pb = scoreHand(cellsOf(b).map((i) => faces[i])).points;
      bestPlain = Math.max(bestPlain, pa + pb);
      bestBonus = Math.max(bestBonus, pa + pb + Math.max(pa, pb));
    }
    assert.equal(solved.maxNoBonus, bestPlain);
    assert.equal(solved.maxWithBonus, bestBonus);
    assert.equal(solved.partitions.length, 4);
  }
});

test('fast evaluator matches solveBoard for both tables on random boards', () => {
  const g = buildGeometry(8);
  const rng = createRng('fast-eval');
  for (const table of Object.keys(SCORE_TABLES)) {
    const fast = makeFastEvaluator(g, table, 2);
    for (let n = 0; n < 2000; n++) {
      const faces = rollFaces(rng, 8);
      const solved = solveBoard(faces, g, table);
      assert.equal(fast.maxNoBonus(faces), solved.maxNoBonus);
      assert.equal(fast.maxWithBonus(faces), solved.maxWithBonus);
    }
  }
});

test('evaluateHand reports faces in cell order and the ×2 goes to the better hand', () => {
  const g = buildGeometry(8);
  const faces = [1, 1, 1, 1, 2, 3, 4, 5, null];
  const h = evaluateHand(faces, 0b1111, 'spec_v03');
  assert.deepEqual(h.cells, [0, 1, 2, 3]);
  assert.equal(h.category, 'four_kind');
  const solved = solveBoard(faces, g, 'spec_v03');
  // cells 0..3 = 1,1,1,1 (four of a kind 30) + cells 4..7 = 2,3,4,5 (straight 15)
  assert.equal(solved.maxNoBonus, 45);
  assert.equal(solved.maxWithBonus, 75);
  assert.equal(solved.bestBonus.bonusHand, 0);
});
