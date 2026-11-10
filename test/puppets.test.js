import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, cardView, turnPose, TURN, WIN_CARD_PAIR, PAIR_SKULL_START } from '../src/ui/puppets.js';

// Every number a pose gives, by part and property.
const bones = (c, k, act) => Object.entries(c.pose(k, act));

test('bonus characters keep the beat: acts last whole beats, the bounce comes round every two beats', () => {
  for (const [kind, c] of Object.entries(CHARACTERS)) {
    const names = new Set(c.parts.map((p) => p.name));
    for (let k = 0; k < 64; k++) {
      for (const [part, b] of bones(c, k, null)) {
        assert.ok(names.has(part), `${kind}: ${part} is not a part`);
        for (const [key, v] of Object.entries(b)) assert.ok(Number.isFinite(v), `${kind} ${part}.${key} at ${k}`);
      }
      assert.deepEqual(c.pose(k, null), c.pose(k + 16, null), `${kind}: drawing ${k} differs from ${k + 16}`);
    }
    for (const [name, table] of Object.entries(c.acts)) {
      assert.equal(table.length, 16, `${kind} ${name}: ${table.length} drawings, not two beats`);
      for (let e = 0; e < table.length; e++) {
        for (const [part, b] of bones(c, 0, { name, e, dir: -1 })) {
          assert.ok(names.has(part), `${kind} ${name}: ${part} is not a part`);
          for (const [key, v] of Object.entries(b)) assert.ok(Number.isFinite(v), `${kind} ${name} ${part}.${key} at ${e}`);
        }
      }
    }
  }
});

test('a turn starts from rest, lands on the beat, settles halfway and rests again (owner, 03.11.2026)', () => {
  for (const [kind, c] of Object.entries(CHARACTERS)) {
    for (const act of [null, ...Object.keys(c.acts)]) {
      const turn = { k0: 40, act, dir: 1 }; // on a beat
      assert.deepEqual(turnPose(c, turn, 39), {}, `${kind} ${act}: at rest before the turn`);
      assert.deepEqual(turnPose(c, turn, 40 + TURN), {}, `${kind} ${act}: at rest after the turn`);
      const land = turnPose(c, turn, 40 + 16);
      assert.deepEqual(land, c.pose(56, null), `${kind} ${act}: lands on the next beat's squash`);
      const settle = turnPose(c, turn, 40 + 17);
      for (const [part, b] of Object.entries(land)) {
        for (const [key, v] of Object.entries(b)) {
          const rest = key === 'sx' || key === 'sy' ? 1 : 0;
          assert.ok(Math.abs(settle[part][key] - rest) <= Math.abs(v - rest) / 2 + 1e-9, `${kind} ${act}: ${part}.${key} settles toward rest`);
        }
      }
    }
  }
});

test('a character is laid on its card like the picture it replaces: its frame fills the picture box, centred at the bottom', () => {
  for (const c of Object.values(CHARACTERS)) {
    const box = { w: 112, h: 112, left: 10.4, top: 4.1, aw: 89.2, ah: 89.2, drop: 5 };
    const { view, s } = cardView(c, box);
    const [fx, fy, fw, fh] = c.frame;
    const x = (u) => (u - view[0]) * s; // a drawing unit, in px from the card's corner
    const y = (u) => (u - view[1]) * s;
    assert.ok(Math.abs(y(fy + fh) - (box.top + box.drop + box.ah)) < 1e-9, 'the frame sits on the box bottom');
    assert.ok(Math.abs((x(fx) + x(fx + fw)) / 2 - (box.left + box.aw / 2)) < 1e-9, 'centred');
    assert.ok(fw * s <= box.aw + 1e-9 && fh * s <= box.ah + 1e-9, 'inside the box');
    assert.ok(Math.abs(view[2] * s - box.w) < 1e-9 && Math.abs(view[3] * s - box.h) < 1e-9, 'the view is the card');
  }
});

test('the knight and the skull have a paired act: two beats from rest to rest, mirrored by which side the other sits (LORE §6 point 8)', () => {
  const knight = CHARACTERS.x2_any;
  const skull = CHARACTERS.joker;
  for (const c of [knight, skull]) {
    const names = new Set(c.parts.map((p) => p.name));
    for (let e = 0; e < 16; e++) {
      for (const dir of [1, -1]) {
        for (const [part, b] of Object.entries(c.pose(0, { name: 'pair', e, dir }))) {
          assert.ok(names.has(part), `${c.name}: ${part} is not a part`);
          for (const [key, v] of Object.entries(b)) assert.ok(Number.isFinite(v), `${c.name} pair ${part}.${key} at ${e}`);
        }
      }
    }
    const turn = { k0: 40, act: 'pair', dir: -1 };
    assert.deepEqual(turnPose(c, turn, 39), {}, `${c.name}: at rest before the act`);
    assert.deepEqual(turnPose(c, turn, 40 + TURN), {}, `${c.name}: at rest after it`);
    assert.deepEqual(turnPose(c, turn, 56), c.pose(56, null), `${c.name}: lands on the next beat's squash`);
  }
  const k = knight.pose(0, { name: 'pair', e: 4, dir: 1 });
  const km = knight.pose(0, { name: 'pair', e: 4, dir: -1 });
  assert.ok(k.head.rot > 0 && km.head.rot === -k.head.rot, 'the knight leans toward the skull, on either side');
  assert.ok(k.pupilL.dx > 0 && km.pupilL.dx === -k.pupilL.dx, 'and looks at it');
  assert.ok(k.flower.rot > 0 && km.flower.rot === k.flower.rot, 'his tulip dips the same way on either side');
  const s = skull.pose(0, { name: 'pair', e: 6, dir: 1 });
  const sm = skull.pose(0, { name: 'pair', e: 6, dir: -1 });
  assert.ok(s.head.rot < 0 && sm.head.rot === -s.head.rot, 'the skull bows toward the knight, on either side');
  assert.ok(s.iris.dx < 0 && sm.iris.dx === -s.iris.dx, 'and looks at him');
  assert.deepEqual(skull.pose(0, { name: 'win', e: 5, dir: -1 }), skull.pose(0, { name: 'win', e: 5, dir: 1 }), 'the victory act alone ignores sides');
  for (const [kind, keys] of Object.entries(WIN_CARD_PAIR)) {
    assert.equal(keys[0][0], 1, `${kind}: keys start at drawing 1`);
    assert.deepEqual(keys[keys.length - 1], [16, 0, 0, 0, 1, 1], `${kind}: the card ends at rest`);
    for (let i = 1; i < keys.length; i++) assert.ok(keys[i][0] > keys[i - 1][0], `${kind}: drawings go up`);
    for (const key of keys) assert.ok(key[2] <= 0, `${kind}: the card never sinks`);
  }
  assert.ok(PAIR_SKULL_START > 0 && PAIR_SKULL_START < 83, 'the skull answers after the knight, before a drawing has passed');
});
