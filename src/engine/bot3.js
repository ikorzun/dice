// Bots for the Auto Hand mode (balancing only). Both play through the public engine and
// switch on the bonuses they want (a bonus may start switched off; a reroll clears holds and
// switches bonuses off, so the bots set both again before every reroll and before playing). The best hand depends
// only on the multiset of faces and the kinds of the bonuses that are on, so the greedy bot
// scores a board by its face counts and memoizes; its lookahead is exact, not sampled.

import { createAutoGame, toggleHold, toggleBonus, reroll, currentHand, playHand, diceCells, isBonus, bonusKind, bankOpen, handOptionsOf, awake, holdCap, BANK } from './auto.js';
import { bestHand } from './hands.js';

// Release unwanted holds first, then hold the rest (same shape as bot5.setHolds); under LOOSE GRIP the first three only.
export function setHolds(game, keep) {
  const wanted = new Set([...keep].slice(0, holdCap(game)));
  for (const i of diceCells(game)) if (game.held[i] && !wanted.has(i)) game = toggleHold(game, i).state;
  for (const i of diceCells(game)) if (!game.held[i] && wanted.has(i)) game = toggleHold(game, i).state;
  return game;
}

const must = (r, what) => {
  if (!r.ok) throw new Error(`bot produced an illegal ${what}: ${r.code}`);
  return r.state;
};
// The kept cards still waiting above the board.
const waitingCards = (game) => game.bank.map((b, k) => (b.used || b.placed ? -1 : BANK + k)).filter((i) => i >= 0);
// The bonuses to switch: the board's and, while the board holds no card, the kept ones still waiting above it.
const bonusCells = (game) => [...game.cells.map((c, i) => i).filter((i) => isBonus(game, i)), ...(bankOpen(game) ? waitingCards(game) : [])];
const isOff = (game, i) => (i >= BANK ? game.bank[i - BANK].off : game.off[i]);
// Only the any-hand multipliers are saved for a later hand: ×2 ANY, and the owl's ×4, which counts on the last hand only
// (10.11.2026). The joker is played as soon as it helps: it adds a face and does not multiply, so waiting gains nothing,
// and until it is played its cell holds no die (saved, it cost the greedy bot a die on two hands of three, and its joker
// board scored below nine plain dice).
const unconditional = (kind) => kind === 'x2_any' || kind === 'x4_any';

// Every way to switch the cards (owner, 17.11.2026, «На поле одна»: one card on the board for a hand, the bank's playing
// from the row while the board holds none, one at a time): the board's as `wantOn(kind, cell)` says, and of the bank's that
// it wants, each alone, or none when it wants none.
function cardChoices(game, wantOn) {
  for (const i of game.cells.map((c, k) => k).filter((k) => isBonus(game, k))) {
    if (game.off[i] === wantOn(game.cells[i].kind, i)) game = must(toggleBonus(game, i), 'bonus switch');
  }
  if (!bankOpen(game)) return [game];
  for (const i of waitingCards(game)) if (!isOff(game, i)) game = must(toggleBonus(game, i), 'bonus switch');
  const wanted = waitingCards(game).filter((i) => wantOn(bonusKind(game, i), i));
  return wanted.length ? wanted.map((i) => must(toggleBonus(game, i), 'bonus switch')) : [game];
}
const handTotal = (game) => (currentHand(game) || { total: 0 }).total;
// The switch that makes the best hand now (the run's script lets its lazy player switch the same way).
export const setBonuses = (game, wantOn) => cardChoices(game, wantOn).reduce((a, b) => (handTotal(b) > handTotal(a) ? b : a));

function play(game, rng) {
  // a hand of five that counts more held (SOLID HOLD) is held before PLAY, as a player reading the counter would
  const opts = handOptionsOf(game);
  if (opts && opts.rules && (opts.rules.ups || []).some((u) => u.held)) {
    const now = currentHand(game);
    const held = now && now.cells.length === 5 ? setHolds(game, new Set(now.cells)) : game;
    if (held !== game && currentHand(held).total > now.total) game = held;
  }
  return must(playHand(game, () => rng.die()), 'play');
}

