#!/usr/bin/env node
// Checks the adaptive Auto Hand generator: players of three strengths play runs of adaptive
// levels (each level built from their own history, like the game does) and the report shows
// whether every one of them settles near the aimed win rate, which layouts they get, how often
// help in trouble fires and how well the predicted win chance matches the outcome.
// Usage: node scripts/adapt3-sim.mjs [--runs=60] [--levels=30] [--seed=adapt-1] [--out=path]
import { writeFileSync } from 'node:fs';
import { createRng } from '../src/engine/rng.js';
import { generateAdaptiveLevel, skillSample, recipeById, ADAPT3, ADAPT3_VERSION, targetFor } from '../src/engine/adapt3.js';
import { playNaiveBot3, playGreedyBot3 } from '../src/engine/bot3.js';
import { createAutoGame, toggleBonus, playHand, isBonus } from '../src/engine/auto.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const RUNS = Number(args.runs ?? 60);
const LEVELS = Number(args.levels ?? 30);
const SEED = String(args.seed ?? 'adapt-1');
const lines = [];
const out = (s = '') => { lines.push(s); console.log(s); };
const pct = (x) => `${(100 * x).toFixed(1)}%`;

// Lazy: never rerolls, switches every bonus on, plays the hand on the board (a floor below naive).
function playLazy(level, { rng }) {
  let g = createAutoGame(level);
  for (let i = 0; i < 9; i++) if (isBonus(g, i)) g = toggleBonus(g, i).state;
  while (g.phase === 'playing') {
    g = playHand(g, () => rng.die()).state;
    for (let i = 0; i < 9; i++) if (isBonus(g, i) && g.off[i]) g = toggleBonus(g, i).state;
  }
  return { score: g.score, won: g.phase === 'won', state: g };
}

const PLAYERS = [['lazy (no rerolls)', playLazy], ['naive', playNaiveBot3], ['greedy', playGreedyBot3]];
const t0 = Date.now();
out('# Auto Hand — adaptive generator check');
out(`seed ${SEED} · ${RUNS} runs × ${LEVELS} levels per player · ${ADAPT3_VERSION} · aim ${pct(ADAPT3.aim)} · ${new Date().toISOString()}`);
out();
out(`Target ladder: ${[1, 2, 3, 5, 10, 15, 20, 30].map((l) => `L${l} ${targetFor(l)}`).join(' · ')}. Level 1 is fixed (8 dice + ×2); from level 2 the layout follows the player's skill.`);
out();
out('| Player | Win rate L2–10 | L11–20 | L21–30 | Mean predicted win | Final skill (mean) | Mean dice / blocks / bonuses | Hands with help | Win rate when helped |');
out('|---|---|---|---|---|---|---|---|---|');
const mixes = {};
for (const [name, play] of PLAYERS) {
  const band = [[0, 0], [0, 0], [0, 0]];
  let predicted = 0;
  let levels = 0;
  let skillSum = 0;
  let dice = 0;
  let blocks = 0;
  let bonuses = 0;
  let hands = 0;
  let helped = 0;
  let helpedLevels = 0;
  let helpedWins = 0;
  const mix = {};
  for (let r = 0; r < RUNS; r++) {
    const rng = createRng(`${SEED}/${name}/${r}`);
    const history = [];
    let skill = ADAPT3.startSkill;
    for (let L = 1; L <= LEVELS; L++) {
      const level = generateAdaptiveLevel({ runSeed: `${SEED}/${name}/${r}`, levelIndex: L, history, config: {} });
      const res = play(level, { rng });
      const recipe = recipeById(level.recipe);
      history.push({ mode: 'auto', recipe: level.recipe, ratio: skillSample(recipe, res.score), won: res.won, predictedWin: level.predictedWin });
      skill = level.skill;
      if (L === 1) continue;
      const b = L <= 10 ? 0 : L <= 20 ? 1 : 2;
      band[b][0] += res.won ? 1 : 0;
      band[b][1] += 1;
      predicted += level.predictedWin;
      levels++;
      dice += recipe.dice;
      blocks += recipe.blocks;
      bonuses += recipe.kinds.length;
      mix[level.recipe] = (mix[level.recipe] || 0) + 1;
      const h = res.state.hands.filter((x) => x.help > 0).length;
      hands += res.state.hands.length;
      helped += h;
      if (h) { helpedLevels++; if (res.won) helpedWins++; }
    }
    skillSum += skill;
  }
  mixes[name] = mix;
  const f2 = (x) => x.toFixed(2);
  out(`| ${name} | ${pct(band[0][0] / band[0][1])} | ${pct(band[1][0] / band[1][1])} | ${pct(band[2][0] / band[2][1])} | ${pct(predicted / levels)} | ${f2(skillSum / RUNS)} | ${f2(dice / levels)} / ${f2(blocks / levels)} / ${f2(bonuses / levels)} | ${pct(helped / hands)} | ${helpedLevels ? pct(helpedWins / helpedLevels) : '—'} |`);
}
out();
out('## Layouts each player gets most (share of levels 2–30)');
out();
for (const [name, mix] of Object.entries(mixes)) {
  const total = Object.values(mix).reduce((s, v) => s + v, 0);
  const top = Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => `${id} ${pct(n / total)}`).join(', ');
  out(`- **${name}**: ${top}`);
}
out();
out(`Recipe ids: \`<dice>d<blocks>x:<bonus kinds>\`. Runtime: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (args.out) { writeFileSync(String(args.out), lines.join('\n') + '\n'); console.log(`written ${args.out}`); }
