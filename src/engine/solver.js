// Exact two-hand partition solver: evaluates every complete partition of the eight ordinary
// dice and reports the theoretical best score with and without the one-use ×2 bonus.

import { cellsOf } from './geometry.js';
import { scoreHand, resolveTable, PIPS_TABLE, PIPS_MULT } from './scoring.js';

export function facesOfMask(faces, mask) {
  return cellsOf(mask).map((i) => faces[i]);
}

export function evaluateHand(faces, mask, table) {
  const handFaces = facesOfMask(faces, mask);
  const scored = scoreHand(handFaces, table);
  return { mask, cells: cellsOf(mask), faces: handFaces, ...scored };
}

export function solveBoard(faces, geometry, table, { bonusMultiplier = 2 } = {}) {
  const t = table === PIPS_TABLE ? PIPS_TABLE : resolveTable(table);
  let bestPlain = null;
  let bestBonus = null;
  const partitions = geometry.partitions.map(([a, b]) => {
    const ha = evaluateHand(faces, a, t);
    const hb = evaluateHand(faces, b, t);
    const total = ha.points + hb.points;
    const bonusHand = ha.points >= hb.points ? 0 : 1;
    const totalWithBonus = total + (bonusMultiplier - 1) * Math.max(ha.points, hb.points);
    const row = { masks: [a, b], hands: [ha, hb], total, totalWithBonus, bonusHand };
    if (!bestPlain || total > bestPlain.total) bestPlain = row;
    if (!bestBonus || totalWithBonus > bestBonus.totalWithBonus) bestBonus = row;
    return row;
  });
  return {
    partitions,
    bestPlain,
    bestBonus,
    maxNoBonus: bestPlain ? bestPlain.total : 0,
    maxWithBonus: bestBonus ? bestBonus.totalWithBonus : 0,
  };
}

// Allocation-free evaluator for simulations and the greedy bot (same rules as solveBoard).
export function makeFastEvaluator(geometry, table, bonusMultiplier = 2) {
  const pips = table === PIPS_TABLE;
  const t = pips ? null : resolveTable(table);
  const parts = geometry.partitions.map(([a, b]) => [cellsOf(a), cellsOf(b)]);
  const counts = new Int32Array(8);
  const extra = bonusMultiplier - 1;

  function handPoints(faces, cells) {
    counts.fill(0);
    let sum = 0;
    for (let k = 0; k < cells.length; k++) { const f = faces[cells[k]]; counts[f]++; sum += f; }
    let max = 0;
    let pairs = 0;
    let distinct = 0;
    let lowest = 0;
    let pairSum = 0;
    let bigSum = 0;
    for (let v = 1; v <= 6; v++) {
      const c = counts[v];
      if (c === 0) continue;
      distinct++;
      if (!lowest) lowest = v;
      if (c > max) { max = c; bigSum = v * c; }
      if (c === 2) { pairs++; pairSum += v * 2; }
    }
    if (max === 4) return pips ? bigSum * PIPS_MULT.four_kind : t.four_kind;
    if (max === 3) return pips ? bigSum * PIPS_MULT.three_kind : t.three_kind;
    if (pairs === 2) return pips ? pairSum * PIPS_MULT.two_pairs : t.two_pairs;
    if (distinct === 4) {
      const straight = counts[lowest + 1] && counts[lowest + 2] && counts[lowest + 3];
      return pips ? (straight ? sum * PIPS_MULT.straight : 0) : (straight ? t.straight : t.high);
    }
    return pips ? pairSum * PIPS_MULT.pair : t.pair;
  }

  return {
    handPoints,
    maxNoBonus(faces) {
      let best = -1;
      for (const [ca, cb] of parts) {
        const v = handPoints(faces, ca) + handPoints(faces, cb);
        if (v > best) best = v;
      }
      return best;
    },
    maxWithBonus(faces) {
      let best = -1;
      for (const [ca, cb] of parts) {
        const pa = handPoints(faces, ca);
        const pb = handPoints(faces, cb);
        const v = pa + pb + extra * (pa > pb ? pa : pb);
        if (v > best) best = v;
      }
      return best;
    },
  };
}
