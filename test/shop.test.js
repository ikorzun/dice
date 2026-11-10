import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARMS, CHARM_SLOTS, CARD_PRICE, doorAfter, bossNext, levelBells, fitWeights, fitTag, shopStock, buyGood, sensibleShopping } from '../src/engine/shop3.js';
import { upgradeOffer } from '../src/engine/upgrades3.js';
import { bossOf, BOSSES, isBossLevel, FIRST_KEEPER } from '../src/engine/bosses3.js';
import { generateRunLevel, runTarget } from '../src/engine/run3.js';
import { handRules, createAutoGame, toggleBonus, playHand, currentHand, toggleHold, holdCap, MIN_DICE } from '../src/engine/auto.js';
import { BONUS_UNLOCKS, unlockedKinds } from '../src/engine/levels3.js';
import { bestHand } from '../src/engine/hands.js';
import { createRng } from '../src/engine/rng.js';

const seq = (...f) => { let i = 0; return () => f[i++ % f.length]; };
const eight = (over = {}) => ({ mode: 'auto', seed: 's', levelIndex: 3, layout: [...Array(8).fill(0).map(() => ({ type: 'die' })), { type: 'block' }], faces: [1, 2, 3, 4, 5, 6, 1, 2, null], target: 50, ...over });

test('doors open after the second and fourth level of each act, the second naming the keeper', () => {
  assert.deepEqual(Array.from({ length: 15 }, (_, k) => k + 1).filter(doorAfter), [2, 4, 7, 9, 12, 14]);
  assert.ok(bossNext(4) && bossNext(9) && !bossNext(2));
  assert.ok(isBossLevel(5) && isBossLevel(10) && !isBossLevel(4));
});

test('a cleared level pays for what was left unused and for a keeper, a golden one 5 more', () => {
  const g = { score: 460, handsLeft: 1, rerollsLeft: 2, level: { target: 340, boss: null, charms: [] } };
  assert.deepEqual(levelBells(g), { clear: 2, hand: 2, reroll: 2, boss: 0, charm: 0, total: 6 });
  assert.equal(levelBells({ score: 340, handsLeft: 0, rerollsLeft: 0, level: { target: 340, boss: 'ghoul_old', charms: ['bellwether'] } }).total, 2 + 3 + 2);
  assert.equal(levelBells({ score: 340, handsLeft: 0, rerollsLeft: 0, level: { target: 340, boss: 'robot_golden', charms: [] } }).boss, 8);
});

test('the fit weighs recent hands, the ones fallen short on most, and keeps a floor', () => {
  const plays = [{ category: 'full_house', cleared: true, level: 6 }, { category: 'straight', cleared: false, level: 6 }, { category: 'pair', cleared: true, level: 1 }];
  const fit = fitWeights({ plays, ups: { two_pairs: 1 } }, 6);
  assert.ok(fit.straight.weight > fit.full_house.weight, 'falling short counts more');
  assert.ok(fit.full_house.weight > fit.pair.weight, 'old plays fade');
  assert.equal(fit.five_kind.weight, 4);
  assert.equal(fit.two_pairs.weight, 6);
  assert.equal(fitTag('full_house', fit), 'YOU PLAY FULL HOUSES');
  assert.equal(fitTag('straight', fit), 'YOU PLAY STRAIGHTS'); // a hand counts as short only for not being the last: the tag says what is true
  assert.equal(fitTag('five_kind', fit), 'WILD OFFER');
  assert.ok(fitWeights({ plays: Array(50).fill({ category: 'pair', cleared: false, level: 6 }) }, 6).pair.weight <= 32);
});

test('the pick leans on the player, and the third offer stays open to anything', () => {
  const heavy = { pair: 4, two_pairs: 4, small_straight: 4, three_kind: 4, full_house: 32, straight: 4, four_kind: 4, five_kind: 4 };
  let hits = 0;
  let thirds = 0;
  for (let r = 0; r < 300; r++) {
    const offer = upgradeOffer(`r${r}`, 3, heavy);
    assert.equal(new Set(offer).size, 3);
    if (offer.slice(0, 2).includes('full_house')) hits++;
    if (offer[2] === 'full_house') thirds++;
    assert.deepEqual(offer, upgradeOffer(`r${r}`, 3, heavy), 'a reload shows the same');
  }
  assert.ok(hits > 300 * 0.6, `the leaned-on hand came up ${hits}/300`);
  assert.ok(thirds < 300 * 0.2);
});

