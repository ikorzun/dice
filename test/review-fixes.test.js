import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPokerGame, hintFor as pokerHint, bankPath as pokerBank, toggleBonus as pokerToggleBonus, toggleHold as pokerToggleHold } from '../src/engine/poker.js';
import { createGame, bankPath as snakeBank } from '../src/engine/game.js';
import { setHolds } from '../src/engine/bot5.js';

const seq = (values) => { let k = 0; return () => values[k++ % values.length]; };
const faces9 = [5, 5, 5, 2, 5, 3, 6, 6, 1];
const pokerLevel = (extra = {}) => ({ seed: 'rf', levelIndex: 1, tier: 1, faces: faces9, bonusIndex: null, target: 100, hands: 3, rerolls: 3, ...extra });

test('ENG-1: the poker hint projects exactly what banking its path scores', () => {
  for (const auto of [true, false]) {
    let g = createPokerGame(pokerLevel(), { autoBonusOnFinalHand: auto });
    while (g.phase === 'playing') {
      const h = pokerHint(g);
      const r = pokerBank(g, h.cells, seq([2, 3, 4]));
      assert.equal(h.projected, r.state.score, `auto=${auto} hand ${g.hands.length + 1}`);
      assert.equal(h.useBonus, !auto && g.handsLeft === 1 && g.bonus.available);
      g = r.state;
    }
  }
  let armed = createPokerGame(pokerLevel());
  armed = pokerToggleBonus(armed).state;
  const h = pokerHint(armed);
  assert.equal(h.projected, pokerBank(armed, h.cells, seq([1])).state.score);
  assert.equal(h.useBonus, false, 'already armed: nothing to recommend');
});

test('ENG-2: banked hand faces are aligned with the traced cells in both engines', () => {
  const p = pokerBank(createPokerGame(pokerLevel()), [4, 5, 2, 1, 0], seq([1]));
  assert.deepEqual(p.hand.cells, [4, 5, 2, 1, 0]);
  assert.deepEqual(p.hand.faces, [5, 3, 5, 5, 5]);
  const s = snakeBank(createGame({ seed: 's', levelIndex: 1, tier: 1, bonusIndex: 8, faces: [1, 2, 3, 4, 5, 6, 1, 2, null], target: 10, rerolls: 2 }), [5, 2, 1, 0]);
  assert.deepEqual(s.hand.cells, [5, 2, 1, 0]);
  assert.deepEqual(s.hand.faces, [6, 3, 2, 1]);
});

test('ENG-3: setHolds under a hold cap keeps exactly the wanted dice', () => {
  let g = createPokerGame(pokerLevel(), { maxHolds: 3 });
  g = setHolds(g, new Set([6, 7, 8]));
  assert.deepEqual(g.held.map((h, i) => (h ? i : -1)).filter((i) => i >= 0), [6, 7, 8]);
  g = setHolds(g, new Set([0, 1, 2]));
  assert.deepEqual(g.held.map((h, i) => (h ? i : -1)).filter((i) => i >= 0), [0, 1, 2], 'release first, then hold');
  assert.equal(pokerToggleHold(g, 3).code, 'HOLD_CAP');
});
