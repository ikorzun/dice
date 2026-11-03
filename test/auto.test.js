import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyExact, bestHand } from '../src/engine/hands.js';
import {
  createAutoGame, toggleHold, toggleBonus, reroll, currentHand, boardHand, heldHand, playHand, hintFor, canReroll,
  rerollTargets, snapshotGame, restoreGame, diceCells, carryOver, BANK,
} from '../src/engine/auto.js';
import { generateAutoLevel, TIERS3, MIN_DICE3, BONUS_UNLOCKS } from '../src/engine/levels3.js';

const D = { type: 'die' };
const B = (kind) => ({ type: 'bonus', kind });
const X = { type: 'block' };
// layout + faces (null where there is no die)
const level = (layout, faces, target = 100, extra = {}) => ({ seed: 'a', levelIndex: 1, tier: 1, layout, faces, target, hands: 3, rerolls: 3, ...extra });
const seq = (values) => { let k = 0; return () => values[k++ % values.length]; };
const dice = (faces) => faces.map((face, cell) => ({ cell, face, held: false }));

test('classifyExact accepts only sets where every die is part of the combination', () => {
  assert.equal(classifyExact([4, 4]), 'pair');
  assert.equal(classifyExact([4, 5]), null);
  assert.equal(classifyExact([2, 2, 2]), 'three_kind');
  assert.equal(classifyExact([3, 3, 5, 5]), 'two_pairs');
  assert.equal(classifyExact([3, 3, 3, 5]), null);
  assert.equal(classifyExact([1, 1, 1, 1]), 'four_kind');
  assert.equal(classifyExact([6, 6, 6, 6, 6]), 'five_kind');
  assert.equal(classifyExact([2, 2, 5, 5, 5]), 'full_house');
  assert.equal(classifyExact([5, 3, 1, 2, 4]), 'straight');
  assert.equal(classifyExact([2, 3, 4, 5, 6]), 'straight');
  assert.equal(classifyExact([1, 2, 3, 4, 6]), null);
  assert.equal(classifyExact([4, 2, 3, 1]), 'small_straight');
  assert.equal(classifyExact([3, 6, 4, 5]), 'small_straight');
  assert.equal(classifyExact([1, 2, 3, 5]), null);
  assert.equal(classifyExact([6, 6, 6, 1, 2]), null);
});

test('the best hand ignores positions and burns only the dice of the combination', () => {
  // three 6s scattered over the board beat the pair of 5s and the straight-less rest
  const h = bestHand(dice([6, 1, 5, 6, 2, 5, 3, 6]));
  assert.equal(h.category, 'full_house'); // 6 6 6 5 5 = 28 × 5
  assert.deepEqual(h.cells, [0, 2, 3, 5, 7]);
  assert.equal(h.points, 140);
  assert.equal(h.total, 140);
  // 1 2 3 4 6 is no straight, but 1 2 3 4 is a small straight (10 × 3 = 30): it beats the pair of 6s (24)
  const run = bestHand(dice([6, 1, 2, 6, 4, 3]));
  assert.equal(run.category, 'small_straight');
  assert.deepEqual(run.cells, [1, 2, 4, 5]);
  assert.equal(run.points, 30);
  // without a run of four the pair of 6s at opposite corners is the hand
  const pair = bestHand(dice([6, 1, 2, 6, 5, 3]));
  assert.equal(pair.category, 'pair');
  assert.deepEqual(pair.cells, [0, 3]);
});

test('a pair is two dice, scored as their sum × 2', () => {
  const h = bestHand(dice([6, 1, 2, 6, 4, 4]));
  // two pairs 6 6 4 4 = 20 × 3 = 60 beats either pair alone
  assert.equal(h.category, 'two_pairs');
  assert.equal(h.cells.length, 4);
  assert.equal(h.total, 60);
  const p = bestHand(dice([6, 1, 2, 6, 3, 5]).slice(0, 4)); // 6 1 2 6
  assert.equal(p.category, 'pair');
  assert.deepEqual(p.cells, [0, 3]);
  assert.equal(p.total, 24);
});

