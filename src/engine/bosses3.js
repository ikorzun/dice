// The bosses of the run (owner's order В2: shop first, then bosses; GPT's rules, art/ai/2026-11-06-shop-bosses): every
// fifth level, where the medal is, has one rule that changes one lever. The rule is known before the level starts (the
// shop before it names it, digest rule 24) and never changes during it. The boss comes from the run seed and the level
// alone, drawn from a shuffled bag so no boss repeats until all six have come; the target stays on the ladder.

import { createRng } from './rng.js';

const BAG = ['judge', 'lowbell', 'hush', 'shortwind', 'usher', 'mason'];
export const BOSSES = Object.freeze({
  judge: Object.freeze({ name: 'THE CROOKED JUDGE', rule: 'STRAIGHTS SCORE HALF', counters: Object.freeze(['velvet_grip']) }),
  lowbell: Object.freeze({ name: 'LADY LOWBELL', rule: 'SIXES ADD ZERO', counters: Object.freeze(['crooked_pip']) }),
  hush: Object.freeze({ name: 'BROTHER HUSH', rule: 'BANK CARDS DO NOT ENTER', counters: Object.freeze(['spare_knuckle', 'final_bow']) }),
  shortwind: Object.freeze({ name: 'SIR SHORTWIND', rule: 'START WITH TWO REROLLS', counters: Object.freeze(['spare_knuckle', 'echo_thimble']), rerolls: 2 }),
  usher: Object.freeze({ name: 'THE LAST USHER', rule: 'START WITH TWO HANDS', counters: Object.freeze(['final_bow', 'quick_pocket']), hands: 2 }),
  mason: Object.freeze({ name: 'MASON GRUDGE', rule: 'EVERY HAND SUMS FIVE LESS', counters: Object.freeze(['stone_ribbon', 'final_bow']) }),
});

export const isBossLevel = (levelIndex) => levelIndex > 0 && levelIndex % 5 === 0;

// The boss id of a level, or null.
export function bossOf(runSeed, levelIndex) {
  if (!isBossLevel(levelIndex)) return null;
  const n = levelIndex / 5 - 1;
  const rng = createRng(`${runSeed}/bosses/${Math.floor(n / BAG.length)}`);
  const bag = BAG.slice();
  for (let k = bag.length - 1; k > 0; k--) {
    const j = rng.int(k + 1);
    [bag[k], bag[j]] = [bag[j], bag[k]];
  }
  return bag[n % BAG.length];
}


