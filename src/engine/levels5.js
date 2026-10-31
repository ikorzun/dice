// Seeded level generation for the Poker 5 mode. Targets are absolute per tier; a candidate
// board is accepted when its best opening snake is below the "already won" line, so the
// hands and rerolls have to earn the target.

import { createRng } from './rng.js';
import { createPokerGame, bestSnake } from './poker.js';
import { clampTier } from './levels.js';

export const GENERATOR5_VERSION = 'poker5-gen-2';

// Calibrated with scripts/montecarlo5.mjs (see docs/DESIGN-POKER5.md).
export const TIERS5 = Object.freeze({
  1: Object.freeze({ target: 40, openingMax: 0.5 }),
  2: Object.freeze({ target: 55, openingMax: 0.5 }),
  3: Object.freeze({ target: 70, openingMax: 0.5 }),
  4: Object.freeze({ target: 85, openingMax: 0.5 }),
  5: Object.freeze({ target: 100, openingMax: 0.5 }),
});

export function rollFaces9(rng, bonusIndex = null) {
  const faces = new Array(9);
  for (let i = 0; i < 9; i++) faces[i] = i === bonusIndex ? null : rng.die();
  return faces;
}

export function generatePokerLevel({ runSeed, levelIndex, tier, config = {}, candidates = 32 }) {
  const t = clampTier(tier);
  const spec = TIERS5[t];
  const bonusIndex = config.bonusIndex === undefined ? 8 : config.bonusIndex;
  let fallback = null;
  for (let k = 0; k < candidates; k++) {
    const seed = `${runSeed}/P${levelIndex}/T${t}/c${k}`;
    const faces = rollFaces9(createRng(seed), bonusIndex);
    const level = {
      mode: 'poker5',
      seed,
      runSeed,
      levelIndex,
      tier: t,
      candidateIndex: k,
      faces,
      bonusIndex,
      target: spec.target,
      hands: config.hands,
      rerolls: config.rerolls,
      sealedMask: 0,
      generatorVersion: GENERATOR5_VERSION,
    };
    const probe = createPokerGame(level, config);
    const best = bestSnake(probe);
    level.openingBest = best.points;
    level.openingCategory = best.category;
    if (best.points <= spec.target * spec.openingMax) return level;
    if (!fallback || best.points < fallback.openingBest) fallback = level;
  }
  return { ...fallback, fallback: true };
}
