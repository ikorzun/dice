// Auto Hand mode (mode 3): nine cells of dice, bonus dice and blocks; positions do not matter.
// The game shows the best hand on the board (counting the bonuses the player switched on; every
// bonus starts off); the player holds dice, rerolls the rest (three rerolls per level, shared by
// the hands) or plays it.
// Playing burns every die on the board and the bonuses the hand used: burnt dice are replaced
// (owner, 03.11.2026: «перебрасывать все»; held dice outside the hand used to stay). A hold before
// PLAY only picks the hand.
// A level ends as soon as the score reaches the target (owner, 01.11.2026), otherwise after its
// three hands. The bank (owner, 02.11.2026): bonuses not played on a won level wait in a bank of three
// for the next levels (`level.bank`, kinds); a banked bonus is cell BANK + k, switched on and used like a
// card on the board, and gone once played. The banked cards come in on the level's first reroll (owner,
// 03.11.2026: «a kept card takes part only after the first reroll; the first round always has every cell
// filled»): each takes the cell of a die being rerolled, in bank and board order (cell `fromBank: k`, the
// entry `placed`), while the board keeps MIN_DICE dice; the rest wait above the board, usable from then
// on. After that reroll a played card's cell takes the first banked card still waiting, else a new die. A
// 'hole' remains only in games saved before. Pure state transitions, same action shape as poker.js.

import { bestHand, BONUS_KINDS } from './hands.js';

export const AUTO_DEFAULT_CONFIG = Object.freeze({
  hands: 3,          // hands per level, all of them are played
  rerolls: 3,        // shared rerolls per level
  handOptions: null, // bestHand options for balance experiments (stacking, table, straightMult); null = the rules
});

const reject = (code, message) => ({ ok: false, code, message });
export const BANK = 100;    // the first banked bonus's cell number (the board's are 0–8)
export const BANK_SIZE = 3; // places in the bank (owner, 02.11.2026); the rest burn
export const MIN_DICE = 6; // every layout keeps this many dice (levels3.js), and so does a kept card coming in
const waiting = (b) => !b.used && !b.placed; // a banked card still above the board

const bump = (state, key) => ({ ...state.stats, [key]: state.stats[key] + 1 });

export function createAutoGame(level, configOverrides = {}, attempt = 1) {
  const config = { ...AUTO_DEFAULT_CONFIG, ...configOverrides };
  if (!Array.isArray(level.layout) || level.layout.length !== 9) throw new Error('an auto level needs a layout of nine cells');
  const cells = level.layout.map((c) => ({ ...c }));
  cells.forEach((c, i) => {
    const f = level.faces[i];
    if (c.type === 'die') {
      if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error(`invalid face ${f} at cell ${i}`);
    } else if (f !== null) throw new Error(`cell ${i} (${c.type}) must have a null face`);
    if (c.type === 'bonus' && !BONUS_KINDS[c.kind]) throw new Error(`unknown bonus kind ${c.kind}`);
    if (!['die', 'bonus', 'block', 'hole'].includes(c.type)) throw new Error(`unknown cell type ${c.type}`);
  });
  const bank = (level.bank || []).map((kind) => {
    if (!BONUS_KINDS[kind]) throw new Error(`unknown bonus kind ${kind} in the bank`);
    return { kind, off: true, used: false, placed: false };
  });
  return {
    mode: 'auto',
    level,
    config,
    attempt,
    cells,
    faces: level.faces.slice(),
    held: new Array(9).fill(false),
    off: cells.map((c) => c.type === 'bonus'), // bonuses start off; the player switches them on
    bank,
    rerollsLeft: level.rerolls ?? config.rerolls,
    handsLeft: level.hands ?? config.hands,
    hands: [],
    score: 0,
    phase: 'playing',
    stats: { rerollsUsed: 0, holdToggles: 0, rejectedPaths: 0, hintsUsed: 0, bonusToggles: 0 },
  };
}

export const isDie = (state, i) => state.cells[i].type === 'die';
export const isBonus = (state, i) => state.cells[i].type === 'bonus';
const banked = (state, i) => (i >= BANK ? state.bank[i - BANK] : null);
// The scoring options of a hand: the experiment's, with the run's upgrades of the combinations (`level.ups`).
const handOptionsOf = (state) => (state.level.ups ? { ...(state.config.handOptions || {}), ups: state.level.ups } : state.config.handOptions ?? undefined);
export const bonusKind = (state, i) => (i >= BANK ? state.bank[i - BANK].kind : state.cells[i].kind);
// The bonuses switched on: the board's and the bank's, as bestHand takes them.
function onBonuses(state) {
  const board = state.cells.map((c, i) => i).filter((i) => isBonus(state, i) && !state.off[i]).map((i) => ({ cell: i, kind: state.cells[i].kind }));
  const bank = state.bank.map((b, k) => ({ cell: BANK + k, kind: b.kind, b })).filter(({ b }) => !b.off && waiting(b)).map(({ cell, kind }) => ({ cell, kind }));
  return [...board, ...bank];
}
export const diceCells = (state) => state.cells.map((c, i) => i).filter((i) => isDie(state, i));

