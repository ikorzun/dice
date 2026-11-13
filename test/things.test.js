import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THINGS, THING_PRICE, MAX_STARS, pocketPlaces, numberOf, ruleOf, starsOf, helpsAgainst, cleanPocket, takeThing, thingRules, thingBells, keeperHelp, PORTAL_RINGS, PORTAL_HANDS, portalOdds, portalRarity, portalOf, CATALOGUE, STARTERS, cleanGallery } from '../src/engine/things3.js';
import { bestHand, BONUS_KINDS } from '../src/engine/hands.js';
import { createAutoGame, currentHand, playHand, toggleBonus, toggleHold, reroll, snapshotGame, restoreGame, BANK } from '../src/engine/auto.js';
import { generateRunLevel, runTarget } from '../src/engine/run3.js';
import { levelBells } from '../src/engine/shop3.js';
import { BOSSES, bossOf } from '../src/engine/bosses3.js';
import { existsSync, readFileSync } from 'node:fs';

const dice = (...f) => f.map((face, cell) => ({ cell, face, held: false }));
const seq = (...f) => { let i = 0; return () => f[i++ % f.length]; };
const count = (things, faces, { first = true, last = false, cards = 0, bank = false, keeper = {}, bonuses = [], held = false } = {}) =>
  bestHand(dice(...faces).map((d) => ({ ...d, held })), bonuses, { rules: { ...thingRules(things, { first, last, cards, bank }), ...keeper } });
const one = (id, stars = 1) => [{ id, stars }];
const card = (kind, k = 0, bank = false) => ({ cell: 9 + k, kind, bank });
// Nine cells for a game: d = a die, anything else a card's kind; faces for the dice in order.
const boardOf = (cells, faces, extra = {}) => {
  let k = 0;
  return { mode: 'auto', seed: 't', levelIndex: 12, target: 99999, layout: cells.map((c) => (c === 'd' ? { type: 'die' } : { type: 'bonus', kind: c })), faces: cells.map((c) => (c === 'd' ? faces[k++] : null)), ...extra };
};

test('thirty-six things, each with a picture, a rarity and price, three numbers and a rule that says its number', () => {
  assert.equal(Object.keys(THINGS).length, 36);
  for (const [id, t] of Object.entries(THINGS)) {
    assert.ok(/^\d{4}_\w+$/.test(t.file), id);
    assert.ok(THING_PRICE[t.rarity] > 0, id);
    assert.equal(t.n.length, MAX_STARS, id);
    assert.ok(t.n[0] < t.n[1] && t.n[1] < t.n[2], `${id}: a star raises the number`);
    for (let s = 1; s <= MAX_STARS; s++) assert.ok(/[A-Z]/.test(ruleOf(id, s)) && !ruleOf(id, s).includes('undefined'), id);
    assert.notEqual(ruleOf(id, 1), ruleOf(id, 3), `${id}: the rule shows the star's number`);
    assert.ok(t.from >= 5 && t.from <= 35, id);
    for (const k of t.helps) assert.ok(k === '*' || BOSSES[k], `${id} helps ${k}`);
  }
  assert.ok(!THINGS.pair_chime, 'PAIR CHIME waits for the owner: its picture is the money bell');
});

test('the pocket: 3 places, a 4th after level 15, a 5th after 35; a repeat gains a star in place; a full pocket replaces', () => {
  assert.deepEqual([1, 15, 16, 35, 36, 60].map(pocketPlaces), [3, 3, 4, 4, 5, 5]);
  let p = [];
  for (const id of ['sweet_scoop', 'six_bite', 'lucky_coin']) p = takeThing(p, id, 3).pocket;
  const again = takeThing(p, 'six_bite', 3);
  assert.equal(again.star, 2);
  assert.deepEqual(again.pocket.map((t) => t.stars), [1, 2, 1], 'a star, no place');
  assert.equal(takeThing(again.pocket, 'full_arc', 3).code, 'POCKET_FULL');
  assert.deepEqual(takeThing(again.pocket, 'full_arc', 3, 0).pocket[0], { id: 'full_arc', stars: 1 });
  assert.equal(takeThing(again.pocket, 'full_arc', 4).pocket.length, 4, 'a fourth place takes it');
  let s = again.pocket;
  s = takeThing(s, 'six_bite', 3).pocket;
  assert.equal(starsOf(s, 'six_bite'), 3);
  assert.equal(takeThing(s, 'six_bite', 3).code, 'FULL_STARS');
  assert.deepEqual(cleanPocket([{ id: 'six_bite', stars: 9 }, { id: 'six_bite', stars: 1 }, { id: 'nope' }, { id: 'lucky_coin' }, { id: 'full_arc', stars: 2 }], 2), [{ id: 'six_bite', stars: 3 }, { id: 'lucky_coin', stars: 1 }]);
});

