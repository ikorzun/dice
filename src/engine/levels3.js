// Seeded level generation for the Auto Hand mode. A level is a layout of nine cells (dice,
// bonus dice, blocks), the dice faces and a target for three hands. Every layout keeps at
// least six dice, so the board always holds a hand: six distinct faces contain a straight,
// otherwise two of them pair up. Bonus kinds unlock one per level; a level that unlocks a
// kind puts it on the board.

import { createRng } from './rng.js';
import { clampTier } from './levels.js';
import { createAutoGame, currentHand } from './auto.js';

export const GENERATOR3_VERSION = 'auto-gen-1';
export const BONUS_UNLOCKS = Object.freeze(['x2_any', 'x3_straight', 'x3_pairs', 'x3_trips', 'joker']);
export const MIN_DICE3 = 6;

// Tier levels are the balance reference of the bots and scripts/montecarlo3.mjs; the game itself
// plays adaptive levels (adapt3.js). Targets: the greedy bot of bot3.js wins ~75% at tier 1
// stepping down evenly to ~40% at tier 5 (owner, 31.10.2026: the naive-bot criterion felt too
// easy), recalibrated 01.11.2026 for bonuses that add up and the straight ×8. Taken from the
// greedy score distributions of scripts/montecarlo3.mjs (--tierLevels=1000 --seed=check1000; the
// default 300-level report is docs/simulation3-latest.md). Not monotone: tier 2 (a block) scores
// lower than tier 1, tier 3 (two bonus dice) higher than the tiers around it.
export const TIERS3 = Object.freeze({
  1: Object.freeze({ dice: 8, bonuses: 1, blocks: 0, target: 490 }),
  2: Object.freeze({ dice: 7, bonuses: 1, blocks: 1, target: 440 }),
  3: Object.freeze({ dice: 6, bonuses: 2, blocks: 1, target: 500 }),
  4: Object.freeze({ dice: 6, bonuses: 1, blocks: 2, target: 420 }),
  5: Object.freeze({ dice: 6, bonuses: 1, blocks: 2, target: 430 }),
});

export const unlockedKinds = (levelIndex) => BONUS_UNLOCKS.slice(0, Math.min(Math.max(1, levelIndex), BONUS_UNLOCKS.length));

// First board of every run: eight dice and the ×2 in the bottom-right corner, like the gold cell of Poker 5.
export const firstLayout = () => [...Array.from({ length: 8 }, () => ({ type: 'die' })), { type: 'bonus', kind: 'x2_any' }];

export function shuffledCells(rng) {
  const order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let k = 8; k > 0; k--) {
    const j = rng.int(k + 1);
    [order[k], order[j]] = [order[j], order[k]];
  }
  return order;
}

// Bonus dice on the first cells of `order`, then the blocks; dice everywhere else.
export function placeLayout(order, kinds, blocks) {
  const layout = Array.from({ length: 9 }, () => ({ type: 'die' }));
  kinds.forEach((kind, b) => { layout[order[b]] = { type: 'bonus', kind }; });
  for (let b = 0; b < blocks; b++) layout[order[kinds.length + b]] = { type: 'block' };
  return layout;
}

export function generateAutoLevel({ runSeed, levelIndex, tier, config = {} }) {
  const t = clampTier(tier);
  const spec = TIERS3[t];
  const seed = `${runSeed}/A${levelIndex}/T${t}`;
  const rng = createRng(seed);
  let layout = firstLayout();
  const kinds = unlockedKinds(levelIndex);
  if (levelIndex !== 1) {
    const order = shuffledCells(rng);
    const newest = levelIndex <= BONUS_UNLOCKS.length ? kinds[kinds.length - 1] : null;
    const placed = [];
    for (let b = 0; b < spec.bonuses; b++) placed.push(b === 0 && newest ? newest : kinds[rng.int(kinds.length)]);
    layout = placeLayout(order, placed, spec.blocks);
  }
  const faces = layout.map((c) => (c.type === 'die' ? rng.die() : null));
  const level = {
    mode: 'auto',
    seed,
    runSeed,
    levelIndex,
    tier: t,
    layout,
    faces,
    target: spec.target,
    hands: config.hands,
    rerolls: config.rerolls,
    generatorVersion: GENERATOR3_VERSION,
  };
  const opening = currentHand(createAutoGame(level, config));
  level.openingBest = opening ? opening.total : 0;
  level.openingCategory = opening ? opening.category : null;
  return level;
}
