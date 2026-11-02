import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playNaiveBot3, playGreedyBot3, expectedBest } from '../src/engine/bot3.js';
import { generateAutoLevel } from '../src/engine/levels3.js';
import { createAutoGame, currentHand, playHand, diceCells } from '../src/engine/auto.js';
import { createRng } from '../src/engine/rng.js';

const SIZE = { pair: 2, two_pairs: 4, small_straight: 4, three_kind: 3, four_kind: 4, full_house: 5, straight: 5, five_kind: 5 };
const levelsFor = (tier, n) => Array.from({ length: n }, (_, i) => generateAutoLevel({ runSeed: `bot3/t${tier}/r${i}`, levelIndex: tier + (i % 8), tier }));

test('auto bots play legal levels: up to three hands (the target ends it), hands of the right size, used bonuses become holes', () => {
  for (let tier = 1; tier <= 5; tier++) {
    const rng = createRng(`bot3-legal-${tier}`);
    for (const [k, level] of levelsFor(tier, 6).entries()) {
      const { state: st, score, won } = k % 2 ? playGreedyBot3(level, { rng }) : playNaiveBot3(level, { rng });
      assert.ok(['won', 'lost'].includes(st.phase));
      assert.equal(st.hands.length + st.handsLeft, 3);
      assert.ok(st.handsLeft === 0 || (won && score >= level.target)); // early only on a win
      assert.equal(score, st.hands.reduce((s, h) => s + h.total, 0));
      assert.equal(won, score >= level.target);
      assert.ok(st.rerollsLeft >= 0 && st.rerollsLeft <= 3);
      for (const h of st.hands) {
        assert.equal(h.cells.length + h.jokerCells.length, SIZE[h.category]);
        for (const i of [...h.bonusCells, ...h.jokerCells]) assert.equal(st.cells[i].type, 'hole');
      }
      assert.ok(diceCells(st).length >= 6);
      assert.ok(diceCells(st).every((i) => Number.isInteger(st.faces[i]) && st.faces[i] >= 1 && st.faces[i] <= 6));
    }
  }
});

test('auto bots are deterministic for a seed', () => {
  const level = generateAutoLevel({ runSeed: 'bot3-det', levelIndex: 6, tier: 3 });
  for (const bot of [playNaiveBot3, playGreedyBot3]) {
    const a = bot(level, { rng: createRng('same') });
    const b = bot(level, { rng: createRng('same') });
    assert.deepEqual(a.state, b.state);
  }
});

test('the greedy bot scores at least as much as the naive bot on average and uses bonuses', () => {
  let naive = 0;
  let greedy = 0;
  let bonusHands = 0;
  for (let tier = 1; tier <= 5; tier++) {
    const rn = createRng(`bot3-cmp-n-${tier}`);
    const rg = createRng(`bot3-cmp-g-${tier}`);
    for (const level of levelsFor(tier, 10)) {
      naive += playNaiveBot3(level, { rng: rn }).score;
      const g = playGreedyBot3(level, { rng: rg });
      greedy += g.score;
      bonusHands += g.state.hands.filter((h) => h.bonuses.length > 0).length;
    }
  }
  assert.ok(greedy >= naive, `greedy ${greedy} < naive ${naive}`);
  assert.ok(bonusHands >= 25, `greedy used bonuses on ${bonusHands} hands only`);
});

test('experiment scoring options reach the engine through config.handOptions', () => {
  // 1 2 3 4 5 5 5 1 + a block: the straight (15 × 8) wins under the rules, the full house (85) with the Poker 5 straight ×5
  const level = { seed: 'opt', levelIndex: 1, tier: 1, target: 100, hands: 3, rerolls: 3, faces: [1, 2, 3, 4, 5, 5, 5, 1, null], layout: [...Array(8).fill({ type: 'die' }), { type: 'block' }] };
  assert.equal(currentHand(createAutoGame(level)).category, 'straight');
  const g = createAutoGame(level, { handOptions: { straightMult: 5 } });
  assert.equal(currentHand(g).category, 'full_house');
  assert.equal(playHand(g, () => 6).hand.total, 85);
  const greedy = playGreedyBot3(level, { rng: createRng('opt'), hand: { straightMult: 5 } });
  assert.deepEqual(greedy.state.config.handOptions, { straightMult: 5 });
});

test('exact hold EVs reproduce the 8-dice enumeration of RESEARCH-BALATRO §5.2 (pips with the straight ×5)', () => {
  const pips = { hand: { straightMult: 5 } };
  assert.equal(expectedBest([6, 6, 6], 5, pips).toFixed(1), '154.3');
  assert.equal(expectedBest([6, 6], 6, pips).toFixed(1), '123.2');
  assert.equal(expectedBest([2, 3, 4, 5], 4, pips).toFixed(1), '94.1');
  assert.equal(expectedBest([2, 3, 4, 5], 4, { hand: { straightMult: 8 } }).toFixed(1), '135.1');
  assert.equal(expectedBest([3, 4, 5, 6], 4, { hand: { straightMult: 10 } }).toFixed(1), '150.2'); // 150.0 there, before the small straight
  assert.equal(expectedBest([2, 3, 4, 5], 4).toFixed(1), '135.1'); // the rules now: straight ×8
});