test('sums: every hand, a 3 in it, five dice, the first hand; at 1 and 3 stars', () => {
  assert.equal(count([], [3, 3]).total, 6 * 2);
  assert.equal(count(one('sweet_scoop'), [3, 3]).total, 8 * 2);
  assert.equal(count(one('sweet_scoop', 3), [3, 3]).total, 10 * 2);
  assert.equal(count(one('three_greens'), [3, 3]).total, 9 * 2);
  assert.equal(count(one('three_greens'), [4, 4]).total, 8 * 2, 'no 3: nothing');
  assert.equal(count(one('full_head'), [1, 2, 3, 4, 5]).total, 18 * 8);
  assert.equal(count(one('five_slices', 3), [1, 2, 3, 4, 5]).total, 24 * 8);
  assert.equal(count(one('full_head'), [4, 4]).total, 8 * 2, 'two dice: nothing');
  assert.equal(count(one('first_slice'), [3, 3]).total, 10 * 2);
  assert.equal(count(one('first_slice'), [3, 3], { first: false }).total, 6 * 2, 'a later hand: nothing');
  assert.deepEqual(count([...one('sweet_scoop'), ...one('six_bite')], [3, 3]).things, ['sweet_scoop'], 'a hand names the things that changed it');
});

test('faces: each 1, 4 or 6 adds more; a keeper\'s zero beats it', () => {
  assert.equal(count([], [1, 1]).total, 2 * 2);
  assert.equal(count(one('magnified_one'), [1, 1]).total, 4 * 2); // each 1 adds 2
  assert.equal(count(one('magnified_one', 3), [1, 1]).total, 8 * 2); // each 1 adds 4
  assert.equal(count(one('six_bite'), [6, 6]).total, 14 * 2);
  assert.equal(count(one('cube_four', 3), [4, 4]).total, 14 * 2);
  assert.equal(count(one('six_bite', 3), [6, 6], { keeper: { sixes: 0 } }).total, 0, 'RED EYE: a six adds nothing, whatever a thing says');
  assert.equal(count(one('magnified_one'), [1, 1], { keeper: { ones: 0 } }).total, 0, 'THE GOLDEN BONES');
  assert.equal(count(one('sweet_scoop'), [3, 3], { keeper: { sumAdd: -5 } }).total, 3 * 2, 'THE EATER\'s toll comes after the things');
  assert.equal(count([], [1, 1], { keeper: { sumAdd: -5 } }).total, 0, 'never below zero');
});

test('multipliers: a combination\'s own, and the last hand\'s', () => {
  assert.equal(count(one('matched_pair'), [2, 2]).total, 4 * 3);
  assert.equal(count(one('matched_pair', 3), [2, 2]).total, 4 * 5);
  assert.equal(count(one('double_date'), [2, 2, 3, 3]).total, 10 * 4);
  assert.equal(count(one('full_arc'), [1, 2, 3, 4, 5]).total, 15 * 9);
  assert.equal(count(one('full_arc', 3), [1, 2, 3, 4, 5]).total, 15 * 11);
  assert.equal(count(one('web_step'), [1, 2, 3, 4]).total, 10 * 4);
  assert.equal(count(one('full_arc'), [2, 2]).total, 4 * 2, 'another combination: nothing');
  assert.equal(count(one('late_bloom'), [3, 3]).total, 6 * 2, 'not the last hand');
  assert.equal(count(one('late_bloom', 2), [3, 3], { last: true }).total, 6 * 4);
  assert.equal(bestHand(dice(1, 2, 3, 4, 5), [], { rules: { ...thingRules(one('full_arc'), { first: true, last: false }), half: ['straight'] } }).mult, 5, 'OLD HORNS halves after the things: ×9 → ×5');
});

test('percents: the first hand\'s and the last\'s, after the cards, rounding down', () => {
  assert.equal(count(one('callback'), [5, 5]).total, 24); // 20 +20%
  assert.equal(count(one('callback', 3), [5, 5]).total, 28); // +40%
  assert.equal(count(one('callback'), [5, 5], { first: false }).total, 20);
  assert.equal(count(one('bounce_back'), [5, 5], { first: false, last: true }).total, 23); // 20 +15%
  assert.equal(count(one('callback'), [5, 5], { bonuses: [{ cell: 9, kind: 'x2_any' }] }).total, 48); // 20 ×2 +20%
  assert.equal(count(one('callback'), [5, 5]).pct, 20);
});

test('bells: a cleared level, each hand left, a beaten keeper', () => {
  assert.deepEqual(thingBells([{ id: 'lucky_coin', stars: 2 }, { id: 'spare_hat', stars: 2 }, { id: 'royal_toll', stars: 1 }, { id: 'six_bite', stars: 1 }], { handsLeft: 2, keeper: true }),
    [{ id: 'lucky_coin', n: 3 }, { id: 'spare_hat', n: 4 }, { id: 'royal_toll', n: 5 }]);
  assert.deepEqual(thingBells([{ id: 'spare_hat', stars: 1 }, { id: 'royal_toll', stars: 3 }], { handsLeft: 0, keeper: false }), []);
});

