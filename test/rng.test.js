import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, hashSeed } from '../src/engine/rng.js';

test('same seed → same stream, different seed → different stream', () => {
  const a = createRng('seed-A');
  const b = createRng('seed-A');
  const c = createRng('seed-B');
  const sa = Array.from({ length: 20 }, () => a.die());
  const sb = Array.from({ length: 20 }, () => b.die());
  const sc = Array.from({ length: 20 }, () => c.die());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.deepEqual(hashSeed('x'), hashSeed('x'));
  assert.notDeepEqual(hashSeed('x'), hashSeed('y'));
  assert.deepEqual(Array.from({ length: 5 }, () => createRng('s').fork('r').die()), Array.from({ length: 5 }, () => createRng('s/r').die()));
});

test('die faces are uniform (chi-square over 120k rolls well under the 1% critical value)', () => {
  const rng = createRng('uniformity');
  const n = 120000;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) counts[rng.die()]++;
  const expected = n / 6;
  let chi = 0;
  for (let v = 1; v <= 6; v++) chi += ((counts[v] - expected) ** 2) / expected;
  assert.ok(chi < 15.09, `chi-square ${chi.toFixed(2)} too high: ${counts.slice(1)}`);
  for (let v = 1; v <= 6; v++) assert.ok(counts[v] > 0);
  assert.throws(() => rng.int(0));
  for (let i = 0; i < 1000; i++) { const x = rng.int(7); assert.ok(x >= 0 && x < 7); }
});
