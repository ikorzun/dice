#!/usr/bin/env node
// Checks the run's curve (run3.js): bots play endless runs as the game does, a missed target ends the run, a
// win brings the sensible upgrade and the unplayed bonuses carry over (the bank). The naive bot stands for a typical
// player and the greedy bot for a strong one (owner's questionnaire В10, 04.11.2026: a typical player reaches level
// 10 in about 8 minutes, a strong one level 20; the portals spec of 10.11.2026: a typical player to about level 30, a
// strong one to about 60). Bots compare variants; they do not forecast people (digest rule 29).
// Each bot plays its runs on one device: the things it sees in portals and buys join its gallery, and the shops of its
// later runs offer them beside the starters (step 3b); --freshGallery starts every run on a device that has found nothing.
// Usage: node scripts/run3-sim.mjs [--runs=400] [--seed=run-1] [--out=path] [--json=path] [--noshop] [--freshGallery] [--aimStart=… --aimFade=… --aimFloor=… --near=…]
//          [--scale=0.9] [--targets=7:380,16:760]   (a retune: every target × the scale, rounded to 10, then single levels' targets)
import { writeFileSync } from 'node:fs';
import { createRng } from '../src/engine/rng.js';
import { generateRunLevel, runTarget, runAim, RUN3, RUN3_VERSION } from '../src/engine/run3.js';
import { upgradeOffer, sensiblePick, withUpgrade } from '../src/engine/upgrades3.js';
import { doorAfter, levelBells, fitWeights, shopStock, sensibleShopping, sellCard, keepCard, cardPrice } from '../src/engine/shop3.js';
import { playNaiveBot3, playGreedyBot3, setBonuses } from '../src/engine/bot3.js';
import { createAutoGame, playHand, carryOver, BANK_SIZE } from '../src/engine/auto.js';
import { BOSSES } from '../src/engine/bosses3.js';
import { THINGS, THING_PRICE, pocketPlaces, takeThing, portalOf } from '../src/engine/things3.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const RUNS = Number(args.runs ?? 400);
const SEED = String(args.seed ?? 'run-1');
const CAP = 80; // a run this long counts as reaching the cap
const SHOP = !args.noshop;
const FRESH = !!args.freshGallery;
// the bots at a door (17.11.2026): never sell, sell a kept card that has waited two levels (the 12.11 report's), or sell them all
const SELL = String(args.sell ?? 'old');
// a card past the bank's three at a won level's end (MODE3-PLAN §62): the bots keep the dearest three, POWER PAINT last (a
// hand holds one card), and sell the other for half, as the game's KEEP and SELL do
const worthOf = (kind) => (kind === 'power_paint' ? 0 : cardPrice(kind));
if (!['never', 'old', 'all'].includes(SELL)) throw new Error(`--sell=never|old|all, not ${SELL}`);
const SECONDS_PER_LEVEL = 55; // the spec's budget, 50–60 s a level with the pick and the shops, until the live game measures it
const targets = RUN3.targets.map((t) => Math.round((t * Number(args.scale ?? 1)) / 10) * 10);
if (args.targets) for (const pair of String(args.targets).split(',')) { const [l, t] = pair.split(':').map(Number); targets[l - 1] = t; }
const curve = { ...RUN3, targets, ...Object.fromEntries(Object.keys(RUN3).filter((k) => k !== 'targets' && args[k] !== undefined).map((k) => [k, Number(args[k])])) };
const lines = [];
const out = (s = '') => { lines.push(s); console.log(s); };
const pct = (x) => `${(100 * x).toFixed(1)}%`;

// Lazy: never rerolls, switches every bonus on (of the bank's, the one that makes the best hand), plays the hand on the
// board (a floor below naive).
function playLazy(level, { rng }) {
  let g = setBonuses(createAutoGame(level), () => true);
  while (g.phase === 'playing') {
    g = playHand(g, () => rng.die()).state;
    if (g.phase !== 'playing') break;
    g = setBonuses(g, () => true);
  }
  return { score: g.score, won: g.phase === 'won', state: g };
}

const PLAYERS = [['lazy (no rerolls)', playLazy], ['naive (typical)', playNaiveBot3], ['greedy (strong)', playGreedyBot3]];