const result = (game) => ({ score: game.score, won: game.phase === 'won', rerollsUsed: game.stats.rerollsUsed, state: game });

// Naive: every bonus on; while rerolls cover the hands left, hold exactly the best hand's dice
// and reroll once; then play. Under 3 hands / 3 rerolls that is one reroll per hand.
export function playNaiveBot3(level, { rng, config = {} } = {}) {
  let game = createAutoGame(level, config);
  while (game.phase === 'playing') {
    game = setBonuses(game, () => true);
    if (game.rerollsLeft >= game.handsLeft) {
      game = setHolds(game, new Set(currentHand(game).cells));
      const r = reroll(game, () => rng.die());
      if (r.ok) game = setBonuses(r.state, () => true);
    }
    game = play(game, rng);
  }
  return result(game);
}

// Face counts as a base-10 number (at most nine dice: a played card makes way for a new die, owner
// 03.11.2026; a count never carries): adding two keys adds the multisets.
const FACE_KEY = [0, 1, 10, 100, 1000, 10000, 100000];
const fact = (n) => (n < 2 ? 1 : n * fact(n - 1));

// Every multiset of k rerolled dice with its probability.
const OUTCOMES = Array.from({ length: 10 }, (_, k) => {
  const list = [];
  const walk = (face, left, key, weight) => {
    if (face === 6) { list.push({ key: key + left * FACE_KEY[6], p: weight / fact(left) / 6 ** k }); return; }
    for (let c = 0; c <= left; c++) walk(face + 1, left - c, key + c * FACE_KEY[face], weight / fact(c));
  };
  walk(1, k, 0, fact(k));
  return list;
});

function facesOfKey(key) {
  const dice = [];
  for (let f = 6; f >= 1; f--) {
    const c = Math.floor(key / FACE_KEY[f]);
    key -= c * FACE_KEY[f];
    for (let n = 0; n < c; n++) dice.push({ cell: dice.length, face: f, held: false });
  }
  return dice;
}

// One memo per (scoring options, kinds of the bonuses that are on).
const contexts = new Map();
function contextFor(kinds, hand) {
  const id = `${JSON.stringify(hand ?? {})}|${[...kinds].sort().join(',')}`;
  let ctx = contexts.get(id);
  if (!ctx) {
    const bonuses = kinds.map((kind, k) => ({ cell: 9 + k, kind }));
    const values = new Map();
    const value = (key) => {
      let v = values.get(key);
      if (v === undefined) {
        const best = bestHand(facesOfKey(key), bonuses, hand ?? undefined);
        v = best ? best.total : 0;
        values.set(key, v);
      }
      return v;
    };
    const evs = new Map();
    const expected = (heldKey, k) => {
      const id2 = heldKey * 16 + k;
      let e = evs.get(id2);
      if (e === undefined) {
        e = 0;
        for (const o of OUTCOMES[k]) e += o.p * value(heldKey + o.key);
        evs.set(id2, e);
      }
      return e;
    };
    ctx = { value, expected };
    contexts.set(id, ctx);
  }
  return ctx;
}

// Exact expected best-hand total after rerolling `rerolled` dice next to `heldFaces`, with
// `kinds` on (used by the report for the hold-plan comparison too).
export function expectedBest(heldFaces, rerolled, { kinds = [], hand = null } = {}) {
  return contextFor(kinds, hand).expected(heldFaces.reduce((s, f) => s + FACE_KEY[f], 0), rerolled);
}

