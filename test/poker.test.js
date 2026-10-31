import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPokerGame, toggleHold, reroll, toggleBonus, previewPath, bankPath, hintFor, rankSnakes, canReroll,
  rerollTargets, snapshotGame, restoreGame, remainingCells,
} from '../src/engine/poker.js';
import { maskOf, orderedPathsOf } from '../src/engine/geometry.js';

// Tests use the nine-dice variant (bonusIndex null) unless stated; the gold-cell variant is tested below.
// They pin the first score table and "play all three hands" so the expected numbers stay stable.
const level = (faces, target = 30, extra = {}) => ({ seed: 'p', levelIndex: 1, tier: 1, faces, bonusIndex: null, target, hands: 3, rerolls: 3, ...extra });
const PIN = { scoreTable: 'poker5_v1', smallStraight: true, endOnTarget: false };
const create = (lvl, extra = {}) => createPokerGame(lvl, { ...PIN, ...extra });
// row0: 5 5 5 | row1: 2 5 3 | row2: 6 6 1
const F = [5, 5, 5, 2, 5, 3, 6, 6, 1];
const seq = (values) => { let k = 0; return () => values[k++ % values.length]; };

test('nine dice, 36 snakes, a five-die snake scores as a poker hand', () => {
  const g = create(level(F));
  assert.equal(g.geometry.eligibleMasks.length, 36);
  assert.equal(g.handsLeft, 3);
  assert.equal(g.rerollsLeft, 3);
  const p = previewPath(g, [0, 1, 2, 5, 4]); // 5,5,5,3,5 -> four of a kind
  assert.equal(p.ok, true);
  assert.equal(p.hand.category, 'four_kind');
  assert.equal(p.total, 40);
  assert.equal(previewPath(g, [0, 1, 2, 5]).partial, true);
  assert.equal(previewPath(g, [0, 4, 8, 5, 2]).code, 'DIAGONAL');
  assert.equal(previewPath(g, [0, 1, 2, 5, 8, 7]).code, 'LENGTH');
  assert.throws(() => create(level([5, 5, 5, 2, 5, 3, 6, 6, null])));
});

test('banking refills exactly the five banked cells, keeps the other four, and decrements hands', () => {
  let g = create(level(F));
  const r = bankPath(g, [0, 1, 2, 5, 4], seq([1, 2, 3, 4, 5]));
  assert.equal(r.ok, true);
  g = r.state;
  assert.deepEqual(r.refilled, [0, 1, 2, 5, 4]);
  assert.deepEqual(g.faces, [1, 2, 3, 2, 5, 4, 6, 6, 1]);
  assert.equal(g.handsLeft, 2);
  assert.equal(g.score, 40);
  assert.equal(g.bankedMask, 0);
  assert.equal(g.phase, 'playing');
  assert.throws(() => bankPath(g, [6, 7, 8, 5, 4]), /drawDie/);
});

test('level ends after the hand budget; win iff score >= target; x2 token consumed once and auto-applied on the last hand', () => {
  let g = create(level(F, 50));
  g = toggleBonus(g).state;
  assert.equal(previewPath(g, [0, 1, 2, 5, 4]).total, 80);
  g = bankPath(g, [0, 1, 2, 5, 4], seq([2])).state; // four of a kind x2 = 80
  assert.equal(g.bonus.available, false);
  assert.equal(toggleBonus(g).code, 'BONUS_USED');
  g = bankPath(g, [6, 7, 8, 5, 4], seq([3])).state;
  assert.equal(g.handsLeft, 1);
  const last = previewPath(g, [0, 1, 2, 5, 4]);
  assert.equal(last.autoBonus, false, 'x2 already used');
  g = bankPath(g, [0, 1, 2, 5, 4], seq([4])).state;
  assert.equal(g.handsLeft, 0);
  assert.equal(g.hands.length, 3);
  assert.equal(g.phase, 'won');
  assert.equal(bankPath(g, [0, 1, 2, 5, 4], seq([4])).code, 'PHASE');

  let h = create(level(F, 1000));
  h = bankPath(h, [0, 1, 2, 5, 4], seq([1])).state;
  h = bankPath(h, [0, 1, 2, 5, 4], seq([1])).state;
  const p = previewPath(h, [0, 1, 2, 5, 4]);
  assert.equal(p.autoBonus, true);
  assert.equal(p.multiplier, 2);
  h = bankPath(h, [0, 1, 2, 5, 4], seq([1])).state;
  assert.equal(h.bonus.autoApplied, true);
  assert.equal(h.phase, 'lost');
});

test('endOnTarget stops the level as soon as the target is reached', () => {
  let g = create(level(F, 40), { endOnTarget: true });
  g = bankPath(g, [0, 1, 2, 5, 4], seq([1])).state;
  assert.equal(g.phase, 'won');
  assert.equal(g.handsLeft, 2);
});

