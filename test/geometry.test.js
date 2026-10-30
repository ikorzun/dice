import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGeometry, validatePath, areAdjacent, isDiagonal, neighborsOf, maskOf, cellsOf, popcount,
  hasHamiltonianPath, orderedPathsOf, CELL_COUNT,
} from '../src/engine/geometry.js';

// Independent brute force: every 4-subset, every permutation, explicit row/col adjacency.
function bruteForce(blocked) {
  const free = [];
  for (let i = 0; i < 9; i++) if (i !== blocked) free.push(i);
  const adj = (a, b) => {
    const [ra, ca, rb, cb] = [Math.floor(a / 3), a % 3, Math.floor(b / 3), b % 3];
    return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
  };
  const perms = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p])));
  const sets = [];
  for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) for (let c = b + 1; c < free.length; c++) for (let d = c + 1; d < free.length; d++) {
    const s = [free[a], free[b], free[c], free[d]];
    if (perms(s).some((p) => adj(p[0], p[1]) && adj(p[1], p[2]) && adj(p[2], p[3]))) sets.push(s);
  }
  const key = (s) => [...s].sort((x, y) => x - y).join(',');
  const keys = new Set(sets.map(key));
  const partitions = new Set();
  for (const s of sets) {
    const comp = free.filter((i) => !s.includes(i));
    if (keys.has(key(comp))) partitions.add([key(s), key(comp)].sort().join('|'));
  }
  const safe = new Set();
  for (const p of partitions) for (const half of p.split('|')) safe.add(half);
  return { eligible: sets.length, partitions: partitions.size, safeFirst: safe.size, stranding: sets.length - safe.size };
}

test('corner bonus cell: 19 eligible sets, 4 partitions, 8 safe first hands, 11 stranding', () => {
  const g = buildGeometry(8);
  assert.deepEqual({ ...g.stats }, { eligible: 19, partitions: 4, safeFirst: 8, stranding: 11 });
  assert.deepEqual({ ...g.stats }, bruteForce(8));
  for (const corner of [0, 2, 6]) assert.deepEqual({ ...buildGeometry(corner).stats }, { eligible: 19, partitions: 4, safeFirst: 8, stranding: 11 });
});

test('edge-middle bonus cell yields zero complete partitions; center yields 4 partitions and 8 sets', () => {
  for (const edge of [1, 3, 5, 7]) {
    assert.equal(buildGeometry(edge).partitions.length, 0);
    assert.equal(buildGeometry(edge).stats.partitions, bruteForce(edge).partitions);
  }
  assert.deepEqual({ ...buildGeometry(4).stats }, { eligible: 8, partitions: 4, safeFirst: 8, stranding: 0 });
  assert.deepEqual({ ...buildGeometry(4).stats }, bruteForce(4));
});

test('brute force agrees with the engine for every blocked cell', () => {
  for (let b = 0; b < CELL_COUNT; b++) assert.deepEqual({ ...buildGeometry(b).stats }, bruteForce(b), `blocked=${b}`);
});

test('the four corner partitions are the expected cell sets', () => {
  const g = buildGeometry(8);
  const parts = g.partitions.map(([a, b]) => [cellsOf(a), cellsOf(b)].map((c) => c.join('')).sort().join('|')).sort();
  assert.deepEqual(parts, ['0123|4567', '0125|3467', '0136|2457', '0367|1245']);
});

test('every safe first hand leaves exactly one legal, traversable, non-overlapping second hand', () => {
  const g = buildGeometry(8);
  for (const m of g.safeSet) {
    const comp = g.freeMask & ~m;
    assert.equal(m & comp, 0);
    assert.equal(popcount(comp), 4);
    assert.ok(g.eligibleSet.has(comp));
    assert.ok(hasHamiltonianPath(cellsOf(comp)));
    assert.equal(g.partnerOf.get(m), comp);
    assert.equal((m | comp), g.freeMask, 'both hands consume all eight ordinary dice');
  }
  for (const m of g.strandingMasks) {
    const comp = g.freeMask & ~m;
    assert.ok(!g.eligibleSet.has(comp), 'stranding sets leave an untraversable remainder');
  }
});

test('T-tetromino sets are not eligible, diagonal-only sets are not eligible', () => {
  assert.equal(hasHamiltonianPath([0, 1, 2, 4]), false); // T
  assert.equal(hasHamiltonianPath([1, 3, 4, 5]), false); // T
  assert.equal(hasHamiltonianPath([0, 4, 8, 2]), false); // diagonals
  assert.equal(hasHamiltonianPath([0, 1, 3, 4]), true); // square
  assert.equal(hasHamiltonianPath([0, 1, 2, 5]), true); // L
  assert.equal(orderedPathsOf([0, 1, 3, 4]).length, 8);
  assert.deepEqual(orderedPathsOf([0, 1, 2, 5])[0], [0, 1, 2, 5]);
});

test('adjacency helpers', () => {
  assert.ok(areAdjacent(0, 1) && areAdjacent(1, 4) && areAdjacent(7, 8));
  assert.ok(!areAdjacent(0, 4) && !areAdjacent(2, 3) && !areAdjacent(0, 0) && !areAdjacent(0, 2));
  assert.ok(isDiagonal(0, 4) && isDiagonal(4, 8) && !isDiagonal(0, 1) && !isDiagonal(0, 2));
  assert.deepEqual([...neighborsOf(4)].sort(), [1, 3, 5, 7]);
  assert.deepEqual([...neighborsOf(0)].sort(), [1, 3]);
  assert.equal(maskOf([0, 1, 2]), 0b111);
  assert.deepEqual(cellsOf(0b101000000), [6, 8]);
});

test('validatePath: diagonals, revisits, bonus cell, banked cells, jumps and lengths', () => {
  const g = buildGeometry(8);
  assert.equal(validatePath([0, 1, 2, 5], g).ok, true);
  assert.equal(validatePath([5, 2, 1, 0], g).ok, true);
  assert.equal(validatePath([0, 4, 5, 2], g).code, 'DIAGONAL');
  assert.equal(validatePath([0, 2, 5, 4], g).code, 'NOT_ADJACENT');
  assert.equal(validatePath([0, 1, 0, 3], g).code, 'REVISIT');
  assert.equal(validatePath([5, 8, 7, 6], g).code, 'BONUS_CELL');
  assert.equal(validatePath([0, 1, 2], g).code, 'LENGTH');
  assert.equal(validatePath([0, 1, 2, 5, 4], g).code, 'LENGTH');
  assert.equal(validatePath([], g).code, 'LENGTH');
  assert.equal(validatePath([0, 1, 2, 9], g).code, 'OUT_OF_RANGE');
  assert.equal(validatePath([0, 1, 2, 5], g, maskOf([5])).code, 'BANKED');
  const partial = validatePath([0, 1], g, 0, { allowPartial: true });
  assert.equal(partial.ok, true);
  assert.equal(partial.complete, false);
});
