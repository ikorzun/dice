// The endless run of the Auto Hand mode (owner, 03.11.2026: «как в Балатро», a missed target ends the run, and
// levels never end). One curve serves everyone (questionnaire В1 A, 04.11.2026: no hidden adaptation). A level's
// target is a table by its number (portals spec, 10.11.2026: a typical player to about level 30, a strong one to
// about 60), and 3.8% a level past it. Its layout is drawn from the recipes whose pass chance for a typical player is
// near the level's aim. That player is modelled as the naive bot's score quantiles (recipes3.js) times the lift of a
// player who took an upgrade after every level before it (UP_LIFT). Both depend only on the run seed and the level
// number: never on how the player did or their upgrades. The bank decides one thing alone: while it holds a card, the
// level's card is a die (owner, 18.11.2026, MODE3-PLAN §64). The chance model only ranks the layouts; how far players
// get is measured by scripts/run3-sim.mjs.

import { createRng } from './rng.js';
import { BONUS_KINDS } from './hands.js';
import { RECIPES3, RECIPE_QUANTILES, RECIPES3_VERSION } from './recipes3.js';
import { unlockedKinds, newKind, firstLayout, shuffledCells, placeLayout } from './levels3.js';
import { createAutoGame, currentHand } from './auto.js';
import { UP_LIFT } from './uplift3.js';
import { bossOf, BOSSES } from './bosses3.js';
import { keeperHelp } from './things3.js';

export const RUN3_VERSION = `run-3/${RECIPES3_VERSION}`;
export const RUN3 = Object.freeze({
  // levels 1–60: the spec's anchors (1: 240, 5: 350, 10: 560 … 30: 2050, 40: 3400, 50: 5200, 60: 7600), filled at an even
  // ratio; no step up on the fifth levels, the keeper is the step. × 0.85 since one card lies on the board for a hand
  // (17.11.2026, MODE3-PLAN §60): that brings the bots' curve back to where it was with two (run3-sim, run-1 and run-2)
  targets: Object.freeze([200, 220, 250, 270, 300, 320, 360, 390, 430, 480, 510, 550, 600, 650, 700, 750, 800, 850, 910, 980,
    1040, 1110, 1170, 1240, 1320, 1390, 1470, 1560, 1650, 1740, 1840, 1930, 2030, 2130, 2240, 2360, 2480, 2610, 2750, 2890,
    3020, 3150, 3280, 3430, 3570, 3730, 3890, 4060, 4230, 4420, 4590, 4770, 4960, 5140, 5350, 5550, 5760, 5980, 6220, 6460]),
  past: 1.038,    // each level past the table, rounded to 10
  aimFirst: 0.99, // a typical player's pass chance the layout aims at on levels 1–2 (the tutorial runs on level 1)
  aimStart: 0.99, // on level 3, then falling towards aimFloor, by e every aimFade levels
  aimFade: 60,    // the spec's first values: boards a typical player passes at 97–99% for twenty-five levels, about 95% at 60
  aimFloor: 0.93,
  near: 1,        // layouts whose modelled failure is within e^near of the best fit's are drawn at random, for variety (0.25
                  // with two cards; with one, 0.25 dealt the Witch's TRIPS on 4 levels in 10 up to level 20, 1 on 1 in 4)
  maxBonuses: 1,  // one card on the board for a hand (owner, 17.11.2026: «На поле одна»); the bank's play when it holds none
  firstRecipe: '8d0x:x2_any',
});

// The lift of the upgrades a sensible player holds on `levelIndex`, going on past the table at its last step.
export function runLift(levelIndex) {
  const last = UP_LIFT.length - 1;
  const n = Math.max(1, levelIndex);
  return n <= last ? UP_LIFT[n] : UP_LIFT[last] + (n - last) * (UP_LIFT[last] - UP_LIFT[last - 1]);
}

export function runTarget(levelIndex, curve = RUN3) {
  const n = Math.max(1, levelIndex);
  const t = curve.targets;
  return n <= t.length ? t[n - 1] : Math.round((t[t.length - 1] * curve.past ** (n - t.length)) / 10) * 10;
}

export function runAim(levelIndex, curve = RUN3) {
  if (levelIndex <= 2) return curve.aimFirst;
  return curve.aimFloor + (curve.aimStart - curve.aimFloor) * Math.exp(-(levelIndex - 3) / curve.aimFade);
}

export const recipeById = (id) => RECIPES3.find((r) => r.id === id) || null;

// Percentile (0..1) of `score` among quantiles `q` (at RECIPE_QUANTILES), linear between them and towards 0 below.
export function percentileOf(q, score) {
  const p = RECIPE_QUANTILES;
  const last = q.length - 1;
  if (score <= q[0]) return Math.max(0.001, (p[0] * Math.max(0, score)) / Math.max(1, q[0]));
  if (score >= q[last]) return Math.min(0.999, p[last] + ((1 - p[last]) * (score - q[last])) / Math.max(1, q[last] - q[last - 1]));
  let k = 0;
  while (q[k + 1] <= score) k++; // stops below `last`: score < q[last] here, so q[k] <= score < q[k + 1]
  return p[k] + ((p[k + 1] - p[k]) * (score - q[k])) / (q[k + 1] - q[k]);
}

// The modelled pass chance of a typical player on the recipe at that level.
export const typicalChance = (recipe, levelIndex, curve = RUN3) => 1 - percentileOf(recipe.naive, runTarget(levelIndex, curve) / runLift(levelIndex));

