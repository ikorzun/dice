// The endless run of the Auto Hand mode (owner, 03.11.2026: «как в Балатро», a missed target ends the run, and
// levels never end). One curve serves everyone (questionnaire В1 A, 04.11.2026: no hidden adaptation). A level's
// target is a table by its number (portals spec, 10.11.2026: a typical player to about level 30, a strong one to
// about 60), and 3.8% a level past it. Its layout is drawn from the recipes whose pass chance for a typical player is
// near the level's aim. That player is modelled as the naive bot's score quantiles (recipes3.js) times the lift of a
// player who took an upgrade after every level before it (UP_LIFT). Both depend only on the run seed and the level
// number: never on how the player did, their bank or their upgrades. The chance model only ranks the layouts; how
// far players get is measured by scripts/run3-sim.mjs.

import { createRng } from './rng.js';
import { RECIPES3, RECIPE_QUANTILES, RECIPES3_VERSION } from './recipes3.js';
import { unlockedKinds, newKind, firstLayout, shuffledCells, placeLayout } from './levels3.js';
import { createAutoGame, currentHand } from './auto.js';
import { UP_LIFT } from './uplift3.js';
import { bossOf, BOSSES } from './bosses3.js';
import { keeperHelp } from './things3.js';

export const RUN3_VERSION = `run-3/${RECIPES3_VERSION}`;
export const RUN3 = Object.freeze({
  // levels 1–60: the spec's anchors (1: 240, 5: 350, 10: 560 … 30: 2050, 40: 3400, 50: 5200, 60: 7600), filled at an even
  // ratio; no step up on the fifth levels, the keeper is the step
  targets: Object.freeze([240, 260, 290, 320, 350, 380, 420, 460, 510, 560, 600, 650, 700, 760, 820, 880, 940, 1000, 1070, 1150,
    1220, 1300, 1380, 1460, 1550, 1640, 1730, 1830, 1940, 2050, 2160, 2270, 2390, 2510, 2640, 2780, 2920, 3070, 3230, 3400,
    3550, 3700, 3860, 4030, 4200, 4390, 4580, 4780, 4980, 5200, 5400, 5610, 5830, 6050, 6290, 6530, 6780, 7040, 7320, 7600]),
  past: 1.038,    // each level past the table, rounded to 10
  aimFirst: 0.99, // a typical player's pass chance the layout aims at on levels 1–2 (the tutorial runs on level 1)
  aimStart: 0.99, // on level 3, then falling towards aimFloor, by e every aimFade levels
  aimFade: 60,    // the spec's first values: boards a typical player passes at 97–99% for twenty-five levels, about 95% at 60
  aimFloor: 0.93,
  near: 0.25,     // layouts whose modelled failure is within e^near of the best fit's are drawn at random, for variety
  maxBonuses: 2,  // three hero cards on one hand reach ×7 and swamp the layout table; a third card comes from the bank
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

// Recipes a level may use: at most two hero cards of different kinds, all opened. A level that opens a hero deals it beside
// the Knight's ×2 ANY HAND (spec: a conditional hero dealt alone leaked runs on the first levels). Letting the aim pick the
// partner instead measured worse (run3-sim, 10.11.2026: the typical bot's median 20 against 23–24; the model ranks
// conditional pairs badly, trips beside SMALL passed 82% at level 16 against 89% for the Knight). Every recipe is nine
// cells of dice and cards (no locks since 09.11.2026).
export function candidates(levelIndex) {
  const fresh = newKind(levelIndex);
  if (fresh) return [recipeById(`7d0x:x2_any+${fresh}`)];
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

// `bank`, `ups` and `things` (the pocket, [{ id, stars }]) only travel with the level into the game: the layout and the
// table's target never look at them. On a keeper's level the things that answer him work before it starts, in plain
// sight: CALM START's points scored, DISTRACTION's cut of the threshold (`help` names them for the screen).
export function generateRunLevel({ runSeed, levelIndex, config = {}, bank = [], ups = {}, things = [], curve = RUN3 }) {
  const seed = `${runSeed}/A${levelIndex}/run`;
  const rng = createRng(seed);
  const boss = bossOf(runSeed, levelIndex);
  const rule = boss ? BOSSES[boss] : {};
  const recipe = chooseRecipe(levelIndex, rng, curve);
  const layout = levelIndex <= 1 ? firstLayout() : placeLayout(shuffledCells(rng), recipe.kinds, recipe.blocks);
  const faces = layout.map((c) => (c.type === 'die' ? rng.die() : null));
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
