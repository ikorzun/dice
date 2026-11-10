// The endless run of the Auto Hand mode (owner, 03.11.2026: «как в Балатро», a missed target ends the run, and
// levels never end). One curve serves everyone (questionnaire В1 A, 04.11.2026: no hidden adaptation). A level's
// target follows a fixed ladder by its number, grown with the lift of a player who took an upgrade after every
// level before it (UP_LIFT). Its layout is drawn from the recipes whose pass chance for a typical player is near
// the level's aim. That player is modelled as the naive bot's score quantiles (recipes3.js) times that lift.
// Both depend only on the run seed and the level number: never on how the player did, their bank or their
// upgrades. The chance model only ranks the layouts; how far players get is measured by scripts/run3-sim.mjs.

import { createRng } from './rng.js';
import { RECIPES3, RECIPE_QUANTILES, RECIPES3_VERSION } from './recipes3.js';
import { BONUS_UNLOCKS, unlockedKinds, firstLayout, shuffledCells, placeLayout } from './levels3.js';
import { createAutoGame, currentHand } from './auto.js';
import { UP_LIFT } from './uplift3.js';
import { bossOf, BOSSES } from './bosses3.js';

export const RUN3_VERSION = `run-2/${RECIPES3_VERSION}`;
export const RUN3 = Object.freeze({
  base: 240,      // level 1's target before upgrades
  growth: 0.03,   // the ladder over the upgrades' lift: ×e^(growth·k + bend·k²) at level k + 1
  bend: 0.0024,   // steeper since the shop (06.11.2026): its goods lift scores; the first levels keep their targets
  aimFirst: 0.99, // a typical player's pass chance the layout aims at on levels 1–2 (the tutorial runs on level 1)
  aimStart: 0.985, // on level 3, then falling towards aimFloor, by e every aimFade levels
  aimFade: 20,    // slower since the boards lost their locks (09.11.2026): every board is nine dice and cards, so the model's chances moved; a typical player reaches level 10 in two runs of three again (В10)
  aimFloor: 0.5,  // with this curve half the typical players reach level 10–11, half the strong ones 20 (questionnaire В10; run3-sim)
  near: 0.25,     // layouts whose modelled failure is within e^near of the best fit's are drawn at random, for variety
  maxBonuses: 2,  // three bonus cards on one hand reach ×7 and swamp the layout table
  firstRecipe: '8d0x:x2_any',
});

// The lift of the upgrades a sensible player holds on `levelIndex`, going on past the table at its last step.
export function runLift(levelIndex) {
  const last = UP_LIFT.length - 1;
  const n = Math.max(1, levelIndex);
  return n <= last ? UP_LIFT[n] : UP_LIFT[last] + (n - last) * (UP_LIFT[last] - UP_LIFT[last - 1]);
}

export function runTarget(levelIndex, curve = RUN3) {
  const k = Math.max(1, levelIndex) - 1;
  return Math.round((curve.base * runLift(levelIndex) * Math.exp(curve.growth * k + curve.bend * k * k)) / 10) * 10;
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

// Recipes a level may use: at most two bonus cards of different kinds, all unlocked; a level that unlocks a
// kind (2–6) must place it. Every recipe is nine cells of dice and cards (no locks since 09.11.2026).
export function candidates(levelIndex) {
  const open = unlockedKinds(levelIndex);
  const newest = levelIndex > 1 && levelIndex <= BONUS_UNLOCKS.length ? open[open.length - 1] : null;
  return RECIPES3.filter((r) => r.kinds.length <= RUN3.maxBonuses && new Set(r.kinds).size === r.kinds.length
    && r.kinds.every((k) => open.includes(k)) && (!newest || r.kinds.includes(newest)));
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

// `bank`, `ups` and `charms` only travel with the level into the game: the level itself never looks at them.
export function generateRunLevel({ runSeed, levelIndex, config = {}, bank = [], ups = {}, charms = [], curve = RUN3 }) {
  const seed = `${runSeed}/A${levelIndex}/run`;
  const rng = createRng(seed);
  const boss = bossOf(runSeed, levelIndex);
  const rule = boss ? BOSSES[boss] : {};
  const recipe = chooseRecipe(levelIndex, rng, curve);
  const layout = levelIndex <= 1 ? firstLayout() : placeLayout(shuffledCells(rng), recipe.kinds, recipe.blocks);
  const faces = layout.map((c) => (c.type === 'die' ? rng.die() : null));
  const level = {
    mode: 'auto',
    seed,
    runSeed,
    levelIndex,
    tier: 1,
    layout,
    faces,
    target: runTarget(levelIndex, curve),
    hands: rule.hands ?? config.hands,
    rerolls: rule.rerolls ?? config.rerolls,
    boss,
    recipe: recipe.id,
    chance: typicalChance(recipe, levelIndex, curve), // the model's, for the log; never shown
    bank: bank.slice(), // the bonuses carried over, kinds
    ups: { ...ups }, // the run's upgrades of the combinations
    charms: charms.slice(), // the run's charms
    generatorVersion: RUN3_VERSION,
  };
  const opening = currentHand(createAutoGame(level, config));
  level.openingBest = opening ? opening.total : 0;
  level.openingCategory = opening ? opening.category : null;
  return level;
}
