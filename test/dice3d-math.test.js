import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pipCentres, pipMesh, PIP_PX, pipRadiusPx,
  landingQuaternion, tumbleTheta, tumblePlan, tumblePose, rotateVector, gridCell, qAxisAngle, qMul, FACE_AXES, DOM_PIPS, ROLL,
} from '../src/ui/dice3d-math.js';
import { MODEL_FACE_VALUES, DIE_BODY, DIE_PIPS, decodePart } from '../src/ui/dice-model.js';

// Same rotation, either sign of the quaternion.
const sameRotation = (a, b) => Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w) > 1 - 1e-9;

// Pip centres of one face, as the mockup lays them out.
const facePips = (face) => pipCentres()[face];

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

test('pips follow the mockup: 21 discs of 24 px (the 1: 28 px) on a 110.4 px die, each a dimple', () => {
  const view = 0.95;
  const { positions, dimple } = pipMesh(view);
  const centres = pipCentres(view).flat();
  assert.equal(centres.length, 21);
  assert.deepEqual(Object.keys(PIP_PX).map((v) => PIP_PX[v].length), [1, 2, 3, 4, 5, 6]);
  const reach = new Array(21).fill(0);
  for (let i = 0; i < positions.length; i += 3) {
    const p = [positions[i], positions[i + 1], positions[i + 2]];
    let best = 0;
    for (let k = 1; k < 21; k++) if (Math.hypot(...p.map((v, a) => v - centres[k][a])) < Math.hypot(...p.map((v, a) => v - centres[best][a]))) best = k;
    const d = p.map((v, a) => v - centres[best][a]);
    reach[best] = Math.max(reach[best], Math.hypot(...d));
    const tilt = [dimple[i], dimple[i + 1], dimple[i + 2]];
    assert.ok(tilt[0] * d[0] + tilt[1] * d[1] + tilt[2] * d[2] >= -1e-9); // subtracted, it leans the normal toward the centre
  }
  // every triangle faces out of the die (back faces are culled)
  for (let i = 0; i < positions.length; i += 9) {
    const [p0, p1, p2] = [0, 3, 6].map((o) => [positions[i + o], positions[i + o + 1], positions[i + o + 2]]);
    const u = p1.map((v, a) => v - p0[a]);
    const w = p2.map((v, a) => v - p0[a]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    assert.ok(n[0] * p0[0] + n[1] * p0[1] + n[2] * p0[2] > 0, `triangle ${i / 9} faces in`);
  }
  const faceOf = pipCentres(view).flatMap((list, f) => list.map(() => MODEL_FACE_VALUES[f]));
  reach.forEach((r, k) => assert.ok(Math.abs(r - (pipRadiusPx(faceOf[k]) / 55.2) * view) < 1e-6, `pip ${k} radius ${r}`));
});
