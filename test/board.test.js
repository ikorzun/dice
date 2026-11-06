import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packRun, unpackRun, withRun, around, RUNS_KEPT } from '../src/ui/board.js';

test('a run packs into one whole number that ranks by level, then points', () => {
  assert.deepEqual(unpackRun(packRun(12, 34567)), { level: 12, points: 34567 });
  assert.ok(packRun(13, 0) > packRun(12, 9999999), 'a further level beats any points');
  assert.ok(packRun(12, 500) > packRun(12, 499));
  assert.equal(unpackRun(packRun(3, 123456789)).points, 9999999, 'points stay inside their digits');
  assert.equal(packRun(3, 12.4) % 1, 0, 'the table stores whole numbers');
});

test('the device keeps its best runs: furthest level, then points', () => {
  let runs = [];
  for (const [level, score] of [[3, 900], [7, 100], [7, 300], [2, 50], [9, 10], [1, 5], [4, 40]]) runs = withRun(runs, { level, score });
  assert.equal(runs.length, RUNS_KEPT);
  assert.deepEqual(runs.map((r) => r.level), [9, 7, 7, 4, 3]);
  assert.equal(runs[1].score, 300);
});

test('the table shows the player with neighbours, the leader kept on top', () => {
  const list = Array.from({ length: 20 }, (_, k) => ({ id: `p${k}`, rank: k + 1 }));
  assert.deepEqual(around(list, 'p9').map((e) => e.rank), [1, 8, 9, 10, 11, 12]);
  assert.deepEqual(around(list, 'p1').map((e) => e.rank), [1, 2, 3, 4, 5], 'near the top no second leader');
  assert.deepEqual(around(list, 'p19').map((e) => e.rank), [1, 16, 17, 18, 19, 20]);
  assert.deepEqual(around(list, 'nobody').map((e) => e.rank), [1, 2, 3, 4, 5]);
});
