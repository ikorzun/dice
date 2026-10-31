// Bots for the Poker 5 mode (balancing only). Both bank the best-scoring snake; they differ
// in how they decide to reroll. Holds are chosen around the best snake's scoring dice.

import { createPokerGame, toggleHold, reroll, toggleBonus, bankPath, bestSnake, rankSnakes } from './poker.js';
import { orderedPathsOf, cellsOf, popcount } from './geometry.js';
import { resolveTable5, classify5 } from './scoring5.js';

function coreCells(hand) {
  const counts = {};
  for (const f of hand.faces) counts[f] = (counts[f] || 0) + 1;
  if (hand.category === 'straight' || hand.category === 'small_straight' || hand.category === 'five_kind' || hand.category === 'four_kind' || hand.category === 'full_house') return hand.cells;
  if (hand.category === 'bust') return [];
  return hand.cells.filter((c, k) => counts[hand.faces[k]] >= 2);
}

// Release unwanted holds first so a hold cap never drops the dice the bot decided to keep.
export function setHolds(game, keep) {
  for (const i of game.geometry.free) {
    if (game.held[i] && !keep.has(i)) {
      const r = toggleHold(game, i);
      if (r.ok) game = r.state;
    }
  }
  for (const i of game.geometry.free) {
    if (!game.held[i] && keep.has(i)) {
      const r = toggleHold(game, i);
      if (r.ok) game = r.state;
    }
  }
  return game;
}

function bankBest(game, rng, useBonus) {
  const best = bestSnake(game);
  if (useBonus && game.bonus.available && !game.bonus.armed) {
    const b = toggleBonus(game);
    if (b.ok) game = b.state;
  }
  const r = bankPath(game, orderedPathsOf(best.cells)[0], () => rng.die());
  if (!r.ok) throw new Error(`bot produced an illegal bank: ${r.code}`);
  return r.state;
}

// Naive: reroll while the best snake is weak and rerolls remain, keeping the scoring dice;
// spends the ×2 on the first hand worth at least `bonusThreshold` points, else on the last hand.
export function playNaiveBot5(level, { rng, config = {}, rerollBelow = 10, bonusThreshold = 20 } = {}) {
  let game = createPokerGame(level, config);
  while (game.phase === 'playing') {
    let best = bestSnake(game);
    while (game.rerollsLeft > 0 && best.points < rerollBelow) {
      game = setHolds(game, new Set(coreCells(best)));
      const r = reroll(game, () => rng.die());
      if (!r.ok) break;
      game = r.state;
      best = bestSnake(game);
    }
    game = bankBest(game, rng, best.points >= bonusThreshold || game.handsLeft === 1);
  }
  return { score: game.score, won: game.phase === 'won', rerollsUsed: game.stats.rerollsUsed, state: game };
}

// Greedy one-step lookahead: estimates, for every hold mask, the expected best-snake points
// after one reroll (sampled) and rerolls when the gain beats `margin`; otherwise banks.
export function playGreedyBot5(level, { rng, config = {}, samples = 12, margin = 2, bonusThreshold = 25 } = {}) {
  let game = createPokerGame(level, config);
  const table = resolveTable5(game.config.scoreTable);
  const opts = { smallStraight: game.config.smallStraight };
  const sets = game.geometry.eligibleMasks.map((m) => cellsOf(m));
  const scratch = new Array(9);
  const bestPoints = (faces) => {
    let best = -1;
    for (const cells of sets) {
      const p = table[classify5([faces[cells[0]], faces[cells[1]], faces[cells[2]], faces[cells[3]], faces[cells[4]]], opts)];
      if (p > best) best = p;
    }
    return best;
  };
  while (game.phase === 'playing') {
    let best = bestSnake(game);
    while (game.rerollsLeft > 0) {
      const standing = best.points;
      let bestMask = -1;
      let bestEst = standing + margin;
      for (let m = 0; m < 511; m++) {
        if (game.bonusIndex != null && (m >> game.bonusIndex) & 1) continue;
        if (game.config.maxHolds != null && popcount(m) > game.config.maxHolds) continue;
        let sum = 0;
        for (let s = 0; s < samples; s++) {
          for (let i = 0; i < 9; i++) scratch[i] = i === game.bonusIndex || (m >> i) & 1 || ((game.sealedMask >> i) & 1) ? game.faces[i] : rng.die();
          sum += bestPoints(scratch);
        }
        const est = sum / samples;
        if (est > bestEst) { bestEst = est; bestMask = m; }
      }
      if (bestMask < 0) break;
      game = setHolds(game, new Set(cellsOf(bestMask)));
      const r = reroll(game, () => rng.die());
      if (!r.ok) break;
      game = r.state;
      best = bestSnake(game);
    }
    game = bankBest(game, rng, best.points >= bonusThreshold || game.handsLeft === 1);
  }
  return { score: game.score, won: game.phase === 'won', rerollsUsed: game.stats.rerollsUsed, state: game };
}

export { rankSnakes };