export function heldCount(state) {
  return diceCells(state).filter((i) => state.held[i]).length;
}

export function rerollTargets(state) {
  return diceCells(state).filter((i) => !state.held[i]);
}

export function canReroll(state) {
  return state.phase === 'playing' && state.rerollsLeft > 0 && rerollTargets(state).length > 0;
}

export function toggleHold(state, i) {
  if (state.phase !== 'playing') return reject('PHASE', 'The level is over');
  if (!isDie(state, i)) return reject('NOT_DIE', 'Only dice can be held');
  const held = state.held.slice();
  held[i] = !held[i];
  return { ok: true, held: held[i], state: { ...state, held, stats: bump(state, 'holdToggles') } };
}

// Switches a bonus die on (it joins the hand when it fits) or back off (kept for a later hand).
export function toggleBonus(state, i) {
  if (state.phase !== 'playing') return reject('PHASE', 'The level is over');
  const b = Number.isInteger(i) ? banked(state, i) : null;
  if (b && waiting(b)) {
    if (!state.stats.rerollsUsed) return reject('NOT_YET', 'Kept bonuses come in on the first reroll');
    const bank = state.bank.map((x, k) => (k === i - BANK ? { ...x, off: !x.off } : x));
    return { ok: true, off: bank[i - BANK].off, state: { ...state, bank, stats: bump(state, 'bonusToggles') } };
  }
  if (!Number.isInteger(i) || i >= BANK || !isBonus(state, i)) return reject('NOT_BONUS', 'Tap a bonus die to switch it');
  const off = state.off.slice();
  off[i] = !off[i];
  return { ok: true, off: off[i], state: { ...state, off, stats: bump(state, 'bonusToggles') } };
}

// Rerolls every unheld die, then clears every hold and switches every bonus off again (owner,
// 01.11.2026): a hold and a switched-on bonus count for one throw. On the level's first reroll the banked
// cards come in, each in place of a die being rerolled, in board order, landing switched off (owner,
// 03.11.2026), as long as the board keeps MIN_DICE dice; those left over wait above the board.
export function reroll(state, rollDie) {
  if (state.phase !== 'playing') return reject('PHASE', 'The level is over');
  if (state.rerollsLeft <= 0) return reject('NO_REROLLS', 'No rerolls left');
  const targets = rerollTargets(state);
  if (targets.length === 0) return reject('NOTHING_TO_REROLL', 'Every die is held - release one to reroll');
  const cells = state.cells.slice();
  const faces = state.faces.slice();
  const bank = state.bank.map((b) => ({ ...b, off: true }));
  const placed = [];
  const rolled = targets.slice();
  if (!state.stats.rerollsUsed) {
    let spare = diceCells(state).length - MIN_DICE; // dice the kept cards may take
    bank.forEach((b, k) => {
      if (!waiting(b) || !rolled.length || spare <= 0) return;
      spare -= 1;
      const i = rolled.shift();
      cells[i] = { type: 'bonus', kind: b.kind, fromBank: k };
      faces[i] = null;
      b.placed = true;
      placed.push({ cell: i, from: k });
    });
  }
  for (const i of rolled) {
    const f = rollDie();
    if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error(`rollDie returned ${f}`);
    faces[i] = f;
  }
  const held = state.held.map(() => false);
  const off = cells.map((c, i) => (c.type === 'bonus' ? true : state.off[i]));
  return { ok: true, rolled, placed, state: { ...state, cells, faces, held, off, bank, rerollsLeft: state.rerollsLeft - 1, stats: bump(state, 'rerollsUsed') } };
}

// The best hand on the board with every bonus that is on, or null.
export function boardHand(state) {
  const dice = diceCells(state).map((i) => ({ cell: i, face: state.faces[i], held: state.held[i] }));
  const bonuses = onBonuses(state);
  return bestHand(dice, bonuses, handOptionsOf(state));
}

// The best hand among the held dice alone (with the bonuses that are on), or null: the UI sets a strong
// one on fire as soon as the player holds it (owner, 01.11.2026).
export function heldHand(state) {
  const dice = diceCells(state).filter((i) => state.held[i]).map((i) => ({ cell: i, face: state.faces[i], held: true }));
  const bonuses = onBonuses(state);
  return dice.length ? bestHand(dice, bonuses, handOptionsOf(state)) : null;
}

// The hand PLAY scores (owner, 02.11.2026): the best on the board, unless the player picks another by
// tapping its dice: when the held dice make a combination, the best of them plays.
export function currentHand(state) {
  return heldHand(state) || boardHand(state);
}

