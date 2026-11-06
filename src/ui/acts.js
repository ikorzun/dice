// What comes next, in words. The owner, 06.11.2026, of the strip of nodes, doors and a seal that stood here: «для человека
// это нечитаемые ребус». An icon nobody has learnt has to be decoded; a word is read (NN/g on icon usability, digest rule 1).
// Worked out from the level and the record alone, so a reload says the same.

import { doorAfter } from '../engine/shop3.js';
import { isBossLevel } from '../engine/bosses3.js';

const until = (from, test) => { let n = 0; while (!test(from + n)) n += 1; return n; };
const ahead = (name, levels) => (levels <= 1 ? `${name} NEXT` : `${name} IN ${levels}`);

// levels: how many more levels end before it comes. best: the record, shown until the run has passed it.
export function nextUp(level, best = null) {
  return {
    shop: ahead('SHOP', until(level, doorAfter) + 1),
    boss: ahead('BOSS', until(level + 1, isBossLevel) + 1),
    best: best && best.level >= level ? `BEST ${best.level}` : '',
  };
}

// What the cleared level leads to, after the pick.
export function afterClear(level) {
  const boss = isBossLevel(level + 1);
  if (doorAfter(level)) return boss ? 'NEXT: SHOP, THEN BOSS' : 'NEXT: SHOP';
  return boss ? 'NEXT: BOSS' : `NEXT: LEVEL ${level + 1}`;
}