// ---------- step 3c: the other sixteen ----------
test('sums: a hand with a 1, the first hand\'s bigger gear, each 1 growing, the centre die whatever its face adds', () => {
  assert.equal(count(one('dead_one'), [1, 1]).total, 10 * 2);
  assert.equal(count(one('dead_one', 3), [1, 1]).total, 16 * 2);
  assert.equal(count(one('dead_one'), [4, 4]).total, 8 * 2, 'no 1: nothing');
  assert.equal(count(one('dead_one'), [1, 1], { keeper: { ones: 0 } }).total, 8 * 2, 'THE GOLDEN BONES zero the ones, the hand still holds them');
  assert.equal(count(one('first_gear'), [3, 3]).total, 16 * 2);
  assert.equal(count(one('first_gear', 3), [3, 3], { first: false }).total, 6 * 2, 'a later hand: nothing');
  assert.equal(count(one('pip_growth'), [1, 1]).total, 6 * 2);
  assert.equal(count(one('pip_growth', 3), [1, 1]).total, 10 * 2);
  assert.equal(count([...one('pip_growth'), ...one('magnified_one')], [1, 1]).total, 8 * 2, 'two things on the ones add up');
  assert.equal(count(one('pip_growth', 3), [1, 1], { keeper: { ones: 0 } }).total, 0, 'a keeper\'s zero beats a face\'s addition');
  // the die in cell 4 (dice() puts the fifth die there)
  assert.equal(count(one('center_knight'), [2, 3, 4, 5, 6]).total, 23 * 8);
  assert.equal(count(one('center_knight', 3), [2, 3, 4, 5, 6]).total, 25 * 8);
  const off = count(one('center_knight'), [3, 3, 1, 2, 5]);
  assert.deepEqual([off.total, off.things], [6 * 2, []], 'the centre die outside the hand: nothing');
  const red = bestHand([{ cell: 0, face: 6, held: false }, { cell: 4, face: 6, held: false }], [], { rules: { ...thingRules(one('center_knight'), { first: true, last: false }), sixes: 0 } });
  assert.equal(red.total, 3 * 2, 'RED EYE: the six in the centre adds nothing, its cell still adds 3');
});

test('jokers and cards: each joker adds to the sum, each card the hand uses adds to it, REFUND among them', () => {
  assert.equal(count([], [6, 6, 2], { bonuses: [card('joker')] }).total, 18 * 4);
  assert.equal(count(one('sharp_wit'), [6, 6, 2], { bonuses: [card('joker')] }).total, 22 * 4);
  assert.equal(count(one('sharp_wit', 3), [6, 6, 2], { bonuses: [card('joker')] }).total, 26 * 4);
  assert.equal(count(one('space_wild'), [6, 6, 2], { bonuses: [card('joker')] }).total, 26 * 4);
  assert.equal(count(one('space_wild', 3), [6, 6, 2], { bonuses: [card('joker')] }).total, 32 * 4);
  assert.equal(count(one('sharp_wit'), [6, 6, 2]).total, 12 * 2, 'no joker: nothing');
  assert.equal(count(one('card_value'), [5, 5], { bonuses: [card('x2_any')] }).total, 13 * 2 * 2);
  assert.equal(count(one('card_value', 3), [5, 5], { bonuses: [card('x2_any')] }).total, 17 * 2 * 2);
  assert.equal(count(one('card_value'), [5, 5], { bonuses: [card('x2_any'), card('joker', 1)] }).total, 21 * 4 * 2, 'the joker is a card too: trips of fives, two cards');
  assert.equal(count(one('card_value'), [5, 5], { bonuses: [card('refund')] }).total, 13 * 2, 'REFUND does not multiply and still adds');
  assert.equal(count(one('card_value'), [5, 5]).total, 10 * 2, 'no card: nothing');
});

test('multipliers: five of a kind\'s, and a hand of five held dice\'s', () => {
  assert.equal(count(one('five_carats'), [4, 4, 4, 4, 4]).total, 20 * 11);
  assert.equal(count(one('five_carats', 3), [4, 4, 4, 4, 4]).total, 20 * 13);
  assert.equal(count(one('five_carats'), [4, 4, 4, 4]).total, 16 * 6, 'four of a kind: nothing');
  assert.equal(count(one('solid_hold'), [1, 2, 3, 4, 5], { held: true }).total, 15 * 9);
  assert.equal(count(one('solid_hold', 3), [1, 2, 3, 4, 5], { held: true }).total, 15 * 11);
  assert.equal(count(one('solid_hold'), [1, 2, 3, 4, 5]).total, 15 * 8, 'not held: nothing');
  assert.equal(count(one('solid_hold'), [4, 4], { held: true }).total, 8 * 2, 'two held dice: nothing');
  const four = bestHand([1, 2, 3, 4].map((face, cell) => ({ cell, face, held: true })), [card('joker')], { rules: thingRules(one('solid_hold'), { first: true, last: false }) });
  assert.equal(four.mult, 8, 'four held dice and a joker are not five held dice');
});