test('a joker stands in for the best missing face and counts its pips', () => {
  // 2 4 5 6 6 1 + joker: best is the straight 2-3-4-5-6 with the joker as 3 = 20 × 8 = 160
  const h = bestHand(dice([2, 4, 5, 6, 6, 1]), [{ cell: 8, kind: 'joker' }]);
  assert.equal(h.category, 'straight');
  assert.deepEqual(h.jokerCells, [8]);
  assert.deepEqual(h.jokerFaces, [3]);
  assert.equal(h.total, 160);
  // without the joker the board only has a pair of 6s
  assert.equal(bestHand(dice([2, 4, 5, 6, 6, 1])).total, 24);
});

test('applicable bonuses add up (×2 and ×3 make ×4), conditions are respected', () => {
  const pairBoard = dice([6, 6, 1, 2]);
  const h = bestHand(pairBoard, [{ cell: 7, kind: 'x2_any' }, { cell: 8, kind: 'x3_pairs' }]);
  assert.equal(h.category, 'pair');
  assert.deepEqual(h.bonusCells, [7, 8]);
  assert.equal(h.bonusMult, 4);
  assert.equal(h.total, 96);
  assert.equal(bestHand(pairBoard, [{ cell: 7, kind: 'x2_any' }, { cell: 8, kind: 'x3_pairs' }], { stacking: 'multiply' }).total, 144); // the first rule, kept as an experiment
  assert.deepEqual(bestHand(pairBoard, [{ cell: 8, kind: 'x3_straight' }]).bonusCells, []);
});

test('the straight scores ×8; ×3 straight turns a weaker straight into the best hand', () => {
  assert.equal(bestHand(dice([1, 2, 3, 4, 5, 5, 5, 1])).category, 'straight'); // 15 × 8 = 120 > full house 5 5 5 1 1 = 85
  // five 5s (25 × 8 = 200) beat the straight 1-5 (120) on their own; ×3 straight lifts it to 360
  const faces = [1, 2, 3, 4, 5, 5, 5, 5, 5];
  assert.equal(bestHand(dice(faces)).category, 'five_kind');
  const withBonus = bestHand(dice(faces), [{ cell: 9, kind: 'x3_straight' }]);
  assert.equal(withBonus.category, 'straight');
  assert.equal(withBonus.total, 360);
});

// 8 dice + the ×2 in the corner: row0 6 6 1 | row1 2 3 4 | row2 5 1 [×2]
const F = [6, 6, 1, 2, 3, 4, 5, 1, null];
const L1 = [D, D, D, D, D, D, D, D, B('x2_any')];

const on = (g, i) => toggleBonus(g, i).state;

test('the board starts with eight dice and the bonus switched off, three hands and three rerolls', () => {
  const g = createAutoGame(level(L1, F));
  assert.equal(diceCells(g).length, 8);
  assert.equal(g.handsLeft, 3);
  assert.equal(g.rerollsLeft, 3);
  assert.deepEqual(g.off, [false, false, false, false, false, false, false, false, true]);
  const h = currentHand(g);
  assert.equal(h.category, 'straight'); // 2 3 4 5 6 = 20 × 8 = 160; the ×2 is off
  assert.equal(h.total, 160);
  assert.deepEqual(h.bonusCells, []);
  assert.throws(() => createAutoGame(level(L1, [...F.slice(0, 8), 3])));
  assert.throws(() => createAutoGame(level([...L1.slice(0, 8), B('nope')], F)));
});

test('the player switches a bonus on to join the hand, and off again to keep it for later', () => {
  let g = createAutoGame(level(L1, F, 10000)); // a far target: the level goes on after the hand
  const r = toggleBonus(g, 8);
  assert.equal(r.ok, true);
  assert.equal(r.off, false);
  g = r.state;
  assert.equal(currentHand(g).total, 320);
  assert.deepEqual(currentHand(g).bonusCells, [8]);
  assert.equal(toggleBonus(g, 0).code, 'NOT_BONUS');
  g = on(g, 8); // off again
  assert.deepEqual(currentHand(g).bonusCells, []);
  const played = playHand(g, seq([1, 2, 3, 4, 5, 6])).state;
  assert.equal(played.cells[8].type, 'bonus'); // not used, still on the board
  assert.equal(played.off[8], true);
  assert.deepEqual(currentHand(on(played, 8)).bonusCells, [8]); // switched on for the next hand
});

