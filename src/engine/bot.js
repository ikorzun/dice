// Greedy one-step-lookahead bot used for balancing simulations and scripted session tests.
// For every hold mask it estimates (by sampling) the expected best two-hand score after one
// reroll, applies the best mask if it beats standing pat, then banks the exact optimum.
// It is a "competent player" proxy, not an optimal policy.

import { createGame, reroll, toggleHold, toggleBonus, bankPath } from './game.js';
import { makeFastEvaluator } from './solver.js';
import { solveBoard } from './solver.js';
import { orderedPathsOf, popcount } from './geometry.js';

export function playGreedyBot(level, { rng, samples = 24, config = {} } = {}) {
  let game = createGame(level, config);
  const { geometry } = game;
  const free = geometry.free;
  const evaluator = makeFastEvaluator(geometry, game.config.scoreTable, game.config.bonusMultiplier);
  const maxHolds = game.config.maxHolds;
  const scratch = game.faces.slice();
  const decisions = [];

  while (game.rerollsLeft > 0) {
    const standing = evaluator.maxWithBonus(game.faces);
    let bestMask = -1;
    let bestEst = standing;
    const allHeld = (1 << free.length) - 1;
    for (let m = 0; m < allHeld; m++) {
      if (maxHolds != null && popcount(m) > maxHolds) continue;
      let sum = 0;
      for (let s = 0; s < samples; s++) {
        for (let k = 0; k < free.length; k++) {
          const cell = free[k];
          scratch[cell] = (m >> k) & 1 ? game.faces[cell] : rng.die();
        }
        sum += evaluator.maxWithBonus(scratch);
      }
      const est = sum / samples;
      if (est > bestEst + 1e-9) {
        bestEst = est;
        bestMask = m;
      }
    }
    if (bestMask < 0) break;
    for (let k = 0; k < free.length; k++) if (game.held[free[k]] && !((bestMask >> k) & 1)) { const r = toggleHold(game, free[k]); if (r.ok) game = r.state; }
    for (let k = 0; k < free.length; k++) if (!game.held[free[k]] && ((bestMask >> k) & 1)) { const r = toggleHold(game, free[k]); if (r.ok) game = r.state; }
    const r = reroll(game, () => rng.die());
    if (!r.ok) break;
    game = r.state;
    decisions.push({ mask: bestMask, expected: bestEst, standing });
  }

  const solved = solveBoard(game.faces, geometry, game.config.scoreTable, { bonusMultiplier: game.config.bonusMultiplier });
  const row = solved.bestBonus;
  const order = [row.hands[row.bonusHand], row.hands[1 - row.bonusHand]];
  for (let h = 0; h < 2; h++) {
    if (h === 0) {
      const b = toggleBonus(game);
      if (b.ok) game = b.state;
    }
    const path = orderedPathsOf(order[h].cells)[0];
    const r = bankPath(game, path);
    if (!r.ok) throw new Error(`bot produced an illegal bank: ${r.code} ${r.message}`);
    game = r.state;
  }
  return {
    score: game.score,
    won: game.phase === 'won',
    rerollsUsed: game.stats.rerollsUsed,
    decisions,
    finalFaces: game.faces,
    state: game,
  };
}

// Naive "human proxy" bot: keeps whatever already scores in the best current partition
// (pairs, trips, two pairs, straights, four of a kind), rerolls everything else, always
// spends both rerolls, then banks the exact optimum with ×2 on the better hand.
// It never plans around the spatial layout, which is the typical first-session behaviour.
export function playNaiveBot(level, { rng, config = {} } = {}) {
  let game = createGame(level, config);
  const { geometry } = game;
  const table = game.config.scoreTable;
  const opts = { bonusMultiplier: game.config.bonusMultiplier };

  const keepCells = (hand) => {
    const counts = {};
    for (const f of hand.faces) counts[f] = (counts[f] || 0) + 1;
    if (hand.category === 'high') return [];
    if (hand.category === 'straight' || hand.category === 'four_kind' || hand.category === 'two_pairs') return hand.cells;
    return hand.cells.filter((c, k) => counts[hand.faces[k]] >= 2);
  };

  while (game.rerollsLeft > 0) {
    const solved = solveBoard(game.faces, geometry, table, opts);
    const row = solved.bestBonus;
    const keep = new Set([...keepCells(row.hands[0]), ...keepCells(row.hands[1])]);
    for (const cell of geometry.free) if (game.held[cell] && !keep.has(cell)) { const r = toggleHold(game, cell); if (r.ok) game = r.state; }
    for (const cell of geometry.free) if (!game.held[cell] && keep.has(cell)) { const r = toggleHold(game, cell); if (r.ok) game = r.state; }
    let heldNow = 0;
    for (const cell of geometry.free) if (game.held[cell]) heldNow++;
    if (heldNow === geometry.free.length) break;
    const r = reroll(game, () => rng.die());
    if (!r.ok) break;
    game = r.state;
  }

  const solved = solveBoard(game.faces, geometry, table, opts);
  const row = solved.bestBonus;
  const order = [row.hands[row.bonusHand], row.hands[1 - row.bonusHand]];
  for (let h = 0; h < 2; h++) {
    if (h === 0) {
      const b = toggleBonus(game);
      if (b.ok) game = b.state;
    }
    const r = bankPath(game, orderedPathsOf(order[h].cells)[0]);
    if (!r.ok) throw new Error(`naive bot produced an illegal bank: ${r.code}`);
    game = r.state;
  }
  return { score: game.score, won: game.phase === 'won', rerollsUsed: game.stats.rerollsUsed, state: game };
}