// Recipes a level may use: at most one card on the board (owner, 17.11.2026: «На поле одна»), of a hero already opened. A
// level that opens a hero deals it alone (it came beside the Knight's ×2 ANY HAND until then, since a conditional hero
// dealt alone leaked runs on the first levels: the targets of those levels answer for it now). Every recipe is nine cells
// of dice and cards (no locks since 09.11.2026).
export function candidates(levelIndex) {
  const fresh = newKind(levelIndex);
  if (fresh) return [recipeById(`8d0x:${fresh}`)];
  const open = unlockedKinds(levelIndex);
  return RECIPES3.filter((r) => r.kinds.length <= RUN3.maxBonuses && new Set(r.kinds).size === r.kinds.length && r.kinds.every((k) => open.includes(k)));
}

// Level 1 is the first board; later levels draw among the recipes that fit the level's aim best.
export function chooseRecipe(levelIndex, rng, curve = RUN3) {
  if (levelIndex <= 1) return recipeById(curve.firstRecipe);
  const aim = runAim(levelIndex, curve);
  // fit by the ratio of the failure chances: near the top of the curve a few points of chance halve the losses
  const all = candidates(levelIndex);
  // deep in a run (strong players, level 18 on) no board lets a typical player reach the aim and every chance sits on the
  // model's floor: the boards would be drawn at random, rich and poor alike. There the richest boards are drawn instead.
  if (all.every((r) => typicalChance(r, levelIndex, curve) <= 0.0011)) {
    const rich = [...all].sort((a, b) => b.naive[5] - a.naive[5]).slice(0, 3);
    return rich[rng.int(rich.length)];
  }
  const scored = all.map((recipe) => ({ recipe, gap: Math.abs(Math.log((1 - typicalChance(recipe, levelIndex, curve)) / (1 - aim))) }));
  const best = Math.min(...scored.map((s) => s.gap));
  const near = scored.filter((s) => s.gap <= best + curve.near);
  return near[rng.int(near.length)].recipe;
}

// `bank`, `ups` and `things` (the pocket, [{ id, stars }]) travel with the level into the game: the table's target never
// looks at them, and the layout looks at the bank alone, for its card (below). On a keeper's level the things that answer
// him work before it starts, in plain sight: CALM START's points scored, DISTRACTION's cut of the threshold (`help` names
// them for the screen).
// A level deals its card only while the bank holds none (owner, 18.11.2026: «Давай давать карту на поле только если у
// игрока нет карт в банке и всего 1 раз за уровень. Иначе сложность с картами падает»). A kept POWER PAINT does not
// count: it joins no hand while a hand holds one card (MODE3-PLAN §60). Still once a level, at its start: a reroll or a
// played card never brings one.
export const bankHoldsCard = (bank) => bank.some((kind) => BONUS_KINDS[kind] && !BONUS_KINDS[kind].paint);

export function generateRunLevel({ runSeed, levelIndex, config = {}, bank = [], ups = {}, things = [], curve = RUN3 }) {
  const seed = `${runSeed}/A${levelIndex}/run`;
  const rng = createRng(seed);
  const boss = bossOf(runSeed, levelIndex);
  const rule = boss ? BOSSES[boss] : {};
  const recipe = chooseRecipe(levelIndex, rng, curve);
  const dealt = levelIndex <= 1 ? firstLayout() : placeLayout(shuffledCells(rng), recipe.kinds, recipe.blocks);
  const drawn = dealt.map((c) => (c.type === 'die' ? rng.die() : null));
  // while the bank holds a card, the card's cell is a die, thrown from its own draw so the other dice stay as dealt
  const withheld = bankHoldsCard(bank) ? dealt.filter((c) => c.type === 'bonus').map((c) => c.kind) : [];
  const spare = createRng(`${seed}/held`);
  const layout = withheld.length ? dealt.map((c) => (c.type === 'bonus' ? { type: 'die' } : c)) : dealt;
  const faces = withheld.length ? drawn.map((f, i) => (dealt[i].type === 'bonus' ? spare.die() : f)) : drawn;
  const help = boss ? keeperHelp(things) : { points: 0, cut: 0, by: [] };
  const target = runTarget(levelIndex, curve);
  const level = {
    mode: 'auto',
    seed,
    runSeed,
    levelIndex,
    tier: 1,
    layout,
    faces,
    target: help.cut ? Math.round((target * (100 - help.cut)) / 100) : target,
    tableTarget: target, // the table's, before a thing's cut
    startScore: help.points,
    help: help.by, // the things that worked before the level, pulsed as it opens
    hands: rule.hands ?? config.hands,
    rerolls: rule.rerolls ?? config.rerolls,
    boss,
    recipe: recipe.id,
    withheld, // the card the layout dealt and the bank held back (kinds), for the log
    chance: typicalChance(recipe, levelIndex, curve), // the model's, for the log; never shown
    bank: bank.slice(), // the bonuses carried over, kinds
    ups: { ...ups }, // the run's upgrades of the combinations
    things: things.map((t) => ({ ...t })), // the pocket as the level starts
    generatorVersion: RUN3_VERSION,
  };
  const opening = currentHand(createAutoGame(level, config));
  level.openingBest = opening ? opening.total : 0;
  level.openingCategory = opening ? opening.category : null;
  return level;
}