test('a shelf is one card, one +1 and one charm, seeded, with no charm the player holds', () => {
  const run = { ups: {}, charms: ['spare_knuckle', 'bellwether'], bank: [], bells: 12 };
  const a = shopStock({ runSeed: 'x', levelIndex: 7, run });
  assert.deepEqual(a.map((g) => g.type), ['card', 'up', 'charm']);
  assert.deepEqual(a, shopStock({ runSeed: 'x', levelIndex: 7, run }));
  for (let r = 0; r < 60; r++) assert.ok(!run.charms.includes(shopStock({ runSeed: `y${r}`, levelIndex: 7, run })[2].id));
  for (const g of a) assert.ok(g.price > 0 && g.tag);
});

test('the door before a keeper offers a charm against him, tagged', () => {
  for (let r = 0; r < 40; r++) {
    const runSeed = `z${r}`;
    const stock = shopStock({ runSeed, levelIndex: 4, run: { ups: {}, charms: [] } });
    const boss = BOSSES[bossOf(runSeed, 5)];
    assert.ok(boss.counters.includes(stock[2].id), `${boss.name}: ${stock[2].id}`);
    assert.equal(stock[2].tag, 'GOOD AGAINST KEEPER');
  }
});

test('buying: bells spent, a slot sold once, a full bank or rail names what it replaces', () => {
  const run = { bells: 10, bank: ['refund', 'joker', 'x2_any'], ups: {}, charms: ['final_bow', 'bellwether', 'stone_ribbon'] };
  const stock = [{ type: 'card', id: 'x3_pairs', price: 4 }, { type: 'up', id: 'pair', price: 6 }, { type: 'charm', id: 'crooked_pip', price: 9 }];
  assert.equal(buyGood(run, stock, 0).code, 'BANK_FULL');
  const a = buyGood(run, stock, 0, { replace: 1 });
  assert.deepEqual(a.run.bank, ['refund', 'x3_pairs', 'x2_any']);
  assert.equal(a.run.bells, 6);
  assert.equal(buyGood(a.run, a.stock, 0, { replace: 1 }).code, 'SOLD');
  assert.equal(buyGood(a.run, a.stock, 2).code, 'BELLS');
  const b = buyGood(a.run, a.stock, 1);
  assert.deepEqual(b.run.ups, { pair: 1 });
  assert.equal(b.run.bells, 0);
  assert.equal(buyGood({ ...run, bells: 9 }, stock, 2).code, 'CHARMS_FULL');
  assert.deepEqual(buyGood({ ...run, bells: 9 }, stock, 2, { replace: 0 }).run.charms, ['crooked_pip', 'bellwether', 'stone_ribbon']);
  assert.equal(run.bells, 10, 'nothing changes in place');
  assert.equal(sensibleShopping({ bells: 30, bank: [], ups: {}, charms: [] }, [stock[1], stock[0], stock[2]]).bells, 11);
});

test('charms in the count', () => {
  const dice = (...f) => f.map((face, cell) => ({ cell, face, held: false }));
  assert.equal(bestHand(dice(1, 1, 1)).total, 3 * 4);
  assert.equal(bestHand(dice(1, 1, 1), [], { rules: { ones: 6 } }).total, 18 * 4);
  assert.equal(bestHand([{ cell: 0, face: 3, held: true }, { cell: 1, face: 3, held: true }], [], { rules: { heldAdd: 1 } }).total, 8 * 2);
  assert.equal(bestHand(dice(3, 3), [], { rules: { sumAdd: 5 } }).total, 11 * 2);
  assert.equal(bestHand(dice(6, 6, 6), [], { rules: { sixes: 0 } }).total, 0);
  assert.equal(bestHand(dice(1, 2, 3, 4, 5), [], { rules: { half: ['straight'] } }).total, 15 * 4);
  assert.equal(bestHand(dice(2, 3, 4, 5, 6), [], { rules: { half: ['straight'] }, ups: { straight: 1 } }).total, 20 * 5); // half of ×9 rounds up: the counter never shows ×4.5
  assert.equal(bestHand(dice(1, 1, 1), [], { rules: { ones: 0 } }).total, 0); // a keeper's ones add nothing
  assert.equal(bestHand(dice(5, 5, 2), [], { rules: { halfSum: true } }).formula, '5 × 2'); // half of 10, shown on the counter
  assert.equal(bestHand(dice(5, 5, 6, 6, 6), [], { rules: { halfSum: true } }).total, 14 * 5); // half of 28 × FULL HOUSE ×5
});

