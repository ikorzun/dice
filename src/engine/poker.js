// Poker 5 mode: nine dice on the 3x3 board, a hand is a snake of five dice scored as a
// five-die poker hand, banked dice are refilled, a level is a small budget of hands and
// rerolls against a target. The four dice left after a hand are the seed of the next one.
// Pure state transitions, same action shape as game.js so the UI can drive either mode.

import { buildGeometry, validatePath, cellsOf, orderedPathsOf, popcount } from './geometry.js';
import { scoreHand5, resolveTable5, DEFAULT_SCORE_TABLE5, CATEGORY5_LABELS } from './scoring5.js';

export const POKER_DEFAULT_CONFIG = Object.freeze({
  handSize: 5,
  hands: 3,              // hands (banks) per level
  rerolls: 3,            // shared rerolls per level
  maxHolds: null,        // null = unlimited holds
  scoreTable: DEFAULT_SCORE_TABLE5,
  smallStraight: true,   // four consecutive values count as a (small) straight
  bonusMultiplier: 2,    // one-use ×2 token
  autoBonusOnFinalHand: true,
  refill: true,          // banked cells receive fresh dice
  endOnTarget: false,    // true: the level ends as soon as the target is reached
  sealedPersist: false,  // sealed dice stay sealed after being banked and refilled
});

const reject = (code, message) => ({ ok: false, code, message });

export function createPokerGame(level, configOverrides = {}, attempt = 1) {
  const config = Object.freeze({ ...POKER_DEFAULT_CONFIG, ...configOverrides });
  const geometry = buildGeometry(null, config.handSize);
  if (!Array.isArray(level.faces) || level.faces.length !== 9) throw new Error('level.faces must have 9 entries');
  for (let i = 0; i < 9; i++) {
    const f = level.faces[i];
    if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error(`invalid face at ${i}`);
  }
  const sealedMask = level.sealedMask || 0;
  return {
    mode: 'poker5',
    config,
    level,
    geometry,
    faces: level.faces.slice(),
    held: new Array(9).fill(false),
    sealedMask,
    bankedMask: 0, // cells emptied by the last bank when refill is off
    rerollsLeft: level.rerolls ?? config.rerolls,
    handsLeft: level.hands ?? config.hands,
    bonus: { available: true, armed: false, usedOnHand: null, autoApplied: false },
    hands: [],
    score: 0,
    phase: 'playing',
    attempt,
    lastRefill: [],
    stats: { rerollsUsed: 0, holdToggles: 0, rejectedPaths: 0, hintsUsed: 0 },
  };
}

export const isSealed = (state, i) => ((state.sealedMask >> i) & 1) === 1;
export const isBanked = (state, i) => ((state.bankedMask >> i) & 1) === 1;
export const isOrdinary = () => true;
export const remainingMask = (state) => state.geometry.freeMask & ~state.bankedMask;
export const remainingCells = (state) => cellsOf(remainingMask(state));

export function heldCount(state) {
  let n = 0;
  for (let i = 0; i < 9; i++) if (state.held[i] && !isBanked(state, i)) n++;
  return n;
}

export function rerollTargets(state) {
  return state.geometry.free.filter((i) => !isBanked(state, i) && !state.held[i] && !isSealed(state, i));
}

const bump = (state, key) => ({ ...state.stats, [key]: state.stats[key] + 1 });

export function toggleHold(state, i) {
  if (state.phase !== 'playing') return reject('PHASE', 'The level is over');
  if (!Number.isInteger(i) || i < 0 || i >= 9) return reject('OUT_OF_RANGE', 'Cell is outside the board');
  if (isBanked(state, i)) return reject('BANKED', 'That cell is empty');
  if (isSealed(state, i)) return reject('SEALED', 'Sealed dice keep their value - no hold needed');
  const held = state.held.slice();
  if (!held[i] && state.config.maxHolds != null && heldCount(state) >= state.config.maxHolds) {
    return reject('HOLD_CAP', `Hold limit: ${state.config.maxHolds} dice per reroll`);
  }
  held[i] = !held[i];
  return { ok: true, held: held[i], state: { ...state, held, stats: bump(state, 'holdToggles') } };
}

export function canReroll(state) {
  return state.phase === 'playing' && state.rerollsLeft > 0 && rerollTargets(state).length > 0;
}

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
  return { ok: true, rolled: targets, state: { ...state, faces, rerollsLeft: state.rerollsLeft - 1, stats: bump(state, 'rerollsUsed') } };
}

export function toggleBonus(state) {
  if (state.phase !== 'playing') return reject('PHASE', 'The level is over');
  if (!state.bonus.available) return reject('BONUS_USED', 'The ×2 has already been used');
  const armed = !state.bonus.armed;
  return { ok: true, armed, state: { ...state, bonus: { ...state.bonus, armed } } };
}

export function evaluateHand5(faces, mask, config) {
  const cells = cellsOf(mask);
  const handFaces = cells.map((i) => faces[i]);
  const scored = scoreHand5(handFaces, config.scoreTable, { smallStraight: config.smallStraight });
  return { mask, cells, faces: handFaces, ...scored };
}

