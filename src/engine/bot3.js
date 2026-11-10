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

// The bonuses to switch: the board's and, from the level's first reroll, the kept ones still waiting above it.
const bonusCells = (game) => [
  ...game.cells.map((c, i) => i).filter((i) => isBonus(game, i)),
  ...(bankOpen(game) ? game.bank.map((b, k) => (b.used || b.placed ? -1 : BANK + k)).filter((i) => i >= 0) : []),
];
const isOff = (game, i) => (i >= BANK ? game.bank[i - BANK].off : game.off[i]);
// Only the any-hand multipliers are saved for a later hand: ×2 ANY, and the owl's ×4, which counts on the last hand only
// (10.11.2026). The joker is played as soon as it helps: it adds a face and does not multiply, so waiting gains nothing,
// and until it is played its cell holds no die (saved, it cost the greedy bot a die on two hands of three, and its joker
// board scored below nine plain dice).
const unconditional = (kind) => kind === 'x2_any' || kind === 'x4_any';

function setBonuses(game, wantOn) {
  for (const i of bonusCells(game)) {
    if (isOff(game, i) === wantOn(bonusKind(game, i))) {
      const r = toggleBonus(game, i);
      if (!r.ok) throw new Error(`bot produced an illegal bonus switch: ${r.code}`);
      game = r.state;
    }
  }
  return game;
}

function play(game, rng) {
  const r = playHand(game, () => rng.die());
  if (!r.ok) throw new Error(`bot produced an illegal play: ${r.code}`);
  return r.state;
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

// Greedy one-step lookahead (`hand`: experiment scoring options, passed to the engine as handOptions): for every hold mask of the dice, the exact expected best-hand
// total after one reroll; rerolls while the best mask beats the standing hand by `margin`.
// Bonus policy: conditional bonuses and the joker always on; ×2 any and the owl's ×4 on for the
// last hand, or earlier when the hand without them already totals `strong`. A missed target ends the run (owner,
// 03.11.2026), so it plays for the target the way a strong player would: a hand that reaches what the level still
// needs, with every bonus on, is played at once, and a hand on pace keeps its dice through a reroll.
const finishes = (game) => currentHand(setBonuses(game, () => true)).total >= game.level.target - game.score;

export function playGreedyBot3(level, { rng, config = {}, hand = null, margin = 20, strong = 150 } = {}) {
  let game = createAutoGame(level, hand ? { ...config, handOptions: hand } : config);
  while (game.phase === 'playing') {
    const last = game.handsLeft === 1;
    const policy = (kind) => last || !unconditional(kind);
    while (game.rerollsLeft > 0) {
      game = setBonuses(game, policy);
      if (finishes(game)) break;
      const ctx = contextFor(onKinds(game), handOptionsOf(game) ?? hand); // the run's upgrades, charms and boss too
      const cells = diceCells(game);
      const now = currentHand(game);
      const standing = now.total;
      // on pace for the target (a hand worth its share of what is left), it keeps the hand's dice and only adds to them
      const onPace = standing >= (game.level.target - game.score) / game.handsLeft;
      const cap = holdCap(game); // LOOSE GRIP: a hand larger than the cap cannot be kept whole
      const keep = onPace && now.cells.length <= cap ? cells.reduce((mask, c, k) => (now.cells.includes(c) ? mask | (1 << k) : mask), 0) : 0;
      let bestMask = -1;
      let bestEst = standing + margin;
      for (let m = 0; m < (1 << cells.length) - 1; m++) {
        if ((m & keep) !== keep) continue;
        let key = 0;
        let held = 0;
        for (let k = 0; k < cells.length; k++) if ((m >> k) & 1) { key += FACE_KEY[game.faces[cells[k]]]; held++; }
        if (held > cap) continue;
        const est = ctx.expected(key, cells.length - held);
        if (est > bestEst) { bestEst = est; bestMask = m; }
      }
      if (bestMask < 0) break;
      game = setHolds(game, new Set(cells.filter((c, k) => (bestMask >> k) & 1)));
      const r = reroll(game, () => rng.die());
      if (!r.ok) throw new Error(`bot produced an illegal reroll: ${r.code}`);
      game = r.state;
    }
    game = setBonuses(game, policy);
    // nothing to hold before playing: every die burns (owner, 03.11.2026), and with no holds the best plays
    if ((!last && currentHand(game).total >= strong) || (currentHand(game).total < game.level.target - game.score && finishes(game))) game = setBonuses(game, () => true);
    game = play(game, rng);
  }
  return result(game);
}
