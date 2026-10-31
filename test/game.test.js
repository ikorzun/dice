import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, toggleHold, reroll, toggleBonus, previewPath, bankPath, hintFor, remainingCells,
  rerollTargets, canReroll, snapshotGame, restoreGame, markHintUsed,
} from '../src/engine/game.js';
import { maskOf, orderedPathsOf, cellsOf } from '../src/engine/geometry.js';

const level = (faces, target = 10, extra = {}) => ({ seed: 't', levelIndex: 1, tier: 1, bonusIndex: 8, faces, target, rerolls: 2, ...extra });
const F = [1, 1, 3, 4, 2, 2, 6, 6, null]; // row0: 1 1 3 | row1: 4 2 2 | row2: 6 6 x
const die = (values) => { let k = 0; return () => values[k++ % values.length]; };

test('createGame validates the level and starts with two rerolls and an available bonus', () => {
  const g = createGame(level(F));
  assert.equal(g.rerollsLeft, 2);
  assert.equal(g.bonus.available, true);
  assert.equal(g.phase, 'playing');
  assert.throws(() => createGame(level([1, 1, 1, 1, 1, 1, 1, 1, 1])));
  assert.throws(() => createGame(level([1, 1, 1, 1, 1, 1, 1, null, null])));
  assert.throws(() => createGame(level(F, 10, { bonusIndex: 1 })), /no complete partition/);
});

test('hold toggles only ordinary, unbanked dice; reroll changes only unheld unbanked dice', () => {
  let g = createGame(level(F));
  assert.equal(toggleHold(g, 8).code, 'BONUS_CELL');
  g = toggleHold(g, 0).state;
  g = toggleHold(g, 1).state;
  assert.deepEqual(rerollTargets(g), [2, 3, 4, 5, 6, 7]);
  const r = reroll(g, die([5]));
  assert.deepEqual(r.rolled, [2, 3, 4, 5, 6, 7]);
  g = r.state;
  assert.deepEqual(g.faces, [1, 1, 5, 5, 5, 5, 5, 5, null]);
  assert.equal(g.rerollsLeft, 1);
  g = toggleHold(g, 0).state; // release
  assert.equal(g.held[0], false);
  assert.equal(g.stats.holdToggles, 3);
});

test('rerolls never go negative and rerolling with every die held is refused', () => {
  let g = createGame(level(F));
  g = reroll(g, die([3])).state;
  g = reroll(g, die([3])).state;
  assert.equal(g.rerollsLeft, 0);
  assert.equal(reroll(g, die([3])).code, 'NO_REROLLS');
  assert.equal(canReroll(g), false);
  let h = createGame(level(F));
  for (const i of h.geometry.free) h = toggleHold(h, i).state;
  assert.equal(reroll(h, die([3])).code, 'NOTHING_TO_REROLL');
  assert.equal(canReroll(h), false);
});

test('hold cap experiment refuses extra holds', () => {
  let g = createGame(level(F), { maxHolds: 3 });
  g = toggleHold(g, 0).state;
  g = toggleHold(g, 1).state;
  g = toggleHold(g, 2).state;
  assert.equal(toggleHold(g, 3).code, 'HOLD_CAP');
  g = toggleHold(g, 0).state; // release one
  assert.equal(toggleHold(g, 3).ok, true);
});

test('previewPath reports partial progress, category, points, safety and diagonals', () => {
  const g = createGame(level(F));
  assert.deepEqual(previewPath(g, [0, 1]), { ok: true, partial: true, count: 2, mask: 0b11 });
  const p = previewPath(g, [0, 1, 2, 5]); // 1,1,3,2 -> pair
  assert.equal(p.ok, true);
  assert.equal(p.hand.category, 'pair');
  assert.equal(p.total, 2);
  assert.equal(p.safe, true);
  const unsafe = previewPath(g, [0, 1, 4, 5]); // S shape leaves 2,3,6,7 disconnected
  assert.equal(unsafe.safe, false);
  assert.equal(unsafe.safetyCode, 'STRANDS');
  assert.equal(previewPath(g, [0, 4, 5, 2]).code, 'DIAGONAL');
  assert.equal(previewPath(g, [7, 8, 5, 2]).code, 'BONUS_CELL');
});