export function previewPath(state, path) {
  if (state.phase !== 'playing') return reject('PHASE', 'The level is over');
  if (state.handsLeft <= 0) return reject('COMPLETE', 'No hands left');
  const v = validatePath(path, state.geometry, state.bankedMask, { allowPartial: true });
  if (!v.ok) return v;
  if (!v.complete) return { ok: true, partial: true, count: path.length, mask: v.mask };
  const hand = evaluateHand5(state.faces, v.mask, state.config);
  const isFinalHand = state.handsLeft === 1;
  const autoBonus = isFinalHand && state.bonus.available && !state.bonus.armed && state.config.autoBonusOnFinalHand;
  const usesBonus = state.bonus.available && (state.bonus.armed || autoBonus);
  const multiplier = usesBonus ? state.config.bonusMultiplier : 1;
  return { ok: true, partial: false, mask: v.mask, hand, multiplier, total: hand.points * multiplier, usesBonus, autoBonus, safe: true, safetyCode: null, safetyMessage: null };
}

// drawDie supplies refill faces (seeded by the UI / simulation).
export function bankPath(state, path, drawDie) {
  const p = previewPath(state, path);
  const rejected = () => ({ ...state, stats: bump(state, 'rejectedPaths') });
  if (!p.ok) return { ...p, state: rejected() };
  if (p.partial) return { ...reject('LENGTH', `Trace ${state.geometry.handSize} dice (${p.count}/${state.geometry.handSize})`), state: rejected() };
  const hand = {
    index: state.hands.length,
    cells: path.slice(),
    mask: p.mask,
    faces: p.hand.faces,
    category: p.hand.category,
    label: p.hand.label,
    points: p.hand.points,
    multiplier: p.multiplier,
    total: p.total,
    bonusAuto: p.autoBonus,
  };
  const hands = [...state.hands, hand];
  const faces = state.faces.slice();
  const held = state.held.slice();
  let bankedMask = state.bankedMask;
  let sealedMask = state.sealedMask;
  const refilled = [];
  for (const i of hand.cells) {
    held[i] = false;
    if (state.config.refill) {
      if (typeof drawDie !== 'function') throw new Error('bankPath needs drawDie when refill is on');
      const f = drawDie();
      if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error(`drawDie returned ${f}`);
      faces[i] = f;
      refilled.push(i);
      if (!state.config.sealedPersist) sealedMask &= ~(1 << i);
    } else {
      bankedMask |= 1 << i;
    }
  }
  const bonus = p.usesBonus
    ? { available: false, armed: false, usedOnHand: hand.index, autoApplied: p.autoBonus }
    : { ...state.bonus, armed: false };
  const score = state.score + hand.total;
  const handsLeft = state.handsLeft - 1;
  let phase = 'playing';
  if (handsLeft === 0 || (state.config.endOnTarget && score >= state.level.target)) phase = score >= state.level.target ? 'won' : 'lost';
  if (phase === 'playing' && !state.config.refill && popcount(remainingMask({ ...state, bankedMask })) < state.geometry.handSize) {
    phase = score >= state.level.target ? 'won' : 'lost';
  }
  return { ok: true, hand, refilled, state: { ...state, hands, faces, held, bankedMask, sealedMask, bonus, score, handsLeft, phase, lastRefill: refilled } };
}

// Every eligible five-cell snake on the current board, best first.
export function rankSnakes(state) {
  const rows = [];
  for (const mask of state.geometry.eligibleMasks) {
    if (mask & state.bankedMask) continue;
    rows.push(evaluateHand5(state.faces, mask, state.config));
  }
  rows.sort((a, b) => b.points - a.points || a.mask - b.mask);
  return rows;
}

export function bestSnake(state) {
  const rows = rankSnakes(state);
  return rows.length ? rows[0] : null;
}

export function hintFor(state) {
  if (state.phase !== 'playing' || state.handsLeft <= 0) return null;
  const best = bestSnake(state);
  if (!best) return null;
  const mult = state.bonus.available ? state.config.bonusMultiplier : 1;
  return { cells: orderedPathsOf(best.cells)[0], hand: best, partition: null, useBonus: state.bonus.available && state.handsLeft === 1, projected: state.score + best.points * mult };
}

export function markHintUsed(state) {
  return { ...state, stats: bump(state, 'hintsUsed') };
}

export const safeFirstMasks = (state) => state.geometry.eligibleMasks.filter((m) => !(m & state.bankedMask));

export function snapshotGame(state) {
  return {
    mode: 'poker5',
    level: state.level,
    config: state.config,
    faces: state.faces,
    held: state.held,
    sealedMask: state.sealedMask,
    bankedMask: state.bankedMask,
    rerollsLeft: state.rerollsLeft,
    handsLeft: state.handsLeft,
    bonus: state.bonus,
    hands: state.hands,
    score: state.score,
    phase: state.phase,
    attempt: state.attempt,
    stats: state.stats,
  };
}

export function restoreGame(snapshot) {
  const base = createPokerGame(snapshot.level, snapshot.config, snapshot.attempt);
  return {
    ...base,
    faces: snapshot.faces.slice(),
    held: snapshot.held.slice(),
    sealedMask: snapshot.sealedMask || 0,
    bankedMask: snapshot.bankedMask || 0,
    rerollsLeft: snapshot.rerollsLeft,
    handsLeft: snapshot.handsLeft,
    bonus: { ...snapshot.bonus },
    hands: snapshot.hands.map((h) => ({ ...h })),
    score: snapshot.score,
    phase: snapshot.phase,
    stats: { ...base.stats, ...snapshot.stats },
  };
}

export { CATEGORY5_LABELS, resolveTable5 };
