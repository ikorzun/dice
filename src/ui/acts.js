// What comes next and what the run holds, in words. The owner, 06.11.2026, of the strip of nodes that stood by LEVEL:
// «для человека это нечитаемые ребус»; of the words that replaced it: «тоже перегружено... показывать только в те моменты,
// когда требует внимания». So none of this is on the board: a cleared level says what follows, How says the rest.
// Worked out from the level and the record alone, so a reload says the same.

import { doorAfter } from '../engine/shop3.js';
import { BOSSES, bossOf, isBossLevel } from '../engine/bosses3.js';

const until = (from, test) => { let n = 0; while (!test(from + n)) n += 1; return n; };
const ahead = (name, levels) => (levels <= 1 ? `${name} NEXT` : `${name} IN ${levels}`);

// For How. levels: how many more levels end before it comes. best: the record, until the run has passed it.
export function nextUp(level, best = null) {
  return {
    shop: ahead('SHOP', until(level, doorAfter) + 1),
    boss: ahead('KEEPER', until(level + 1, isBossLevel) + 1),
    best: best && best.level >= level ? `BEST ${best.level}` : '',
  };
}

// What the cleared level leads to, after the pick: only a shop has to be said (a keeper's rule stands above the pick).
export const afterClear = (level) => (doorAfter(level) ? 'NEXT: SHOP' : '');

// Before a keeper, his rule: it bears on the pick, so it is read above it (digest rule 24).
export const bossRule = (runSeed, level) => (isBossLevel(level + 1) ? `KEEPER RULE: ${BOSSES[bossOf(runSeed, level + 1)].rule}` : '');

// A level's pay (levelBells in shop3.js), each amount with what earned it: «HANDS LEFT +4» alone read as four hands.
const left = (n, name) => `${n} ${name}${n > 1 ? 'S' : ''} LEFT`;
export const bellsPaid = (paid) => [['CLEAR', paid.clear], [left(paid.hand / 2, 'HAND'), paid.hand], [left(paid.reroll, 'REROLL'), paid.reroll], ['KEEPER', paid.boss], ['LUCKY COIN', paid.charm]]
  .filter(([, n]) => n).map(([name, n]) => `${name} +${n}`);
export const BELLS_RULE = ['CLEAR +2', 'EACH HAND LEFT +2', 'EACH REROLL LEFT +1'];
