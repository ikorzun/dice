#!/usr/bin/env node
// Balance report for the Auto Hand mode (mode 3): per-tier score distributions of a naive and a
// greedy bot on generator levels, targets from the greedy win-rate criterion, the hands and
// bonuses the bots play, exact hold-plan EVs, and three scoring experiments (defaults untouched).
// Usage: node scripts/montecarlo3.mjs [--tierLevels=300] [--seed=20261031] [--out=path]
import { writeFileSync } from 'node:fs';
import { createRng } from '../src/engine/rng.js';
import { generateAutoLevel, TIERS3 } from '../src/engine/levels3.js';
import { playNaiveBot3, playGreedyBot3, expectedBest } from '../src/engine/bot3.js';
import { PIPS_MULT5 } from '../src/engine/scoring5.js';
import { AUTO_MULT } from '../src/engine/hands.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const NT = Number(args.tierLevels ?? 300);
const SEED = String(args.seed ?? '20261031');
const SPREAD = 8; // tier t plays level indices t … t+7: forced new kinds while ≤ 5, random kinds after
const GOAL = { 1: 0.75, 2: 0.6625, 3: 0.575, 4: 0.4875, 5: 0.4 }; // greedy win rate per tier (owner, 31.10)
const CATS = ['pair', 'two_pairs', 'small_straight', 'three_kind', 'full_house', 'straight', 'four_kind', 'five_kind'];
const KINDS = ['x2_any', 'x3_straight', 'x3_pairs', 'x3_trips', 'joker'];
const lines = [];
const out = (s = '') => { lines.push(s); console.log(s); };
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const f1 = (x) => x.toFixed(1);

// Category-first table (experiment b): score = category base + pip sum, multiplier 1 (the base
// already prices rarity; a multiplier on top would count it twice). base_c = round(K / p_c) with
// p_c the exact chance to make category c on 8 dice with one reroll from the best hold for c
// (printed in section G), so aiming at any category has the same first-order EV (fair odds);
// K = 52.7 sets the mean best hand of a fresh 8-die board to the pips table's.
const CATEGORY_FIRST = Object.freeze({
  base: { pair: 53, two_pairs: 53, small_straight: 66, three_kind: 55, full_house: 56, straight: 85, four_kind: 89, five_kind: 229 },
  mult: { pair: 1, two_pairs: 1, small_straight: 1, three_kind: 1, full_house: 1, straight: 1, four_kind: 1, five_kind: 1 },
});
const EXPERIMENTS = [
  { axis: '—', name: 'rules: bonuses add up, straight ×8', hand: null },
  { axis: 'a', name: 'stacking: multiply (first rule)', hand: { stacking: 'multiply' } },
  { axis: 'a', name: 'stacking: single best bonus', hand: { stacking: 'single' } },
  { axis: 'b', name: 'category-first table', hand: { table: CATEGORY_FIRST } },
  { axis: 'c', name: 'straight ×5 (pips of Poker 5)', hand: { straightMult: 5 } },
  { axis: 'c', name: 'straight ×10', hand: { straightMult: 10 } },
];

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, n - 1));
  const q = (p) => sorted[Math.min(n - 1, Math.floor(p * n))];
  return { mean, ci95: 1.96 * sd / Math.sqrt(n), q, pGe: (x) => sorted.filter((v) => v >= x).length / n };
}

// Hands, points and bonuses of a batch of finished levels.
function tally(results) {
  const t = { hands: 0, points: 0, cat: {}, catPts: {}, placed: {}, used: {}, onHand: {}, stacked: 0, bonusHands: 0, oneHand: 0, multiBonusLevels: 0 };
  for (const { level, state } of results) {
    const placed = level.layout.filter((c) => c.type === 'bonus').map((c) => c.kind);
    for (const k of placed) t.placed[k] = (t.placed[k] || 0) + 1;
    const withBonus = new Set();
    for (const h of state.hands) {
      t.hands++;
      t.points += h.total;
      t.cat[h.category] = (t.cat[h.category] || 0) + 1;
      t.catPts[h.category] = (t.catPts[h.category] || 0) + h.total;
      if (h.bonuses.length) { t.bonusHands++; withBonus.add(h.index); }
      if (h.bonuses.length > 1) t.stacked++;
      for (const k of h.bonuses) {
        t.used[k] = (t.used[k] || 0) + 1;
        t.onHand[k] = t.onHand[k] || [0, 0, 0];
        t.onHand[k][h.index]++;
      }
    }
    if (placed.length > 1) {
      t.multiBonusLevels++;
      if (withBonus.size === 1 && state.hands.reduce((s, h) => s + h.bonuses.length, 0) === placed.length) t.oneHand++;
    }
  }
  return t;
}
const straightShare = (t) => ({ hands: (t.cat.straight || 0) / t.hands, points: (t.catPts.straight || 0) / t.points });