test('FINAL BOW counts on the last hand only; SPARE KNUCKLE and ECHO THIMBLE change the rerolls', () => {
  let g = createAutoGame(eight({ charms: ['final_bow', 'spare_knuckle'], target: 9999 }), {});
  assert.equal(g.rerollsLeft, 4);
  const plain = currentHand(g).total;
  g = playHand(g, seq(1, 2, 3, 4, 5, 6)).state;
  g = playHand(g, seq(1, 2, 3, 4, 5, 6)).state;
  assert.equal(g.handsLeft, 1);
  assert.equal(currentHand(g).total, plain + 5 * currentHand(g).mult);
  let e = createAutoGame({ ...eight({ charms: ['echo_thimble'], target: 9999 }), layout: [...Array(7).fill(0).map(() => ({ type: 'die' })), { type: 'bonus', kind: 'refund' }, { type: 'block' }], faces: [1, 2, 3, 4, 5, 6, 1, null, null] }, {});
  e = toggleBonus(e, 7).state;
  assert.equal(playHand(e, seq(1, 2, 3)).state.rerollsLeft, 3 + 2);
});

test('STONE RIBBON adds five to five-die hands only; QUICK POCKET starts the first kept card on the board', () => {
  const rules = handRules(eight({ charms: ['stone_ribbon'] }), 3);
  assert.equal(bestHand([1, 2, 3, 4, 5].map((face, cell) => ({ cell, face, held: false })), [], { rules }).total, (15 + 5) * 8); // a straight: +5
  assert.equal(bestHand([4, 4].map((face, cell) => ({ cell, face, held: false })), [], { rules }).total, 8 * 2); // a pair: nothing
  const q = createAutoGame(eight({ charms: ['quick_pocket'], bank: ['joker', 'refund'] }), {});
  assert.deepEqual(q.cells[7], { type: 'bonus', kind: 'joker', fromBank: 0 });
  assert.equal(q.faces[7], null);
  assert.ok(q.off[7] && q.bank[0].placed && !q.bank[1].placed);
  const six = { ...eight({ charms: ['quick_pocket'], bank: ['joker'] }), layout: [...Array(6).fill(0).map(() => ({ type: 'die' })), { type: 'block' }, { type: 'block' }, { type: 'block' }], faces: [1, 2, 3, 4, 5, 6, null, null, null] };
  assert.equal(createAutoGame(six, {}).cells.filter((c) => c.type === 'die').length, MIN_DICE, 'six dice stay');
});

test('a keeper comes from the seed alone: THE EATER first, never one of the last two, each from his level; his rule stands on the level', () => {
  assert.equal(bossOf('a', 7), null);
  assert.equal(bossOf('a', 15), bossOf('a', 15));
  const met = new Set();
  for (let r = 0; r < 300; r++) {
    const run = Array.from({ length: 14 }, (_, k) => bossOf(`k${r}`, 5 * (k + 1)));
    assert.equal(run[0], FIRST_KEEPER);
    run.forEach((id, k) => {
      const level = 5 * (k + 1);
      assert.ok(BOSSES[id].from <= level && level <= (BOSSES[id].until ?? Infinity), `${id} on level ${level}`);
      if (k > 0) assert.ok(id !== run[k - 1] && (k < 2 || id !== run[k - 2]), `${id} again on level ${level}`);
      met.add(id);
    });
  }
  assert.deepEqual([...met].sort(), Object.keys(BOSSES).sort(), 'every keeper comes by level 70');
  for (let r = 0; r < 200; r++) {
    const runSeed = `b${r}`;
    for (const L of [5, 10, 35]) {
      const level = generateRunLevel({ runSeed, levelIndex: L, ups: { pair: 2 }, charms: ['bellwether'], bank: ['joker'] });
      const plain = generateRunLevel({ runSeed, levelIndex: L });
      assert.equal(level.target, runTarget(L), 'the boss keeps the ladder');
      assert.deepEqual(level.layout, plain.layout, 'the player never changes the board');
      const b = BOSSES[level.boss];
      assert.ok(b, level.boss);
      if (b.hands) assert.equal(createAutoGame(level, { hands: 3, rerolls: 3 }).handsLeft, 2);
      if (b.rerolls) assert.equal(createAutoGame(level, { hands: 3, rerolls: 3 }).rerollsLeft, 2);
      const dice = level.layout.filter((c) => c.type === 'die').length;
      assert.ok(dice >= MIN_DICE, `${level.boss} L${L} ${dice} dice`);
      assert.ok(level.layout.every((c) => c.type === 'die' || c.type === 'bonus')); // no cell is ever locked or empty (owner, 09.11.2026)
      level.layout.forEach((c, i) => assert.equal(c.type === 'die', level.faces[i] !== null));
    }
  }
  const eater = { mode: 'auto', seed: 'm', levelIndex: 5, boss: 'fatman', charms: [] };
  assert.equal(handRules(eater, 3).sumAdd, -5); // his toll
  assert.equal(handRules({ ...eater, charms: ['stone_ribbon'] }, 3).fiveAdd, 5); // the ribbon pays it back on five-die hands
  assert.equal(handRules({ ...eater, boss: 'skeleton_golden', charms: ['crooked_pip'] }, 3).ones, 0); // the keeper's word comes last
});

