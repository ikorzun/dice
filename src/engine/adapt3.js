// Adaptive levels for the Auto Hand mode (owner, 01.11.2026: adapt between levels, the layout is
// the only lever, hidden from the player, aim at a 70–75% win rate). The target follows a fixed
// ladder by level index. The player's skill is how their scores compare with the greedy bot's
// median on the layouts they played (score ÷ median, an exponential average over the run): a
// player of skill k is modelled as the greedy bot's score distribution scaled by k, so the win
// chance on a layout is 1 − F(target ÷ k). The next level gets the layout recipe whose predicted
// win chance is closest to the aim. Help in trouble lives in auto.js (playHand) and reads
// level.typicalHand set here.

import { createRng } from './rng.js';
import { RECIPES3, RECIPE_QUANTILES, RECIPES3_VERSION } from './recipes3.js';
import { BONUS_UNLOCKS, unlockedKinds, firstLayout, shuffledCells, placeLayout } from './levels3.js';
import { createAutoGame, currentHand } from './auto.js';

export const ADAPT3_VERSION = `adapt-1/${RECIPES3_VERSION}`;
export const ADAPT3 = Object.freeze({
  aim: 0.75,        // predicted win chance the next layout aims at
  startSkill: 0.85, // a new player: a little above the naive bot (its scores ≈ 0.79 of the greedy median)
  alpha: 0.4,       // weight of the latest level in the skill average
  form: Object.freeze([0.9, 1, 1.1]), // skill multipliers the win chance is averaged over
  nudge: 0.12,      // skill offset per win above (or loss below) the predicted chance
  fade: 0.9,        // how much of the offset carries to the next level
  maxBonuses: 2,    // three bonus dice on one hand reach ×7 and swamp the layout table
  firstRecipe: '8d0x:x2_any',
});

// Assumption (owner chose layout as the only lever): an easy first level (the naive bot wins
// ~89% at 340); levels 2–5 must place the kind they unlock, which leaves few layouts to choose
// from, so their targets stay low; then a gentle ramp the layout table covers for weak and
// strong players alike (checked by scripts/adapt3-sim.mjs).
const EARLY_TARGETS = [340, 360, 360, 370, 380];
export function targetFor(levelIndex) {
  if (levelIndex <= EARLY_TARGETS.length) return EARLY_TARGETS[Math.max(1, levelIndex) - 1];
  return Math.min(460, 390 + 10 * (levelIndex - 6));
}

export const recipeById = (id) => RECIPES3.find((r) => r.id === id) || null;

// Percentile (0..1) of `score` in the recipe's greedy score distribution, linear between quantiles.
export function percentileOf(recipe, score) {
  const q = recipe.greedy;
  const p = RECIPE_QUANTILES;
  const last = q.length - 1;
  if (score <= q[0]) return Math.max(0.01, (p[0] * Math.max(0, score)) / Math.max(1, q[0]));
  if (score >= q[last]) return Math.min(0.99, p[last] + ((1 - p[last]) * (score - q[last])) / Math.max(1, q[last] - q[last - 1]));
  let k = 0;
  while (q[k + 1] <= score) k++; // stops below `last`: score < q[last] here, so q[k] <= score < q[k + 1]
  return p[k] + ((p[k + 1] - p[k]) * (score - q[k])) / (q[k + 1] - q[k]);
}

// A finished level's skill sample: the score over the greedy median of its recipe.
export const skillSample = (recipe, score) => score / recipe.greedy[RECIPE_QUANTILES.indexOf(0.5)];

// Skill after the finished auto levels of the run, oldest first. Entries carry `ratio` (the score
// sample) and, once adaptive, `won` and `predictedWin`: wins above or below the prediction nudge
// the skill (a fading log offset), so the realised win rate follows the aim even where a player's
// scores are not shaped like the bot's.
export function skillFrom(history = []) {
  let skill = ADAPT3.startSkill;
  let offset = 0;
  for (const h of history) {
    if (h.mode !== 'auto' || !Number.isFinite(h.ratio)) continue;
    skill += ADAPT3.alpha * (h.ratio - skill);
    offset *= ADAPT3.fade;
    if (Number.isFinite(h.predictedWin)) offset += ADAPT3.nudge * ((h.won ? 1 : 0) - h.predictedWin);
  }
  return skill * Math.exp(offset);
}

// Averaged over a spread of the skill: a person's form varies from level to level more than the
// bot's does, and a point estimate would over-promise near the top of the curve.
export function winChance(recipe, target, skill) {
  const k = Math.max(0.05, skill);
  return ADAPT3.form.reduce((s, m) => s + 1 - percentileOf(recipe, target / (k * m)), 0) / ADAPT3.form.length;
}

// Recipes a level may use: at most two bonus dice of different kinds, all unlocked; a level that
// unlocks a kind (2–5) must place it.
export function candidates(levelIndex) {
  const open = unlockedKinds(levelIndex);
  const newest = levelIndex > 1 && levelIndex <= BONUS_UNLOCKS.length ? open[open.length - 1] : null;
  return RECIPES3.filter((r) => r.kinds.length <= ADAPT3.maxBonuses && new Set(r.kinds).size === r.kinds.length
    && r.kinds.every((k) => open.includes(k)) && (!newest || r.kinds.includes(newest)));
}

// The recipe closest to the aim; near-ties (within 0.04) are drawn by `rng` for variety, and the
// previous level's recipe is avoided when another one is as close.
export function chooseRecipe({ levelIndex, skill, previousId = null, rng }) {
  if (levelIndex <= 1) return { recipe: recipeById(ADAPT3.firstRecipe), chance: winChance(recipeById(ADAPT3.firstRecipe), targetFor(1), skill) };
  const target = targetFor(levelIndex);
  const scored = candidates(levelIndex).map((recipe) => ({ recipe, chance: winChance(recipe, target, skill) }));
  const gap = (s) => Math.abs(s.chance - ADAPT3.aim);
  const best = Math.min(...scored.map(gap));
  let near = scored.filter((s) => gap(s) <= best + 0.04);
  if (near.length > 1) near = near.filter((s) => s.recipe.id !== previousId);
  return near[rng.int(near.length)];
}

export function generateAdaptiveLevel({ runSeed, levelIndex, tier = 1, history = [], config = {} }) {
  const seed = `${runSeed}/A${levelIndex}/adaptive`;
  const rng = createRng(seed);
  const skill = skillFrom(history);
  const previous = [...history].reverse().find((h) => h.mode === 'auto' && h.recipe);
  const { recipe, chance } = chooseRecipe({ levelIndex, skill, previousId: previous ? previous.recipe : null, rng });
  const layout = levelIndex <= 1 ? firstLayout() : placeLayout(shuffledCells(rng), recipe.kinds, recipe.blocks);
  const faces = layout.map((c) => (c.type === 'die' ? rng.die() : null));
  const level = {
    mode: 'auto',
    seed,
    runSeed,
    levelIndex,
    tier,
    layout,
    faces,
    target: targetFor(levelIndex),
    hands: config.hands,
    rerolls: config.rerolls,
    recipe: recipe.id,
    skill,
    predictedWin: chance,
    typicalHand: Math.round(recipe.greedy[RECIPE_QUANTILES.indexOf(0.5)] / 3), // help in trouble compares the need per hand with this
    generatorVersion: ADAPT3_VERSION,
  };
  const opening = currentHand(createAutoGame(level, config));
  level.openingBest = opening ? opening.total : 0;
  level.openingCategory = opening ? opening.category : null;
  return level;
}
