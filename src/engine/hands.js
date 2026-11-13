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

// The ten heroes of the portals redesign (10.11.2026), each opened by depth in levels3.js. `fits` receives the combination
// category and the hand's faces (a joker's face among them); without faces it answers whether the category can ever fit.
export const BONUS_KINDS = Object.freeze({
  x2_any: Object.freeze({ symbol: '×2', label: 'ANY HAND', mult: 2, fits: () => true }),
  x3_straight: Object.freeze({ symbol: '×3', label: 'STRAIGHT', mult: 3, fits: (c) => c === 'straight' }),
  x3_pairs: Object.freeze({ symbol: '×3', label: 'PAIRS', mult: 3, fits: (c) => c === 'pair' || c === 'two_pairs' }),
  x3_trips: Object.freeze({ symbol: '×3', label: 'TRIPS', mult: 3, fits: (c) => c === 'three_kind' || c === 'full_house' }),
  joker: Object.freeze({ symbol: '★', label: 'JOKER', wild: true }),
  refund: Object.freeze({ symbol: '+1', label: 'REFUND', mult: 1, fits: () => true, refund: 1 }),
  x3_kinds: Object.freeze({ symbol: '×3', label: 'KINDS', mult: 3, fits: (c) => c === 'four_kind' || c === 'five_kind' }),
  x3_small: Object.freeze({ symbol: '×3', label: 'SMALL', mult: 3, fits: (c) => c === 'small_straight' }),
  // MOON OWL sleeps through the first hands: it fits any hand, but counts only on the level's last (`awake` in auto.js)
  x4_any: Object.freeze({ symbol: '×4', label: 'LAST HAND', mult: 4, fits: () => true, last: true }),
  // Bigfoot: a hand with two sixes or more, a joker standing in for a six counts; no straight ever holds two
  x3_sixes: Object.freeze({ symbol: '×3', label: 'TWO SIXES', mult: 3, fits: (c, faces) => c !== 'straight' && c !== 'small_straight' && (!faces || faces.filter((f) => f === 6).length >= 2) }),
  // The card-things (portals spec, step 4; their shop data in things3.js CARD_THINGS): sold in the shop alone, kept in the
  // bank, played once like a hero's card. BIG BANG and HOT TRIPS are the ×4 of the KINDS and TRIPS heroes' hands; ODD PUNK
  // and EVEN FLOOR want a hand of one parity (a joker's face counts; no straight is one); SECOND WIND joins any hand, which
  // then costs no PLAY (auto.js); POWER PAINT joins only a hand another card with a number joins, and raises it by one.
  big_bang: Object.freeze({ symbol: '×4', label: 'KINDS', mult: 4, fits: (c) => c === 'four_kind' || c === 'five_kind', thing: true }),
  hot_trips: Object.freeze({ symbol: '×4', label: 'TRIPS', mult: 4, fits: (c) => c === 'three_kind' || c === 'full_house', thing: true }),
  odd_punk: Object.freeze({ symbol: '×3', label: 'ODD DICE', mult: 3, fits: (c, faces) => c !== 'straight' && c !== 'small_straight' && (!faces || faces.every((f) => f % 2 === 1)), thing: true }),
  even_floor: Object.freeze({ symbol: '×3', label: 'EVEN DICE', mult: 3, fits: (c, faces) => c !== 'straight' && c !== 'small_straight' && (!faces || faces.every((f) => f % 2 === 0)), thing: true }),
  second_wind: Object.freeze({ symbol: '', label: 'FREE PLAY', mult: 1, fits: () => true, free: true, thing: true }),
  power_paint: Object.freeze({ symbol: '+1', label: 'OTHER CARDS', mult: 1, fits: () => true, paint: true, thing: true }),
});

// A card with a number that a thing or POWER PAINT can raise: a multiplier or REFUND, never a joker, SECOND WIND or a paint.
export const numberedKind = (kind) => !!BONUS_KINDS[kind] && !BONUS_KINDS[kind].wild && !BONUS_KINDS[kind].free && !BONUS_KINDS[kind].paint;

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
  if (n === 4 && shape === '1111' && Math.max(...faces) - Math.min(...faces) === 3) return 'small_straight'; // four in a row (owner, 02.11.2026: a rule of dice)
  if (n === 5 && shape === '5') return 'five_kind';
  if (n === 5 && shape === '32') return 'full_house';
  if (n === 5 && shape === '11111' && Math.max(...faces) - Math.min(...faces) === 4) return 'straight';
  return null;
}

export const CENTER = 4; // the board's middle cell (three rows of three, cells 0–8)

// The sum of a hand's faces (dice and jokers alike) under the pocket's things and a keeper's rules, in the spec's order:
// each face and the additions to it (a keeper's zero beats them) and to its cell (the middle die's, whatever its face
// adds), then the hand's additions (its jokers and cards among them), then the keeper's toll, never below zero. Faces
// still decide the combination. `center`: the index in `faces` of the die in the middle cell, or -1. `used` collects the
// things that changed it.
function sumOf(faces, r, used, { center = -1, jokers = 0, cards = 0 } = {}) {
  const zero = (f) => (f === 1 && r.ones === 0) || (f === 6 && r.sixes === 0);
  let sum = 0;
  faces.forEach((f, k) => {
    if (k === center) for (const a of r.cells || []) { sum += a.n; used.add(a.id); }
    if (zero(f)) return;
    sum += f;
    for (const a of r.faces || []) if (a.face === f) { sum += a.n; used.add(a.id); }
  });
  for (const a of r.adds || []) {
    if (a.when === 'any' || (a.when === 'five' && faces.length === 5) || (a.when === 'has' && faces.includes(a.face))) { sum += a.n; used.add(a.id); }
  }
  if (jokers) for (const a of r.jokers || []) { sum += a.n * jokers; used.add(a.id); }
  if (cards) for (const a of r.cards || []) { sum += a.n * cards; used.add(a.id); }
  return Math.max(0, sum + (r.sumAdd || 0));
}

