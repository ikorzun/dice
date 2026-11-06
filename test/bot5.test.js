import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playNaiveBot5, playGreedyBot5 } from '../src/engine/bot5.js';
import { generatePokerLevel, TIERS5 } from '../src/engine/levels5.js';
import { createPokerGame, bestSnake } from '../src/engine/poker.js';
import { nextTier } from '../src/engine/levels.js';
import { createRng } from '../src/engine/rng.js';

test('poker bot sessions: legal banks only, three hands, nine dice kept, x2 once, no repeated boards', () => {
  const rng = createRng('poker-bot-session');
  let tier = 1;
  const boards = new Set();
  let wins = 0;
  for (let i = 1; i <= 30; i++) {
    const level = generatePokerLevel({ runSeed: 'poker-run', levelIndex: i, tier, config: { hands: 3, rerolls: 3, bonusIndex: i % 3 === 0 ? null : 8 } });
    const key = level.faces.join('');
    assert.ok(!boards.has(key), `level ${i} repeats a board`);
    boards.add(key);
    assert.equal(level.target, TIERS5[tier].target);
    assert.ok(level.openingBest <= level.target * TIERS5[tier].openingMax || level.fallback, 'opening snake must not already win');
    const res = i % 2 ? playNaiveBot5(level, { rng }) : playGreedyBot5(level, { rng, samples: 4 });
    const st = res.state;
    assert.ok(['won', 'lost'].includes(st.phase));
    assert.equal(st.hands.length + st.handsLeft, 3);
    if (st.phase === 'lost') assert.equal(st.handsLeft, 0);
    if (st.handsLeft > 0) assert.ok(st.score >= level.target, 'an early end only on reaching the target');
    assert.ok(st.faces.every((f, k) => (k === st.bonusIndex ? f === null : Number.isInteger(f) && f >= 1 && f <= 6)), 'all ordinary dice remain after refills');
    assert.equal(st.score, st.hands.reduce((s, h) => s + h.total, 0));
    assert.ok(st.hands.filter((h) => h.multiplier > 1).length <= 1, 'x2 used at most once');
    if (st.handsLeft === 0) assert.equal(st.hands.filter((h) => h.multiplier > 1).length, 1, 'x2 used exactly once when all hands are played');
    assert.ok(st.rerollsLeft >= 0 && st.rerollsLeft <= 3);
    for (const h of st.hands) {
      assert.equal(h.cells.length, 5);
      assert.equal(new Set(h.cells).size, 5);
    }
    if (res.won) wins++;
    tier = nextTier(tier, res.won);
  }
  assert.ok(wins >= 10, `bots should clear a fair share, won ${wins}/30`);
});

test('generator is deterministic and the hint reproduces the opening best', () => {
  const a = generatePokerLevel({ runSeed: 'det', levelIndex: 2, tier: 3 });
  const b = generatePokerLevel({ runSeed: 'det', levelIndex: 2, tier: 3 });
  assert.deepEqual(a, b);
  assert.equal(bestSnake(createPokerGame(a)).points, a.openingBest);
});
