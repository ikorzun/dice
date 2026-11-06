import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextUp, afterClear } from '../src/ui/acts.js';

test('what comes next is said in words, counted in levels still to clear', () => {
  assert.deepEqual(nextUp(1), { shop: 'SHOP IN 2', boss: 'BOSS IN 4', best: '' });
  assert.deepEqual(nextUp(2), { shop: 'SHOP NEXT', boss: 'BOSS IN 3', best: '' });
  assert.deepEqual(nextUp(3), { shop: 'SHOP IN 2', boss: 'BOSS IN 2', best: '' });
  assert.deepEqual(nextUp(4), { shop: 'SHOP NEXT', boss: 'BOSS NEXT', best: '' });
  assert.deepEqual(nextUp(6), { shop: 'SHOP IN 2', boss: 'BOSS IN 4', best: '' });
  assert.deepEqual(nextUp(123), { shop: 'SHOP IN 2', boss: 'BOSS IN 2', best: '' });
});

test('the record shows until the run passes it', () => {
  assert.equal(nextUp(7, { level: 18 }).best, 'BEST 18');
  assert.equal(nextUp(18, { level: 18 }).best, 'BEST 18');
  assert.equal(nextUp(19, { level: 18 }).best, '');
});

test('after a cleared level the next step is named', () => {
  assert.equal(afterClear(1), 'NEXT: LEVEL 2');
  assert.equal(afterClear(2), 'NEXT: SHOP');
  assert.equal(afterClear(3), 'NEXT: LEVEL 4');
  assert.equal(afterClear(4), 'NEXT: SHOP, THEN BOSS');
  assert.equal(afterClear(5), 'NEXT: LEVEL 6');
});
