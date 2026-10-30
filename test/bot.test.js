import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playGreedyBot } from '../src/engine/bot.js';
import { generateLevel, nextTier } from '../src/engine/levels.js';
import { createRng } from '../src/engine/rng.js';

test('scripted bot sessions: legal banking only, all dice consumed, scores consistent, no repeated levels', () => {
  const rng = createRng('bot-session');
  let tier = 1;
  const boards = new Set();
  let wins = 0;
  for (let i = 1; i <= 40; i++) {
    const lvl = generateLevel({ runSeed: 'bot-run', levelIndex: i, tier });
    const key = lvl.faces.join('');
    assert.ok(!boards.has(key));
    boards.add(key);
    const res = playGreedyBot(lvl, { rng, samples: 8 });
    const st = res.state;
    assert.equal(st.hands.length, 2);
    assert.equal(st.bankedMask, st.geometry.freeMask);
    assert.equal(st.score, st.hands[0].total + st.hands[1].total);
    assert.equal(st.hands.filter((h) => h.multiplier > 1).length, 1, 'x2 used exactly once');
    assert.ok(st.rerollsLeft >= 0 && st.rerollsLeft <= 2);
    assert.ok(res.score >= lvl.bestNoRerollWithBonus * 0 && res.score <= 90);
    if (res.won) wins++;
    tier = nextTier(tier, res.won);
  }
  assert.ok(wins > 5, `bot should win a reasonable share, won ${wins}/40`);
});

test('bot with the hold-cap experiment respects the cap', () => {
  const rng = createRng('bot-cap');
  const lvl = generateLevel({ runSeed: 'cap', levelIndex: 1, tier: 3 });
  const res = playGreedyBot(lvl, { rng, samples: 8, config: { maxHolds: 3 } });
  for (const d of res.decisions) {
    let n = 0;
    for (let m = d.mask; m; m &= m - 1) n++;
    assert.ok(n <= 3);
  }
  assert.equal(res.state.hands.length, 2);
});
