// Seeded level generation and the transparent, rule-based difficulty policy (handoff §7).
// Targets are absolute points per tier; candidates are accepted only when the exact
// no-reroll optimum (with ×2) sits inside a band below the target, so the opening roll
// never wins by itself and the rerolls have to earn the gap.

import { createRng } from './rng.js';
import { buildGeometry } from './geometry.js';
import { solveBoard } from './solver.js';
import { DEFAULT_SCORE_TABLE } from './scoring.js';

export const GENERATOR_VERSION = '3x3-gen-1';
export const MIN_TIER = 1;
export const MAX_TIER = 5;

// Targets sit on natural score thresholds of the v0.3 table (e.g. 20 = three of a kind ×2,
// 25 = trips ×2 + two pairs, 30 = straight ×2, 35 = straight ×2 + two pairs) and were
// calibrated with scripts/montecarlo.mjs (see docs/ANALYSIS.md). lo/hi are fractions of the
// target that bound the exact no-reroll optimum (with ×2) of an accepted board.
const FLAT_TIERS = Object.freeze({
  1: Object.freeze({ target: 12, lo: 0.35, hi: 0.9 }),
  2: Object.freeze({ target: 20, lo: 0.35, hi: 0.9 }),
  3: Object.freeze({ target: 25, lo: 0.3, hi: 0.72 }),
  4: Object.freeze({ target: 30, lo: 0.3, hi: 0.72 }),
  5: Object.freeze({ target: 35, lo: 0.3, hi: 0.72 }),
});
// Pip-based scoring (sum of matching dice × count) scores roughly three times higher;
// calibrated separately with scripts/montecarlo.mjs --table=pips.
const PIPS_TIERS = Object.freeze({
  1: Object.freeze({ target: 60, lo: 0.35, hi: 0.9 }),
  2: Object.freeze({ target: 90, lo: 0.35, hi: 0.9 }),
  3: Object.freeze({ target: 120, lo: 0.3, hi: 0.72 }),
  4: Object.freeze({ target: 150, lo: 0.3, hi: 0.72 }),
  5: Object.freeze({ target: 180, lo: 0.3, hi: 0.72 }),
});
export const TIERS = FLAT_TIERS;
export const TIERS_BY_TABLE = Object.freeze({ spec_v03: FLAT_TIERS, rarity: FLAT_TIERS, pips: PIPS_TIERS });
export const tiersFor = (scoreTable) => TIERS_BY_TABLE[scoreTable] || FLAT_TIERS;

export const DIFFICULTY_RULE_TEXT = 'Rule-based demo: win a level → next tier +1, lose → tier −1 (tiers 1–5). No AI prediction, no mid-level manipulation.';

export function clampTier(tier) {
  return Math.min(MAX_TIER, Math.max(MIN_TIER, Math.round(tier)));
}

export function nextTier(tier, won) {
  return clampTier(tier + (won ? 1 : -1));
}

export function rollFaces(rng, bonusIndex) {
  const faces = new Array(9).fill(null);
  for (let i = 0; i < 9; i++) if (i !== bonusIndex) faces[i] = rng.die();
  return faces;
}

export function generateLevel({
  runSeed,
  levelIndex,
  tier,
  bonusIndex = 8,
  rerolls = 2,
  scoreTable = DEFAULT_SCORE_TABLE,
  bonusMultiplier = 2,
  candidates = 48,
}) {
  const t = clampTier(tier);
  const spec = tiersFor(scoreTable)[t];
  const geometry = buildGeometry(bonusIndex);
  const lo = spec.target * spec.lo;
  const hi = spec.target * spec.hi;
  let fallback = null;
  let firstInBand = null;
  for (let k = 0; k < candidates; k++) {
    const seed = `${runSeed}/L${levelIndex}/T${t}/c${k}`;
    const faces = rollFaces(createRng(seed), bonusIndex);
    const solved = solveBoard(faces, geometry, scoreTable, { bonusMultiplier });
    const level = {
      seed,
      runSeed,
      levelIndex,
      tier: t,
      candidateIndex: k,
      bonusIndex,
      faces,
      target: spec.target,
      rerolls,
      scoreTable,
      bonusMultiplier,
      generatorVersion: GENERATOR_VERSION,
      bestNoReroll: solved.maxNoBonus,
      bestNoRerollWithBonus: solved.maxWithBonus,
    };
    if (solved.maxWithBonus >= lo && solved.maxWithBonus <= hi) {
      // Prefer boards with a real choice: at least two partitions within 60% of the optimum.
      level.choice = solved.partitions.filter((p) => p.totalWithBonus >= 0.6 * solved.maxWithBonus).length;
      if (level.choice >= 2) return level;
      if (!firstInBand) firstInBand = level;
      continue;
    }
    const dist = solved.maxWithBonus < lo ? lo - solved.maxWithBonus : solved.maxWithBonus - hi;
    if (!fallback || dist < fallback.dist) fallback = { level, dist };
  }
  if (firstInBand) return firstInBand;
  return { ...fallback.level, fallback: true };
}