test('a card\'s own number: every card, the level\'s first cards, the first from the bank; REFUND gives more back; +4 at most', () => {
  const pairs = [card('x2_any'), card('x3_pairs', 1)];
  assert.equal(count([], [5, 5], { bonuses: pairs }).total, 20 * 4);
  assert.equal(count(one('all_seeing'), [5, 5], { bonuses: [card('x2_any')] }).total, 20 * 3);
  assert.equal(count(one('all_seeing', 3), [5, 5], { bonuses: [card('x2_any')] }).total, 20 * 5);
  assert.equal(count(one('all_seeing'), [5, 5], { bonuses: pairs }).total, 20 * 6, 'both cards one higher: 1 + 2 + 3');
  assert.equal(count(one('brain_boost'), [5, 5], { bonuses: pairs }).total, 20 * 5, 'the first card only');
  assert.equal(count(one('brain_boost', 2), [5, 5], { bonuses: pairs }).total, 20 * 6);
  assert.equal(count(one('brain_boost', 2), [5, 5], { bonuses: pairs, cards: 1 }).total, 20 * 5, 'one card played before: one left');
  assert.equal(count(one('brain_boost'), [5, 5], { bonuses: pairs, cards: 1 }).total, 20 * 4, 'spent');
  assert.equal(count(one('patient_beads'), [5, 5], { bonuses: [card('x2_any', 0, true)] }).total, 20 * 4, '×2 AS ×4');
  assert.equal(count(one('patient_beads'), [5, 5], { bonuses: [card('x2_any')] }).total, 20 * 2, 'not from the bank');
  assert.equal(count(one('patient_beads'), [5, 5], { bonuses: [card('x2_any', 0, true)], bank: true }).total, 20 * 2, 'a bank card played before: spent');
  const capped = count([...one('all_seeing', 3), ...one('patient_beads', 3), ...one('brain_boost', 3)], [5, 5], { bonuses: [card('x2_any', 0, true)] });
  assert.equal(capped.bonusMult, 6, '+3 +4 +1 on one card: +4 at most, ×2 AS ×6');
  const refund = count(one('all_seeing', 2), [5, 5], { bonuses: [card('refund')] });
  assert.deepEqual([refund.total, refund.refund, refund.things], [20, 3, ['all_seeing']], '+1 AS +3');
  const both = count(one('brain_boost'), [5, 5], { bonuses: [card('refund'), card('x2_any', 1)] });
  assert.deepEqual([both.bonusMult, both.refund], [3, 1], 'a multiplier before REFUND');
  assert.equal(count(one('brain_boost'), [5, 5], { bonuses: [card('joker')] }).bonusMult, 1, 'a joker has no number');
});

test('in a game: BRAIN BOOST counts the level\'s numbered cards, a joker spends nothing, and a reload keeps the count', () => {
  const level = boardOf(['d', 'd', 'joker', 'd', 'd', 'x2_any', 'd', 'x2_any', 'd'], [5, 5, 1, 2, 6, 3], { things: one('brain_boost', 2) });
  let g = createAutoGame(level, { hands: 3, rerolls: 3 });
  g = toggleBonus(g, 2).state; // the joker alone
  const h1 = playHand(g, seq(1, 2, 3, 4, 6, 5, 3));
  assert.deepEqual(h1.hand.bonuses, ['joker']);
  assert.ok(!h1.hand.things.includes('brain_boost'), 'a joker has no number to raise');
  g = toggleBonus(h1.state, 5).state;
  const shown = currentHand(g);
  assert.equal(shown.bonusMult, 3, 'the first numbered card: ×2 AS ×3');
  const again = currentHand(restoreGame(JSON.parse(JSON.stringify(snapshotGame(g)))));
  assert.deepEqual([again.total, again.bonusMult], [shown.total, shown.bonusMult], 'a reload counts the same');
  const h2 = playHand(g, seq(2, 3, 4, 6, 1, 1, 2));
  assert.equal(h2.hand.total, shown.total);
  g = toggleBonus(h2.state, 7).state;
  assert.equal(currentHand(g).bonusMult, 3, 'the second of two stars');
  const h3 = playHand(g, seq(1));
  assert.ok(h3.hand.things.includes('brain_boost'));
  // a level with three numbered cards: the third is not raised
  let t = createAutoGame(boardOf(['d', 'x2_any', 'd', 'd', 'd', 'x2_any', 'd', 'x2_any', 'd'], [5, 5, 2, 3, 4, 6], { things: one('brain_boost', 2) }), { hands: 3, rerolls: 3 });
  for (const i of [1, 5]) t = toggleBonus(t, i).state;
  assert.equal(currentHand(t).bonusMult, 5, 'two cards, both raised: 1 + 2 + 2');
  t = playHand(t, seq(2, 3, 4, 6, 1, 2, 3)).state;
  t = toggleBonus(t, 7).state;
  assert.equal(currentHand(t).bonusMult, 2, 'the third card counts as it is');
});

