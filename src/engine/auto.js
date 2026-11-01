// Auto Hand mode (mode 3): nine cells of dice, bonus dice and blocks; positions do not matter.
// The game shows the best hand on the board (counting the bonuses the player switched on; every
// bonus starts off); the player holds dice, rerolls the rest (three rerolls per level, shared by
// the hands) or plays it.
// Playing burns the hand, every unheld die and the bonuses the hand used: burnt dice are
// replaced, a used bonus leaves a hole. Held dice outside the hand stay, still held.
// A level is always three hands. Pure state transitions, same action shape as poker.js.

import { bestHand, BONUS_KINDS } from './hands.js';

export const AUTO_DEFAULT_CONFIG = Object.freeze({
  hands: 3,          // hands per level, all of them are played
  rerolls: 3,        // shared rerolls per level
  handOptions: null, // bestHand options for balance experiments (stacking, table, straightMult); null = the rules
});

const reject = (code, message) => ({ ok: false, code, message });

// Face of the largest group (ties: the higher face), or null without dice.
function largestGroupFace(faces) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const f of faces) counts[f]++;
  let best = null;
  for (let f = 6; f >= 1; f--) if (counts[f] && (best === null || counts[f] > counts[best])) best = f;
  return best;
}
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
  return {
    mode: 'auto',
    level,
    config,
    attempt,
    cells,
    faces: level.faces.slice(),
    held: new Array(9).fill(false),
    off: cells.map((c) => c.type === 'bonus'), // bonuses start off; the player switches them on
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
  if (!Number.isInteger(i) || !isBonus(state, i)) return reject('NOT_BONUS', 'Tap a bonus die to switch it');
  const off = state.off.slice();
  off[i] = !off[i];
  return { ok: true, off: off[i], state: { ...state, off, stats: bump(state, 'bonusToggles') } };
}

// Rerolls every unheld die, then clears every hold and switches every bonus off again (owner,
// 01.11.2026): a hold and a switched-on bonus count for one throw.
export function reroll(state, rollDie) {
  if (state.phase !== 'playing') return reject('PHASE', 'The level is over');
  if (state.rerollsLeft <= 0) return reject('NO_REROLLS', 'No rerolls left');
  const targets = rerollTargets(state);
  if (targets.length === 0) return reject('NOTHING_TO_REROLL', 'Every die is held - release one to reroll');
  const faces = state.faces.slice();
  for (const i of targets) {
    const f = rollDie();
    if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error(`rollDie returned ${f}`);
    faces[i] = f;
  }
  const held = state.held.map(() => false);
  const off = state.cells.map((c, i) => (isBonus(state, i) ? true : state.off[i]));
  return { ok: true, rolled: targets, state: { ...state, faces, held, off, rerollsLeft: state.rerollsLeft - 1, stats: bump(state, 'rerollsUsed') } };
}

// The best hand on the board with every bonus that is on, or null.
export function currentHand(state) {
  const dice = diceCells(state).map((i) => ({ cell: i, face: state.faces[i], held: state.held[i] }));
  const bonuses = state.cells.map((c, i) => i).filter((i) => isBonus(state, i) && !state.off[i]).map((i) => ({ cell: i, kind: state.cells[i].kind }));
  return bestHand(dice, bonuses, state.config.handOptions ?? undefined);
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
    bonuses: used.map((i) => state.cells[i].kind),
    category: best.category,
    label: best.label,
    points: best.points,
    formula: best.formula,
    multiplier: best.bonusMult,
    total: best.total,
    bonusAuto: false,
  };
  const burned = diceCells(state).filter((i) => best.cells.includes(i) || !state.held[i]);
  const score = state.score + hand.total;
  const handsLeft = state.handsLeft - 1;
  // Help in trouble (adaptive levels set typicalHand): when the hands left need far more than a
  // typical hand each, each refilled die may copy the largest group of the held dice that stay.
  // Help comes only with what arrives, aims at what the player kept, and is never shown.
  const need = handsLeft > 0 && state.level.typicalHand ? (state.level.target - score) / handsLeft / state.level.typicalHand : 0;
  const help = need > 1.6 ? 2 : need > 1.25 ? 1 : 0;
  const favored = help ? largestGroupFace(diceCells(state).filter((i) => !burned.includes(i)).map((i) => state.faces[i])) : null;
  const faces = state.faces.slice();
  const held = state.held.slice();
  for (const i of burned) {
    const coin = favored ? drawDie() : 0; // a die as the coin: copy on 1 (help 1) or 1–2 (help 2)
    const f = drawDie();
    if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error(`drawDie returned ${f}`);
    faces[i] = favored && coin <= help ? favored : f;
    held[i] = false;
  }
  hand.help = favored ? help : 0;
  const cells = state.cells.slice();
  const off = state.off.slice();
  for (const i of used) {
    cells[i] = { type: 'hole' };
    off[i] = false;
  }
  const phase = handsLeft > 0 ? 'playing' : score >= state.level.target ? 'won' : 'lost';
  // a refund bonus in the hand gives rerolls back
  hand.refund = used.reduce((n, i) => n + (BONUS_KINDS[state.cells[i].kind].refund || 0), 0);
  const rerollsLeft = state.rerollsLeft + hand.refund;
  return {
    ok: true,
    hand,
    burned,
    refilled: burned,
    holes: used,
    state: { ...state, cells, faces, held, off, hands: [...state.hands, hand], score, handsLeft, rerollsLeft, phase },
  };
}

export function hintFor(state) {
  if (state.phase !== 'playing') return null;
  const best = currentHand(state);
  if (!best) return null;
  return { cells: best.cells, hand: best, useBonus: false, projected: state.score + best.total };
}

export function markHintUsed(state) {
  return { ...state, stats: bump(state, 'hintsUsed') };
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
    rerollsLeft: snapshot.rerollsLeft,
    handsLeft: snapshot.handsLeft,
    hands: snapshot.hands.slice(),
    score: snapshot.score,
    phase: snapshot.phase,
    stats: { ...base.stats, ...snapshot.stats },
  };
}
