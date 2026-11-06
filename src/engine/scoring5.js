// Five-die poker hands (Poker 5 mode). Categories are mutually exclusive; the highest
// matching one wins. Pip sums never count: a pair of 1s equals a pair of 6s.
// Exact outcome counts among 6^5 = 7776 ordered rolls are verified exhaustively in tests.

export const CATEGORY5 = Object.freeze({
  FIVE_KIND: 'five_kind',
  FOUR_KIND: 'four_kind',
  FULL_HOUSE: 'full_house',
  STRAIGHT: 'straight',
  SMALL_STRAIGHT: 'small_straight',
  THREE_KIND: 'three_kind',
  TWO_PAIRS: 'two_pairs',
  PAIR: 'pair',
  BUST: 'bust',
});

export const CATEGORY5_LABELS = Object.freeze({
  five_kind: 'FIVE OF A KIND',
  four_kind: 'FOUR OF A KIND',
  full_house: 'FULL HOUSE',
  straight: 'STRAIGHT',
  small_straight: 'SMALL STRAIGHT',
  three_kind: 'THREE OF A KIND',
  two_pairs: 'TWO PAIRS',
  pair: 'ONE PAIR',
  bust: 'NO MATCH',
});

// Without the small-straight category (classic poker dice partition of 7776).
export const CATEGORY5_OUTCOMES = Object.freeze({
  five_kind: 6,
  four_kind: 150,
  full_house: 300,
  straight: 240,
  three_kind: 1200,
  two_pairs: 1800,
  pair: 3600,
  bust: 480,
});

// With "small straight" (exactly four consecutive values, no five-run) as an exclusive
// category ranked above one pair: it absorbs 720 pair rolls and 240 bust rolls.
export const CATEGORY5_OUTCOMES_SMALL = Object.freeze({
  five_kind: 6,
  four_kind: 150,
  full_house: 300,
  straight: 240,
  small_straight: 960,
  three_kind: 1200,
  two_pairs: 1800,
  pair: 2880,
  bust: 240,
});

export const SCORE_TABLES5 = Object.freeze({
  // First Poker 5 table (steeper top): ordered by rarity, "no match" at 0 by poker convention.
  poker5_v1: Object.freeze({ five_kind: 60, four_kind: 40, straight: 25, full_house: 20, small_straight: 10, three_kind: 10, two_pairs: 6, pair: 2, bust: 0 }),
  // Design-panel table (see docs/DESIGN-POKER5.md): Yahtzee-familiar 50 for five of a kind,
  // straight above full house because on dice it is rarer (240 vs 300 of 7776).
  poker5_v2: Object.freeze({ five_kind: 50, four_kind: 30, straight: 25, full_house: 20, small_straight: 10, three_kind: 10, two_pairs: 5, pair: 2, bust: 0 }),
});
export const DEFAULT_SCORE_TABLE5 = 'poker5_v2';
export const PIPS_TABLE5 = 'pips';
// Multiplier grows with the rarity of the combination; the base is the pip sum of the dice
// that form it (all five for a straight or a full house).
export const PIPS_MULT5 = Object.freeze({ pair: 2, two_pairs: 3, small_straight: 3, three_kind: 4, straight: 5, full_house: 5, four_kind: 6, five_kind: 8, bust: 0 });
export const PIPS_RULES5 = Object.freeze({ five_kind: 'sum × 8', four_kind: 'sum × 6', straight: 'sum × 5', full_house: 'sum × 5', small_straight: 'run × 3', three_kind: 'sum × 4', two_pairs: 'sum × 3', pair: 'sum × 2', bust: '0' });

export function resolveTable5(table = DEFAULT_SCORE_TABLE5) {
  if (typeof table === 'string') {
    const t = SCORE_TABLES5[table];
    if (!t) throw new Error(`unknown 5-die score table "${table}"`);
    return t;
  }
  return table;
}

// Pip-based score of a classified five-die hand: matching dice score their pip sum × count.
export function pipsScore5(faces, category) {
  const counts = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const f of faces) counts[f]++;
  const sumWhere = (pred) => { let s = 0; for (let v = 1; v <= 6; v++) if (pred(counts[v])) s += v * counts[v]; return s; };
  const mult = PIPS_MULT5[category] || 0;
  let base = 0;
  if (category === CATEGORY5.FIVE_KIND) base = sumWhere((c) => c === 5);
  else if (category === CATEGORY5.FOUR_KIND) base = sumWhere((c) => c === 4);
  else if (category === CATEGORY5.FULL_HOUSE || category === CATEGORY5.STRAIGHT) base = faces.reduce((s, f) => s + f, 0);
  else if (category === CATEGORY5.SMALL_STRAIGHT) {
    let lo = 1;
    while (lo <= 3 && !(counts[lo] && counts[lo + 1] && counts[lo + 2] && counts[lo + 3])) lo++;
    base = lo * 4 + 6;
  }
  else if (category === CATEGORY5.THREE_KIND) base = sumWhere((c) => c === 3);
  else if (category === CATEGORY5.TWO_PAIRS || category === CATEGORY5.PAIR) base = sumWhere((c) => c === 2);
  const points = base * mult;
  return { points, formula: mult ? `${base} × ${mult}` : '0' };
}

function hasRunOfFour(counts) {
  for (let lo = 1; lo <= 3; lo++) {
    if (counts[lo] && counts[lo + 1] && counts[lo + 2] && counts[lo + 3]) return true;
  }
  return false;
}

export function classify5(faces, { smallStraight = false } = {}) {
  if (!Array.isArray(faces) || faces.length !== 5) throw new Error('classify5 expects exactly five faces');
  const counts = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const f of faces) {
    if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error(`invalid face ${f}`);
    counts[f]++;
  }
  let max = 0;
  let pairs = 0;
  let distinct = 0;
  for (let v = 1; v <= 6; v++) {
    const c = counts[v];
    if (c === 0) continue;
    distinct++;
    if (c > max) max = c;
    if (c === 2) pairs++;
  }
  if (max === 5) return CATEGORY5.FIVE_KIND;
  if (max === 4) return CATEGORY5.FOUR_KIND;
  if (max === 3 && pairs === 1) return CATEGORY5.FULL_HOUSE;
  if (distinct === 5) {
    const large = (counts[1] && counts[5] && !counts[6]) || (counts[2] && counts[6] && !counts[1]);
    if (large) return CATEGORY5.STRAIGHT;
    return smallStraight && hasRunOfFour(counts) ? CATEGORY5.SMALL_STRAIGHT : CATEGORY5.BUST;
  }
  if (max === 3) return CATEGORY5.THREE_KIND;
  if (pairs === 2) return CATEGORY5.TWO_PAIRS;
  // exactly one pair and three singles (four distinct values)
  return smallStraight && hasRunOfFour(counts) ? CATEGORY5.SMALL_STRAIGHT : CATEGORY5.PAIR;
}

export function scoreHand5(faces, table = DEFAULT_SCORE_TABLE5, opts = {}) {
  const category = classify5(faces, opts);
  if (table === PIPS_TABLE5) {
    const p = pipsScore5(faces, category);
    return { category, label: CATEGORY5_LABELS[category], points: p.points, formula: p.formula };
  }
  const t = resolveTable5(table);
  return { category, label: CATEGORY5_LABELS[category], points: t[category], formula: String(t[category]) };
}
