import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  landingQuaternion, tumbleTheta, tumblePlan, tumblePose, rotateVector, gridCell, qAxisAngle, qMul, FACE_AXES, DOM_PIPS, ROLL,
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

test('the tumble waits out the crouch, eases into an edge impact, then tips flat with one overshoot', () => {
  const total = 2 * Math.PI;
  const [hit, rest] = ROLL.impacts;
  assert.equal(tumbleTheta(0, total), total);
  assert.equal(tumbleTheta(0.08, total), total);
  let prev = total;
  for (let u = 0.09; u <= hit; u += 0.01) { // down all the way, slowing into the floor
    assert.ok(tumbleTheta(u, total) < prev, `turns back at ${u}`);
    prev = tumbleTheta(u, total);
  }
  assert.ok(Math.abs(tumbleTheta(hit, total) - ROLL.rock) < 1e-12); // lands tilted on an edge
  let flips = 0;
  for (let u = hit + 0.005; u < rest; u += 0.005) {
    assert.ok(Math.abs(tumbleTheta(u, total)) <= ROLL.rock + 1e-12);
    if (Math.sign(tumbleTheta(u, total)) !== Math.sign(tumbleTheta(u - 0.005, total)) && tumbleTheta(u, total) !== 0) flips++;
  }
  assert.equal(flips, 1); // one overshoot past flat, no wobble
  assert.ok(Math.abs(tumbleTheta(rest, total)) < 1e-12);
  assert.equal(tumbleTheta(1, total), 0);
});

test('a throw starts on the old face and ends on the new one, for every pair of values', () => {
  const halfTurn = qAxisAngle([0, 1, 0], Math.PI); // the DOM cannot tell a die turned by 180° on the board
  for (let from = 1; from <= 6; from++) {
    for (let to = 1; to <= 6; to++) {
      const end = to % 2 ? landingQuaternion(to) : qMul(halfTurn, landingQuaternion(to));
      for (const axis of [[1, 0, 0], [0.3, 0.1, -0.9], [0, 0, 1]]) {
        const plan = tumblePlan(landingQuaternion(from), end, axis);
        assert.ok(sameRotation(tumblePose(plan, 0), landingQuaternion(from)), `${from}→${to} start`);
        assert.ok(sameRotation(tumblePose(plan, 1), end), `${from}→${to} end`);
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