test('an unsafe first bank is rejected with an explanation and no state change except the counter', () => {
  const g = createGame(level(F));
  const r = bankPath(g, [0, 1, 4, 5]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'STRANDS');
  assert.match(r.message, /no valid second hand/);
  assert.equal(r.state.hands.length, 0);
  assert.equal(r.state.bankedMask, 0);
  assert.equal(r.state.stats.rejectedPaths, 1);
  for (const code of [['LENGTH', [0, 1, 2]], ['DIAGONAL', [0, 4, 5, 2]], ['REVISIT', [0, 1, 0, 3]]]) {
    assert.equal(bankPath(g, code[1]).code, code[0]);
  }
});

test('full level: two irreversible hands exhaust the eight dice, bonus consumed exactly once, win/loss decided', () => {
  let g = createGame(level(F, 10));
  // first hand 6,6 + 4,2 -> cells 6,7,3,4 -> path 6-7-4-3 : faces 6,6,2,4 -> pair (2). Arm bonus -> 4.
  g = toggleBonus(g).state;
  assert.equal(g.bonus.armed, true);
  const p = previewPath(g, [6, 7, 4, 3]);
  assert.equal(p.multiplier, 2);
  assert.equal(p.total, 4);
  let r = bankPath(g, [6, 7, 4, 3]);
  assert.equal(r.ok, true);
  g = r.state;
  assert.equal(g.score, 4);
  assert.equal(g.bonus.available, false);
  assert.equal(g.bonus.usedOnHand, 0);
  assert.deepEqual(remainingCells(g), [0, 1, 2, 5]);
  assert.equal(toggleBonus(g).code, 'BONUS_USED');
  assert.equal(bankPath(g, [6, 7, 4, 3]).code, 'BANKED', 'no duplicate banking');
  assert.equal(bankPath(g, [0, 1, 2, 3]).code, 'BANKED');
  // rerolls still usable on remaining dice only
  g = toggleHold(g, 0).state;
  r = reroll(g, die([1]));
  assert.deepEqual(r.rolled, [1, 2, 5]);
  g = r.state;
  assert.deepEqual(g.faces.slice(0, 8), [1, 1, 1, 4, 2, 1, 6, 6]);
  // second hand must be the remaining four: 0,1,2,5 = 1,1,1,1 -> four of a kind 30
  assert.equal(bankPath(g, [0, 1, 4, 5]).code, 'BANKED');
  r = bankPath(g, [5, 2, 1, 0]);
  assert.equal(r.ok, true);
  g = r.state;
  assert.equal(g.hands.length, 2);
  assert.equal(g.hands[1].multiplier, 1, 'bonus was already consumed');
  assert.equal(g.score, 34);
  assert.equal(g.phase, 'won');
  assert.equal(g.bankedMask, g.geometry.freeMask);
  assert.equal(bankPath(g, [0, 1, 2, 5]).code, 'PHASE');
  assert.equal(toggleHold(g, 0).code, 'PHASE');
  assert.equal(reroll(g, die([1])).code, 'PHASE');
});

test('unused ×2 is auto-applied to the final hand (documented deviation) and can be disabled', () => {
  let g = createGame(level(F, 100));
  g = bankPath(g, [0, 1, 2, 5]).state; // pair -> 2
  assert.equal(g.bonus.available, true);
  const p = previewPath(g, [3, 4, 7, 6]); // 4,2,6,6 -> pair 2 -> x2 auto
  assert.equal(p.autoBonus, true);
  assert.equal(p.total, 4);
  g = bankPath(g, [3, 4, 7, 6]).state;
  assert.equal(g.score, 6);
  assert.equal(g.bonus.autoApplied, true);
  assert.equal(g.hands[1].bonusAuto, true);
  assert.equal(g.phase, 'lost');

  let h = createGame(level(F, 100), { autoBonusOnFinalHand: false });
  h = bankPath(h, [0, 1, 2, 5]).state;
  const q = previewPath(h, [3, 4, 7, 6]);
  assert.equal(q.autoBonus, false);
  assert.equal(q.total, 2);
  h = bankPath(h, [3, 4, 7, 6]).state;
  assert.equal(h.score, 4);
  assert.equal(h.bonus.available, true);
});

