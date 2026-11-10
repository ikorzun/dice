// Seeded level generation for the Auto Hand mode. A level is a layout of nine cells (dice,
// bonus dice, blocks), the dice faces and a target for three hands. Every layout keeps at
// least six dice, so the board always holds a hand: six distinct faces contain a straight,
// otherwise two of them pair up. Bonus kinds unlock one per level; a level that unlocks a
// kind puts it on the board.

import { createRng } from './rng.js';
import { clampTier } from './levels.js';
import { createAutoGame, currentHand, MIN_DICE } from './auto.js';

export const GENERATOR3_VERSION = 'auto-gen-1';
export const BONUS_UNLOCKS = Object.freeze(['x2_any', 'x3_straight', 'x3_pairs', 'x3_trips', 'joker', 'refund']);
export const MIN_DICE3 = MIN_DICE;

// Tier levels are the balance reference of the bots, scripts/montecarlo3.mjs and scripts/upgrades3.mjs; the game
// itself plays the run's levels (run3.js). Until 09.11.2026 the targets followed the owner's criterion of 31.10.2026
// (the greedy bot of bot3.js wins ~75% at tier 1, stepping down evenly to ~40% at tier 5), last set 01.11.2026.
// Since no cell is ever locked or empty (owner, 09.11.2026) every tier is nine cells of dice and cards, in two
// layouts that keep one target each: 8 dice and a card 490 (tiers 1, 2, 4), 7 dice and two cards 560 (tiers 3, 5).
// The greedy bot wins 59–71% of them, so the steps are gone (docs/simulation3-latest.md, section C); recalibrating
// would move UP_SHARES (upgrades3.mjs plays these tiers) and so the run's curve.
export const TIERS3 = Object.freeze({
  1: Object.freeze({ dice: 8, bonuses: 1, blocks: 0, target: 490 }),
  2: Object.freeze({ dice: 8, bonuses: 1, blocks: 0, target: 490 }),
  3: Object.freeze({ dice: 7, bonuses: 2, blocks: 0, target: 560 }),
  4: Object.freeze({ dice: 8, bonuses: 1, blocks: 0, target: 490 }),
  5: Object.freeze({ dice: 7, bonuses: 2, blocks: 0, target: 560 }),
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
