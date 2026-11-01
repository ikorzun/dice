import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  landingQuaternion, spinRemaining, spinPlan, spinAt, spreadAt, rotateVector, gridCell, qAxisAngle, qMul, FACE_AXES, DOM_PIPS, SPIN, SPREAD,
} from '../src/ui/dice3d-math.js';
import { MODEL_FACE_VALUES, DIE_BODY, DIE_PIPS, decodePart } from '../src/ui/dice-model.js';

// Same rotation, either sign of the quaternion.
const sameRotation = (a, b) => Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w) > 1 - 1e-9;

// Pip centres of one model face: one representative vertex per pip.
function facePips(face) {
  const { positions } = decodePart(DIE_PIPS);
  const ax = FACE_AXES[face];
  const a = ax.findIndex((v) => v !== 0);
  const out = [];
  for (let i = 0; i < positions.length; i += 3) {
    const p = [positions[i], positions[i + 1], positions[i + 2]];
    if (p[a] * ax[a] < 0.99) continue;
    if (!out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 0.3)) out.push(p);
  }
  return out;
}

test('every value lands face-up with the pip layout of the DOM die', () => {
  for (let v = 1; v <= 6; v++) {
    const q = landingQuaternion(v);
    const face = MODEL_FACE_VALUES.indexOf(v);
    assert.ok(rotateVector(q, FACE_AXES[face])[1] > 0.999, `value ${v} is not up`);
    const cells = facePips(face).map((p) => gridCell(rotateVector(q, p))).sort((a, b) => a - b);
    assert.deepEqual(cells, [...DOM_PIPS[v]].sort((a, b) => a - b), `value ${v} pip layout`);
  }
});

test('the spin keeps full speed for the first 80% of the roll, then eases to rest without a bounce', () => {
  assert.equal(spinRemaining(0), 1);
  assert.ok(Math.abs(spinRemaining(1)) < 1e-12);
  const step = 1 / 600;
  const speed = (u) => (spinRemaining(u) - spinRemaining(u + step)) / step;
  const top = speed(0);
  for (let u = 0; u + step <= SPIN.flat - step; u += step) assert.ok(Math.abs(speed(u) - top) < 1e-6);
  let prev = top;
  for (let u = SPIN.flat; u + step <= 1; u += step) {
    const s = speed(u);
    assert.ok(s >= 0 && s <= prev + 1e-9, `speed rises at ${u}`);
    prev = s;
  }
  assert.ok(speed(1 - step) < top * 0.01);
});

test('a spin starts on the old face and ends on the new one, for every pair of values', () => {
  const halfTurn = qAxisAngle([0, 1, 0], Math.PI); // the DOM cannot tell a die turned by 180° on the board
  for (let from = 1; from <= 6; from++) {
    for (let to = 1; to <= 6; to++) {
      const end = to % 2 ? landingQuaternion(to) : qMul(halfTurn, landingQuaternion(to));
      for (const axis of [[1, 0, 0], [0.3, 0.1, -0.9], [0, 0, 1]]) {
        const plan = spinPlan(landingQuaternion(from), end, axis, 1 + (from % 2), 1);
        assert.ok(sameRotation(spinAt(plan, 1), landingQuaternion(from)), `${from}→${to} start`);
        assert.ok(sameRotation(spinAt(plan, 0), end), `${from}→${to} end`);
      }
    }
  }
});

test('the generated die model decodes into in-range triangle lists within the unit cube', () => {
  for (const [part, maxTris] of [[DIE_BODY, 6000], [DIE_PIPS, 1008]]) {
    const { positions, indices } = decodePart(part);
    assert.equal(indices.length % 3, 0);
    assert.ok(indices.length / 3 <= maxTris);
    assert.ok(indices.every((i) => i < positions.length / 3));
    assert.ok(positions.every((c) => Math.abs(c) <= 1.01));
  }
});

test('the dice spread apart while they spin and fall back together, fastest on arrival, then knock', () => {
  assert.equal(spreadAt(0), 0);
  assert.ok(Math.abs(spreadAt(1)) < 1e-12);
  assert.equal(spreadAt(0.3), 1);
  for (let u = 0; u < SPREAD.out; u += 0.01) assert.ok(spreadAt(u + 0.01) >= spreadAt(u)); // out
  const v = (u) => spreadAt(u) - spreadAt(u + 0.01);
  for (let u = SPREAD.hold; u + 0.02 < SPREAD.back; u += 0.01) assert.ok(v(u + 0.01) > v(u)); // accelerating back
  assert.ok(spreadAt((SPREAD.back + 1) / 2) < 0); // the knock: a little past the rest place
});