// Exact chance to make each category on n dice: fresh, and with one reroll from the best hold for it.
function categoryOdds(n) {
  const has = {
    pair: (c) => c.some((x) => x >= 2),
    two_pairs: (c) => c.filter((x) => x >= 2).length >= 2,
    small_straight: (c) => [0, 1, 2].some((lo) => [0, 1, 2, 3].every((d) => c[lo + d] > 0)),
    three_kind: (c) => c.some((x) => x >= 3),
    full_house: (c) => c.some((x, a) => x >= 3 && c.some((y, b) => b !== a && y >= 2)),
    straight: (c) => [0, 1].some((lo) => [0, 1, 2, 3, 4].every((d) => c[lo + d] > 0)),
    four_kind: (c) => c.some((x) => x >= 4),
    five_kind: (c) => c.some((x) => x >= 5),
  };
  const fact = (k) => (k < 2 ? 1 : k * fact(k - 1));
  const multisets = (k) => {
    const list = [];
    const walk = (f, left, c) => {
      if (f === 5) { c[5] = left; list.push({ c: c.slice(), p: fact(k) / c.reduce((s, x) => s * fact(x), 1) / 6 ** k }); return; }
      for (let x = 0; x <= left; x++) { c[f] = x; walk(f + 1, left - x, c); }
    };
    walk(0, k, new Array(6).fill(0));
    return list;
  };
  const byK = Array.from({ length: n + 1 }, (_, k) => multisets(k));
  const subs = (c) => c.reduce((acc, x) => acc.flatMap((h) => Array.from({ length: x + 1 }, (_, y) => [...h, y])), [[]]);
  const odds = {};
  for (const cat of CATS) {
    const memo = new Map();
    let fresh = 0;
    let one = 0;
    for (const { c, p } of byK[n]) {
      if (has[cat](c)) { fresh += p; one += p; continue; }
      let best = 0;
      for (const h of subs(c)) {
        const key = h.join('');
        if (!memo.has(key)) {
          const k = n - h.reduce((s, x) => s + x, 0);
          memo.set(key, byK[k].reduce((s, o) => s + (has[cat](h.map((x, i) => x + o.c[i])) ? o.p : 0), 0));
        }
        best = Math.max(best, memo.get(key));
      }
      one += p * best;
    }
    odds[cat] = { fresh, one };
  }
  return odds;
}

const t0 = Date.now();
out('# Auto Hand (mode 3) — simulation report');
out(`seed ${SEED} · ${NT} generator levels per tier (level index tier … tier+${SPREAD - 1}) · 3 hands · 3 shared rerolls · bonuses start off, the bots switch them on · ${new Date().toISOString()}`);
out();
out('Bots: **naive** switches every bonus on, holds exactly the best hand\'s dice and rerolls once per hand (while rerolls ≥ hands left), then plays. **Greedy** (`playGreedyBot3`, margin 20, strong 150) evaluates every hold mask of the dice by the exact expected best hand after one reroll and rerolls while the best mask beats the standing hand by 20; conditional bonuses always on, ×2 any and joker on for the last hand or when the hand without them already totals 150. Both maximize score and ignore the target.');
out();

const levels = {};
const runs = {};
for (let tier = 1; tier <= 5; tier++) {
  levels[tier] = Array.from({ length: NT }, (_, i) => generateAutoLevel({ runSeed: `${SEED}/t${tier}/r${i}`, levelIndex: tier + (i % SPREAD), tier }));
  const rn = createRng(`${SEED}/naive/${tier}`);
  const rg = createRng(`${SEED}/greedy/${tier}`);
  runs[tier] = {
    naive: levels[tier].map((level) => ({ level, ...playNaiveBot3(level, { rng: rn }) })),
    greedy: levels[tier].map((level) => ({ level, ...playGreedyBot3(level, { rng: rg }) })),
  };
}
const dist = (tier, bot) => summarize(runs[tier][bot].map((r) => r.score));