const onKinds = (game) => bonusCells(game).filter((i) => !isOff(game, i)).map((i) => bonusKind(game, i)).filter((kind) => awake(game, kind));
// The lookahead counts multisets of faces, which have no cells: a rule bound to a cell (CENTER KNIGHT) is left out of its
// estimates, and the hand played still counts it.
const unplaced = (opts) => (opts && opts.rules && (opts.rules.cells || []).length ? { ...opts, rules: { ...opts.rules, cells: [] } } : opts);

// Greedy one-step lookahead (`hand`: experiment scoring options, passed to the engine as handOptions): for every hold mask of the dice, the exact expected best-hand
// total after one reroll; rerolls while the best mask beats the standing hand by `margin`.
// Bonus policy: conditional bonuses and the joker always on; ×2 any and the owl's ×4 on for the
// last hand, or earlier when the hand without them already totals `strong`. A missed target ends the run (owner,
// 03.11.2026), so it plays for the target the way a strong player would: a hand that reaches what the level still
// needs, with every bonus on, is played at once, and a hand on pace keeps its dice through a reroll.
// One card a hand (17.11.2026): of the kept cards it may switch on, it takes the one whose best hold promises most, and a
// card on the board that would keep the bank shut (an any-hand one saved for later) goes on while kept cards wait.
const finishes = (game) => currentHand(setBonuses(game, () => true)).total >= game.level.target - game.score;

// The best hold for one reroll with the cards that are on: { mask, est, cells }, mask -1 when the standing hand is better.
function lookahead(game, hand, margin) {
  const ctx = contextFor(onKinds(game), unplaced(handOptionsOf(game)) ?? hand); // the run's upgrades, things and boss too
  const cells = diceCells(game);
  const now = currentHand(game);
  const standing = now.total;
  // on pace for the target (a hand worth its share of what is left), it keeps the hand's dice and only adds to them
  const onPace = standing >= (game.level.target - game.score) / game.handsLeft;
  const cap = holdCap(game); // LOOSE GRIP: a hand larger than the cap cannot be kept whole
  const keep = onPace && now.cells.length <= cap ? cells.reduce((mask, c, k) => (now.cells.includes(c) ? mask | (1 << k) : mask), 0) : 0;
  let mask = -1;
  let est = standing + margin;
  for (let m = 0; m < (1 << cells.length) - 1; m++) {
    if ((m & keep) !== keep) continue;
    let key = 0;
    let held = 0;
    for (let k = 0; k < cells.length; k++) if ((m >> k) & 1) { key += FACE_KEY[game.faces[cells[k]]]; held++; }
    if (held > cap) continue;
    const e = ctx.expected(key, cells.length - held);
    if (e > est) { est = e; mask = m; }
  }
  return { mask, est, cells };
}

export function playGreedyBot3(level, { rng, config = {}, hand = null, margin = 20, strong = 150 } = {}) {
  let game = createAutoGame(level, hand ? { ...config, handOptions: hand } : config);
  while (game.phase === 'playing') {
    const last = game.handsLeft === 1;
    const policy = (kind, i) => last || !unconditional(kind) || (i < BANK && waitingCards(game).length > 0);
    while (game.rerollsLeft > 0) {
      if (finishes(game)) break;
      let pick = null;
      for (const g of cardChoices(game, policy)) {
        const plan = lookahead(g, hand, margin);
        if (!pick || plan.est > pick.plan.est) pick = { g, plan };
      }
      game = pick.g;
      if (pick.plan.mask < 0) break;
      game = setHolds(game, new Set(pick.plan.cells.filter((c, k) => (pick.plan.mask >> k) & 1)));
      game = must(reroll(game, () => rng.die()), 'reroll');
    }
    game = setBonuses(game, policy);
    // nothing to hold before playing: every die burns (owner, 03.11.2026), and with no holds the best plays
    if ((!last && currentHand(game).total >= strong) || (currentHand(game).total < game.level.target - game.score && finishes(game))) game = setBonuses(game, () => true);
    game = play(game, rng);
  }
  return result(game);
}