test('rerolls skip held and sealed dice, never go negative, and sealed dice cannot be held', () => {
  let g = create(level(F, 30, { sealedMask: maskOf([8]) }));
  g = toggleHold(g, 0).state;
  assert.equal(toggleHold(g, 8).code, 'SEALED');
  assert.deepEqual(rerollTargets(g), [1, 2, 3, 4, 5, 6, 7]);
  g = reroll(g, seq([4])).state;
  assert.deepEqual(g.faces, [5, 4, 4, 4, 4, 4, 4, 4, 1]);
  g = reroll(g, seq([2])).state;
  g = reroll(g, seq([2])).state;
  assert.equal(g.rerollsLeft, 0);
  assert.equal(reroll(g, seq([2])).code, 'NO_REROLLS');
  assert.equal(canReroll(g), false);
  // sealed die loses its seal when banked and refilled (sealedPersist false)
  g = bankPath(g, [8, 7, 6, 3, 0], seq([6])).state;
  assert.equal(g.sealedMask, 0);
});

test('refill off: banked cells stay empty and the level ends when fewer than five dice remain', () => {
  let g = create(level(F, 10), { refill: false });
  g = bankPath(g, [0, 1, 2, 5, 4]).state;
  assert.deepEqual(remainingCells(g), [3, 6, 7, 8]);
  assert.equal(g.phase, 'won');
  assert.equal(previewPath(g, [3, 6, 7, 8, 5]).code, 'PHASE');
});

test('hint is the best-scoring snake and rankSnakes is sorted', () => {
  const g = create(level(F));
  const rows = rankSnakes(g);
  assert.equal(rows.length, 36);
  for (let k = 1; k < rows.length; k++) assert.ok(rows[k - 1].points >= rows[k].points);
  const h = hintFor(g);
  assert.equal(h.hand.category, 'four_kind');
  assert.equal(orderedPathsOf(h.hand.cells).length > 0, true);
  assert.equal(previewPath(g, h.cells).ok, true);
});

test('snapshot/restore round-trips', () => {
  let g = create(level(F));
  g = toggleHold(g, 3).state;
  g = bankPath(g, [0, 1, 2, 5, 4], seq([2, 3])).state;
  const back = restoreGame(JSON.parse(JSON.stringify(snapshotGame(g))));
  assert.deepEqual(back.faces, g.faces);
  assert.equal(back.handsLeft, 2);
  assert.equal(back.score, 40);
  assert.deepEqual(back.held, g.held);
});

test('gold ×2 cell variant: eight dice, 19 snakes, bonus cell is never held, rerolled, refilled or traced', () => {
  const faces = [5, 5, 5, 2, 5, 3, 6, 6, null];
  let g = create({ seed: 'g', levelIndex: 1, tier: 1, faces, bonusIndex: 8, target: 30, hands: 3, rerolls: 3 });
  assert.equal(g.geometry.eligibleMasks.length, 19);
  assert.equal(g.bonusIndex, 8);
  assert.equal(toggleHold(g, 8).code, 'BONUS_CELL');
  assert.equal(previewPath(g, [7, 8, 5, 2, 1]).code, 'BONUS_CELL');
  assert.deepEqual(rerollTargets(g), [0, 1, 2, 3, 4, 5, 6, 7]);
  g = reroll(g, seq([4])).state;
  assert.equal(g.faces[8], null);
  const r = bankPath(g, [0, 1, 2, 5, 4], seq([1]));
  assert.equal(r.ok, true);
  assert.equal(r.state.faces[8], null);
  assert.deepEqual(r.refilled, [0, 1, 2, 5, 4]);
  assert.throws(() => createPokerGame({ seed: 'g', levelIndex: 1, tier: 1, faces: [1, 1, 1, 1, 1, 1, 1, 1, 1], bonusIndex: 8, target: 30 }), /bonus cell/);
  const back = restoreGame(JSON.parse(JSON.stringify(snapshotGame(r.state))));
  assert.equal(back.bonusIndex, 8);
  assert.equal(back.geometry.eligibleMasks.length, 19);
});

test('v2 defaults: two rerolls, no small straight, end on target, Yahtzee-style 50; preview and hint name the carry', () => {
  const g = createPokerGame({ ...level(F), rerolls: undefined });
  assert.equal(g.rerollsLeft, 2);
  assert.equal(g.config.smallStraight, false);
  assert.equal(g.config.endOnTarget, true);
  const p = previewPath(g, [0, 1, 2, 5, 4]);
  assert.equal(p.total, 30);
  assert.deepEqual(p.leaves, [2, 6, 6, 1]);
  const h = hintFor(g);
  assert.equal(h.leaves.length, 4);
  assert.equal(createPokerGame(level([3, 3, 3, 3, 3, 1, 2, 4, 6])).geometry.handSize, 5);
  const five = previewPath(createPokerGame(level([3, 3, 3, 3, 3, 1, 2, 4, 6])), [2, 1, 0, 3, 4]);
  assert.equal(five.hand.category, 'five_kind');
  assert.equal(five.total, 50);
});

test('hint ties are broken toward the better carry', () => {
  // Two four-of-a-kind snakes of 5s; one leaves 6 6 6 1, the other leaves 2 6 6 1.
  const faces = [5, 5, 5, 5, 2, 6, 6, 6, 1];
  const g = createPokerGame(level(faces));
  const rows = rankSnakes(g);
  assert.equal(rows[0].points, rows[1].points);
  assert.ok(rows[0].carry >= rows[1].carry);
});
