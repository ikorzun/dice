#!/usr/bin/env node
// Balance report for the Poker 5 mode: score distributions of a naive and a greedy bot
// under the configured hands/rerolls economy, and per-tier win rates of the generator.
// Usage: node scripts/montecarlo5.mjs [--boards=2000] [--tierBoards=300] [--hands=3] [--rerolls=3] [--out=path]
import { writeFileSync } from 'node:fs';
import { createRng } from '../src/engine/rng.js';
import { rollFaces9, generatePokerLevel, TIERS5 } from '../src/engine/levels5.js';
import { playNaiveBot5, playGreedyBot5 } from '../src/engine/bot5.js';
import { createPokerGame, bestSnake } from '../src/engine/poker.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const N = Number(args.boards ?? 2000);
const NT = Number(args.tierBoards ?? 300);
const SEED = String(args.seed ?? '20261030');
const config = { hands: Number(args.hands ?? 3), rerolls: Number(args.rerolls ?? 3), smallStraight: args.smallStraight !== 'false', bonusIndex: args.bonusIndex === 'none' ? null : 8 };
const lines = [];
const out = (s = '') => { lines.push(s); console.log(s); };
const pct = (x) => `${(100 * x).toFixed(1)}%`;
function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, n - 1));
  const q = (p) => sorted[Math.min(n - 1, Math.floor(p * n))];
  return { mean, ci95: 1.96 * sd / Math.sqrt(n), median: q(0.5), p10: q(0.1), p25: q(0.25), p75: q(0.75), p90: q(0.9), pGe: (x) => sorted.filter((v) => v >= x).length / n };
}
const t0 = Date.now();
out(`# Poker 5 — simulation report`);
out(`seed ${SEED} · hands ${config.hands} · rerolls ${config.rerolls} · small straight ${config.smallStraight} · gold cell ${config.bonusIndex === null ? 'no (9 dice)' : 'yes (8 dice)'} · ${new Date().toISOString()}`);
out();
{
  const rng = createRng(`${SEED}/poker/B`);
  const naive = [];
  const greedy = [];
  const opening = [];
  for (let i = 0; i < N; i++) {
    const faces = rollFaces9(rng, config.bonusIndex);
    const level = { seed: `B${i}`, levelIndex: i, tier: 1, faces, bonusIndex: config.bonusIndex, target: 100000, hands: config.hands, rerolls: config.rerolls, sealedMask: 0 };
    opening.push(bestSnake(createPokerGame(level, config)).points);
    naive.push(playNaiveBot5(level, { rng, config }).score);
    greedy.push(playGreedyBot5(level, { rng, config, samples: 10 }).score);
  }
  const o = summarize(opening);
  const n = summarize(naive);
  const g = summarize(greedy);
  out(`## A. Fresh boards (${N}): score per level`);
  out();
  out(`Best opening snake: mean ${o.mean.toFixed(1)}, median ${o.median}, p90 ${o.p90}.`);
  out(`Naive bot: mean ${n.mean.toFixed(1)} ± ${n.ci95.toFixed(1)}, median ${n.median}, p10 ${n.p10}, p25 ${n.p25}, p75 ${n.p75}, p90 ${n.p90}.`);
  out(`Greedy bot: mean ${g.mean.toFixed(1)} ± ${g.ci95.toFixed(1)}, median ${g.median}, p10 ${g.p10}, p25 ${g.p25}, p75 ${g.p75}, p90 ${g.p90}.`);
  out();
  out('| Target T | P(naive ≥ T) | P(greedy ≥ T) |');
  out('|---|---|---|');
  for (const T of [20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150]) out(`| ${T} | ${pct(n.pGe(T))} | ${pct(g.pGe(T))} |`);
  out();
}
{
  out(`## B. Generator per tier (${NT} levels per tier)`);
  out();
  out('| Tier | Target | Mean opening best | Fallbacks | Naive win rate | Greedy win rate |');
  out('|---|---|---|---|---|---|');
  for (let tier = 1; tier <= 5; tier++) {
    const rng = createRng(`${SEED}/poker/C/${tier}`);
    let nw = 0;
    let gw = 0;
    let fb = 0;
    let sumOpen = 0;
    for (let i = 0; i < NT; i++) {
      const level = generatePokerLevel({ runSeed: `${SEED}/t${tier}/r${i}`, levelIndex: i, tier, config });
      if (level.fallback) fb++;
      sumOpen += level.openingBest;
      if (playNaiveBot5(level, { rng, config }).won) nw++;
      if (playGreedyBot5(level, { rng, config, samples: 8 }).won) gw++;
    }
    out(`| ${tier} | ${TIERS5[tier].target} | ${(sumOpen / NT).toFixed(1)} | ${fb} | ${pct(nw / NT)} | ${pct(gw / NT)} |`);
  }
  out();
}
out(`Runtime: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (args.out) { writeFileSync(String(args.out), lines.join('\n') + '\n'); console.log(`written ${args.out}`); }
