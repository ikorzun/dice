// Pure state-transition engine for one level (handoff v0.3 §2). Every action returns
// { ok, state?, code?, message? } and never mutates its input, so the UI can animate
// freely without the risk of effects causing false game-state transitions.

import { buildGeometry, validatePath, cellsOf, orderedPathsOf, neighborsOf, HAND_SIZE } from './geometry.js';
import { DEFAULT_SCORE_TABLE } from './scoring.js';
import { solveBoard, evaluateHand } from './solver.js';

export const DEFAULT_CONFIG = Object.freeze({
  handSize: HAND_SIZE,
  rerolls: 2,
  // null = unlimited holds (v0.3 baseline). A number enables the "hold cap" experiment:
  // you cannot protect both future hands from a reroll at once.
  maxHolds: null,
  scoreTable: DEFAULT_SCORE_TABLE,
  bonusMultiplier: 2,
  // Deviation from v0.3 (documented): an unused ×2 is applied to the final hand
  // automatically. Not using it is never better for the player, so no decision is lost.
  autoBonusOnFinalHand: true,
});

const reject = (code, message) => ({ ok: false, code, message });

export function createGame(level, configOverrides = {}, attempt = 1) {
  const config = Object.freeze({ ...DEFAULT_CONFIG, ...configOverrides });
  const geometry = buildGeometry(level.bonusIndex, config.handSize);
  if (geometry.partitions.length === 0) {
    throw new Error(`bonus cell ${level.bonusIndex} leaves no complete partition`);
  }
  if (!Array.isArray(level.faces) || level.faces.length !== 9) throw new Error('level.faces must have 9 entries');
  for (let i = 0; i < 9; i++) {
    const f = level.faces[i];
    if (i === level.bonusIndex) {
      if (f !== null) throw new Error('bonus cell must have a null face');
    } else if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error(`invalid face at ${i}`);
  }
  return {
    config,
    level,
    geometry,
    faces: level.faces.slice(),
    held: new Array(9).fill(false),
    bankedMask: 0,
    rerollsLeft: level.rerolls ?? config.rerolls,
    bonus: { available: true, armed: false, usedOnHand: null, autoApplied: false },
    hands: [],
    score: 0,
    phase: 'playing',
    attempt,
    stats: { rerollsUsed: 0, holdToggles: 0, rejectedPaths: 0, hintsUsed: 0 },
  };
}

export const isOrdinary = (state, i) => i !== state.level.bonusIndex;
export const isBanked = (state, i) => ((state.bankedMask >> i) & 1) === 1;
export const remainingMask = (state) => state.geometry.freeMask & ~state.bankedMask;
export const remainingCells = (state) => cellsOf(remainingMask(state));

export function heldCount(state) {
  let n = 0;
  for (const i of state.geometry.free) if (state.held[i] && !isBanked(state, i)) n++;
  return n;
}

export function rerollTargets(state) {
  return state.geometry.free.filter((i) => !isBanked(state, i) && !state.held[i]);
}

function bumpStat(state, key) {
  return { ...state.stats, [key]: state.stats[key] + 1 };
}

export function toggleHold(state, i) {
  if (state.phase !== 'playing') return reject('PHASE', 'The level is over');
  if (!Number.isInteger(i) || i < 0 || i >= 9) return reject('OUT_OF_RANGE', 'Cell is outside the board');
  if (!isOrdinary(state, i)) return reject('BONUS_CELL', 'The ×2 cell has no face to hold');
  if (isBanked(state, i)) return reject('BANKED', 'That die is already banked');
  const held = state.held.slice();
  if (!held[i] && state.config.maxHolds != null && heldCount(state) >= state.config.maxHolds) {
    return reject('HOLD_CAP', `Hold limit: ${state.config.maxHolds} dice per reroll`);
  }
  held[i] = !held[i];
  return { ok: true, held: held[i], state: { ...state, held, stats: bumpStat(state, 'holdToggles') } };
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
  return {
    ok: true,
    rolled: targets,
    state: { ...state, faces, rerollsLeft: state.rerollsLeft - 1, stats: bumpStat(state, 'rerollsUsed') },
  };
}

export function toggleBonus(state) {
  if (state.phase !== 'playing') return reject('PHASE', 'The level is over');
  if (!state.bonus.available) return reject('BONUS_USED', 'The ×2 has already been used');
  const armed = !state.bonus.armed;
  return { ok: true, armed, state: { ...state, bonus: { ...state.bonus, armed } } };
}

