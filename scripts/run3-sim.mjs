#!/usr/bin/env node
// Checks the run's curve (run3.js): bots play endless runs as the game does, a missed target ends the run, a
// win brings the sensible upgrade and the unplayed bonuses carry over (the bank). The naive bot stands for a typical
// player and the greedy bot for a strong one (owner's questionnaire В10, 04.11.2026: a typical player reaches level
// 10 in about 8 minutes, a strong one level 20). Bots compare variants; they do not forecast people (digest rule 29).
// Usage: node scripts/run3-sim.mjs [--runs=400] [--seed=run-1] [--out=path] [--noshop] [--base=… --growth=… --bend=… --aimStart=… --aimFade=… --aimFloor=…]
import { writeFileSync } from 'node:fs';
import { createRng } from '../src/engine/rng.js';
import { generateRunLevel, runTarget, runAim, RUN3, RUN3_VERSION } from '../src/engine/run3.js';
import { upgradeOffer, sensiblePick, withUpgrade } from '../src/engine/upgrades3.js';
import { doorAfter, levelBells, fitWeights, shopStock, sensibleShopping } from '../src/engine/shop3.js';
import { playNaiveBot3, playGreedyBot3 } from '../src/engine/bot3.js';
import { createAutoGame, toggleBonus, playHand, isBonus, carryOver } from '../src/engine/auto.js';
import { BOSSES } from '../src/engine/bosses3.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const RUNS = Number(args.runs ?? 400);
const SEED = String(args.seed ?? 'run-1');
const CAP = 80; // a run this long counts as reaching the cap
const SHOP = !args.noshop;
const SECONDS_PER_LEVEL = 45; // a rough guess until the live game measures it (questionnaire В10)
const curve = { ...RUN3, ...Object.fromEntries(Object.keys(RUN3).filter((k) => args[k] !== undefined).map((k) => [k, Number(args[k])])) };
const lines = [];
const out = (s = '') => { lines.push(s); console.log(s); };
const pct = (x) => `${(100 * x).toFixed(1)}%`;

// Lazy: never rerolls, switches every bonus on, plays the hand on the board (a floor below naive).
function playLazy(level, { rng }) {
  let g = createAutoGame(level);
  for (let i = 0; i < 9; i++) if (isBonus(g, i)) g = toggleBonus(g, i).state;
  while (g.phase === 'playing') {
    g = playHand(g, () => rng.die()).state;
    if (g.phase !== 'playing') break; // a card that came in after the last hand stays off
    for (let i = 0; i < 9; i++) if (isBonus(g, i) && g.off[i]) g = toggleBonus(g, i).state;
  }
  return { score: g.score, won: g.phase === 'won', state: g };
}

const PLAYERS = [['lazy (no rerolls)', playLazy], ['naive (typical)', playNaiveBot3], ['greedy (strong)', playGreedyBot3]];
const t0 = Date.now();
const results = {};
for (const [name, play] of PLAYERS) {
  const reached = [];
  const tries = new Array(CAP + 2).fill(0);
  const wins = new Array(CAP + 2).fill(0);
  const mix = {};
  const bossTries = {};
  let spent = 0;
  let doors = 0;
  let charmed = 0;
  for (let r = 0; r < RUNS; r++) {
    const runSeed = `${SEED}/${r}`; // every player plays the same runs: the same layouts and targets
    const rng = createRng(`${SEED}/${name}/${r}`);
    let run = { bells: 0, ups: {}, bank: [], charms: [] };
    const plays = [];
    let used = 0;
    let L = 1;
    for (; L <= CAP; L++) {
      const level = generateRunLevel({ runSeed, levelIndex: L, ups: run.ups, bank: run.bank, charms: run.charms, curve });
      const res = play(level, { rng });
      tries[L]++;
      if (L > 1) mix[level.recipe] = (mix[level.recipe] || 0) + 1;
      if (level.boss) { const b = (bossTries[level.boss] ??= { tries: 0, wins: 0 }); b.tries++; if (res.won) b.wins++; }
      if (!res.won) break;
      wins[L]++;
      const g = res.state;
      used += g.stats.rerollsUsed;
      g.hands.forEach((h, k) => plays.push({ category: h.category, cleared: k === g.hands.length - 1, level: L }));
      const fit = fitWeights({ plays, ups: run.ups }, L);
      const weights = Object.fromEntries(Object.entries(fit).map(([c, f]) => [c, f.weight]));
      run = { ...run, bank: carryOver(g), ups: withUpgrade(run.ups, sensiblePick(upgradeOffer(runSeed, L, SHOP ? weights : null))), bells: run.bells + levelBells(g).total };
      if (SHOP && doorAfter(L)) {
        const before = run.bells;
        run = sensibleShopping(run, shopStock({ runSeed, levelIndex: L, run, plays, habits: { rerolls: Math.min(1, used / (3 * L)), cards: run.bank.length / 3 } }), name.startsWith('greedy') ? undefined : ['card', 'up', 'charm']);
        spent += before - run.bells;
        doors++;
      }
    }
    charmed += run.charms.length;
    reached.push(Math.min(L, CAP));
  }
  results[name] = { reached: reached.sort((a, b) => a - b), tries, wins, mix, bossTries, spent, doors, charmed };
}

