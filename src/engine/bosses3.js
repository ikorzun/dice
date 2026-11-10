// The keepers of the run (portals spec, 10.11.2026): every fifth level is a keeper, one of the owner's portraits, with one
// rule. The rule is known before the level starts (the shop before it names it, digest rule 24) and never changes during
// it; the target stays on the ladder. Each rule is data the engine reads (auto.js handRules, toggleHold; run3.js hands
// and rerolls), never the keeper's name. Level 5 is always THE EATER; every later fifth level draws by the run seed among
// the keepers open at that depth, never one of the last two. Three golden keepers come from level 35 and pay 5 more bells.
// counters: the charms the shop before a keeper offers against him (until the pocket's things replace the charms).

import { createRng } from './rng.js';

export const BOSSES = Object.freeze({
  fatman: Object.freeze({ name: 'THE EATER', rule: 'EVERY HAND SUMS FIVE LESS', from: 5, until: 25, sumAdd: -5, counters: Object.freeze(['stone_ribbon', 'final_bow']) }),
  ghoul: Object.freeze({ name: 'RED EYE', rule: 'SIXES ADD ZERO', from: 10, sixes: 0, counters: Object.freeze(['crooked_pip']) }),
  prisoner: Object.freeze({ name: 'THE CONVICT', rule: 'START WITH TWO REROLLS', from: 10, rerolls: 2, counters: Object.freeze(['spare_knuckle', 'echo_thimble']) }),
  robot: Object.freeze({ name: 'IRON WARDEN', rule: 'START WITH TWO HANDS', from: 15, hands: 2, counters: Object.freeze(['final_bow', 'quick_pocket']) }),
  ghoul_old: Object.freeze({ name: 'OLD HORNS', rule: 'STRAIGHTS SCORE HALF', from: 20, half: Object.freeze(['straight', 'small_straight']), counters: Object.freeze(['velvet_grip']) }),
  zombie: Object.freeze({ name: 'LOOSE GRIP', rule: 'HOLD THREE DICE AT MOST', from: 30, holdCap: 3, counters: Object.freeze(['spare_knuckle']) }),
  knight_golden: Object.freeze({ name: 'THE GOLDEN KNIGHT', rule: 'FIRST HAND SCORES HALF', from: 35, golden: true, firstHalf: true, counters: Object.freeze(['final_bow', 'spare_knuckle']) }),
  robot_golden: Object.freeze({ name: 'THE GOLDEN MACHINE', rule: 'START WITH TWO HANDS AND TWO REROLLS', from: 45, golden: true, hands: 2, rerolls: 2, counters: Object.freeze(['spare_knuckle', 'final_bow']) }),
  skeleton_golden: Object.freeze({ name: 'THE GOLDEN BONES', rule: 'ONES AND SIXES ADD ZERO', from: 55, golden: true, ones: 0, sixes: 0, counters: Object.freeze(['velvet_grip', 'stone_ribbon']) }),
});

export const FIRST_KEEPER = 'fatman';
export const isBossLevel = (levelIndex) => levelIndex > 0 && levelIndex % 5 === 0;
const open = (id, levelIndex) => BOSSES[id].from <= levelIndex && levelIndex <= (BOSSES[id].until ?? Infinity);

// The keeper id of a level, or null: the run's keepers drawn in order from level 5, each from the seed and its level alone.
export function bossOf(runSeed, levelIndex) {
  if (!isBossLevel(levelIndex)) return null;
  const drawn = [FIRST_KEEPER];
  for (let level = 10; level <= levelIndex; level += 5) {
    const pool = Object.keys(BOSSES).filter((id) => open(id, level) && !drawn.slice(-2).includes(id));
    drawn.push(pool[createRng(`${runSeed}/keepers/${level}`).int(pool.length)]);
  }
  return drawn[drawn.length - 1];
}