test('reroll changes every unheld die, never bonuses, blocks or held dice; works with nothing held', () => {
  const layout = [D, D, D, D, D, D, X, D, B('x2_any')];
  const faces = [6, 6, 1, 2, 3, 4, null, 1, null];
  let g = createAutoGame(level(layout, faces));
  g = toggleHold(g, 0).state;
  assert.equal(toggleHold(g, 6).code, 'NOT_DIE');
  const r = reroll(g, seq([5]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.rolled, [1, 2, 3, 4, 5, 7]);
  assert.deepEqual(r.state.faces, [6, 5, 5, 5, 5, 5, null, 5, null]);
  assert.equal(r.state.rerollsLeft, 2);
  g = createAutoGame(level(layout, faces));
  assert.equal(reroll(g, seq([2])).ok, true); // nothing held: everything rolls
  for (const i of diceCells(g)) g = toggleHold(g, i).state;
  assert.equal(canReroll(g), false);
  assert.equal(reroll(g, seq([2])).code, 'NOTHING_TO_REROLL');
  let h = createAutoGame(level(layout, faces));
  for (let k = 0; k < 3; k++) h = reroll(h, seq([3])).state;
  assert.equal(reroll(h, seq([3])).code, 'NO_REROLLS');
});

test('a reroll clears every hold and switches every bonus off again: both count for one throw', () => {
  let g = createAutoGame(level(L1, F));
  g = toggleHold(g, 0).state;
  g = on(g, 8);
  const r = reroll(g, seq([5]));
  assert.equal(r.state.faces[0], F[0]); // the held die kept its face through the reroll
  assert.deepEqual(r.state.held, new Array(9).fill(false));
  assert.equal(r.state.off[8], true);
  assert.deepEqual(currentHand(r.state).bonusCells, []);
});

test('the held hand is the best hand among the held dice only', () => {
  let g = createAutoGame(level([D, D, D, D, D, D, D, D, D], [6, 6, 6, 6, 1, 2, 3, 4, 5]));
  assert.equal(heldHand(g), null);
  for (const i of [0, 1, 2]) g = toggleHold(g, i).state;
  assert.equal(heldHand(g).category, 'three_kind');
  g = toggleHold(g, 3).state;
  assert.deepEqual([heldHand(g).category, heldHand(g).cells], ['four_kind', [0, 1, 2, 3]]);
  assert.equal(boardHand(g).category, 'straight'); // the board's best hand (2-6, 160) is another one
  assert.equal(currentHand(g).category, 'four_kind'); // but the player picked the four: it plays (owner, 02.11.2026)
});

test('playing burns the hand and every unheld die; held dice outside the hand stay, no longer held; a new die takes the used card\'s cell', () => {
  let g = on(createAutoGame(level(L1, F, 10000)), 8);
  g = toggleHold(g, 7).state; // the 1 at the bottom is not in the straight
  g = toggleHold(g, 4).state; // the 3 is in the straight: held, but played, so it burns
  const r = playHand(g, seq([2]));
  assert.equal(r.ok, true);
  assert.equal(r.hand.category, 'straight');
  assert.deepEqual(r.hand.bonuses, ['x2_any']);
  assert.equal(r.hand.total, 320);
  assert.deepEqual(r.burned, [0, 1, 2, 3, 4, 5, 6]); // the straight + the unheld 6 and 1
  assert.deepEqual(r.spent, [8]);
  assert.deepEqual(r.placed, []); // nothing waits in the bank: a new die
  assert.deepEqual(r.refilled, [0, 1, 2, 3, 4, 5, 6, 8]);
  const s = r.state;
  assert.equal(s.faces[7], 1);
  assert.equal(s.held[7], false); // it stayed, but nothing stays selected after a hand
  assert.equal(s.held[4], false);
  assert.equal(s.cells[8].type, 'die');
  assert.equal(s.faces[8], 2);
  assert.equal(s.off[8], false);
  assert.equal(s.score, 320);
  assert.equal(s.handsLeft, 2);
  assert.equal(s.phase, 'playing');
});

test('a refund bonus joins any hand without multiplying it, gives a reroll back and makes way for a new die', () => {
  const layout = [...L1.slice(0, 8), B('refund')];
  let g = createAutoGame(level(layout, F));
  g = reroll(g, seq([1, 2, 3, 4, 5, 6, 1, 2])).state; // spend one of the three rerolls
  assert.equal(g.rerollsLeft, 2);
  const off = currentHand(g);
  g = on(g, 8);
  const h = currentHand(g);
  assert.deepEqual(h.bonusCells, [8]);
  assert.equal(h.bonusMult, 1);
  assert.equal(h.total, off.total);
  const r = playHand(g, seq([2]));
  assert.deepEqual(r.hand.bonuses, ['refund']);
  assert.equal(r.hand.refund, 1);
  assert.deepEqual(r.spent, [8]);
  assert.equal(r.state.rerollsLeft, 3);
  assert.equal(r.state.cells[8].type, 'die');
  // switched off it stays on the board and the rerolls do not change
  const kept = playHand(createAutoGame(level(layout, F)), seq([2]));
  assert.equal(kept.hand.refund, 0);
  assert.equal(kept.state.rerollsLeft, 3);
  assert.equal(kept.state.cells[8].type, 'bonus');
});

test('a level ends as soon as the score reaches the target, otherwise after three hands', () => {
  let g = createAutoGame(level(L1, F, 50));
  g = playHand(g, seq([6])).state;
  assert.ok(g.score >= 50);
  assert.equal(g.phase, 'won');
  assert.equal(g.handsLeft, 2);
  assert.equal(playHand(g, seq([6])).code, 'PHASE');
  const lost = [1, 2, 3].reduce((s) => playHand(s, seq([1, 2, 3, 4, 6])).state, createAutoGame(level(L1, F, 100000)));
  assert.equal(lost.phase, 'lost');
});

test('a board without a combination cannot be played', () => {
  const layout = [D, D, D, D, D, X, X, X, X];
  const g = createAutoGame(level(layout, [1, 2, 4, 5, 6, null, null, null, null])); // no pair, no run of four
  assert.equal(currentHand(g), null);
  assert.equal(hintFor(g), null);
  assert.equal(playHand(g, seq([1])).code, 'NO_HAND');
});

test('snapshot and restore round-trip a game in progress', () => {
  let g = createAutoGame(level(L1, F));
  g = toggleHold(g, 7).state;
  g = reroll(g, seq([4, 5])).state;
  g = toggleBonus(g, 8).state;
  g = playHand(g, seq([3])).state;
  const back = restoreGame(JSON.parse(JSON.stringify(snapshotGame(g))));
  assert.deepEqual(back.off, g.off);
  assert.deepEqual(back.faces, g.faces);
  assert.deepEqual(back.cells, g.cells);
  assert.deepEqual(back.held, g.held);
  assert.equal(back.score, g.score);
  assert.equal(back.handsLeft, g.handsLeft);
  assert.equal(back.rerollsLeft, g.rerollsLeft);
  assert.deepEqual(currentHand(back), currentHand(g));
  assert.deepEqual(rerollTargets(back), rerollTargets(g));
});

test('six dice always hold a hand (exhaustive over 6^6 boards)', () => {
  for (let code = 0; code < 6 ** 6; code++) {
    const faces = [];
    for (let k = 0, c = code; k < 6; k++, c = Math.floor(c / 6)) faces.push(1 + (c % 6));
    assert.ok(bestHand(dice(faces)), `no hand on ${faces}`);
  }
});

test('levels: deterministic, at least six dice, level 1 has the ×2 in the corner, a new kind appears when unlocked', () => {
  const a = generateAutoLevel({ runSeed: 'r', levelIndex: 3, tier: 3 });
  const b = generateAutoLevel({ runSeed: 'r', levelIndex: 3, tier: 3 });
  assert.deepEqual(a, b);
  const first = generateAutoLevel({ runSeed: 'r', levelIndex: 1, tier: 1 });
  assert.deepEqual(first.layout[8], { type: 'bonus', kind: 'x2_any' });
  assert.equal(first.layout.filter((c) => c.type === 'die').length, 8);
  for (let lv = 1; lv <= 8; lv++) {
    for (let tier = 1; tier <= 5; tier++) {
      for (let s = 0; s < 20; s++) {
        const L = generateAutoLevel({ runSeed: `s${s}`, levelIndex: lv, tier });
        const nDice = L.layout.filter((c) => c.type === 'die').length;
        assert.ok(nDice >= MIN_DICE3);
        assert.equal(L.target, TIERS3[tier].target);
        const kinds = L.layout.filter((c) => c.type === 'bonus').map((c) => c.kind);
        if (lv <= BONUS_UNLOCKS.length) assert.ok(kinds.includes(BONUS_UNLOCKS[lv - 1]), `level ${lv} tier ${tier} misses ${BONUS_UNLOCKS[lv - 1]}`);
        for (const k of kinds) assert.ok(BONUS_UNLOCKS.slice(0, Math.max(lv, 1)).includes(k));
        assert.ok(L.openingBest > 0);
        createAutoGame(L, {});
      }
    }
  }
});

test('the player picks the hand by holding its dice (owner, 02.11.2026); a held die alone keeps the best', () => {
  // the board's best is the straight 2-6; holding the two 6s picks the pair of them instead
  let g = createAutoGame(level([D, D, D, D, D, D, D, D, D], [6, 6, 1, 2, 3, 4, 5, 1, 1], 10000));
  assert.equal(currentHand(g).category, 'straight');
  g = toggleHold(toggleHold(g, 0).state, 1).state;
  assert.deepEqual([currentHand(g).category, currentHand(g).cells], ['pair', [0, 1]]);
  const r = playHand(g, seq([2]));
  assert.equal(r.hand.category, 'pair');
  assert.deepEqual(r.burned, [0, 1, 2, 3, 4, 5, 6, 7, 8]); // the pair, and every die not held
  // one held die is no combination: the best on the board plays, and the held 1 outside it stays
  const one = toggleHold(createAutoGame(level([D, D, D, D, D, D, D, D, D], [6, 6, 1, 2, 3, 4, 5, 1, 1], 10000)), 7).state;
  assert.equal(currentHand(one).category, 'straight');
  assert.ok(!playHand(one, seq([2])).burned.includes(7));
});

test('the bank (owner, 02.11.2026): a banked bonus comes in on the first reroll; one left above switches on by tap, joins a hand it fits and is gone once played', () => {
  let g = createAutoGame(level(L1, F, 10000, { bank: ['x3_trips', 'x2_any'] }));
  const plain = currentHand(g).total; // the straight 2-6 = 20 × 8
  assert.ok(g.bank.every((b) => b.off && !b.used && !b.placed)); // above the board, off
  assert.equal(toggleBonus(g, BANK + 1).code, 'NOT_YET'); // not in play before the level's first reroll (owner, 03.11.2026)
  for (const i of [0, 1, 3, 4, 5, 6, 7]) g = toggleHold(g, i).state; // only the 1 at cell 2 is rerolled
  const first = reroll(g, seq([1]));
  assert.deepEqual(first.placed, [{ cell: 2, from: 0 }]); // the ×3 TRIPS comes in on that die's cell
  assert.deepEqual(first.rolled, []);
  g = first.state;
  assert.deepEqual(g.cells[2], { type: 'bonus', kind: 'x3_trips', fromBank: 0 });
  assert.deepEqual([g.faces[2], g.off[2]], [null, true]); // it lands off like every card
  assert.deepEqual(g.bank.map((b) => b.placed), [true, false]); // the ×2 found no die: it waits above
  assert.equal(currentHand(g).total, plain);
  g = toggleBonus(g, BANK + 1).state; // from now on it switches on
  assert.equal(currentHand(g).total, plain * 2);
  assert.deepEqual(currentHand(g).bonusCells, [BANK + 1]);
  assert.equal(toggleBonus(g, BANK + 5).ok, false); // no such place
  assert.equal(toggleBonus(g, BANK).ok, false); // the one on the board switches there, not in the bank
  const again = reroll(g, seq([1])); // a reroll switches the bank off as well; only the first brings cards in
  assert.ok(again.state.bank.every((b) => b.off));
  assert.deepEqual(again.placed, []);
  const r = playHand(g, seq([2]));
  assert.deepEqual(r.hand.bonuses, ['x2_any']);
  assert.deepEqual(r.spent, []); // a card played from the bank frees no cell on the board
  assert.deepEqual(r.state.bank.map((b) => b.used), [false, true]);
  assert.equal(toggleBonus(r.state, BANK + 1).ok, false); // a played one cannot be switched again
  const back = restoreGame(snapshotGame(r.state));
  assert.deepEqual(back.bank, r.state.bank);
});

test('a won level carries the unplayed bonuses: the bank still waiting first, then the board in order, three at most', () => {
  const lv = level([D, D, D, D, D, B('x3_pairs'), D, B('joker'), B('x2_any')], [6, 6, 6, 6, 1, null, 2, null, null], 10, { bank: ['x3_trips', 'refund'] });
  let g = createAutoGame(lv);
  g = toggleBonus(g, 8).state; // the ×2 joins the four of a kind and is used, before any reroll
  const r = playHand(g, seq([3]));
  assert.equal(r.state.phase, 'won');
  assert.deepEqual(r.placed, []); // before the first reroll the bank is not in play: a new die takes the ×2's cell
  assert.deepEqual(carryOver(r.state), ['x3_trips', 'refund', 'x3_pairs']); // the joker is fourth: it burns
});

test('kept cards come in on the first reroll (owner, 03.11.2026): in place of rerolled dice, in order, while six dice stay; the rest wait above, and a played card makes way for the next', () => {
  const lv = level([D, D, D, D, D, D, D, D, B('x2_any')], [6, 6, 1, 6, 1, 2, 4, 3, null], 10000, { bank: ['x3_pairs', 'joker', 'x3_trips'] });
  let g = createAutoGame(lv);
  assert.deepEqual(g.bank.map((b) => b.placed), [false, false, false]); // the first round is the level's own board
  for (const i of [0, 1, 3, 7]) g = toggleHold(g, i).state; // the dice at 2, 4, 5 and 6 are rerolled
  const first = reroll(g, seq([5]));
  // eight dice, six must stay: two cards come in, on the first rerolled cells; the ×3 TRIPS waits above
  assert.deepEqual(first.placed, [{ cell: 2, from: 0 }, { cell: 4, from: 1 }]);
  assert.deepEqual(first.rolled, [5, 6]);
  g = first.state;
  assert.deepEqual(g.cells[2], { type: 'bonus', kind: 'x3_pairs', fromBank: 0 });
  assert.deepEqual(g.cells[4], { type: 'bonus', kind: 'joker', fromBank: 1 });
  assert.equal(diceCells(g).length, 6);
  assert.deepEqual(g.bank.map((b) => b.placed), [true, true, false]);
  assert.equal(g.off[2] && g.off[4], true); // they land off like every card
  assert.equal(toggleBonus(g, BANK + 2).ok, true); // the one above switches on from now on
  assert.deepEqual(restoreGame(snapshotGame(g)).cells, g.cells);
  // the ×2 is played: the waiting ×3 TRIPS takes its cell; the next card played gets a new die
  g = toggleBonus(g, 8).state;
  const r = playHand(g, seq([4]));
  assert.deepEqual(r.spent, [8]);
  assert.deepEqual(r.placed, [{ cell: 8, from: 2 }]);
  assert.deepEqual(r.state.cells[8], { type: 'bonus', kind: 'x3_trips', fromBank: 2 });
  assert.deepEqual([r.state.off[8], r.state.faces[8]], [true, null]);
  const s = toggleBonus(r.state, 2).state; // the ×3 PAIRS joins a pair of 4s
  const r2 = playHand(s, seq([4]));
  if (r2.hand.bonuses.includes('x3_pairs')) {
    assert.deepEqual(r2.placed, []);
    assert.equal(r2.state.cells[2].type, 'die');
    assert.ok(r2.refilled.includes(2));
  }
  assert.ok([r.state, r2.state].every((st) => st.cells.every((c) => c.type !== 'hole'))); // never a hole
  // six dice and two locks: the board keeps its dice, the locks stay, every kept card waits above, usable now
  let six = createAutoGame(level([D, D, X, D, D, D, X, D, B('x2_any')], [6, 6, null, 6, 1, 2, null, 3, null], 10000, { bank: ['x3_pairs', 'joker'] }));
  const none = reroll(six, seq([5]));
  assert.deepEqual(none.placed, []);
  six = none.state;
  assert.deepEqual([six.cells[2], six.cells[6], diceCells(six).length], [X, X, 6]);
  assert.equal(toggleBonus(six, BANK).ok, true);
});

test('an upgrade raises its combination\'s multiplier by one (owner, 02.11.2026)', () => {
  const faces = [6, 6, 1, 2, 5, 3, 1, 1, null];
  const base = createAutoGame(level(L1, faces, 10000));
  const cat = currentHand(base).category; // the full house 6 6 1 1 1: 15 × 5
  const up = createAutoGame(level(L1, faces, 10000, { ups: { [cat]: 1 } }));
  assert.equal(cat, 'full_house');
  assert.equal(currentHand(up).formula, `${currentHand(base).base} × ${currentHand(base).mult + 1}`);
  assert.equal(currentHand(up).total, currentHand(base).base * (currentHand(base).mult + 1));
});