const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const reach = (sorted, n) => sorted.filter((x) => x >= n).length / sorted.length;
out('# Auto Hand — the run (a missed target ends it)');
out(`seed ${SEED} · ${RUNS} runs per player · ${RUN3_VERSION} · curve ${JSON.stringify(Object.fromEntries(['base', 'growth', 'bend', 'aimFirst', 'aimStart', 'aimFade', 'aimFloor'].map((k) => [k, curve[k]])))} · ${new Date().toISOString()}`);
out();
out(`Targets: ${[1, 2, 3, 5, 10, 15, 20, 25, 30].map((l) => `L${l} ${runTarget(l, curve)}`).join(' · ')}.`);
out();
out('"Reached" is the level the run ended on. Minutes at a rough 45 s per level played.');
out();
out('| Player | Median reached | Mean | 10–90 % | Reach L5 | Reach L10 | Reach L15 | Reach L20 | Reach L30 | Median minutes |');
out('|---|---|---|---|---|---|---|---|---|---|');
for (const [name, r] of Object.entries(results)) {
  const s = r.reached;
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  out(`| ${name} | ${q(s, 0.5)} | ${mean.toFixed(1)} | ${q(s, 0.1)}–${q(s, 0.9)} | ${pct(reach(s, 5))} | ${pct(reach(s, 10))} | ${pct(reach(s, 15))} | ${pct(reach(s, 20))} | ${pct(reach(s, 30))} | ${((q(s, 0.5) * SECONDS_PER_LEVEL) / 60).toFixed(1)} |`);
}
out();
out('## Pass rate by level (runs that got there)');
out();
out(`| Level | Target | Aim (model) | ${PLAYERS.map(([n]) => n).join(' | ')} |`);
out(`|---|---|---|${PLAYERS.map(() => '---').join('|')}|`);
for (let L = 1; L <= 30; L++) {
  const cells = PLAYERS.map(([n]) => { const r = results[n]; return r.tries[L] >= 20 ? `${pct(r.wins[L] / r.tries[L])} (${r.tries[L]})` : r.tries[L] ? `— (${r.tries[L]})` : '—'; });
  out(`| ${L} | ${runTarget(L, curve)} | ${pct(runAim(L, curve))} | ${cells.join(' | ')} |`);
}
out();
out('## Bosses and the shop');
out();
out(`| Player | ${Object.keys(BOSSES).map((b) => BOSSES[b].name).join(' | ')} | Bells a door | Charms a run |`);
out(`|---|${Object.keys(BOSSES).map(() => '---').join('|')}|---|---|`);
for (const [name, r] of Object.entries(results)) {
  const cells = Object.keys(BOSSES).map((b) => { const x = r.bossTries[b]; return x ? `${pct(x.wins / x.tries)} (${x.tries})` : '—'; });
  out(`| ${name} | ${cells.join(' | ')} | ${(r.spent / Math.max(1, r.doors)).toFixed(1)} | ${(r.charmed / RUNS).toFixed(1)} |`);
}
out();
out('## Layouts the strong player met most (levels 2 on)');
out();
const mix = results['greedy (strong)'].mix;
const total = Object.values(mix).reduce((s, v) => s + v, 0);
out(Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, n]) => `${id} ${pct(n / total)}`).join(', '));
out();
out(`Recipe ids: \`<dice>d<blocks>x:<bonus kinds>\`. Runtime: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (args.out) { writeFileSync(String(args.out), lines.join('\n') + '\n'); console.log(`written ${args.out}`); }