test('in a game: PATIENT BEADS raises the level\'s first card from the bank, on the board or still above it', () => {
  // nine dice: both banked cards come in on the first reroll, the first into a cell as fromBank 0
  let g = createAutoGame(boardOf(Array(9).fill('d'), [5, 5, 1, 2, 3, 4, 6, 2, 3], { things: one('patient_beads'), bank: ['x2_any', 'x2_any'] }), { hands: 3, rerolls: 3 });
  const r = reroll(g, seq(5, 5, 5, 5, 5, 5, 5));
  assert.deepEqual(r.placed.map((p) => p.from), [0, 1]);
  g = toggleBonus(r.state, r.placed[0].cell).state;
  assert.equal(g.cells[r.placed[0].cell].fromBank, 0);
  assert.equal(currentHand(g).bonusMult, 4, '×2 AS ×4');
  const h1 = playHand(g, seq(1, 2, 3, 4, 6, 2, 3, 4, 6));
  assert.equal(h1.hand.bank, 1);
  g = toggleBonus(h1.state, r.placed[1].cell).state;
  assert.equal(currentHand(g).bonusMult, 2, 'the second bank card counts as it is');
  // six dice and three cards: the banked card waits above the board, BANK + 0, and counts higher there
  let w = createAutoGame(boardOf(['d', 'd', 'joker', 'd', 'd', 'joker', 'd', 'refund', 'd'], [5, 5, 1, 2, 3, 6], { things: one('patient_beads', 3), bank: ['x2_any'] }), { hands: 3, rerolls: 3 });
  w = reroll(w, seq(4)).state;
  assert.equal(w.bank[0].placed, false);
  w = toggleBonus(w, BANK).state;
  const above = currentHand(w);
  assert.equal(above.bonusMult, 6, '×2 AS ×6 at three stars');
  assert.ok(above.things.includes('patient_beads'));
});

test('in a game: a raised REFUND gives its rerolls back, SOLID HOLD counts five held dice, never under LOOSE GRIP', () => {
  let g = createAutoGame(boardOf(['d', 'd', 'd', 'd', 'd', 'd', 'd', 'refund', 'd'], [5, 5, 1, 2, 3, 4, 6, 2], { things: one('all_seeing') }), { hands: 3, rerolls: 3 });
  g = toggleBonus(g, 7).state;
  assert.equal(currentHand(g).refund, 2);
  const r = playHand(g, seq(1, 2, 3, 4, 6, 2, 3, 4, 6));
  assert.deepEqual([r.hand.refund, r.state.rerollsLeft], [2, 5], '+1 AS +2');
  // a straight on the board: held, its multiplier is one higher
  const straight = boardOf(Array(9).fill('d'), [1, 2, 3, 4, 5, 1, 1, 6, 6], { things: one('solid_hold') });
  let s = createAutoGame(straight, { hands: 3, rerolls: 3 });
  assert.equal(currentHand(s).mult, 8);
  for (const i of [0, 1, 2, 3, 4]) s = toggleHold(s, i).state;
  const held = currentHand(s);
  assert.deepEqual([held.mult, held.things], [9, ['solid_hold']]);
  assert.equal(playHand(s, seq(2)).hand.total, held.total);
  let z = createAutoGame({ ...straight, boss: 'zombie' }, { hands: 3, rerolls: 3 });
  for (const i of [0, 1, 2]) z = toggleHold(z, i).state;
  assert.equal(toggleHold(z, 3).code, 'HOLD_CAP');
  assert.ok(!currentHand(z).things.includes('solid_hold'));
});

