import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upFaceIndex, assignFaceValues, snapQuaternion, rotateVector, FACE_AXES, OPPOSITE } from '../src/ui/dice3d-math.js';

const fromAxisAngle = (axis, angle) => { const s = Math.sin(angle / 2); return { x: axis[0] * s, y: axis[1] * s, z: axis[2] * s, w: Math.cos(angle / 2) }; };
const mul = (a, b) => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});

test('upFaceIndex finds the face whose normal points up for every axis-aligned orientation', () => {
  assert.equal(upFaceIndex({ x: 0, y: 0, z: 0, w: 1 }), 2); // +y up
  assert.equal(upFaceIndex(fromAxisAngle([1, 0, 0], Math.PI)), 3); // flipped: -y up
  assert.equal(upFaceIndex(fromAxisAngle([0, 0, 1], Math.PI / 2)), 0); // +90° about z lifts local +x
  assert.equal(upFaceIndex(fromAxisAngle([0, 0, 1], -Math.PI / 2)), 1);
  assert.equal(upFaceIndex(fromAxisAngle([1, 0, 0], Math.PI / 2)), 5);
  assert.equal(upFaceIndex(fromAxisAngle([1, 0, 0], -Math.PI / 2)), 4);
  // tilted by a few degrees keeps the same answer
  assert.equal(upFaceIndex(mul(fromAxisAngle([0, 0, 1], Math.PI / 2), fromAxisAngle([1, 0, 0], 0.1))), 0);
});

test('assignFaceValues puts the value on the landing face with opposite faces summing to 7', () => {
  for (let top = 0; top < 6; top++) {
    for (let v = 1; v <= 6; v++) {
      const vals = assignFaceValues(top, v);
      assert.equal(vals[top], v);
      assert.deepEqual([...vals].sort(), [1, 2, 3, 4, 5, 6]);
      for (let k = 0; k < 6; k++) assert.equal(vals[k] + vals[OPPOSITE[k]], 7);
    }
  }
});

test('snapQuaternion keeps the up face and yields an axis-aligned orientation', () => {
  for (let trial = 0; trial < 200; trial++) {
    const base = [fromAxisAngle([1, 0, 0], (Math.floor(trial / 4) % 4) * Math.PI / 2), fromAxisAngle([0, 0, 1], (trial % 4) * Math.PI / 2)][trial % 2];
    const yaw = fromAxisAngle([0, 1, 0], (trial * 0.37) % (Math.PI * 2));
    const wobble = mul(fromAxisAngle([1, 0, 0], 0.06), fromAxisAngle([0, 0, 1], -0.05));
    const q = mul(mul(yaw, base), wobble);
    const s = snapQuaternion(q);
    assert.equal(upFaceIndex(s), upFaceIndex(q));
    for (const axis of FACE_AXES) {
      const r = rotateVector(s, axis);
      const big = r.map(Math.abs).filter((c) => c > 0.999).length;
      const small = r.map(Math.abs).filter((c) => c < 1e-6).length;
      assert.equal(big, 1);
      assert.equal(small, 2);
    }
    const n = Math.hypot(s.x, s.y, s.z, s.w);
    assert.ok(Math.abs(n - 1) < 1e-9);
  }
});
