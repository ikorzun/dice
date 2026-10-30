// Exact 3x3 board geometry (handoff v0.3 §4): orthogonal adjacency only, one blocked (bonus)
// cell, four-cell hands that admit a self-avoiding orthogonal path, complete two-hand
// partitions and the safe-first-hand lookup used by the bank guard on every gesture.

export const SIZE = 3;
export const CELL_COUNT = SIZE * SIZE;
export const HAND_SIZE = 4;

export const rowOf = (i) => Math.floor(i / SIZE);
export const colOf = (i) => i % SIZE;
export const indexOf = (row, col) => row * SIZE + col;

export function areAdjacent(a, b) {
  if (a === b) return false;
  return Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;
}

export function isDiagonal(a, b) {
  return Math.abs(rowOf(a) - rowOf(b)) === 1 && Math.abs(colOf(a) - colOf(b)) === 1;
}

const NEIGHBORS = Array.from({ length: CELL_COUNT }, (_, i) => {
  const out = [];
  if (rowOf(i) > 0) out.push(i - SIZE);
  if (colOf(i) > 0) out.push(i - 1);
  if (colOf(i) < SIZE - 1) out.push(i + 1);
  if (rowOf(i) < SIZE - 1) out.push(i + SIZE);
  return Object.freeze(out);
});

export const neighborsOf = (i) => NEIGHBORS[i];

export function maskOf(cells) {
  let m = 0;
  for (const c of cells) m |= 1 << c;
  return m;
}

export function cellsOf(mask) {
  const out = [];
  for (let i = 0; i < CELL_COUNT; i++) if ((mask >> i) & 1) out.push(i);
  return out;
}

export function popcount(mask) {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

// All orderings of `cells` that form a simple orthogonal path, sorted lexicographically.
export function orderedPathsOf(cells) {
  const set = maskOf(cells);
  const n = cells.length;
  const out = [];
  const walk = (path, used) => {
    if (path.length === n) {
      out.push(path.slice());
      return;
    }
    const last = path[path.length - 1];
    for (const nb of NEIGHBORS[last]) {
      if ((set >> nb) & 1 && !((used >> nb) & 1)) {
        path.push(nb);
        walk(path, used | (1 << nb));
        path.pop();
      }
    }
  };
  for (const start of [...cells].sort((a, b) => a - b)) walk([start], 1 << start);
  return out;
}

export function hasHamiltonianPath(cells) {
  const set = maskOf(cells);
  const n = cells.length;
  const visit = (cur, used, depth) => {
    if (depth === n) return true;
    for (const nb of NEIGHBORS[cur]) {
      if ((set >> nb) & 1 && !((used >> nb) & 1) && visit(nb, used | (1 << nb), depth + 1)) return true;
    }
    return false;
  };
  return cells.some((start) => visit(start, 1 << start, 1));
}

function combinations(items, k) {
  const out = [];
  const rec = (start, acc) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

const geometryCache = new Map();

export function buildGeometry(blockedIndex = 8, handSize = HAND_SIZE) {
  const key = `${blockedIndex}:${handSize}`;
  if (geometryCache.has(key)) return geometryCache.get(key);
  if (!Number.isInteger(blockedIndex) || blockedIndex < 0 || blockedIndex >= CELL_COUNT) {
    throw new Error(`blocked index out of range: ${blockedIndex}`);
  }
  const free = [];
  for (let i = 0; i < CELL_COUNT; i++) if (i !== blockedIndex) free.push(i);
  const freeMask = maskOf(free);
  const eligibleMasks = combinations(free, handSize)
    .filter((cells) => hasHamiltonianPath(cells))
    .map((cells) => maskOf(cells));
  const eligibleSet = new Set(eligibleMasks);
  const partitions = [];
  const safeSet = new Set();
  const partnerOf = new Map();
  for (const m of eligibleMasks) {
    const comp = freeMask & ~m;
    if (popcount(comp) === handSize && eligibleSet.has(comp) && m < comp) {
      partitions.push(Object.freeze([m, comp]));
      safeSet.add(m);
      safeSet.add(comp);
      partnerOf.set(m, comp);
      partnerOf.set(comp, m);
    }
  }
  const strandingMasks = eligibleMasks.filter((m) => !safeSet.has(m));
  const geometry = Object.freeze({
    blockedIndex,
    handSize,
    free: Object.freeze(free),
    freeMask,
    eligibleMasks: Object.freeze(eligibleMasks),
    eligibleSet,
    partitions: Object.freeze(partitions),
    safeSet,
    partnerOf,
    strandingMasks: Object.freeze(strandingMasks),
    stats: Object.freeze({
      eligible: eligibleMasks.length,
      partitions: partitions.length,
      safeFirst: safeSet.size,
      stranding: strandingMasks.length,
    }),
  });
  geometryCache.set(key, geometry);
  return geometry;
}

export const DEFAULT_GEOMETRY = buildGeometry(8);

const fail = (code, message) => ({ ok: false, code, message });

// Validates an ordered finger path. With allowPartial, a shorter prefix is accepted so the
// UI can validate while the gesture is still in progress.
export function validatePath(path, geometry = DEFAULT_GEOMETRY, bankedMask = 0, { allowPartial = false } = {}) {
  const handSize = geometry.handSize;
  if (!Array.isArray(path) || path.length === 0) return fail('LENGTH', `Trace ${handSize} connected dice`);
  if (path.length > handSize) return fail('LENGTH', `A hand has exactly ${handSize} dice`);
  let mask = 0;
  for (let k = 0; k < path.length; k++) {
    const cell = path[k];
    if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return fail('OUT_OF_RANGE', 'Cell is outside the board');
    if (cell === geometry.blockedIndex) return fail('BONUS_CELL', 'The ×2 cell is not a die');
    if ((bankedMask >> cell) & 1) return fail('BANKED', 'That die is already banked');
    if ((mask >> cell) & 1) return fail('REVISIT', 'Each die can be used once per hand');
    if (k > 0) {
      const prev = path[k - 1];
      if (!areAdjacent(prev, cell)) {
        return isDiagonal(prev, cell)
          ? fail('DIAGONAL', 'Diagonal moves are not allowed')
          : fail('NOT_ADJACENT', 'Dice must touch edge to edge');
      }
    }
    mask |= 1 << cell;
  }
  if (path.length < handSize && !allowPartial) return fail('LENGTH', `Trace ${handSize} dice (${path.length}/${handSize})`);
  return { ok: true, mask, complete: path.length === handSize };
}