export function playHand(state, drawDie) {
  if (state.phase !== 'playing') return reject('PHASE', 'The level is over');
  if (state.handsLeft <= 0) return reject('COMPLETE', 'No hands left');
  const best = currentHand(state);
  if (!best) return reject('NO_HAND', 'No hand on the board - reroll');
  if (typeof drawDie !== 'function') throw new Error('playHand needs drawDie');
  const used = [...best.bonusCells, ...best.jokerCells];
  const hand = {
    index: state.hands.length,
    cells: best.cells,
    faces: best.faces,
    jokerCells: best.jokerCells,
    jokerFaces: best.jokerFaces,
    bonusCells: best.bonusCells,
    bonuses: used.map((i) => bonusKind(state, i)),
    category: best.category,
    label: best.label,
    points: best.points,
    formula: best.formula,
    multiplier: best.bonusMult,
    total: best.total,
    bonusAuto: false,
  };
  const burned = diceCells(state); // every die, held or not (owner, 03.11.2026)
  const score = state.score + hand.total;
  const handsLeft = state.handsLeft - 1;
  const faces = state.faces.slice();
  const held = state.held.map(() => false); // nothing stays held after a hand
  const cells = state.cells.slice();
  const off = state.off.slice();
  const bank = state.bank.map((b, k) => (used.includes(BANK + k) ? { ...b, off: false, used: true } : b)); // a played one is gone
  // a played card's cell takes the first banked card still waiting, else a new die (owner, 03.11.2026); before
  // the level's first reroll the banked cards are not in play yet
  const spent = used.filter((i) => i < BANK);
  const placed = [];
  const fresh = [];
  for (const i of spent) {
    const k = state.stats.rerollsUsed ? bank.findIndex(waiting) : -1;
    if (k >= 0) {
      bank[k] = { ...bank[k], placed: true };
      cells[i] = { type: 'bonus', kind: bank[k].kind, fromBank: k };
      off[i] = true;
      placed.push({ cell: i, from: k });
    } else {
      cells[i] = { type: 'die' };
      off[i] = false;
      fresh.push(i);
    }
  }
  const refilled = [...burned, ...fresh];
  for (const i of refilled) {
    const f = drawDie();
    if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error(`drawDie returned ${f}`);
    faces[i] = f;
  }
  const phase = score >= state.level.target ? 'won' : handsLeft > 0 ? 'playing' : 'lost';
  // a refund bonus in the hand gives rerolls back
  hand.refund = used.reduce((n, i) => n + (BONUS_KINDS[bonusKind(state, i)].refund || 0), 0);
  const rerollsLeft = state.rerollsLeft + hand.refund;
  return {
    ok: true,
    hand,
    burned,
    refilled,
    spent,
    placed,
    state: { ...state, cells, faces, held, off, bank, hands: [...state.hands, hand], score, handsLeft, rerollsLeft, phase },
  };
}

export function hintFor(state) {
  if (state.phase !== 'playing') return null;
  const best = boardHand(state); // the hint shows the best, whatever the player holds
  if (!best) return null;
  return { cells: best.cells, hand: best, useBonus: false, projected: state.score + best.total };
}

export function markHintUsed(state) {
  return { ...state, stats: bump(state, 'hintsUsed') };
}

// The bank after a won level: the banked bonuses still waiting, then the board's in board order (those that came
// from the bank among them), three at most.
export function carryOver(state) {
  const board = state.cells.filter((c) => c.type === 'bonus').map((c) => c.kind);
  return [...state.bank.filter(waiting).map((b) => b.kind), ...board].slice(0, BANK_SIZE);
}

export function snapshotGame(state) {
  return {
    level: state.level,
    config: state.config,
    attempt: state.attempt,
    cells: state.cells,
    faces: state.faces,
    held: state.held,
    off: state.off,
    bank: state.bank,
    rerollsLeft: state.rerollsLeft,
    handsLeft: state.handsLeft,
    hands: state.hands,
    score: state.score,
    phase: state.phase,
    stats: state.stats,
  };
}

export function restoreGame(snapshot) {
  const base = createAutoGame(snapshot.level, snapshot.config, snapshot.attempt);
  return {
    ...base,
    cells: snapshot.cells.map((c) => ({ ...c })),
    faces: snapshot.faces.slice(),
    held: snapshot.held.slice(),
    off: snapshot.off.slice(),
    bank: (snapshot.bank || base.bank).map((b) => ({ ...b })),
    rerollsLeft: snapshot.rerollsLeft,
    handsLeft: snapshot.handsLeft,
    hands: snapshot.hands.slice(),
    score: snapshot.score,
    phase: snapshot.phase,
    stats: { ...base.stats, ...snapshot.stats },
  };
}