// What the things and POWER PAINT add to each card the hand uses (card_up): ALL SEEING every card, BRAIN BOOST the level's
// first cards, PATIENT BEADS its first card from the bank, each POWER PAINT every other card; multipliers before REFUND,
// in board order. Only a card with a number is raised (numberedKind). +4 at most on one card (the spec's limit).
function raisesOf(applied, r, used) {
  const up = applied.map(() => 0);
  const order = applied.map((b, k) => k).filter((k) => numberedKind(applied[k].kind)).sort((a, b) => Number(!!BONUS_KINDS[applied[a].kind].refund) - Number(!!BONUS_KINDS[applied[b].kind].refund));
  for (const u of (r && r.raise) || []) {
    const ks = u.which === 'all' ? order : u.which === 'first' ? order.slice(0, u.count) : order.filter((k) => applied[k].bank).slice(0, 1);
    for (const k of ks) up[k] += u.n;
    if (ks.length) used.add(u.id);
  }
  const paints = applied.filter((b) => BONUS_KINDS[b.kind].paint).length;
  for (const k of order) up[k] += paints;
  return up.map((n) => Math.min(4, n));
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

// dice: [{ cell, face, held }]; bonuses: [{ cell, kind, bank }] that are on and may be used (`bank`: it came from the
// bank, for PATIENT BEADS).
// Returns the best hand or null when the board holds no combination.
// Options are for balance experiments only; without them the rules above apply. stacking:
// 'add' (rules, owner 01.11.2026), 'multiply' (the first rule: ×2 · ×3 = ×6) or 'single' (only
// the largest applicable bonus is used and burnt); the joker is not a multiplier and is never
// affected. table { base, mult }: score = (category base + pip sum) × mult. straightMult:
// multiplier of the straight (5 = the Poker 5 table). ups { category: n }: the run's upgrades, +n to that
// combination's multiplier (owner, 02.11.2026: after a won level the player picks one of three to upgrade). rules:
// what the pocket's things and a keeper change in the count (`handRules` in auto.js, `thingRules` in things3.js): adds,
// faces, cells, jokers, cards, ups, raise, pct, the things' (each names its thing); ones and sixes, 0 when a keeper
// zeroes them; sumAdd, the keeper's toll on the sum; half, the combinations whose multiplier halves; halfSum, the sum
// halves (rounding up). A hand names the things that changed its count (`things`), its percent (`pct`) comes after the
// cards, rounding down, and `refund` is the rerolls its REFUND cards give back.
export function bestHand(dice, bonuses = [], { stacking = 'add', table = null, straightMult = null, ups = null, rules = null } = {}) {
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
        const fitting = mults.filter((b) => !BONUS_KINDS[b.kind].paint && BONUS_KINDS[b.kind].fits(category, faces));
        const chosen = stacking === 'single' && fitting.length > 1 ? [fitting.reduce(largest)] : fitting;
        // POWER PAINT joins only a hand that a card with a number joins; alone it stays on the board, not used up
        const applied = chosen.some((b) => numberedKind(b.kind)) ? [...chosen, ...mults.filter((b) => BONUS_KINDS[b.kind].paint)] : chosen;
        const used = new Set();
        // THE EATER's toll can take a small hand's sum to nothing, never below
        const sum = rules
          ? sumOf(faces, rules, used, { center: picked.findIndex((d) => d.cell === CENTER), jokers: j, cards: applied.length + j })
          : faces.reduce((s, f) => s + f, 0) + (table ? table.base[category] : 0);
        const base = rules && rules.halfSum ? Math.ceil(sum / 2) : sum; // THE GOLDEN KNIGHT's first hand: the counter shows the halved sum
        let full = multOf[category] + ((ups && ups[category]) || 0);
        const fiveHeld = picked.length === 5 && picked.every((d) => d.held); // SOLID HOLD's hand
        for (const u of (rules && rules.ups) || []) if ((!u.category || u.category === category) && (!u.held || fiveHeld)) { full += u.n; used.add(u.id); }
        const mult = rules && rules.half && rules.half.includes(category) ? Math.ceil(full / 2) : full; // OLD HORNS halves it, rounding up: never ×4.5 on the counter
        let pct = 0;
        for (const p of (rules && rules.pct) || []) { pct += p.n; used.add(p.id); }
        // a card's number, raised by the things and POWER PAINT: a multiplier counts higher, REFUND gives more back (+1 AS +2)
        const raise = raisesOf(applied, rules, used);
        const own = (b, k) => (BONUS_KINDS[b.kind].refund ? 1 : BONUS_KINDS[b.kind].mult + raise[k]);
        const bonusMult = stacking === 'add'
          ? applied.reduce((m, b, k) => m + own(b, k) - 1, 1)
          : applied.reduce((m, b, k) => m * own(b, k), 1);
        const refund = applied.reduce((n, b, k) => n + (BONUS_KINDS[b.kind].refund ? BONUS_KINDS[b.kind].refund + raise[k] : 0), 0);
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
          points: Math.floor(base * mult),
          formula: `${base} × ${mult}`,
          bonusMult,
          refund,
          pct,
          total: Math.floor((Math.floor(base * mult) * bonusMult * (100 + pct)) / 100),
          heldBurned: picked.filter((d) => d.held).length,
          things: [...used],
        };
        if (!best || better(cand, best)) best = cand;
      }
    }
  }
  return best;
}
