// Auto Hand mode: finds the best scoring combination among the dice on the board, regardless
// of position, and the bonus dice that apply to it. A hand is exactly the dice that form the
// combination (pair = 2, two pairs = 4, full house / straight / five of a kind = 5). Its score
// is the pips rule of Poker 5 (pip sum × rarity multiplier) with the straight at ×8, then the
// applicable bonuses that are switched on add up: ×(1 + Σ(bonus − 1)), so ×2 and ×3 make ×4.
// A joker bonus stands in for the best missing face; a refund bonus joins any hand and gives a
// reroll back when the hand is played (it does not multiply).

import { PIPS_MULT5, CATEGORY5_LABELS } from './scoring5.js';

// Owner, 01.11.2026: a straight scores ×8 in Auto Hand (with pips, collecting one face beat
// chasing a straight ×1.54 in expected points); Poker 5 keeps its own table.
export const AUTO_MULT = Object.freeze({ ...PIPS_MULT5, straight: 8 });

// Unlock order is set by levels3.js; `fits` receives the combination category.
export const BONUS_KINDS = Object.freeze({
  x2_any: Object.freeze({ symbol: '×2', label: 'ANY HAND', mult: 2, fits: () => true }),
  x3_straight: Object.freeze({ symbol: '×3', label: 'STRAIGHT', mult: 3, fits: (c) => c === 'straight' }),
  x3_pairs: Object.freeze({ symbol: '×3', label: 'PAIRS', mult: 3, fits: (c) => c === 'pair' || c === 'two_pairs' }),
  x3_trips: Object.freeze({ symbol: '×3', label: 'TRIPS', mult: 3, fits: (c) => c === 'three_kind' || c === 'full_house' }),
  joker: Object.freeze({ symbol: '★', label: 'JOKER', wild: true }),
  refund: Object.freeze({ symbol: '+1', label: 'REFUND', mult: 1, fits: () => true, refund: 1 }),
});

// Category of a set of dice that is itself a combination (every die counts), or null.
export function classifyExact(faces) {
  const n = faces.length;
  const counts = new Map();
  for (const f of faces) counts.set(f, (counts.get(f) || 0) + 1);
  const shape = [...counts.values()].sort((a, b) => b - a).join('');
  if (n === 2 && shape === '2') return 'pair';
  if (n === 3 && shape === '3') return 'three_kind';
  if (n === 4 && shape === '4') return 'four_kind';
  if (n === 4 && shape === '22') return 'two_pairs';
  if (n === 5 && shape === '5') return 'five_kind';
  if (n === 5 && shape === '32') return 'full_house';
  if (n === 5 && shape === '11111' && Math.max(...faces) - Math.min(...faces) === 4) return 'straight';
  return null;
}

const better = (a, b) => {
  if (a.total !== b.total) return a.total > b.total;
  const ua = a.bonusCells.length + a.jokerCells.length;
  const ub = b.bonusCells.length + b.jokerCells.length;
  if (ua !== ub) return ua < ub; // keep bonuses for later when the total is the same
  if (a.heldBurned !== b.heldBurned) return a.heldBurned < b.heldBurned;
  const ka = [...a.cells, ...a.jokerCells].join(',');
  const kb = [...b.cells, ...b.jokerCells].join(',');
  return ka < kb;
};

// dice: [{ cell, face, held }]; bonuses: [{ cell, kind }] that are on and may be used.
// Returns the best hand or null when the board holds no combination.
// Options are for balance experiments only; without them the rules above apply. stacking:
// 'add' (rules, owner 01.11.2026), 'multiply' (the first rule: ×2 · ×3 = ×6) or 'single' (only
// the largest applicable bonus is used and burnt); the joker is not a multiplier and is never
// affected. table { base, mult }: score = (category base + pip sum) × mult. straightMult:
// multiplier of the straight (5 = the Poker 5 table).
export function bestHand(dice, bonuses = [], { stacking = 'add', table = null, straightMult = null } = {}) {
  const jokers = bonuses.filter((b) => BONUS_KINDS[b.kind].wild).map((b) => b.cell);
  const mults = bonuses.filter((b) => !BONUS_KINDS[b.kind].wild);
  const multOf = straightMult ? { ...(table ? table.mult : AUTO_MULT), straight: straightMult } : table ? table.mult : AUTO_MULT;
  const largest = (a, b) => (BONUS_KINDS[b.kind].mult > BONUS_KINDS[a.kind].mult ? b : a);
  const n = dice.length;
  let best = null;
  for (let mask = 1; mask < 1 << n; mask++) {
    const picked = [];
    for (let k = 0; k < n; k++) if (mask & (1 << k)) picked.push(dice[k]);
    if (picked.length > 5) continue;
    for (let j = 0; j <= Math.min(jokers.length, 5 - picked.length); j++) {
      if (picked.length + j < 2) continue;
      for (let code = 0; code < 6 ** j; code++) {
        const jokerFaces = [];
        for (let k = 0, c = code; k < j; k++, c = Math.floor(c / 6)) jokerFaces.push(1 + (c % 6));
        const faces = [...picked.map((d) => d.face), ...jokerFaces];
        const category = classifyExact(faces);
        if (!category) continue;
        const base = faces.reduce((s, f) => s + f, 0) + (table ? table.base[category] : 0);
        const mult = multOf[category];
        const fitting = mults.filter((b) => BONUS_KINDS[b.kind].fits(category));
        const applied = stacking === 'single' && fitting.length > 1 ? [fitting.reduce(largest)] : fitting;
        const bonusMult = stacking === 'add'
          ? applied.reduce((m, b) => m + BONUS_KINDS[b.kind].mult - 1, 1)
          : applied.reduce((m, b) => m * BONUS_KINDS[b.kind].mult, 1);
        const cand = {
          cells: picked.map((d) => d.cell),
          faces,
          jokerCells: jokers.slice(0, j),
          jokerFaces,
          bonusCells: applied.map((b) => b.cell),
          category,
          label: CATEGORY5_LABELS[category],
          base,
          mult,
          points: base * mult,
          formula: `${base} × ${mult}`,
          bonusMult,
          total: base * mult * bonusMult,
          heldBurned: picked.filter((d) => d.held).length,
        };
        if (!best || better(cand, best)) best = cand;
      }
    }
  }
  return best;
}