out('## A. Tiers: layout and bonus kinds');
out();
out('| Tier | Layout | Bonus kinds placed (share of bonus cells) | Mean opening best (as generated) |');
out('|---|---|---|---|');
for (let tier = 1; tier <= 5; tier++) {
  const s = TIERS3[tier];
  const t = tally(runs[tier].naive);
  const nb = Object.values(t.placed).reduce((a, b) => a + b, 0);
  const kinds = KINDS.filter((k) => t.placed[k]).map((k) => `${k} ${pct(t.placed[k] / nb)}`).join(', ');
  const open = levels[tier].reduce((a, l) => a + l.openingBest, 0) / NT;
  out(`| ${tier} | ${s.dice} dice · ${s.bonuses} bonus · ${s.blocks} block | ${kinds} | ${f1(open)} |`);
}
out();

out('## B. Score distributions per tier (quantiles for adaptive difficulty)');
out();
const QS = [0.05, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 0.95];
out(`| Tier | Bot | Mean ± 95% CI | ${QS.map((p) => `p${Math.round(100 * p)}`).join(' | ')} |`);
out(`|---|---|---|${QS.map(() => '---').join('|')}|`);
for (let tier = 1; tier <= 5; tier++) {
  for (const bot of ['naive', 'greedy']) {
    const d = dist(tier, bot);
    out(`| ${tier} | ${bot} | ${f1(d.mean)} ± ${f1(d.ci95)} | ${QS.map((p) => d.q(p)).join(' | ')} |`);
  }
}
out();
out('pX is the score that X% of levels stay below; the win rate at target T is the share of levels scoring ≥ T.');
out();

out('## C. Targets');
out();
out('Criterion (owner, 31.10.2026): greedy win rate ≈75% at tier 1 stepping down evenly to ≈40% at tier 5. Suggested target = the multiple of 10 whose greedy win rate is closest to the goal.');
out();
out('| Tier | Goal (greedy) | Suggested target | Greedy win rate there | Naive win rate there | Current TIERS3 target | Greedy win rate | Naive win rate |');
out('|---|---|---|---|---|---|---|---|');
const suggested = {};
for (let tier = 1; tier <= 5; tier++) {
  const g = dist(tier, 'greedy');
  const n = dist(tier, 'naive');
  let best = 10;
  for (let T = 10; T <= 2000; T += 10) if (Math.abs(g.pGe(T) - GOAL[tier]) < Math.abs(g.pGe(best) - GOAL[tier])) best = T;
  suggested[tier] = best;
  const cur = TIERS3[tier].target;
  out(`| ${tier} | ${pct(GOAL[tier])} | ${best} | ${pct(g.pGe(best))} | ${pct(n.pGe(best))} | ${cur} | ${pct(g.pGe(cur))} | ${pct(n.pGe(cur))} |`);
}
const monotone = [1, 2, 3, 4, 5].every((t) => t === 1 || suggested[t] >= suggested[t - 1]);
out();
out(`Suggested targets are ${monotone ? '' : 'not '}monotone non-decreasing over the tiers.`);
const sameLayout = [2, 3, 4, 5].filter((t) => ['dice', 'bonuses', 'blocks'].every((k) => TIERS3[t][k] === TIERS3[t - 1][k])).map((t) => `${t - 1} and ${t}`);
if (sameLayout.length) out(`Tiers ${sameLayout.join(', ')} share a layout and differ only by target.`);
out('TIERS3 targets were set from a larger run of this script (`--tierLevels=1000 --seed=check1000`); a 300-level sample suggests targets within about 10 points of them.');
out();
out('### Win rate over a range of targets (naive / greedy)');
out();
out('| Target | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |');
out('|---|---|---|---|---|---|');
for (let T = 200; T <= 900; T += 25) {
  out(`| ${T} | ${[1, 2, 3, 4, 5].map((t) => `${pct(dist(t, 'naive').pGe(T))} / ${pct(dist(t, 'greedy').pGe(T))}`).join(' | ')} |`);
}
out();