// A beaten keeper's portal (things3.js portalOf; MODE3-PLAN §55): every bot takes its thing into a free place or as a star;
// with a full pocket it gives up the weakest thing, by price and stars (the lift is measured in step 6), when the new one
// is worth more, and else leaves it for 3 bells. The thing joins the device's gallery either way.
const worth = (t) => THING_PRICE[THINGS[t.id].rarity] * t.stars;
function takePortal(run, runSeed, L, gallery) {
  const p = portalOf(runSeed, L, { pocket: run.pocket, gallery: [...gallery] });
  if (!p || !p.thing) return run;
  gallery.add(p.thing);
  const places = pocketPlaces(L + 1);
  const r = takeThing(run.pocket, p.thing, places);
  if (r.ok) return { ...run, pocket: r.pocket };
  const weakest = run.pocket.reduce((k, t, i) => (worth(t) < worth(run.pocket[k]) ? i : k), 0);
  if (worth({ id: p.thing, stars: 1 }) > worth(run.pocket[weakest])) return { ...run, pocket: takeThing(run.pocket, p.thing, places, weakest).pocket };
  return { ...run, bells: run.bells + 3 };
}
const t0 = Date.now();
const results = {};
for (const [name, play] of PLAYERS) {
  const reached = [];
  const tries = new Array(CAP + 2).fill(0);
  const wins = new Array(CAP + 2).fill(0);
  const mix = {};
  const bands = []; // the layouts by levels 2–10, 11–20, 21–30, 31 on
  const bossTries = {};
  let spent = 0;
  let doors = 0;
  let pocketed = 0; // the things the bots carry at the run's end
  const runOrder = [];
  let gallery = new Set(); // the device's finds, kept from run to run
  let found = 0;
  // the bank since «На поле одна» (17.11.2026): its cards play while the board holds no card, so a card on the board that is
  // never played keeps them waiting (`blocked`); `waits`: whole levels each kept card waited before it was played
  // `ages`: whole levels every kept card had waited at every level's start, played or not (the waits count only the played)
  const bank = { levels: 0, cards: 0, played: 0, blocked: 0, over: 0, overBells: 0, swapped: 0, sold: 0, soldBells: 0, waits: [], ages: [] };
  for (let r = 0; r < RUNS; r++) {
    if (FRESH) gallery = new Set();
    const earlier = [...gallery]; // the shop offers the finds of earlier runs
    const runSeed = `${SEED}/${r}`; // every player plays the same runs: the same layouts and targets
    const rng = createRng(`${SEED}/${name}/${r}`);
    let run = { bells: 0, ups: {}, upsBought: 0, bank: [], pocket: [] };
    let born = []; // the level each kept card came to the bank on, beside run.bank
    const plays = [];
    let used = 0;
    let L = 1;
    for (; L <= CAP; L++) {
      const level = generateRunLevel({ runSeed, levelIndex: L, ups: run.ups, bank: run.bank, things: run.pocket, curve });
      const res = play(level, { rng });
      tries[L]++;
      if (L > 1) mix[level.recipe] = (mix[level.recipe] || 0) + 1;
      if (L > 1) { const band = (bands[Math.min(3, Math.floor((L - 1) / 10))] ??= {}); band[level.recipe] = (band[level.recipe] || 0) + 1; }
      if (level.boss) { const b = (bossTries[level.boss] ??= { tries: 0, wins: 0 }); b.tries++; if (res.won) b.wins++; }
      const g = res.state;
      const dealt = level.layout.findIndex((c) => c.type === 'bonus');
      if (run.bank.length) {
        bank.levels++;
        bank.cards += run.bank.length;
        bank.ages.push(...born.map((b) => L - b - 1));
        if (dealt >= 0 && !g.hands.some((h) => h.bonusCells.includes(dealt))) bank.blocked++;
      }
      g.bank.forEach((b, k) => { if (b.used) { bank.played++; bank.waits.push(L - born[k] - 1); } });
      if (!res.won) break;
      wins[L]++;
      used += g.stats.rerollsUsed;
      g.hands.forEach((h, k) => plays.push({ category: h.category, cleared: k === g.hands.length - 1, level: L }));
      const fit = fitWeights({ plays, ups: run.ups }, L);
      const weights = Object.fromEntries(Object.entries(fit).map(([c, f]) => [c, f.weight]));
      const cards = carryOver(g);
      const borns = [...g.bank.flatMap((b, k) => (b.used || b.placed ? [] : [born[k]])), ...g.cells.filter((c) => c.type === 'bonus').map(() => L)];
      run = { ...run, bank: cards.slice(0, BANK_SIZE), ups: withUpgrade(run.ups, sensiblePick(upgradeOffer(runSeed, L, SHOP ? weights : null))), bells: run.bells + levelBells(g).total };
      born = borns.slice(0, BANK_SIZE);
      cards.slice(BANK_SIZE).forEach((kind, j) => {
        const weakest = run.bank.reduce((w, c, i) => (worthOf(c) < worthOf(run.bank[w]) ? i : w), 0);
        const replace = worthOf(kind) > worthOf(run.bank[weakest]) ? weakest : null;
        const r = keepCard(run, kind, replace);
        run = r.run;
        if (replace !== null) { born[replace] = borns[BANK_SIZE + j]; bank.swapped++; }
        bank.over++;
        bank.overBells += r.bells;
      });
      if (SHOP && level.boss) run = takePortal(run, runSeed, L, gallery); // before the pick in the game; the bots' pick does not look at it
      if (SHOP && doorAfter(L)) {
        // a kept card sells for half its price (17.11.2026, MODE3-PLAN §61): the bots sell as --sell says, before they buy
        for (let k = run.bank.length - 1; k >= 0; k--) {
          if (SELL === 'all' || (SELL === 'old' && L - born[k] >= 2)) {
            const r = sellCard(run, k);
            run = r.run;
            born.splice(k, 1);
            bank.sold++;
            bank.soldBells += r.bells;
          }
        }
        const before = run.bells;
        const shelf = run.bank;
        const stock = shopStock({ runSeed, levelIndex: L, run: { ...run, levelIndex: L + 1, gallery: earlier }, plays });
        run = sensibleShopping({ ...run, levelIndex: L + 1 }, stock, name.startsWith('greedy') ? undefined : ['card', 'up', 'thing']);
        born = run.bank.map((kind, k) => (shelf[k] === kind ? born[k] : L)); // a card bought or put in a card's place came on L
        for (const t of run.pocket) gallery.add(t.id); // a thing bought is found
        spent += before - run.bells;
        doors++;
      }
    }
    pocketed += run.pocket.length;
    found += gallery.size;
    reached.push(Math.min(L, CAP));
    runOrder.push(Math.min(L, CAP));
  }
  results[name] = { reached: reached.sort((a, b) => a - b), tries, wins, mix, bands, bank, bossTries, spent, doors, pocketed, runOrder, found };
}