test('bells in a game: a reroll left, a straight played, each hand left, and KNOCKOUT PAY multiplies a keeper\'s whole pay', () => {
  const game = (boss, things, { handsLeft = 1, rerollsLeft = 2, hands = [{ category: 'small_straight' }] } = {}) => ({ handsLeft, rerollsLeft, hands, level: { boss, things } });
  const sum = (b) => b.clear + b.hand + b.reroll + b.boss + b.things.reduce((a, t) => a + t.n, 0);
  const plain = levelBells(game(null, [{ id: 'victory_honk', stars: 1 }, { id: 'chainmaker', stars: 2 }, { id: 'peace_bonus', stars: 1 }]));
  assert.deepEqual(plain.things, [{ id: 'victory_honk', n: 2 }, { id: 'chainmaker', n: 4 }, { id: 'peace_bonus', n: 2 }]);
  assert.equal(plain.total, sum(plain));
  assert.deepEqual(levelBells(game(null, [{ id: 'victory_honk', stars: 3 }, { id: 'chainmaker', stars: 1 }], { rerollsLeft: 0, hands: [{ category: 'pair' }] })).things, [], 'no reroll left, no straight played');
  const keeper = levelBells(game('ghoul', [{ id: 'knockout_pay', stars: 1 }, { id: 'lucky_coin', stars: 1 }, { id: 'chainmaker', stars: 1 }]));
  const pay = 2 + 2 + 2 + 3; // clear, a hand left, two rerolls left, the keeper
  assert.deepEqual(keeper.things, [{ id: 'lucky_coin', n: 2 }, { id: 'chainmaker', n: 3 }, { id: 'knockout_pay', n: pay + 5 }], 'the other things\' bells doubled too');
  assert.equal(keeper.total, 2 * (pay + 5));
  assert.equal(keeper.total, sum(keeper));
  assert.equal(levelBells(game('ghoul', [{ id: 'knockout_pay', stars: 3 }])).total, 4 * pay, '×4 at three stars');
  assert.deepEqual(levelBells(game(null, [{ id: 'knockout_pay', stars: 3 }])).things, [], 'no keeper, nothing');
});

test('a keeper\'s level: CALM START scores before it starts and DISTRACTION cuts the threshold, in plain sight; other levels keep the table', () => {
  const pocket = [{ id: 'calm_start', stars: 2 }, { id: 'distraction', stars: 1 }, { id: 'lucky_coin', stars: 1 }];
  assert.deepEqual(keeperHelp(pocket), { points: 60, cut: 5, by: ['calm_start', 'distraction'] });
  const keeper = generateRunLevel({ runSeed: 'kh', levelIndex: 10, things: pocket });
  const plain = generateRunLevel({ runSeed: 'kh', levelIndex: 10 });
  assert.equal(keeper.tableTarget, runTarget(10));
  assert.equal(keeper.target, Math.round(runTarget(10) * 0.95));
  assert.deepEqual(keeper.layout, plain.layout, 'the board is the same');
  assert.deepEqual(keeper.help, ['calm_start', 'distraction']);
  assert.equal(createAutoGame(keeper, { hands: 3, rerolls: 3 }).score, 60);
  const other = generateRunLevel({ runSeed: 'kh', levelIndex: 9, things: pocket });
  assert.equal(other.target, runTarget(9));
  assert.equal(createAutoGame(other, { hands: 3, rerolls: 3 }).score, 0);
  assert.ok(helpsAgainst('calm_start', 'prisoner') && helpsAgainst('full_head', 'fatman') && !helpsAgainst('full_head', 'ghoul'));
});

// The counter shows what is scored (the spec's rule): with each thing at 1 and 3 stars, the numbers shown before PLAY (the
// sum, the multipliers, the percent) make the total PLAY scores, through every hand of a level
test('the counter\'s number is the scored number, each thing at 1 and 3 stars', () => {
  const board = { mode: 'auto', seed: 'c', levelIndex: 12, layout: [...Array(7).fill(0).map(() => ({ type: 'die' })), { type: 'bonus', kind: 'x2_any' }, { type: 'die' }], faces: [1, 2, 3, 4, 5, 6, 6, null, 4], target: 99999 };
  for (const id of Object.keys(THINGS)) {
    for (const stars of [1, 3]) {
      let g = createAutoGame({ ...board, things: [{ id, stars }] }, { hands: 3, rerolls: 3 });
      g = toggleBonus(g, 7).state;
      for (let h = 0; h < 3; h++) {
        const shown = currentHand(g);
        assert.equal(shown.total, Math.floor((Math.floor(shown.base * shown.mult) * shown.bonusMult * (100 + shown.pct)) / 100), `${id} ★${stars}: the shown numbers make the total`);
        const r = playHand(g, seq(2, 3, 3, 5, 6, 1, 4));
        assert.equal(r.hand.total, shown.total, `${id} ★${stars} hand ${h + 1}`);
        assert.equal(r.hand.pct, shown.pct);
        assert.deepEqual(r.hand.things, shown.things);
        g = r.state;
      }
    }
  }
  // a joker, REFUND and a card from the bank on the board too, every card on, after the level's first reroll
  const deck = boardOf(['d', 'd', 'joker', 'd', 'd', 'd', 'd', 'refund', 'd'], [1, 2, 4, 5, 6, 6, 3], { bank: ['x3_pairs'] });
  for (const id of Object.keys(THINGS)) {
    for (const stars of [1, 3]) {
      let g = reroll(createAutoGame({ ...deck, things: [{ id, stars }] }, { hands: 3, rerolls: 3 }), seq(3, 5, 6, 2, 2, 4)).state;
      for (let h = 0; h < 3; h++) {
        for (const i of g.cells.map((c, k) => k).filter((k) => g.cells[k].type === 'bonus' && g.off[k])) g = toggleBonus(g, i).state;
        const shown = currentHand(g);
        assert.equal(shown.total, Math.floor((Math.floor(shown.base * shown.mult) * shown.bonusMult * (100 + shown.pct)) / 100), `${id} ★${stars} with cards`);
        const r = playHand(g, seq(2, 3, 3, 5, 6, 1, 4));
        assert.deepEqual([r.hand.total, r.hand.pct, r.hand.refund, r.hand.things], [shown.total, shown.pct, shown.refund, shown.things], `${id} ★${stars} hand ${h + 1} with cards`);
        g = r.state;
      }
    }
  }
});