test('RED EYE, OLD HORNS and THE GOLDEN BONES count through the game itself', () => {
  const g = createAutoGame({ ...eight({ boss: 'ghoul' }), faces: [6, 6, 6, 1, 2, 3, 4, 5, null] }, {});
  const h = toggleHold(toggleHold(toggleHold(g, 0).state, 1).state, 2).state;
  assert.equal(currentHand(h).total, 0);
  const j = createAutoGame({ ...eight({ boss: 'ghoul_old' }), faces: [1, 2, 3, 4, 5, 1, 1, 1, null] }, {});
  assert.ok(currentHand(j).total <= 15 * 8);
  const small = createAutoGame({ ...eight({ boss: 'ghoul_old' }), faces: [1, 2, 3, 4, 1, 1, 6, 6, null] }, {});
  const s4 = toggleHold(toggleHold(toggleHold(toggleHold(small, 0).state, 1).state, 2).state, 3).state;
  assert.equal(currentHand(s4).category, 'small_straight');
  assert.equal(currentHand(s4).formula, '10 × 2'); // a small straight's ×3 halves too, rounding up
  const b = createAutoGame({ ...eight({ boss: 'skeleton_golden' }), faces: [1, 1, 1, 6, 6, 6, 2, 3, null] }, {});
  const ones = toggleHold(toggleHold(toggleHold(b, 0).state, 1).state, 2).state;
  assert.equal(currentHand(ones).total, 0);
});

test('LOOSE GRIP refuses a fourth hold; THE GOLDEN KNIGHT halves the first hand only', () => {
  let g = createAutoGame({ ...eight({ boss: 'zombie' }) }, {});
  assert.equal(holdCap(g), 3);
  for (const i of [0, 1, 2]) g = toggleHold(g, i).state;
  const r = toggleHold(g, 3);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'HOLD_CAP');
  assert.ok(toggleHold(g, 0).ok, 'letting go is always allowed');
  assert.equal(holdCap(createAutoGame(eight(), {})), Infinity);
  let k = createAutoGame({ ...eight({ boss: 'knight_golden', target: 9999 }), faces: [5, 5, 1, 2, 3, 4, 6, 6, null] }, {});
  k = toggleHold(toggleHold(k, 0).state, 1).state;
  assert.equal(currentHand(k).formula, '5 × 2');
  k = playHand(k, seq(5)).state;
  k = toggleHold(toggleHold(k, 0).state, 1).state;
  assert.equal(currentHand(k).formula, '10 × 2'); // the second hand counts whole
});

test('the late heroes come on boards from their levels; the shop sells only opened kinds; every card has a price', () => {
  for (const k of BONUS_UNLOCKS) assert.ok(CARD_PRICE[k] > 0, k);
  const run = { ups: {}, charms: [] };
  const sold = (levelIndex) => new Set(Array.from({ length: 300 }, (_, r) => shopStock({ runSeed: `u${r}`, levelIndex, run })[0].id));
  for (const k of sold(9)) assert.ok(unlockedKinds(9).includes(k), k);
  assert.ok(sold(27).has('x3_sixes'), 'SIXES ×3 is sold once it is open');
  const dice = (...f) => f.map((face, cell) => ({ cell, face, held: false }));
  assert.equal(bestHand(dice(4, 4, 4, 4), [{ cell: 9, kind: 'x3_kinds' }]).bonusMult, 3);
  assert.equal(bestHand(dice(1, 2, 3, 4), [{ cell: 9, kind: 'x3_small' }]).bonusMult, 3);
  assert.equal(bestHand(dice(2, 2), [{ cell: 9, kind: 'x4_any' }]).bonusMult, 4);
  assert.equal(bestHand(dice(6, 6, 2), [{ cell: 9, kind: 'x3_sixes' }]).bonusMult, 3);
  assert.equal(bestHand(dice(5, 5, 6), [{ cell: 9, kind: 'x3_sixes' }]).bonusMult, 1); // one six is not two
  assert.equal(bestHand(dice(6, 1, 1), [{ cell: 9, kind: 'x3_sixes' }, { cell: 10, kind: 'joker' }]).bonusMult, 3); // a joker's six counts
});

test('the offers carry a tag only when they have a reason', () => {
  const fit = fitWeights({ plays: [{ category: 'pair', cleared: true, level: 3 }] }, 3);
  assert.equal(fitTag('pair', fit, true), 'YOU PLAY THIS');
  assert.equal(fitTag('straight', fit, true), '');
});
