// The shop of the run (owner's order В2, GPT's design, art/ai/2026-11-06-shop-bosses; the portals plan, step 2, MODE3-PLAN
// §54). Clearing a level pays BELLS, more for hands and rerolls left unused, so the price of a decision shows (digest rule
// 16). A door opens after the second and the fourth level of each act, after the free upgrade pick: two shelves, a THING
// and a +1 TO A COMBINATION, each sold once. The last door before a keeper names him and offers a thing against him (rule
// 24) when the starters or the device's earlier finds hold one. Before level 5 the thing is a card-thing (things3.js
// CARD_THINGS, step 4: one-use cards for the bank); from level 5 one of the pocket's things, a card-thing 3 times in 10. Hero
// cards are no longer sold. A thing the player carries comes as its next star. The pocket's things on the shelf are the
// twelve starters and the ones this device found in earlier runs (things3.js shopPool, step 3b; run.gallery).
// Offers fit the player (questionnaire В9): they weigh the hands played and fallen short on, recent ones most, and the
// tag says so (rule 25: help in a score game must be visible). Targets and layouts never look at any of this.

import { BONUS_KINDS } from './hands.js';
import { BANK_SIZE } from './auto.js';
import { createRng } from './rng.js';
import { CATEGORY5_LABELS } from './scoring5.js';
import { UP_CATEGORIES, withUpgrade } from './upgrades3.js';
import { bossOf, BOSSES } from './bosses3.js';
import { THINGS, THING_PRICE, CARD_THINGS, CARD_THING_PRICE, cardPool, pocketPlaces, starsOf, helpsAgainst, takeThing, thingBells, shopPool } from './things3.js';

const ALL = UP_CATEGORIES;

export const THINGS_FROM = 5; // the first shop of the pocket's things is the one after level 7
export const CARD_SHARE = 0.3; // from it, the thing shelf holds a card-thing 3 times in 10
// +1 to a combination: 10 bells, 2 more for each one bought in a shop this run (the free picks are free), 24 at most
export const upPrice = (bought = 0) => Math.min(24, 10 + 2 * bought);

// The act's second and fourth levels: 2, 4, 7, 9, 12…
export const doorAfter = (levelIndex) => (levelIndex - 1) % 5 === 1 || (levelIndex - 1) % 5 === 3;
export const bossNext = (levelIndex) => levelIndex % 5 === 4; // the door before a boss

// What a won level pays, each part named for its receipt; `things`: what each thing in the pocket paid ([{ id, n }]).
export function levelBells(game) {
  const parts = {
    clear: 2,
    hand: 2 * game.handsLeft,
    reroll: game.rerollsLeft,
    boss: game.level.boss ? (BOSSES[game.level.boss].golden ? 8 : 3) : 0, // a golden keeper pays 5 more
  };
  const pay = Object.values(parts).reduce((a, b) => a + b, 0);
  const things = thingBells(game.level.things, { handsLeft: game.handsLeft, rerollsLeft: game.rerollsLeft, keeper: !!game.level.boss, played: (game.hands || []).map((h) => h.category), pay });
  return { ...parts, things, total: pay + things.reduce((a, t) => a + t.n, 0) };
}

// How much a player leans on each combination. plays: { category, cleared, level }, this run's and the hands that
// ended the last one (level 0). Each counts less with every level since: 0.85 per level.
export function fitWeights({ plays = [], ups = {} }, levelIndex) {
  const weigh = (cleared, c) => plays.reduce((s, p) => s + (p.category === c && p.cleared === cleared ? 0.85 ** (levelIndex - p.level) : 0), 0);
  return Object.fromEntries(ALL.map((c) => {
    const played = weigh(true, c);
    const short = weigh(false, c);
    return [c, { weight: 4 + Math.min(28, 5 * played + 7 * short + 2 * (ups[c] || 0)), played, short }];
  }));
}

// The tag of a combination offered: the reason it came up, or none for an offer with no such reason.
const plural = (c) => (c === 'pair' ? 'PAIRS' : `${CATEGORY5_LABELS[c]}${/(straight|house)$/.test(c) ? 'S' : ''}`);
export function fitTag(category, fit, brief = false) {
  const f = fit[category];
  if (!f || f.played + f.short < 0.3) return brief ? '' : 'WILD OFFER';
  return brief ? 'YOU PLAY THIS' : `YOU PLAY ${plural(category)}`; // on the pick, beside the name
}

function draw(rng, items, weightOf) {
  const weights = items.map(weightOf);
  let x = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < items.length; k++) {
    x -= weights[k];
    if (x < 0) return items[k];
  }
  return items[items.length - 1];
}

// The combinations a card raises, for its fit.
const cardCats = (kind) => (kind === 'joker' || kind === 'refund' ? ALL : ALL.filter((c) => BONUS_KINDS[kind].fits(c)));

