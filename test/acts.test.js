import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextUp, afterClear, bossRule, bellsPaid, BELLS_RULE } from '../src/ui/acts.js';
import { levelBells } from '../src/engine/shop3.js';
import { BOSSES, bossOf } from '../src/engine/bosses3.js';

test('what comes next is said in words, counted in levels still to clear', () => {
  assert.deepEqual(nextUp(1), { shop: 'SHOP IN 2', boss: 'KEEPER IN 4', best: '' });
  assert.deepEqual(nextUp(2), { shop: 'SHOP NEXT', boss: 'KEEPER IN 3', best: '' });
  assert.deepEqual(nextUp(3), { shop: 'SHOP IN 2', boss: 'KEEPER IN 2', best: '' });
  assert.deepEqual(nextUp(4), { shop: 'SHOP NEXT', boss: 'KEEPER NEXT', best: '' });
  assert.deepEqual(nextUp(6), { shop: 'SHOP IN 2', boss: 'KEEPER IN 4', best: '' });
  assert.deepEqual(nextUp(123), { shop: 'SHOP IN 2', boss: 'KEEPER IN 2', best: '' });
});

test('the record shows until the run passes it', () => {
  assert.equal(nextUp(7, { level: 18 }).best, 'BEST 18');
  assert.equal(nextUp(18, { level: 18 }).best, 'BEST 18');
  assert.equal(nextUp(19, { level: 18 }).best, '');
});

test('a cleared level names only what is not the next level', () => {
  assert.equal(afterClear(1), '');
  assert.equal(afterClear(2), 'NEXT: SHOP');
  assert.equal(afterClear(3), '');
  assert.equal(afterClear(4), 'NEXT: SHOP');
  assert.equal(afterClear(5), '');
  assert.equal(afterClear(7), 'NEXT: SHOP');
  assert.equal(afterClear(9), 'NEXT: SHOP');
});

test('the next keeper\'s rule comes with the pick before him, and only then', () => {
  assert.equal(bossRule('seed', 3), '');
  assert.equal(bossRule('seed', 4), 'KEEPER RULE: EVERY HAND SUMS FIVE LESS'); // level 5 is always THE EATER
  assert.equal(bossRule('seed', 5), '');
  assert.equal(bossRule('seed', 9), `KEEPER RULE: ${BOSSES[bossOf('seed', 10)].rule}`);
});

test('a level\'s pay names what earned each amount, and the rule in How matches the pay', () => {
  const pay = (handsLeft, rerollsLeft, boss = null, charms = []) => levelBells({ handsLeft, rerollsLeft, level: { boss, charms } });
  assert.deepEqual(bellsPaid(pay(0, 0)), ['CLEAR +2']);
  assert.deepEqual(bellsPaid(pay(2, 3)), ['CLEAR +2', '2 HANDS LEFT +4', '3 REROLLS LEFT +3']);
  assert.deepEqual(bellsPaid(pay(1, 1, 'ghoul_old', ['bellwether'])), ['CLEAR +2', '1 HAND LEFT +2', '1 REROLL LEFT +1', 'KEEPER +3', 'LUCKY COIN +2']);
  assert.deepEqual(bellsPaid(pay(0, 0, 'knight_golden')), ['CLEAR +2', 'KEEPER +8']); // a golden keeper pays 5 more
  const one = pay(1, 1);
  assert.deepEqual(BELLS_RULE, [`CLEAR +${one.clear}`, `EACH HAND LEFT +${one.hand}`, `EACH REROLL LEFT +${one.reroll}`]);
});
