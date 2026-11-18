import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyExact, bestHand, AUTO_MULT } from '../src/engine/hands.js';
import {
  createAutoGame, toggleHold, toggleBonus, reroll, currentHand, boardHand, heldHand, playHand, hintFor, canReroll,
  rerollTargets, snapshotGame, restoreGame, diceCells, carryOver, awake, BANK,
} from '../src/engine/auto.js';
import { generateAutoLevel, TIERS3, MIN_DICE3, unlockedKinds, newKind } from '../src/engine/levels3.js';

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

test('the best hand ignores positions and takes only the dice of the combination', () => {
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

test('playing burns every die, held or not (owner, 03.11.2026), and nothing stays selected; a new die takes the used card\'s cell', () => {
  let g = on(createAutoGame(level(L1, F, 10000)), 8);
  g = toggleHold(g, 7).state; // the 1 at the bottom is not in the straight: held, it burns all the same
  g = toggleHold(g, 4).state; // the 3 is in the straight: held, and played
  const r = playHand(g, seq([2]));
  assert.equal(r.ok, true);
  assert.equal(r.hand.category, 'straight');
  assert.deepEqual(r.hand.bonuses, ['x2_any']);
  assert.equal(r.hand.total, 320);
  assert.deepEqual(r.burned, [0, 1, 2, 3, 4, 5, 6, 7]); // every die on the board
  assert.deepEqual(r.spent, [8]);
  assert.deepEqual(r.refilled, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const s = r.state;
  assert.equal(s.faces[7], 2); // thrown anew
  assert.equal(s.held[7], false);
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

test('levels: deterministic, at least six dice, level 1 has the ×2 in the corner, a new hero appears on the level it opens', () => {
  const a = generateAutoLevel({ runSeed: 'r', levelIndex: 3, tier: 3 });
  const b = generateAutoLevel({ runSeed: 'r', levelIndex: 3, tier: 3 });
  assert.deepEqual(a, b);
  const first = generateAutoLevel({ runSeed: 'r', levelIndex: 1, tier: 1 });
  assert.deepEqual(first.layout[8], { type: 'bonus', kind: 'x2_any' });
  assert.equal(first.layout.filter((c) => c.type === 'die').length, 8);
  for (let lv = 1; lv <= 27; lv++) {
    for (let tier = 1; tier <= 5; tier++) {
      for (let s = 0; s < 20; s++) {
        const L = generateAutoLevel({ runSeed: `s${s}`, levelIndex: lv, tier });
        const nDice = L.layout.filter((c) => c.type === 'die').length;
        assert.ok(nDice >= MIN_DICE3);
        assert.equal(L.target, TIERS3[tier].target);
        const kinds = L.layout.filter((c) => c.type === 'bonus').map((c) => c.kind);
        if (newKind(lv)) assert.ok(kinds.includes(newKind(lv)), `level ${lv} tier ${tier} misses ${newKind(lv)}`);
        for (const k of kinds) assert.ok(unlockedKinds(lv).includes(k));
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
  assert.deepEqual(r.burned, [0, 1, 2, 3, 4, 5, 6, 7, 8]); // every die burns
  // one held die is no combination: the best on the board plays, and the held 1 outside it burns too
  const one = toggleHold(createAutoGame(level([D, D, D, D, D, D, D, D, D], [6, 6, 1, 2, 3, 4, 5, 1, 1], 10000)), 7).state;
  assert.equal(currentHand(one).category, 'straight');
  assert.ok(playHand(one, seq([2])).burned.includes(7));
});

test('the bank (owner, 02.11.2026; «На поле одна», 17.11.2026): a kept card plays from the row while the board holds no card, one at a time, joins a hand it fits, is gone once played and never comes onto the board', () => {
  let g = createAutoGame(level(L1, F, 10000, { bank: ['x3_trips', 'x2_any'] }));
  assert.ok(g.bank.every((b) => b.off && !b.used && !b.placed)); // above the board, off
  assert.equal(toggleBonus(g, BANK + 1).code, 'NOT_YET'); // the board's ×2 lies there: the bank waits
  const rolled = reroll(g, seq([1]));
  assert.deepEqual(rolled.state.cells, g.cells); // a reroll brings no card onto the board
  assert.equal(toggleBonus(rolled.state, BANK + 1).code, 'NOT_YET');
  const first = playHand(on(g, 8), seq([2])); // the board's ×2 is played: a new die takes its cell, and the bank opens
  assert.deepEqual([first.spent, first.state.cells[8].type], [[8], 'die']);
  g = first.state;
  const plain = currentHand(g).total; // nine 2s: five of a kind, 10 × 8
  g = on(g, BANK + 1); // the kept ×2 switches on from the row
  assert.equal(currentHand(g).total, plain * 2);
  assert.deepEqual(currentHand(g).bonusCells, [BANK + 1]);
  g = on(g, BANK); // one at a time: the ×3 TRIPS takes the ×2's place
  assert.deepEqual(g.bank.map((b) => b.off), [false, true]);
  g = on(g, BANK + 1);
  assert.deepEqual(g.bank.map((b) => b.off), [true, false]);
  assert.equal(toggleBonus(g, BANK + 5).ok, false); // no such place
  const again = reroll(g, seq([1])); // a reroll switches the bank off as well
  assert.ok(again.state.bank.every((b) => b.off));
  assert.deepEqual(again.state.cells, g.cells);
  const r = playHand(g, seq([2]));
  assert.deepEqual(r.hand.bonuses, ['x2_any']);
  assert.deepEqual(r.spent, []); // a card played from the bank frees no cell on the board
  assert.deepEqual(r.state.bank.map((b) => b.used), [false, true]);
  assert.equal(toggleBonus(r.state, BANK + 1).ok, false); // a played one cannot be switched again
  const back = restoreGame(snapshotGame(r.state));
  assert.deepEqual(back.bank, r.state.bank);
});

test('a won level carries every unplayed bonus: the bank still waiting first, then the board in order (the bank keeps three, the player chooses past them)', () => {
  const lv = level([D, D, D, D, D, B('x3_pairs'), D, B('joker'), B('x2_any')], [6, 6, 6, 6, 1, null, 2, null, null], 10, { bank: ['x3_trips', 'refund'] });
  let g = createAutoGame(lv);
  g = toggleBonus(g, 8).state; // the ×2 joins the four of a kind and is used, before any reroll
  const r = playHand(g, seq([3]));
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.cells[8].type, 'die'); // a new die takes the ×2's cell
  assert.deepEqual(carryOver(r.state), ['x3_trips', 'refund', 'x3_pairs', 'joker']); // the joker is fourth: it waits for the player's choice (keepCard)
});

test('a game saved before «На поле одна» keeps the card that came in on its first reroll: it plays on the board, the bank waits while it lies there, and none counts twice', () => {
  const lv = level([D, D, D, D, D, D, D, D, B('x2_any')], [5, 5, 1, 1, 2, 3, 6, 4, null], 10000, { bank: ['x3_pairs', 'joker'] });
  let g = restoreGame({
    ...snapshotGame(createAutoGame(lv)),
    cells: [D, D, { type: 'bonus', kind: 'x3_pairs', fromBank: 0 }, D, D, D, D, D, B('x2_any')],
    faces: [5, 5, null, 1, 1, 2, 3, 6, null],
    off: [false, false, true, false, false, false, false, false, true],
    bank: [{ kind: 'x3_pairs', off: true, used: false, placed: true }, { kind: 'joker', off: true, used: false, placed: false }],
    stats: { rerollsUsed: 1, holdToggles: 0, rejectedPaths: 0, hintsUsed: 0, bonusToggles: 0 },
  });
  assert.equal(toggleBonus(g, BANK + 1).code, 'NOT_YET'); // cards lie on the board: the joker waits
  assert.deepEqual(carryOver(g), ['joker', 'x3_pairs', 'x2_any']); // the ×3 PAIRS once, from the board
  const r = playHand(on(g, 2), seq([4])); // two pairs, 5s and 1s, ×3
  assert.deepEqual([r.hand.bonuses, r.state.cells[2].type], [['x3_pairs'], 'die']);
  assert.ok(r.state.cells.every((c) => c.type !== 'hole'));
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


// MOON OWL, ×4 LAST HAND (owner, 10.11.2026: LORE §3.2 and §6 item 1): it fits any hand, but only the level's last.
const owlBoard = (extra = {}) => level([D, D, D, D, D, D, D, D, B('x4_any')], [2, 2, 3, 5, 6, 1, 4, 1, null], 10000, extra);
const pairs = seq([3, 3, 1, 5, 6, 2, 4, 1]); // every refill brings a pair of 3s

test('×4 LAST HAND shows on the counter only on the last hand, and is not used up before it', () => {
  let g = createAutoGame(owlBoard());
  g = toggleBonus(g, 8).state; // switched on at once
  assert.equal(g.off[8], false);
  for (const left of [3, 2]) {
    assert.equal(g.handsLeft, left);
    assert.equal(awake(g, 'x4_any'), false);
    const h = currentHand(g);
    assert.equal(h.bonusMult, 1); // no ×4 on the counter
    assert.deepEqual(h.bonusCells, []);
    const r = playHand(g, pairs);
    assert.deepEqual(r.hand.bonuses, []);
    assert.equal(r.hand.multiplier, 1);
    g = r.state;
    assert.deepEqual(g.cells[8], B('x4_any')); // still on the board, still on
    assert.equal(g.off[8], false);
  }
  assert.equal(g.handsLeft, 1);
  const last = currentHand(g);
  assert.equal(last.bonusMult, 4);
  assert.deepEqual(last.bonusCells, [8]);
  const r = playHand(g, pairs);
  assert.deepEqual(r.hand.bonuses, ['x4_any']);
  assert.equal(r.hand.total, r.hand.points * 4);
  assert.equal(r.state.cells[8].type, 'die'); // used: a new die takes its cell
});

test('×4 LAST HAND under IRON WARDEN wakes on the second hand, the same hand as LATE BLOOM', () => {
  let g = createAutoGame(owlBoard({ hands: 2, boss: 'robot', things: [{ id: 'late_bloom', stars: 1 }] }));
  g = toggleBonus(g, 8).state;
  const first = currentHand(g);
  assert.equal(first.bonusMult, 1);
  assert.equal(first.mult, AUTO_MULT[first.category]); // LATE BLOOM sleeps too
  assert.deepEqual(first.things, []);
  g = playHand(g, pairs).state;
  assert.equal(g.handsLeft, 1);
  const h = currentHand(g);
  assert.equal(h.bonusMult, 4);
  assert.equal(h.mult, AUTO_MULT[h.category] + 1); // both wake for the last hand
  assert.deepEqual(h.things, ['late_bloom']);
  assert.equal(h.total, h.points * 4);
});

test('×4 LAST HAND from the bank waits like the board card; a reroll switches it off as any card', () => {
  let g = createAutoGame(level([D, D, D, D, D, D, D, D, D], [2, 2, 3, 5, 6, 1, 4, 1, 6], 10000, { bank: ['x4_any'] }));
  g = toggleBonus(g, BANK).state; // nine dice and no card on the board: the owl switches on from the row
  assert.equal(currentHand(g).bonusMult, 1);
  g = playHand(g, pairs).state;
  g = playHand(g, pairs).state;
  assert.equal(g.bank[0].off, false);
  assert.equal(currentHand(g).bonusMult, 4);
  g = reroll(g, seq([3])).state;
  assert.equal(g.bank[0].off, true); // a reroll clears it like every card: the player switches it on again
  assert.equal(currentHand(g).bonusMult, 1);
});

// ---------- the card-things (portals step 4, MODE3-PLAN §58) ----------
test('the card-things fit their hands and no other, and add up with the heroes\' cards', () => {
  const mult = (faces, kinds) => bestHand(dice(faces), kinds.map((kind, k) => ({ cell: 9 + k, kind }))).bonusMult;
  assert.equal(mult([4, 4, 4, 4], ['big_bang']), 4);
  assert.equal(mult([4, 4, 4, 4, 4], ['big_bang']), 4);
  assert.equal(mult([4, 4, 4], ['big_bang']), 1);
  assert.equal(mult([5, 5, 5], ['hot_trips']), 4);
  assert.equal(mult([5, 5, 5, 2, 2], ['hot_trips']), 4, 'a full house holds its trips, as the TRIPS hero\'s card says');
  assert.equal(mult([5, 5], ['hot_trips']), 1);
  assert.equal(mult([3, 3], ['odd_punk']), 3);
  assert.equal(mult([3, 3, 5, 5], ['odd_punk']), 3);
  assert.equal(mult([2, 2], ['odd_punk']), 1);
  assert.equal(mult([1, 2, 3, 4, 5], ['odd_punk']), 1, 'no straight is of one parity');
  assert.equal(mult([4, 4], ['even_floor']), 3);
  assert.equal(mult([6, 6, 2, 2], ['even_floor']), 3);
  assert.equal(mult([3, 3], ['even_floor']), 1);
  assert.equal(mult([3, 3], ['odd_punk', 'x2_any']), 4, 'cards add up: ×3 and ×2 make ×4');
  const j = bestHand(dice([5, 5, 2]), [{ cell: 9, kind: 'odd_punk' }, { cell: 10, kind: 'joker' }]);
  assert.ok(j.jokerFaces.every((f) => f % 2 === 1) && j.bonusMult === 3, 'a joker\'s face counts as a die\'s for the parity');
});

test('POWER PAINT joins only a hand a card with a number joins, raises each by one, and alone stays unspent', () => {
  const at = (faces, kinds) => bestHand(dice(faces), kinds.map((kind, k) => ({ cell: 9 + k, kind })));
  assert.deepEqual(at([5, 5], ['power_paint']).bonusCells, [], 'alone it is not in the hand');
  const two = at([5, 5], ['power_paint', 'x2_any']);
  assert.deepEqual([two.bonusMult, [...two.bonusCells].sort((x, y) => x - y)], [3, [9, 10]], '×2 AS ×3');
  const both = at([5, 5], ['power_paint', 'x2_any', 'odd_punk']);
  assert.equal(both.bonusMult, 6, 'every other card: ×3 and ×4 make ×6');
  const back = at([5, 5], ['power_paint', 'refund']);
  assert.deepEqual([back.bonusMult, back.refund], [1, 2], 'REFUND +1 AS +2');
  assert.deepEqual(at([5, 5], ['power_paint', 'second_wind']).bonusCells, [10], 'SECOND WIND has no number to raise');
  // on the board: played alone it stays where it lies; with a ×2 it is used up with it
  const lay = [D, D, D, D, D, D, D, B('power_paint'), D];
  let g = createAutoGame(level(lay, [5, 5, 1, 2, 3, 6, 4, null, 4], 9999));
  g = toggleBonus(g, 7).state;
  const r = playHand(g, seq([2]));
  assert.ok(r.state.cells[7].type === 'bonus' && r.state.cells[7].kind === 'power_paint' && !r.hand.bonuses.length);
  let h = createAutoGame(level([D, D, D, D, D, D, B('x2_any'), B('power_paint'), D], [5, 5, 1, 2, 3, 6, null, null, 4], 9999));
  h = toggleBonus(toggleBonus(h, 6).state, 7).state;
  const p = playHand(h, seq([2]));
  assert.deepEqual([p.hand.multiplier, [...p.hand.bonuses].sort(), p.state.cells[7].type], [3, ['power_paint', 'x2_any'], 'die']);
});

test('SECOND WIND: the hand it joins costs no PLAY, and the card is gone after it', () => {
  let g = createAutoGame(level([D, D, D, D, D, D, D, B('second_wind'), D], [5, 5, 1, 2, 3, 6, 4, null, 4], 9999));
  g = toggleBonus(g, 7).state;
  assert.equal(currentHand(g).bonusMult, 1, 'it multiplies nothing');
  const r = playHand(g, seq([2, 3]));
  assert.deepEqual([r.hand.free, r.state.handsLeft, r.state.cells[7].type, r.state.hands.length], [true, 3, 'die', 1]);
  const next = playHand(r.state, seq([1]));
  assert.deepEqual([next.hand.free, next.state.handsLeft], [false, 2]);
});

test('a card-thing bought waits in the bank, plays from its row, and goes back to the bank unplayed', () => {
  const g = createAutoGame(level([D, D, D, D, D, D, D, D, D], [5, 5, 1, 2, 3, 6, 4, 2, 3], 9999, { bank: ['odd_punk'] }));
  const r = reroll(g, seq([3]));
  assert.deepEqual(r.state.cells, g.cells, 'it never comes onto the board');
  const s = toggleBonus(r.state, BANK).state; // nine 3s, all odd: it joins
  assert.deepEqual([currentHand(s).bonusMult, currentHand(s).bonusCells], [3, [BANK]]);
  assert.deepEqual(carryOver(s), ['odd_punk'], 'unplayed, it waits for the next level');
});