out('## D. Played hands');
out();
out('Share of played hands by category, all tiers pooled (share of points in brackets).');
out();
out(`| Bot | ${CATS.join(' | ')} |`);
out(`|---|${CATS.map(() => '---').join('|')}|`);
const pooled = {};
for (const bot of ['naive', 'greedy']) {
  pooled[bot] = tally([1, 2, 3, 4, 5].flatMap((t) => runs[t][bot]));
  const t = pooled[bot];
  out(`| ${bot} | ${CATS.map((c) => `${pct((t.cat[c] || 0) / t.hands)} (${pct((t.catPts[c] || 0) / t.points)})`).join(' | ')} |`);
}
out();
out('Straights against of-a-kind hands (pair, two pairs, three, full house, four, five) per tier: share of hands / share of points.');
out();
out('| Tier | Naive: straights | Naive: of-a-kind | Greedy: straights | Greedy: of-a-kind |');
out('|---|---|---|---|---|');
for (let tier = 1; tier <= 5; tier++) {
  const cells = ['naive', 'greedy'].flatMap((bot) => {
    const s = straightShare(tally(runs[tier][bot]));
    return [`${pct(s.hands)} / ${pct(s.points)}`, `${pct(1 - s.hands)} / ${pct(1 - s.points)}`];
  });
  out(`| ${tier} | ${cells.join(' | ')} |`);
}
out();

out('## E. Bonus usage');
out();
out('| Bot | Kind | Placed | Used | Used on hand 1 / 2 / 3 |');
out('|---|---|---|---|---|');
for (const bot of ['naive', 'greedy']) {
  const t = pooled[bot];
  for (const k of KINDS) {
    if (!t.placed[k]) continue;
    const used = t.used[k] || 0;
    const on = t.onHand[k] || [0, 0, 0];
    out(`| ${bot} | ${k} | ${t.placed[k]} | ${pct(used / t.placed[k])} | ${on.map((x) => pct(used ? x / used : 0)).join(' / ')} |`);
  }
}
out();
for (const bot of ['naive', 'greedy']) {
  const t = pooled[bot];
  const t3 = tally(runs[3][bot]);
  out(`- ${bot}: ${pct(t.bonusHands / t.hands)} of hands use a bonus; ${pct(t.stacked / Math.max(1, t.bonusHands))} of those stack two or more. Tier 3 (two bonuses): every bonus spent on one hand in ${pct(t3.oneHand / Math.max(1, t3.multiBonusLevels))} of levels.`);
}
out();

out('## F. Hold plans: exact EV of one reroll');
out();
out('Exact over every outcome of the rerolled dice (method of RESEARCH-BALATRO §5.2), scored by the engine\'s `bestHand`; positions do not matter, no bonuses unless stated.');
out();
const PLANS8 = [['hold 6-6-6, reroll 5', [6, 6, 6], 5], ['hold 6-6, reroll 6', [6, 6], 6], ['hold 2-3-4-5, reroll 4', [2, 3, 4, 5], 4], ['hold 3-4-5-6, reroll 4', [3, 4, 5, 6], 4]];
const PLANS6 = [['hold 6-6-6, reroll 3', [6, 6, 6], 3], ['hold 2-3-4-5, reroll 2', [2, 3, 4, 5], 2], ['hold 3-4-5-6, reroll 2', [3, 4, 5, 6], 2]];
const BONUS6 = ['x2_any', 'x3_straight'];
const planRow = (hand, plans, kinds = []) => plans.map(([, held, k]) => f1(expectedBest(held, k, { kinds, hand })));
const dominance = (hand, plans, kinds = []) => {
  const ev = plans.map(([, held, k]) => expectedBest(held, k, { kinds, hand }));
  return ev[0] / Math.max(...ev.slice(plans.length === 4 ? 2 : 1));
};
out(`| Scoring | ${PLANS8.map((p) => `8 dice: ${p[0]}`).join(' | ')} | of-a-kind ÷ best straight draw |`);
out(`|---|${PLANS8.map(() => '---').join('|')}|---|`);
out(`| rules (straight ×8) | ${planRow(null, PLANS8).join(' | ')} | ${dominance(null, PLANS8).toFixed(2)} |`);
out(`| pips of Poker 5 (straight ×5) | ${planRow({ straightMult: 5 }, PLANS8).join(' | ')} | ${dominance({ straightMult: 5 }, PLANS8).toFixed(2)} |`);
out();