test('things never lower a hand, and a hand names a thing exactly when it changed the count or the rerolls it gives back', () => {
  const boards = [[3, 3], [1, 1], [6, 6, 6], [1, 2, 3, 4, 5], [2, 2, 3, 3], [1, 2, 3, 4], [4, 4, 4, 4], [5, 5, 5, 2, 2], [4, 4, 4, 4, 4], [2, 6, 3, 1, 6]];
  const decks = [[], [card('x2_any', 0, true)], [card('joker')], [card('refund')], [card('x3_pairs'), card('joker', 1), card('refund', 2, true)]];
  for (const id of Object.keys(THINGS)) {
    for (const faces of boards) {
      for (const bonuses of decks) {
        for (const held of [false, true]) {
          for (const [first, last] of [[true, false], [false, true], [false, false]]) {
            const plain = count([], faces, { first, last, bonuses, held });
            const withIt = count(one(id, 2), faces, { first, last, bonuses, held });
            const where = `${id} on ${faces} with ${bonuses.map((b) => b.kind)} held ${held} first ${first} last ${last}`;
            assert.ok(withIt.total >= plain.total && withIt.refund >= plain.refund, where);
            // a thing that changed it is named; one named may only have tipped a tie to another hand of the same total
            if (withIt.total > plain.total || withIt.refund > plain.refund) assert.ok(withIt.things.includes(id), where);
            else assert.equal(withIt.total, plain.total, where);
          }
        }
      }
    }
  }
  assert.ok(Object.values(BONUS_KINDS).length > 0);
  for (const id of Object.keys(THINGS)) assert.ok(numberOf({ id, stars: 2 }) === THINGS[id].n[1]);
});

// ---------- the portal ----------
const RARE_ORDER = ['common', 'uncommon', 'rare', 'legendary'];

test('a portal opens after every keeper and only then, the same for the same seed, level, pocket and gallery', () => {
  assert.equal(portalOf('run-1', 7), null);
  assert.equal(portalOf('run-1', 0), null);
  for (const level of [5, 10, 25, 40, 60]) {
    const p = portalOf('run-1', level, { pocket: one('sweet_scoop'), gallery: ['lucky_coin'] });
    assert.deepEqual(p, portalOf('run-1', level, { pocket: one('sweet_scoop'), gallery: ['lucky_coin'] }));
    assert.ok(PORTAL_RINGS.includes(p.ring) && PORTAL_HANDS.includes(p.hands) && THINGS[p.thing], `${level}`);
    assert.ok(THINGS[p.thing].from <= level);
  }
  const things = new Set(Array.from({ length: 40 }, (_, k) => portalOf(`run-${k}`, 5).thing));
  assert.ok(things.size > 5, 'the seed changes the thing');
});

test('every ring, pair of hands and thing has its picture beside the page and its custom property', () => {
  const css = readFileSync('src/ui/styles.css', 'utf8');
  const named = (prop, file) => css.includes(`${prop}: url("../../assets/ui/${file}")`);
  for (const id of PORTAL_RINGS) assert.ok(existsSync(`assets/ui/portal/ring-${id}.webp`) && named(`--portal-ring-${id}`, `portal/ring-${id}.webp`), id);
  for (const id of PORTAL_HANDS) assert.ok(existsSync(`assets/ui/portal/hands-${id}.webp`) && named(`--portal-hands-${id}`, `portal/hands-${id}.webp`), id);
  for (const id of Object.keys(THINGS)) {
    assert.ok(existsSync(`assets/ui/portal/thing-${id}.webp`) && named(`--portal-thing-${id}`, `portal/thing-${id}.webp`), id); // the portal's
    assert.ok(existsSync(`assets/ui/things/${id}.webp`) && named(`--thing-${id}`, `things/${id}.webp`), id); // the pocket's
  }
});

test('neither the ring nor the hands repeat one of the last two portals, and the golden hands wait for level 35', () => {
  for (let k = 0; k < 30; k++) {
    const seen = [];
    for (let level = 5; level <= 120; level += 5) {
      const p = portalOf(`run-${k}`, level);
      const last = seen.slice(-2);
      assert.ok(!last.some((q) => q.ring === p.ring), `ring at ${level}`);
      assert.ok(!last.some((q) => q.hands === p.hands), `hands at ${level}`);
      if (level < 35) assert.ok(!/_gold$/.test(p.hands), `gold hands at ${level}`);
      seen.push(p);
    }
  }
  const gold = Array.from({ length: 200 }, (_, k) => portalOf(`run-${k}`, 50).hands).filter((h) => /_gold$/.test(h));
  assert.ok(gold.length > 0, 'the golden hands do come');
});

