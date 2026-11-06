import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, scoreHand, CATEGORY, CATEGORY_OUTCOMES, SCORE_TABLES } from '../src/engine/scoring.js';

test('exhaustive 6^4 = 1296 rolls match the handoff category counts exactly', () => {
  const counts = {};
  let total = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) for (let d = 1; d <= 6; d++) {
    const cat = classify([a, b, c, d]);
    counts[cat] = (counts[cat] || 0) + 1;
    total++;
  }
  assert.equal(total, 1296);
  assert.deepEqual(counts, { ...CATEGORY_OUTCOMES });
  assert.equal(Object.values(CATEGORY_OUTCOMES).reduce((s, n) => s + n, 0), 1296);
});

test('categories are exclusive and ignore pip sums (face-swap invariance)', () => {
  assert.equal(classify([1, 1, 3, 4]), classify([6, 6, 3, 4]));
  assert.equal(classify([1, 1, 5, 5]), classify([2, 2, 6, 6]));
  assert.equal(scoreHand([1, 1, 3, 4]).points, scoreHand([6, 6, 3, 4]).points);
  assert.equal(scoreHand([1, 1, 5, 5]).points, scoreHand([2, 2, 6, 6]).points);
  // swapping 1<->6 for every roll keeps the category unless a straight is created/destroyed
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) for (let d = 1; d <= 6; d++) {
    const roll = [a, b, c, d];
    const swapped = roll.map((f) => (f === 1 ? 6 : f === 6 ? 1 : f));
    const c1 = classify(roll);
    const c2 = classify(swapped);
    if (c1 !== c2) {
      assert.ok([c1, c2].includes(CATEGORY.STRAIGHT), `${roll} -> ${c1} vs ${swapped} -> ${c2}`);
      assert.ok([c1, c2].includes(CATEGORY.HIGH));
    }
  }
});

test('specific classifications', () => {
  assert.equal(classify([2, 2, 2, 2]), CATEGORY.FOUR_KIND);
  assert.equal(classify([4, 4, 4, 1]), CATEGORY.THREE_KIND);
  assert.equal(classify([1, 1, 6, 6]), CATEGORY.TWO_PAIRS);
  assert.equal(classify([1, 2, 3, 4]), CATEGORY.STRAIGHT);
  assert.equal(classify([4, 3, 2, 5]), CATEGORY.STRAIGHT);
  assert.equal(classify([3, 4, 5, 6]), CATEGORY.STRAIGHT);
  assert.equal(classify([1, 2, 3, 5]), CATEGORY.HIGH);
  assert.equal(classify([1, 1, 3, 6]), CATEGORY.PAIR);
  assert.equal(classify([1, 2, 4, 6]), CATEGORY.HIGH);
  assert.equal(classify([1, 2, 3, 6]), CATEGORY.HIGH);
});

test('score tables carry every category and the baseline matches v0.3', () => {
  for (const [name, table] of Object.entries(SCORE_TABLES)) {
    for (const cat of Object.values(CATEGORY)) assert.ok(Number.isInteger(table[cat]), `${name} lacks ${cat}`);
  }
  assert.deepEqual({ ...SCORE_TABLES.spec_v03 }, { four_kind: 30, straight: 15, three_kind: 10, two_pairs: 5, pair: 2, high: 0 });
  assert.throws(() => classify([1, 2, 3]));
  assert.throws(() => classify([1, 2, 3, 7]));
  assert.throws(() => scoreHand([1, 2, 3, 4], 'nope'));
});
