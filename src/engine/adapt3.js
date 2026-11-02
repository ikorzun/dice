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
import { UP_LIFT } from './uplift3.js';
import { upLift } from './upgrades3.js';

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

// The target a level asks for (owner, 02.11.2026: the targets grow with the upgrades): the ladder × the lift a
// sensible upgrader has by then (UP_LIFT), to the nearest 10.
export const expectedUpLift = (levelIndex) => UP_LIFT[Math.max(1, Math.min(levelIndex, UP_LIFT.length - 1))];
export const levelTarget = (levelIndex) => Math.round((targetFor(levelIndex) * expectedUpLift(levelIndex)) / 10) * 10;

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

// A finished level's skill sample: its score over the greedy median of its recipe (three hands). A level
// won early stops at the target: each hand it did not play counts as 0.75 of a typical one (a third of
// the median), so one lucky hand is not blown up and an early win is not cut short. Greedy win rate
// (docs/simulation3-adaptive.md, aim 75 %): score alone 85 %, the pace 64 %, a full typical hand 71 %,
// 0.75 of one 74 %.
export function skillSample(recipe, score, hands = 3, lift = 1) {
  const median = recipe.greedy[RECIPE_QUANTILES.indexOf(0.5)];
  return (score / lift + (0.75 * Math.max(0, 3 - hands) * median) / 3) / median; // the bank's part is not skill
}

// The bank's lift (owner, 02.11.2026: bonuses carried over): a banked bonus is a bonus that takes no cell,
// as if a block of a layout became it, so its lift is the greedy median of `<d>d<b-1>x:A+B` over `<d>d<b>x:A`,
// averaged over the recipes that have both. Banked bonuses add up like those on the board.
const BANK_LIFT = (() => {
  const median = (r) => r.greedy[RECIPE_QUANTILES.indexOf(0.5)];
  const sums = {};
  for (const r of RECIPES3) {
    if (r.blocks < 1 || r.kinds.length > 1) continue;
    for (const b of RECIPES3) {
      if (b.dice !== r.dice || b.blocks !== r.blocks - 1 || b.kinds.length !== r.kinds.length + 1) continue;
      const extra = [...b.kinds];
      for (const k of r.kinds) extra.splice(extra.indexOf(k), 1);
      if (extra.length !== 1 || r.kinds.some((k) => !b.kinds.includes(k))) continue;
      (sums[extra[0]] ||= []).push(median(b) / median(r));
    }
  }
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v.reduce((s, x) => s + x, 0) / v.length]));
})();
export const bankLift = (kinds = []) => 1 + kinds.reduce((s, k) => s + Math.max(0, (BANK_LIFT[k] ?? 1) - 1), 0);

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
export function winChance(recipe, target, skill, lift = 1) {
  const k = Math.max(0.05, skill) * lift;
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
export function chooseRecipe({ levelIndex, skill, previousId = null, rng, lift = 1 }) {
  if (levelIndex <= 1) return { recipe: recipeById(ADAPT3.firstRecipe), chance: winChance(recipeById(ADAPT3.firstRecipe), levelTarget(1), skill, lift) };
  const target = levelTarget(levelIndex);
  const scored = candidates(levelIndex).map((recipe) => ({ recipe, chance: winChance(recipe, target, skill, lift) }));
  const gap = (s) => Math.abs(s.chance - ADAPT3.aim);
  const best = Math.min(...scored.map(gap));
  let near = scored.filter((s) => gap(s) <= best + 0.04);
  if (near.length > 1) near = near.filter((s) => s.recipe.id !== previousId);
  return near[rng.int(near.length)];
}

export function generateAdaptiveLevel({ runSeed, levelIndex, tier = 1, history = [], config = {}, bank = [], ups = {} }) {
  const seed = `${runSeed}/A${levelIndex}/adaptive`;
  const rng = createRng(seed);
  const skill = skillFrom(history);
  const previous = [...history].reverse().find((h) => h.mode === 'auto' && h.recipe);
  const lift = bankLift(bank);
  // the layout is chosen for the lift a sensible upgrader has by now, so a better pick of upgrades is the
  // player's gain; the prediction and the samples use the player's own lift
  const actual = upLift(ups);
  const { recipe } = chooseRecipe({ levelIndex, skill, previousId: previous ? previous.recipe : null, rng, lift: lift * expectedUpLift(levelIndex) });
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
    target: levelTarget(levelIndex),
    hands: config.hands,
    rerolls: config.rerolls,
    recipe: recipe.id,
    skill,
    predictedWin: winChance(recipe, levelTarget(levelIndex), skill, lift * actual),
    bank: bank.slice(), // the bonuses carried over, kinds (a retry starts with them again)
    bankLift: lift,
    ups: { ...ups }, // the run's upgrades of the combinations
    upLift: actual,
    typicalHand: Math.round((recipe.greedy[RECIPE_QUANTILES.indexOf(0.5)] / 3) * lift * actual), // help in trouble compares the need per hand with this
    generatorVersion: ADAPT3_VERSION,
  };
  const opening = currentHand(createAutoGame(level, config));
  level.openingBest = opening ? opening.total : 0;
  level.openingCategory = opening ? opening.category : null;
  return level;
}