test('second hand must use all four remaining dice', () => {
  let g = createGame(level(F, 10));
  g = bankPath(g, [3, 0, 1, 2]).state; // L-shaped path; remaining 4,5,6,7
  assert.equal(bankPath(createGame(level(F, 10)), [0, 1, 2, 3]).code, 'NOT_ADJACENT', '{0,1,2,3} is a legal set but 2→3 is not a legal step');
  const bad = bankPath(g, [4, 5, 2, 1]);
  assert.equal(bad.code, 'BANKED');
  assert.equal(previewPath(g, [4, 5, 2, 1]).code, 'BANKED');
  const ok = bankPath(g, [5, 4, 7, 6]);
  assert.equal(ok.ok, true);
});

test('hint returns a safe first hand backed by the solver, then the forced final hand', () => {
  let g = createGame(level(F, 10));
  const h1 = hintFor(g);
  assert.ok(g.geometry.safeSet.has(maskOf(h1.cells)));
  assert.equal(previewPath(g, h1.cells).safe, true);
  assert.equal(h1.projected, 12); // best: {6,7,3,4}? pair(2) + {0,1,2,5} pair(2)... solver picks max with bonus
  g = markHintUsed(g);
  assert.equal(g.stats.hintsUsed, 1);
  g = bankPath(g, h1.cells).state;
  const h2 = hintFor(g);
  assert.deepEqual([...h2.cells].sort(), remainingCells(g));
  assert.deepEqual(orderedPathsOf(remainingCells(g)).length > 0, true);
  g = bankPath(g, h2.cells).state;
  assert.equal(hintFor(g), null);
});

test('snapshot/restore round-trips the state', () => {
  let g = createGame(level(F, 10));
  g = toggleHold(g, 2).state;
  g = toggleBonus(g).state;
  g = bankPath(g, [6, 7, 4, 3]).state;
  const snap = JSON.parse(JSON.stringify(snapshotGame(g)));
  const back = restoreGame(snap);
  assert.deepEqual(back.faces, g.faces);
  assert.deepEqual(back.held, g.held);
  assert.equal(back.bankedMask, g.bankedMask);
  assert.deepEqual(back.bonus, g.bonus);
  assert.equal(back.score, g.score);
  assert.deepEqual(cellsOf(back.geometry.freeMask), cellsOf(g.geometry.freeMask));
  assert.equal(previewPath(back, [0, 1, 2, 5]).ok, true);
});

test('every board has a safe first hand regardless of faces (guard can never deadlock)', () => {
  const g = createGame(level(F, 10));
  assert.ok(g.geometry.safeSet.size >= 1);
  for (const m of g.geometry.safeSet) assert.equal(previewPath(g, orderedPathsOf(cellsOf(m))[0]).safe, true);
});

test('strandedCells names the dice a stranding first hand would cut off', async () => {
  const { strandedCells } = await import('../src/engine/game.js');
  const g = createGame(level(F, 10));
  assert.deepEqual(strandedCells(g, maskOf([0, 1, 4, 5])), [2]); // S shape isolates the top-right die
  assert.deepEqual(strandedCells(g, maskOf([0, 1, 4, 7])), [2, 3, 5, 6]); // leaves two equal pairs {2,5} and {3,6}: all cut off
  assert.deepEqual(strandedCells(g, maskOf([1, 2, 4, 7])), [5]); // leaves {0,3,6} connected and the right 5 isolated
  const p = previewPath(g, [5, 4, 1, 0]);
  assert.equal(p.safe, false);
  assert.deepEqual(p.stranded, [2]);
  const r = bankPath(g, [5, 4, 1, 0]);
  assert.deepEqual(r.stranded, [2]);
  assert.deepEqual(previewPath(g, [0, 1, 2, 5]).stranded, []);
});
