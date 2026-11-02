import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dimpleNormals,
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

test('the tumble waits out the crouch, eases onto an edge, then snaps flat with no bounce', () => {
  const total = 2 * Math.PI;
  assert.equal(tumbleTheta(0, total), total);
  assert.equal(tumbleTheta(ROLL.start, total), total);
  let prev = total;
  for (let u = ROLL.start + 0.005; u <= 1; u += 0.005) { // the angle only shrinks: no overshoot, no hop
    const t = tumbleTheta(u, total);
    assert.ok(t <= prev && t >= 0, `turns back at ${u}`);
    prev = t;
  }
  assert.ok(Math.abs(tumbleTheta(ROLL.edge, total) - ROLL.rock) < 1e-12); // touches down tilted on an edge
  const step = 0.002;
  const speed = (u) => (tumbleTheta(u, total) - tumbleTheta(u + step, total)) / step;
  for (let u = ROLL.edge + step; u + 2 * step < ROLL.flat; u += step) assert.ok(speed(u + step) > speed(u)); // pulled in faster and faster
  assert.equal(tumbleTheta(ROLL.flat, total), 0);
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

test('dimple normals: 21 pips, each normal leans toward its pip centre (a pressed-in bowl)', () => {
  const { positions } = decodePart(DIE_PIPS);
  const pos = Float32Array.from(positions);
  const normals = new Float32Array(pos.length);
  for (let v = 0; v < pos.length / 3; v++) {
    const a = [0, 1, 2].reduce((m, k) => (Math.abs(pos[3 * v + k]) > Math.abs(pos[3 * v + m]) ? k : m), 0);
    normals[3 * v + a] = Math.sign(pos[3 * v + a]); // a flat face's normal
  }
  const flat = Float32Array.from(normals);
  assert.equal(dimpleNormals(pos, normals), 21);
  let leaning = 0;
  let total = 0;
  for (let v = 0; v < pos.length / 3; v++) {
    const n = [0, 1, 2].map((k) => normals[3 * v + k]);
    assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-5);
    const tilt = [0, 1, 2].map((k) => n[k] - flat[3 * v + k]);
    if (Math.hypot(...tilt) > 1e-3) { total++; if (n[0] * flat[3 * v] + n[1] * flat[3 * v + 1] + n[2] * flat[3 * v + 2] < 1) leaning++; }
  }
  assert.ok(total > 0 && leaning === total);
});
