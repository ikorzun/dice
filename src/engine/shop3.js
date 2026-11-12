// The shop of the run (owner's order В2, GPT's design, art/ai/2026-11-06-shop-bosses). Clearing a level pays BELLS, more
// for hands and rerolls left unused, so the price of a decision shows (digest rule 16). A door opens after the second
// and the fourth level of each act, after the free upgrade pick: three goods, one card, one +1 and one charm, each sold
// once. The last door before a boss names the boss and offers something against it (rule 24).
// Offers fit the player (questionnaire В9): they weigh the hands played and fallen short on, recent ones most, and the
// tag says so (rule 25: help in a score game must be visible). Targets and layouts never look at any of this.

import { BONUS_KINDS } from './hands.js';
import { BANK_SIZE } from './auto.js';
import { createRng } from './rng.js';
import { CATEGORY5_LABELS } from './scoring5.js';
import { UP_CATEGORIES, withUpgrade } from './upgrades3.js';
import { unlockedKinds } from './levels3.js';
import { bossOf, BOSSES } from './bosses3.js';

export const CHARM_SLOTS = 3;
const ALL = UP_CATEGORIES;

// The names and pictures are the owner's things of the portals plan (owner, 12.11.2026: «Объекты я давал с героями»;
// his pick: the pictures only, scripts/charms.py); the ids, rules and prices are the charms' own
export const CHARMS = Object.freeze({
  crooked_pip: Object.freeze({ name: 'SIX GRIP', rule: 'ONES COUNT AS SIX IN HAND SUMS', price: 9, serves: ['full_house', 'straight', 'two_pairs'] }),
  velvet_grip: Object.freeze({ name: 'SOLID HOLD', rule: 'HELD DICE ADD ONE TO HAND SUM', price: 8, serves: ['pair', 'three_kind', 'five_kind'], habit: 'holds' }),
  quick_pocket: Object.freeze({ name: 'FIRST FLIGHT', rule: 'FIRST BANK CARD STARTS ON BOARD', price: 8, serves: [], habit: 'cards' }),
  stone_ribbon: Object.freeze({ name: 'FIVE SLICES', rule: 'FIVE-DIE HANDS ADD FIVE', price: 7, serves: ['full_house', 'straight', 'five_kind'] }),
  echo_thimble: Object.freeze({ name: 'CALLBACK', rule: 'REFUND GIVES BACK TWO REROLLS', price: 7, serves: [], habit: 'rerolls' }),
  bellwether: Object.freeze({ name: 'LUCKY COIN', rule: 'TWO MORE BELLS EACH CLEARED LEVEL', price: 9, serves: [] }),
  final_bow: Object.freeze({ name: 'LATE BLOOM', rule: 'LAST HAND ADDS FIVE TO SUM', price: 8, serves: ALL }),
  spare_knuckle: Object.freeze({ name: 'REWIND', rule: 'ONE MORE REROLL EACH LEVEL', price: 15, serves: [], habit: 'rerolls' }),
});

export const CARD_PRICE = Object.freeze({ x2_any: 4, x3_straight: 6, x3_pairs: 4, x3_trips: 5, joker: 6, refund: 4, x3_kinds: 5, x3_small: 4, x4_any: 9, x3_sixes: 5 });
export const UP_PRICE = Object.freeze({ pair: 6, two_pairs: 7, small_straight: 7, three_kind: 7, full_house: 8, four_kind: 8, straight: 10, five_kind: 10 });

// The act's second and fourth levels: 2, 4, 7, 9, 12…
export const doorAfter = (levelIndex) => (levelIndex - 1) % 5 === 1 || (levelIndex - 1) % 5 === 3;
export const bossNext = (levelIndex) => levelIndex % 5 === 4; // the door before a boss

// What a won level pays, each part named for its receipt.
export function levelBells(game) {
  const parts = {
    clear: 2,
    hand: 2 * game.handsLeft,
    reroll: game.rerollsLeft,
    boss: game.level.boss ? (BOSSES[game.level.boss].golden ? 8 : 3) : 0, // a golden keeper pays 5 more
    charm: (game.level.charms || []).includes('bellwether') ? 2 : 0,
  };
  return { ...parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
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

// The shelf after `levelIndex`, seeded: the same run and the same choices bring the same goods. run: { ups, charms };
// plays and habits ({ rerolls, holds, cards }, 0 to 1): how the player has played so far.
export function shopStock({ runSeed, levelIndex, run, plays = [], habits = {} }) {
  const rng = createRng(`${runSeed}/A${levelIndex}/shop`);
  const fit = fitWeights({ plays, ups: run.ups }, levelIndex);
  const sum = (cats) => cats.reduce((s, c) => s + fit[c].weight, 0) / Math.max(1, cats.length);
  const leaned = (cats) => cats.slice().sort((a, b) => fit[b].weight - fit[a].weight)[0];
  const kind = draw(rng, unlockedKinds(levelIndex), (k) => sum(cardCats(k)));
  const category = draw(rng, ALL, (c) => fit[c].weight);
  const free = Object.keys(CHARMS).filter((id) => !(run.charms || []).includes(id));
  const charmWeight = (id) => 4 + (CHARMS[id].serves.length ? sum(CHARMS[id].serves) : 0) + 12 * (habits[CHARMS[id].habit] || 0);
  const boss = bossNext(levelIndex) ? bossOf(runSeed, levelIndex + 1) : null;
  const counters = boss ? BOSSES[boss].counters.filter((id) => free.includes(id)) : [];
  const charm = free.length ? draw(rng, counters.length ? counters : free, charmWeight) : null;
  const habitTag = (h) => ({ rerolls: 'YOU SPEND REROLLS', holds: 'YOU HOLD DICE', cards: 'YOU KEEP CARDS' })[h];
  const charmTag = (id) => {
    const c = CHARMS[id];
    if (counters.includes(id)) return 'GOOD AGAINST KEEPER';
    if (c.habit && (habits[c.habit] || 0) >= 0.4) return habitTag(c.habit);
    return 'WILD OFFER'; // a charm names no hand, so a tag naming one would be a riddle over it (its weight still leans)
  };
  const stock = [
    { type: 'card', id: kind, price: CARD_PRICE[kind], tag: cardCats(kind).length < ALL.length ? fitTag(leaned(cardCats(kind)), fit) : 'WILD OFFER' },
    { type: 'up', id: category, price: UP_PRICE[category], tag: fitTag(category, fit) },
  ];
  if (charm) stock.push({ type: 'charm', id: charm, price: CHARMS[charm].price, tag: charmTag(charm) });
  return stock;
}

// Buys one good. run: { bells, bank, ups, charms }. A full bank or charm rail names the place the good replaces (the old
// one burns). Returns { ok, run, stock } or { ok: false, code, message }.
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
  } else if (good.type === 'up') {
    next.ups = withUpgrade(run.ups, good.id);
  } else {
    if (run.charms.length >= CHARM_SLOTS && replace === null) return reject('CHARMS_FULL', 'Replace a charm');
    next.charms = run.charms.length < CHARM_SLOTS ? [...run.charms, good.id] : run.charms.map((k, i) => (i === replace ? good.id : k));
  }
  return { ok: true, run: next, stock: stock.map((g, i) => (i === slot ? { ...g, sold: true } : g)) };
}

// A shopper for the bots: buys in this order while the bells last and a place is free. A strong player goes for what
// stays (the charm, the +1), a typical one takes the shelf as it comes.
export function sensibleShopping(run, stock, order = ['charm', 'up', 'card']) {
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
