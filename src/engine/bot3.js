// Bots for the Auto Hand mode (balancing only). Both play through the public engine and
// switch on the bonuses they want (a bonus may start switched off; a reroll clears holds and
// switches bonuses off, so the bots set both again before every reroll and before playing). The best hand depends
// only on the multiset of faces and the kinds of the bonuses that are on, so the greedy bot
// scores a board by its face counts and memoizes; its lookahead is exact, not sampled.

import { createAutoGame, toggleHold, toggleBonus, reroll, currentHand, boardHand, playHand, diceCells, isBonus } from './auto.js';
import { bestHand, BONUS_KINDS } from './hands.js';

// Release unwanted holds first, then hold the rest (same shape as bot5.setHolds).
export function setHolds(game, keep) {
  for (const i of diceCells(game)) if (game.held[i] && !keep.has(i)) game = toggleHold(game, i).state;
  for (const i of diceCells(game)) if (!game.held[i] && keep.has(i)) game = toggleHold(game, i).state;
  return game;
}

const bonusCells = (game) => game.cells.map((c, i) => i).filter((i) => isBonus(game, i));
const unconditional = (kind) => kind === 'x2_any' || BONUS_KINDS[kind].wild;

function setBonuses(game, wantOn) {
  for (const i of bonusCells(game)) {
    if (game.off[i] === wantOn(game.cells[i].kind)) {
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

// Face counts as a base-9 number (at most eight dice, so a count never carries): adding two
// keys adds the multisets.
const FACE_KEY = [0, 1, 9, 81, 729, 6561, 59049];
const fact = (n) => (n < 2 ? 1 : n * fact(n - 1));

// Every multiset of k rerolled dice with its probability.
const OUTCOMES = Array.from({ length: 9 }, (_, k) => {
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

const onKinds = (game) => bonusCells(game).filter((i) => !game.off[i]).map((i) => game.cells[i].kind);

// Greedy one-step lookahead (`hand`: experiment scoring options, passed to the engine as handOptions): for every hold mask of the dice, the exact expected best-hand
// total after one reroll; rerolls while the best mask beats the standing hand by `margin`.
// Bonus policy: conditional bonuses always on; unconditional ones (×2 any, joker) on for the
// last hand, or earlier when the hand without them already totals `strong`.
export function playGreedyBot3(level, { rng, config = {}, hand = null, margin = 20, strong = 150 } = {}) {
  let game = createAutoGame(level, hand ? { ...config, handOptions: hand } : config);
  while (game.phase === 'playing') {
    const last = game.handsLeft === 1;
    const policy = (kind) => last || !unconditional(kind);
    let keep = null;
    while (game.rerollsLeft > 0) {
      game = setBonuses(game, policy);
      const ctx = contextFor(onKinds(game), hand);
      const cells = diceCells(game);
      const standing = currentHand(game).total;
      let bestMask = -1;
      let bestEst = standing + margin;
      for (let m = 0; m < (1 << cells.length) - 1; m++) {
        let key = 0;
        let held = 0;
        for (let k = 0; k < cells.length; k++) if ((m >> k) & 1) { key += FACE_KEY[game.faces[cells[k]]]; held++; }
        const est = ctx.expected(key, cells.length - held);
        if (est > bestEst) { bestEst = est; bestMask = m; }
      }
      if (bestMask < 0) break;
      keep = new Set(cells.filter((c, k) => (bestMask >> k) & 1));
      game = setHolds(game, keep);
      const r = reroll(game, () => rng.die());
      if (!r.ok) throw new Error(`bot produced an illegal reroll: ${r.code}`);
      game = r.state;
    }
    game = setBonuses(game, policy);
    // hold the keepers again (unheld dice burn on play) with the best hand's dice, so the best plays
    if (keep) game = setHolds(game, new Set([...keep, ...boardHand(game).cells]));
    if (!last && currentHand(game).total >= strong) game = setBonuses(game, () => true);
    game = play(game, rng);
  }
  return result(game);
}