function components(cells) {
  const set = new Set(cells);
  const seen = new Set();
  const out = [];
  for (const c of cells) {
    if (seen.has(c)) continue;
    const comp = [];
    const stack = [c];
    seen.add(c);
    while (stack.length) {
      const x = stack.pop();
      comp.push(x);
      for (const nb of neighborsOf(x)) {
        if (set.has(nb) && !seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

// For a first hand that strands the board: the leftover dice that get cut off (every cell
// outside the largest connected leftover group, or all four when they connect but form no path).
export function strandedCells(state, mask) {
  const rest = cellsOf(remainingMask(state) & ~mask);
  const comps = components(rest).sort((a, b) => b.length - a.length);
  if (comps.length > 1 && comps[1].length === comps[0].length) return rest; // no dominant group: all are cut off
  if (comps.length > 1) return comps.slice(1).flat().sort((a, b) => a - b);
  return rest;
}

function handSafety(state, mask) {
  if (state.hands.length === 0) {
    if (!state.geometry.safeSet.has(mask)) return reject('STRANDS', 'This path leaves no valid second hand.');
    return { ok: true };
  }
  if (mask !== remainingMask(state)) return reject('NOT_REMAINING', 'The last hand must use all four remaining dice.');
  return { ok: true };
}

// Validates a (possibly partial) path and, when complete, previews category, points,
// multiplier and the safe-bank guard verdict without changing state.
export function previewPath(state, path) {
  if (state.phase !== 'playing') return reject('PHASE', 'The level is over');
  if (state.hands.length >= 2) return reject('COMPLETE', 'Both hands are banked');
  const v = validatePath(path, state.geometry, state.bankedMask, { allowPartial: true });
  if (!v.ok) return v;
  if (!v.complete) return { ok: true, partial: true, count: path.length, mask: v.mask };
  const hand = evaluateHand(state.faces, v.mask, state.config.scoreTable);
  const safety = handSafety(state, v.mask);
  const isFinalHand = state.hands.length === 1;
  const autoBonus = isFinalHand && state.bonus.available && !state.bonus.armed && state.config.autoBonusOnFinalHand;
  const usesBonus = state.bonus.available && (state.bonus.armed || autoBonus);
  const multiplier = usesBonus ? state.config.bonusMultiplier : 1;
  return {
    ok: true,
    partial: false,
    mask: v.mask,
    hand,
    multiplier,
    total: hand.points * multiplier,
    usesBonus,
    autoBonus,
    safe: safety.ok,
    safetyCode: safety.ok ? null : safety.code,
    safetyMessage: safety.ok ? null : safety.message,
    stranded: !safety.ok && safety.code === 'STRANDS' ? strandedCells(state, v.mask) : [],
  };
}

export function bankPath(state, path) {
  const p = previewPath(state, path);
  const rejected = () => ({ ...state, stats: bumpStat(state, 'rejectedPaths') });
  if (!p.ok) return { ...p, state: rejected() };
  if (p.partial) return { ...reject('LENGTH', `Trace ${state.geometry.handSize} dice (${p.count}/${state.geometry.handSize})`), state: rejected() };
  if (!p.safe) return { ...reject(p.safetyCode, p.safetyMessage), stranded: p.stranded, state: rejected() };

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
  const bankedMask = state.bankedMask | p.mask;
  const held = state.held.map((h, i) => (((bankedMask >> i) & 1) ? false : h));
  const bonus = p.usesBonus
    ? { available: false, armed: false, usedOnHand: hand.index, autoApplied: p.autoBonus }
    : { ...state.bonus, armed: false };
  const score = state.score + hand.total;
  let phase = 'playing';
  if (hands.length === 2) phase = score >= state.level.target ? 'won' : 'lost';
  return { ok: true, hand, state: { ...state, hands, bankedMask, held, bonus, score, phase } };
}

export function markHintUsed(state) {
  return { ...state, stats: bumpStat(state, 'hintsUsed') };
}

// Solver-backed hint: the best safe first hand (bonus-aware), or the forced final hand.
export function hintFor(state) {
  if (state.phase !== 'playing' || state.hands.length >= 2) return null;
  const table = state.config.scoreTable;
  const opts = { bonusMultiplier: state.config.bonusMultiplier };
  if (state.hands.length === 0) {
    const solved = solveBoard(state.faces, state.geometry, table, opts);
    const row = state.bonus.available ? solved.bestBonus : solved.bestPlain;
    const bonusHand = row.hands[row.bonusHand];
    const better = row.hands[0].points >= row.hands[1].points ? row.hands[0] : row.hands[1];
    const first = state.bonus.available ? bonusHand : better;
    return {
      cells: orderedPathsOf(first.cells)[0],
      hand: first,
      partition: row,
      useBonus: state.bonus.available && first === bonusHand,
      projected: state.bonus.available ? row.totalWithBonus : row.total,
    };
  }
  const mask = remainingMask(state);
  const hand = evaluateHand(state.faces, mask, table);
  return { cells: orderedPathsOf(hand.cells)[0], hand, partition: null, useBonus: state.bonus.available, projected: state.score + hand.points * (state.bonus.available ? state.config.bonusMultiplier : 1) };
}

export function safeFirstMasks(state) {
  return [...state.geometry.safeSet];
}

// Serialisable snapshot (geometry is rebuilt on restore).
export function snapshotGame(state) {
  return {
    level: state.level,
    config: state.config,
    faces: state.faces,
    held: state.held,
    bankedMask: state.bankedMask,
    rerollsLeft: state.rerollsLeft,
    bonus: state.bonus,
    hands: state.hands,
    score: state.score,
    phase: state.phase,
    attempt: state.attempt,
    stats: state.stats,
  };
}

export function restoreGame(snapshot) {
  const base = createGame(snapshot.level, snapshot.config, snapshot.attempt);
  return {
    ...base,
    faces: snapshot.faces.slice(),
    held: snapshot.held.slice(),
    bankedMask: snapshot.bankedMask,
    rerollsLeft: snapshot.rerollsLeft,
    bonus: { ...snapshot.bonus },
    hands: snapshot.hands.map((h) => ({ ...h })),
    score: snapshot.score,
    phase: snapshot.phase,
    stats: { ...base.stats, ...snapshot.stats },
  };
}