test('the rarity keeps to its table by depth over 10,000 portals, and a golden keeper gives rare or better', () => {
  for (const level of [5, 20, 35, 50]) {
    const odds = portalOdds(level);
    const tally = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
    let n = 0;
    for (let k = 0; n < 10000; k++) {
      if (BOSSES[bossOf(`run-${k}`, level)].golden) continue; // a golden keeper has his own odds, below
      tally[portalRarity(`run-${k}`, level)] += 1;
      n += 1;
    }
    RARE_ORDER.forEach((r, i) => assert.ok(Math.abs(tally[r] / 100 - odds[i]) < 1.5, `${r} at ${level}: ${tally[r] / 100}% vs ${odds[i]}%`));
  }
  let golden = 0;
  for (let k = 0; golden < 300 && k < 20000; k++) {
    const seed = `run-${k}`;
    for (const level of [35, 40, 45, 50, 55, 60]) {
      if (!BOSSES[bossOf(seed, level)].golden) continue;
      golden += 1;
      assert.ok(['rare', 'legendary'].includes(portalRarity(seed, level)), `${seed} ${level}`);
    }
  }
  assert.ok(golden >= 300, 'golden keepers were found');
});

test('the portal never brings a thing at 3 stars, falls to a lower rarity when its own is empty, and brings a star to one carried', () => {
  const full = Object.keys(THINGS).filter((id) => THINGS[id].rarity === 'common').map((id) => ({ id, stars: 3 }));
  for (let k = 0; k < 300; k++) {
    const p = portalOf(`run-${k}`, 20, { pocket: full });
    assert.ok(p.thing && starsOf(full, p.thing) < MAX_STARS, `run-${k}`);
    assert.notEqual(THINGS[p.thing].rarity, 'common');
  }
  // level 5 has no uncommon thing yet: every draw is a common one
  for (let k = 0; k < 300; k++) assert.equal(THINGS[portalOf(`run-${k}`, 5).thing].rarity, 'common');
  // a carried thing comes as its next star, and a first find says so
  for (let k = 0; k < 50; k++) {
    const p = portalOf(`run-${k}`, 5);
    const again = portalOf(`run-${k}`, 5, { pocket: one(p.thing, 2), gallery: [p.thing] });
    if (again.thing === p.thing) assert.equal(again.star, 3);
    assert.equal(p.star, 1);
    assert.equal(p.fresh, true);
    assert.equal(again.fresh, again.thing !== p.thing);
  }
  const every = Object.keys(THINGS).map((id) => ({ id, stars: 3 }));
  assert.equal(portalOf('run-1', 60, { pocket: every }).thing, null);
});

test('a thing the device has not found yet counts double', () => {
  const commons = Object.keys(THINGS).filter((id) => THINGS[id].rarity === 'common' && THINGS[id].from <= 5);
  const gallery = commons.slice(0, 5);
  let unfound = 0;
  for (let k = 0; k < 10000; k++) if (!gallery.includes(portalOf(`run-${k}`, 5, { gallery }).thing)) unfound += 1;
  const want = (2 * (commons.length - 5)) / (2 * (commons.length - 5) + 5);
  assert.ok(Math.abs(unfound / 10000 - want) < 0.02, `${unfound / 100}% vs ${(want * 100).toFixed(1)}%`);
});

// ---------- the gallery ----------
test('the catalogue holds the spec\'s 59 things, every built one among them with its picture, and the twelve starters', () => {
  assert.equal(CATALOGUE.length, 59);
  assert.equal(CATALOGUE.filter((t) => t.kind === 'card').length, 6);
  assert.equal(new Set(CATALOGUE.map((t) => t.id)).size, 59);
  for (const [id, t] of Object.entries(THINGS)) assert.equal(CATALOGUE.find((c) => c.id === id)?.file, t.file, id);
  const css = readFileSync('src/ui/styles.css', 'utf8');
  for (const t of CATALOGUE) assert.ok(existsSync(`assets/ui/things/${t.id}.webp`) && css.includes(`--thing-${t.id}: url("../../assets/ui/things/${t.id}.webp")`), t.id);
  assert.equal(STARTERS.length, 12);
  for (const id of STARTERS) assert.ok(CATALOGUE.some((t) => t.id === id && t.kind === 'pocket'), id);
});

test('a saved gallery keeps known ids once each', () => {
  assert.deepEqual(cleanGallery(['six_bite', 'six_bite', 'nothing', 'pair_chime', 3]), ['six_bite', 'pair_chime']);
  assert.deepEqual(cleanGallery(null), []);
});