const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const reach = (sorted, n) => sorted.filter((x) => x >= n).length / sorted.length;
out('# Auto Hand — the run (a missed target ends it)');
out(`seed ${SEED} · ${RUNS} runs per player${FRESH ? ' · every run on a fresh device' : ' · one device a player'} · bots sell ${SELL} · ${RUN3_VERSION} · aim ${JSON.stringify(Object.fromEntries(['aimFirst', 'aimStart', 'aimFade', 'aimFloor', 'near'].map((k) => [k, curve[k]])))} · ${new Date().toISOString()}`);
out();
out(`Targets: ${[1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60].map((l) => `L${l} ${runTarget(l, curve)}`).join(' · ')}.`);
out();
out(`"Reached" is the level the run ended on. Minutes at a rough ${SECONDS_PER_LEVEL} s per level played.`);
out();
out('| Player | Median reached | Mean | 10–90 % | Reach L5 | Reach L10 | Reach L20 | Reach L30 | Reach L45 | Reach L60 | Median minutes |');
out('|---|---|---|---|---|---|---|---|---|---|---|');
for (const [name, r] of Object.entries(results)) {
  const s = r.reached;
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  out(`| ${name} | ${q(s, 0.5)} | ${mean.toFixed(1)} | ${q(s, 0.1)}–${q(s, 0.9)} | ${pct(reach(s, 5))} | ${pct(reach(s, 10))} | ${pct(reach(s, 20))} | ${pct(reach(s, 30))} | ${pct(reach(s, 45))} | ${pct(reach(s, 60))} | ${((q(s, 0.5) * SECONDS_PER_LEVEL) / 60).toFixed(1)} |`);
}
out();
out('## Pass rate by level (runs that got there)');
out();
out(`| Level | Target | Aim (model) | ${PLAYERS.map(([n]) => n).join(' | ')} |`);
out(`|---|---|---|${PLAYERS.map(() => '---').join('|')}|`);
for (let L = 1; L <= 60; L++) {
  const cells = PLAYERS.map(([n]) => { const r = results[n]; return r.tries[L] >= 20 ? `${pct(r.wins[L] / r.tries[L])} (${r.tries[L]})` : r.tries[L] ? `— (${r.tries[L]})` : '—'; });
  out(`| ${L} | ${runTarget(L, curve)} | ${pct(runAim(L, curve))} | ${cells.join(' | ')} |`);
}
out();
out('## Keepers and the shop');
out();
out(`| Player | ${Object.keys(BOSSES).map((b) => BOSSES[b].name).join(' | ')} | Bells a door | Things a run | Gallery a run |`);
out(`|---|${Object.keys(BOSSES).map(() => '---').join('|')}|---|---|---|`);
for (const [name, r] of Object.entries(results)) {
  const cells = Object.keys(BOSSES).map((b) => { const x = r.bossTries[b]; return x ? `${pct(x.wins / x.tries)} (${x.tries})` : '—'; });
  out(`| ${name} | ${cells.join(' | ')} | ${(r.spent / Math.max(1, r.doors)).toFixed(1)} | ${(r.pocketed / RUNS).toFixed(1)} | ${(r.found / RUNS).toFixed(1)} |`);
}
out();
out('## The bank (one card on the board, 17.11.2026)');
out();
out('Kept cards play from the row while the board holds no card, one a hand. "Blocked": levels begun with kept cards whose card on the board was never played, so the bank stayed shut. "Lasts": kept cards at a start ÷ the cards that leave a level (played, sold, or replaced by a card past three), the levels a card stays in the bank. "Past three": cards a won level carried past the bank\'s three, each a choice that sells one card for half (MODE3-PLAN §62). "Sold": at the doors, by --sell. "Age": whole levels every kept card had already waited at every level\'s start, played later or not. "Waited": whole levels a kept card spent in the bank before the level it was played on (the played ones only).');
out();
out('| Player | Levels with kept cards | Kept cards at a start | Played a level | Lasts, levels | Age, mean | Age 3+ | Blocked levels | Waited, mean | Waited 3+ | Past three a run | Their bells a run | Sold a run | Sale bells a run |');
out('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
for (const [name, r] of Object.entries(results)) {
  const b = r.bank;
  const w = b.waits;
  out(`| ${name} | ${b.levels} | ${(b.cards / Math.max(1, b.levels)).toFixed(2)} | ${(b.played / Math.max(1, b.levels)).toFixed(2)} | ${b.played + b.sold + b.swapped ? (b.cards / (b.played + b.sold + b.swapped)).toFixed(1) : '—'} | ${mean(b.ages).toFixed(2)} | ${pct(b.ages.filter((x) => x >= 3).length / Math.max(1, b.ages.length))} | ${pct(b.blocked / Math.max(1, b.levels))} | ${mean(w).toFixed(2)} | ${pct(w.filter((x) => x >= 3).length / Math.max(1, w.length))} | ${(b.over / RUNS).toFixed(2)} | ${(b.overBells / RUNS).toFixed(1)} | ${(b.sold / RUNS).toFixed(2)} | ${(b.soldBells / RUNS).toFixed(1)} |`);
}
out();
out('## Layouts the strong player met most (levels 2 on)');
out();
const mix = results['greedy (strong)'].mix;
const total = Object.values(mix).reduce((s, v) => s + v, 0);
out(Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, n]) => `${id} ${pct(n / total)}`).join(', '));
out();
results['greedy (strong)'].bands.forEach((band, k) => {
  if (!band) return;
  const n = Object.values(band).reduce((s, v) => s + v, 0);
  out(`- Levels ${['2–10', '11–20', '21–30', '31 on'][k]}: ${Object.entries(band).sort((a, b) => b[1] - a[1]).map(([id, c]) => `${id} ${pct(c / n)}`).join(', ')}`);
});
out();
out(`Recipe ids: \`<dice>d<blocks>x:<bonus kinds>\`. Runtime: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (args.json) writeFileSync(String(args.json), JSON.stringify(Object.fromEntries(Object.entries(results).map(([n, r]) => [n, r.runOrder]))) + '\n');
if (args.out) { writeFileSync(String(args.out), lines.join('\n') + '\n'); console.log(`written ${args.out}`); }
