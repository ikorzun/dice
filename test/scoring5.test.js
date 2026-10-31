import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify5, scoreHand5, CATEGORY5, CATEGORY5_OUTCOMES, CATEGORY5_OUTCOMES_SMALL, SCORE_TABLES5 } from '../src/engine/scoring5.js';

function exhaustive(opts) {
  const counts = {};
  let total = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) for (let d = 1; d <= 6; d++) for (let e = 1; e <= 6; e++) {
    const cat = classify5([a, b, c, d, e], opts);
    counts[cat] = (counts[cat] || 0) + 1;
    total++;
  }
  return { counts, total };
}

test('exhaustive 6^5 = 7776 rolls match the classic poker-dice partition', () => {
  const { counts, total } = exhaustive({ smallStraight: false });
  assert.equal(total, 7776);
  assert.deepEqual(counts, { ...CATEGORY5_OUTCOMES });
  assert.equal(Object.values(CATEGORY5_OUTCOMES).reduce((s, n) => s + n, 0), 7776);
});

test('with small straight as an exclusive category the counts still sum to 7776 and match Yahtzee (960 + 240 = 1200 rolls contain a 4-run)', () => {
  const { counts, total } = exhaustive({ smallStraight: true });
  assert.equal(total, 7776);
  assert.deepEqual(counts, { ...CATEGORY5_OUTCOMES_SMALL });
  assert.equal(counts.small_straight + counts.straight, 1200);
});

test('specific five-die classifications', () => {
  assert.equal(classify5([3, 3, 3, 3, 3]), CATEGORY5.FIVE_KIND);
  assert.equal(classify5([3, 3, 3, 3, 1]), CATEGORY5.FOUR_KIND);
  assert.equal(classify5([2, 2, 5, 5, 5]), CATEGORY5.FULL_HOUSE);
  assert.equal(classify5([1, 2, 3, 4, 5]), CATEGORY5.STRAIGHT);
  assert.equal(classify5([6, 2, 3, 4, 5]), CATEGORY5.STRAIGHT);
  assert.equal(classify5([1, 2, 3, 4, 6]), CATEGORY5.BUST);
  assert.equal(classify5([1, 2, 3, 4, 6], { smallStraight: true }), CATEGORY5.SMALL_STRAIGHT);
  assert.equal(classify5([1, 2, 3, 4, 4], { smallStraight: true }), CATEGORY5.SMALL_STRAIGHT);
  assert.equal(classify5([1, 2, 3, 4, 4]), CATEGORY5.PAIR);
  assert.equal(classify5([1, 2, 4, 5, 6]), CATEGORY5.BUST);
  assert.equal(classify5([1, 2, 4, 5, 6], { smallStraight: true }), CATEGORY5.BUST);
  assert.equal(classify5([4, 4, 4, 1, 2]), CATEGORY5.THREE_KIND);
  assert.equal(classify5([1, 1, 6, 6, 3]), CATEGORY5.TWO_PAIRS);
  assert.equal(classify5([1, 1, 3, 5, 6]), CATEGORY5.PAIR);
  assert.equal(classify5([1, 1, 3, 5, 6]).valueOf(), classify5([6, 6, 3, 5, 1]));
  assert.throws(() => classify5([1, 2, 3, 4]));
  assert.throws(() => classify5([1, 2, 3, 4, 7]));
});

test('face-swap invariance: exchanging 1s and 6s changes the category only when a straight is involved', () => {
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) for (let d = 1; d <= 6; d++) for (let e = 1; e <= 6; e++) {
    const roll = [a, b, c, d, e];
    const swapped = roll.map((f) => (f === 1 ? 6 : f === 6 ? 1 : f));
    const c1 = classify5(roll, { smallStraight: true });
    const c2 = classify5(swapped, { smallStraight: true });
    if (c1 !== c2) assert.ok([c1, c2].some((x) => x === 'straight' || x === 'small_straight'), `${roll} ${c1} vs ${swapped} ${c2}`);
  }
});

test('score tables cover every category and rank by rarity where chosen', () => {
  for (const [name, t] of Object.entries(SCORE_TABLES5)) {
    for (const cat of Object.values(CATEGORY5)) assert.ok(Number.isInteger(t[cat]), `${name} lacks ${cat}`);
    assert.ok(t.five_kind > t.four_kind && t.four_kind > t.straight && t.straight > t.full_house && t.full_house >= t.three_kind && t.three_kind > t.two_pairs && t.two_pairs > t.pair && t.pair > t.bust);
  }
  assert.equal(scoreHand5([2, 2, 2, 2, 2]).points, 50);
  assert.equal(scoreHand5([2, 2, 2, 2, 2], 'poker5_v1').points, 60);
  assert.equal(scoreHand5([1, 1, 3, 5, 6]).points, scoreHand5([6, 6, 3, 5, 1]).points);
});