out('## G. Experiments (the rules are the first row)');
out();
out('The same generator levels, greedy bot only, with the engine scoring by `bestHand(…, options)` (`config.handOptions`). Dominance: exact EV of holding 6-6-6 divided by the best straight-draw hold (≈1 means no dominant plan), and the share of straights among greedy plays.');
out();
const exp = EXPERIMENTS.map((e) => {
  const rs = {};
  for (let tier = 1; tier <= 5; tier++) {
    const rg = createRng(`${SEED}/greedy/${tier}`);
    rs[tier] = e.hand ? levels[tier].map((level) => ({ level, ...playGreedyBot3(level, { rng: rg, hand: e.hand }) })) : runs[tier].greedy;
  }
  const all = tally([1, 2, 3, 4, 5].flatMap((t) => rs[t]));
  return { ...e, rs, all, t3: tally(rs[3]) };
});
out('| Axis | Variant | Greedy mean T1 | T2 | T3 | T4 | T5 | Straights: hands / points | EV 6-6-6 ÷ straight draw (8 dice, no bonus) | Same, 6 dice with ×2 any + ×3 straight on | Tier 3: all bonuses on one hand |');
out('|---|---|---|---|---|---|---|---|---|---|---|');
for (const e of exp) {
  const means = [1, 2, 3, 4, 5].map((t) => f1(summarize(e.rs[t].map((r) => r.score)).mean));
  const s = straightShare(e.all);
  out(`| ${e.axis} | ${e.name} | ${means.join(' | ')} | ${pct(s.hands)} / ${pct(s.points)} | ${dominance(e.hand, PLANS8).toFixed(2)} | ${dominance(e.hand, PLANS6, BONUS6).toFixed(2)} | ${pct(e.t3.oneHand / Math.max(1, e.t3.multiBonusLevels))} |`);
}
out();
out('Hold-plan EVs per variant:');
out();
out(`| Variant | ${PLANS8.map((p) => `8 dice: ${p[0]}`).join(' | ')} | ${PLANS6.map((p) => `6 dice, ×2+×3 straight: ${p[0]}`).join(' | ')} |`);
out(`|---|${PLANS8.map(() => '---').join('|')}|${PLANS6.map(() => '---').join('|')}|`);
for (const e of exp) out(`| ${e.name} | ${planRow(e.hand, PLANS8).join(' | ')} | ${planRow(e.hand, PLANS6, BONUS6).join(' | ')} |`);
out();
out('Notes:');
out('- (a) Stacking only changes a hand that fits two multiplier bonuses at once, which needs the two bonus cells of tier 3; the joker is a wild face, not a multiplier, and is unaffected. With "single" only the largest bonus is used and burnt; the other stays on the board.');
out(`- (c) Only the straight multiplier changes (rules ×${AUTO_MULT.straight}, Poker 5 ×${PIPS_MULT5.straight}); full house stays ×${AUTO_MULT.full_house}, four ×${AUTO_MULT.four_kind}.`);
out('- (b) How the category-first table was chosen: score = category base + pip sum, no multiplier (the base already prices rarity). base = round(K ÷ p), p = exact chance to make the category on 8 dice with one reroll from the best hold for it, so going for any category has the same first-order EV (fair odds, the Poker Squares principle of RESEARCH.md); K = 52.7 makes the mean best hand of a fresh 8-die board equal the pips table\'s. Odds behind it (and on 6 dice, where tiers 3–5 play and the table is mispriced):');
out();
const odds8 = categoryOdds(8);
const odds6 = categoryOdds(6);
out('| Category | 8 dice fresh | 8 dice, one reroll | Base | 6 dice fresh | 6 dice, one reroll |');
out('|---|---|---|---|---|---|');
for (const c of CATS) out(`| ${c} | ${pct(odds8[c].fresh)} | ${pct(odds8[c].one)} | ${CATEGORY_FIRST.base[c]} | ${pct(odds6[c].fresh)} | ${pct(odds6[c].one)} |`);
out();
out(`Mean best hand of a fresh 8-die board: pips ${f1(expectedBest([], 8))}, category-first ${f1(expectedBest([], 8, { hand: { table: CATEGORY_FIRST } }))}.`);
out();
out(`Runtime: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (args.out) { writeFileSync(String(args.out), lines.join('\n') + '\n'); console.log(`written ${args.out}`); }
