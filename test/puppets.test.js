import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, cardView, turnPose, TURN } from '../src/ui/puppets.js';

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