// The shelf after `levelIndex`, seeded: the same run and the same choices bring the same goods. run: { ups, pocket,
// upsBought, gallery }; plays: how the player has played so far (the fit).
export function shopStock({ runSeed, levelIndex, run, plays = [] }) {
  const rng = createRng(`${runSeed}/A${levelIndex}/shop`);
  const fit = fitWeights({ plays, ups: run.ups }, levelIndex);
  const avg = (cats) => cats.reduce((s, c) => s + fit[c].weight, 0) / Math.max(1, cats.length);
  const leaned = (cats) => cats.slice().sort((a, b) => fit[b].weight - fit[a].weight)[0];
  const category = draw(rng, ALL, (c) => fit[c].weight);
  const up = { type: 'up', id: category, price: upPrice(run.upsBought), tag: fitTag(category, fit) };
  const card = () => {
    const kind = draw(rng, cardPool(levelIndex), (k) => avg(cardCats(k)));
    return [{ type: 'card', id: kind, price: CARD_THING_PRICE[CARD_THINGS[kind].rarity], tag: cardCats(kind).length < ALL.length ? fitTag(leaned(cardCats(kind)), fit) : 'WILD OFFER' }, up];
  };
  const pool = shopPool(levelIndex, run.pocket, run.gallery); // the starters and this device's finds (step 3b)
  const keeper = bossNext(levelIndex) ? bossOf(runSeed, levelIndex + 1) : null;
  const counters = keeper ? pool.filter((id) => helpsAgainst(id, keeper)) : [];
  // a card-thing before level 5, then 3 times in 10; never before a keeper whose door has a thing against him
  if (levelIndex < THINGS_FROM || !pool.length || (!counters.length && rng.next() < CARD_SHARE)) return card();
  const id = draw(rng, counters.length ? counters : pool, (t) => 4 + avg(THINGS[t].serves));
  const owned = starsOf(run.pocket, id);
  const serves = THINGS[id].serves;
  const tag = counters.includes(id) ? 'GOOD AGAINST KEEPER' : owned ? '+1 STAR' : serves.length < ALL.length ? fitTag(leaned(serves), fit) : 'WILD OFFER';
  return [{ type: 'thing', id, star: owned + 1, price: THING_PRICE[THINGS[id].rarity], tag }, up];
}

// What a card the bank holds is worth: a card-thing its shop price; a hero's card, dealt and no longer sold, what the shop
// asked for it until step 4 (66656a7, MODE3-PLAN §58).
export const HERO_PRICE = Object.freeze({ x2_any: 4, x3_straight: 6, x3_pairs: 4, x3_trips: 5, joker: 6, refund: 4, x3_kinds: 5, x3_small: 4, x4_any: 9, x3_sixes: 5 });
export const cardPrice = (kind) => (CARD_THINGS[kind] ? CARD_THING_PRICE[CARD_THINGS[kind].rarity] : HERO_PRICE[kind]);
// A kept card sells for half its price, rounded down (owner, 17.11.2026: «Продажа за полцены»; MODE3-PLAN §61).
export const sellPrice = (kind) => Math.max(1, Math.floor(cardPrice(kind) / 2));

// Sells the bank's card at place k: its half price in bells, and the cards after it move up. Returns { ok, run, bells }.
export function sellCard(run, k) {
  const kind = run.bank[k];
  if (!kind) return { ok: false, code: 'NO_CARD', message: 'Nothing there' };
  return { ok: true, bells: sellPrice(kind), run: { ...run, bells: run.bells + sellPrice(kind), bank: run.bank.filter((c, i) => i !== k) } };
}

// A won level's card that finds the bank full (owner, 17.11.2026, his 12.11 option «продажа за полцены по желанию и
// выбор трёх при переполнении»; MODE3-PLAN §62): it takes the place of the bank's card at `replace`, which sells as
// sellCard sells it, or with `replace` null sells itself. Returns { ok, run, sold, bells }.
export function keepCard(run, kind, replace = null) {
  const sold = replace === null ? kind : run.bank[replace];
  if (!sold) return { ok: false, code: 'NO_CARD', message: 'Nothing there' };
  const bank = replace === null ? run.bank : run.bank.map((c, i) => (i === replace ? kind : c));
  return { ok: true, sold, bells: sellPrice(sold), run: { ...run, bells: run.bells + sellPrice(sold), bank } };
}

// Buys one good. run: { bells, bank, ups, upsBought, pocket, levelIndex }. A full bank or pocket names the place the good
// replaces: a bank card replaced sells as sellCard sells it, a thing replaced is gone. Returns { ok, run, stock } or
// { ok: false, code, message }.
export function buyGood(run, stock, slot, { replace = null } = {}) {
  const good = stock[slot];
  const reject = (code, message) => ({ ok: false, code, message });
  if (!good) return reject('NO_GOOD', 'Nothing there');
  if (good.sold) return reject('SOLD', 'Sold');
  if (good.price > run.bells) return reject('BELLS', 'Not enough bells');
  const next = { ...run, bells: run.bells - good.price };
  if (good.type === 'card') {
    if (run.bank.length >= BANK_SIZE && replace === null) return reject('BANK_FULL', 'Replace a bank card');
    next.bank = run.bank.length < BANK_SIZE ? [...run.bank, good.id] : run.bank.map((k, i) => (i === replace ? good.id : k));
    if (run.bank.length >= BANK_SIZE) next.bells += sellPrice(run.bank[replace]);
  } else if (good.type === 'up') {
    next.ups = withUpgrade(run.ups, good.id);
    next.upsBought = (run.upsBought || 0) + 1;
  } else {
    const r = takeThing(run.pocket || [], good.id, pocketPlaces(run.levelIndex || 1), replace);
    if (!r.ok) return reject(r.code, r.code === 'POCKET_FULL' ? 'Replace a thing' : 'Nothing to add');
    next.pocket = r.pocket;
  }
  return { ok: true, run: next, stock: stock.map((g, i) => (i === slot ? { ...g, sold: true } : g)) };
}

// A shopper for the bots: buys in this order while the bells last and a place is free. A strong player goes for what
// stays (the thing, the +1), a typical one takes the shelf as it comes.
export function sensibleShopping(run, stock, order = ['thing', 'up', 'card']) {
  let now = run;
  let shelf = stock;
  for (const type of order) {
    const slot = shelf.findIndex((g) => g.type === type);
    if (slot < 0) continue;
    const r = buyGood(now, shelf, slot);
    if (r.ok) { now = r.run; shelf = r.stock; }
  }
  return now;
}
