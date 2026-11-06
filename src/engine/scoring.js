// Four-die hand classification and score tables (handoff v0.3 §3).
// Categories are mutually exclusive; the highest matching one is returned.
// Scoring never looks at the pip sum: a pair of ones equals a pair of sixes.

export const CATEGORY = Object.freeze({
  FOUR_KIND: 'four_kind',
  STRAIGHT: 'straight',
  THREE_KIND: 'three_kind',
  TWO_PAIRS: 'two_pairs',
  PAIR: 'pair',
  HIGH: 'high',
});

export const CATEGORY_LABELS = Object.freeze({
  four_kind: 'FOUR OF A KIND',
  straight: 'STRAIGHT',
  three_kind: 'THREE OF A KIND',
  two_pairs: 'TWO PAIRS',
  pair: 'ONE PAIR',
  high: 'NO MATCH',
});

// Display order on help screens (by value in the baseline table).
export const CATEGORY_ORDER = Object.freeze(['four_kind', 'straight', 'three_kind', 'two_pairs', 'pair', 'high']);

// Exact outcome counts among 6^4 = 1296 ordered rolls (verified exhaustively in tests).
export const CATEGORY_OUTCOMES = Object.freeze({
  four_kind: 6,
  straight: 72,
  three_kind: 120,
  two_pairs: 90,
  pair: 720,
  high: 288,
});

export const SCORE_TABLES = Object.freeze({
  // Provisional baseline from handoff v0.3 §3. Kept unchanged for the hypothesis test.
  spec_v03: Object.freeze({ four_kind: 30, straight: 15, three_kind: 10, two_pairs: 5, pair: 2, high: 0 }),
  // Alternative ordered strictly by rarity: with four dice, two pairs (6.94%) is rarer
  // than three of a kind (9.26%), the opposite of the five-die poker intuition.
  rarity: Object.freeze({ four_kind: 30, straight: 15, two_pairs: 12, three_kind: 10, pair: 2, high: 0 }),
});

export const DEFAULT_SCORE_TABLE = 'spec_v03';
// 'pips' is not a flat table: the matching dice score their pip sum times a multiplier that
// grows with the rarity of the combination (three 3s = 9 × 4 = 36); a straight scores the
// sum of all its dice × 5.
export const PIPS_TABLE = 'pips';
export const PIPS_MULT = Object.freeze({ pair: 2, two_pairs: 3, three_kind: 4, straight: 5, four_kind: 6, high: 0 });
export const PIPS_RULES = Object.freeze({ four_kind: 'sum × 6', straight: 'sum × 5', three_kind: 'sum × 4', two_pairs: 'sum × 3', pair: 'sum × 2', high: '0' });

export function resolveTable(table = DEFAULT_SCORE_TABLE) {
  if (typeof table === 'string') {
    const t = SCORE_TABLES[table];
    if (!t) throw new Error(`unknown score table "${table}"`);
    return t;
  }
  return table;
}

// Pip-based score of a classified four-die hand: { points, base, mult, formula }.
export function pipsScore(faces, category) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const f of faces) counts[f]++;
  const sumWhere = (pred) => { let s = 0; for (let v = 1; v <= 6; v++) if (pred(counts[v])) s += v * counts[v]; return s; };
  let base = 0;
  const mult = PIPS_MULT[category] || 0;
  if (category === CATEGORY.FOUR_KIND) base = sumWhere((c) => c === 4);
  else if (category === CATEGORY.THREE_KIND) base = sumWhere((c) => c === 3);
  else if (category === CATEGORY.TWO_PAIRS || category === CATEGORY.PAIR) base = sumWhere((c) => c === 2);
  else if (category === CATEGORY.STRAIGHT) base = faces.reduce((s, f) => s + f, 0);
  const points = base * mult;
  return { points, base, mult, formula: mult ? `${base} × ${mult}` : '0' };
}

export function classify(faces) {
  if (!Array.isArray(faces) || faces.length !== 4) throw new Error('classify expects exactly four faces');
  const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const f of faces) {
    if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error(`invalid face ${f}`);
    counts[f]++;
  }
  let max = 0;
  let pairs = 0;
  let distinct = 0;
  let lowest = 0;
  for (let v = 1; v <= 6; v++) {
    const c = counts[v];
    if (c === 0) continue;
    distinct++;
    if (!lowest) lowest = v;
    if (c > max) max = c;
    if (c === 2) pairs++;
  }
  if (max === 4) return CATEGORY.FOUR_KIND;
  if (max === 3) return CATEGORY.THREE_KIND;
  if (pairs === 2) return CATEGORY.TWO_PAIRS;
  if (distinct === 4) {
    const straight = counts[lowest + 1] > 0 && counts[lowest + 2] > 0 && counts[lowest + 3] > 0;
    return straight ? CATEGORY.STRAIGHT : CATEGORY.HIGH;
  }
  return CATEGORY.PAIR; // exactly one pair plus two distinct singles
}

export function scoreHand(faces, table = DEFAULT_SCORE_TABLE) {
  const category = classify(faces);
  if (table === PIPS_TABLE) {
    const p = pipsScore(faces, category);
    return { category, label: CATEGORY_LABELS[category], points: p.points, formula: p.formula };
  }
  const t = resolveTable(table);
  return { category, label: CATEGORY_LABELS[category], points: t[category], formula: String(t[category]) };
}
