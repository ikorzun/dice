// Pure math for the 3D reroll spin (no three.js dependency, unit-tested): the orientation that
// shows each value face-up with the same pip layout as the DOM die, the spin that turns a die from
// its old face to its new one, and the speed profile measured on the owner's reference video
// (01.11.2026: 500 ms, full speed from the first frame, slowing only over the last ~20%).
// World: y is up (the camera looks straight down), screen right is +x, screen down is +z.
// Quaternions are plain { x, y, z, w }.

import { MODEL_FACE_VALUES, DIE_PIPS, decodePart } from './dice-model.js';

// Local face axes, in the order MODEL_FACE_VALUES lists them: +x, -x, +y, -y, +z, -z.
export const FACE_AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// DOM pip layout: cells 1..9 of the face's 3×3 grid, row-major (styles.css .face[data-value] rules).
export const DOM_PIPS = Object.freeze({ 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] });

export const SPIN = Object.freeze({
  durationMs: 500, // the reference roll: 30 frames at 60 fps
  flat: 0.8,       // share of the roll at constant speed; then a quadratic ease to rest (~100 ms)
});

export const qMul = (a, b) => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});
const qConj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
export function qAxisAngle([x, y, z], angle) {
  const l = Math.hypot(x, y, z) || 1;
  const s = Math.sin(angle / 2) / l;
  return { x: x * s, y: y * s, z: z * s, w: Math.cos(angle / 2) };
}

export function rotateVector(q, v) {
  const { x, y, z, w } = q;
  const [vx, vy, vz] = v;
  // t = 2 * cross(q.xyz, v); v' = v + w * t + cross(q.xyz, t)
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

// Quaternion of the rotation whose matrix has the columns X, Y, Z (images of the local axes).
function quatFromBasis(X, Y, Z) {
  const m = [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]]; // row-major
  const tr = m[0] + m[4] + m[8];
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return { w: 0.25 * s, x: (m[7] - m[5]) / s, y: (m[2] - m[6]) / s, z: (m[3] - m[1]) / s };
  }
  if (m[0] > m[4] && m[0] > m[8]) {
    const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2;
    return { w: (m[7] - m[5]) / s, x: 0.25 * s, y: (m[1] + m[3]) / s, z: (m[2] + m[6]) / s };
  }
  if (m[4] > m[8]) {
    const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2;
    return { w: (m[2] - m[6]) / s, x: (m[1] + m[3]) / s, y: 0.25 * s, z: (m[5] + m[7]) / s };
  }
  const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2;
  return { w: (m[3] - m[1]) / s, x: (m[2] + m[6]) / s, y: (m[5] + m[7]) / s, z: 0.25 * s };
}

// Pip centres of the model, per face (FACE_AXES order).
function pipCentres() {
  const { positions } = decodePart(DIE_PIPS);
  return FACE_AXES.map((ax) => {
    const a = ax.findIndex((v) => v !== 0);
    const clusters = [];
    for (let i = 0; i < positions.length; i += 3) {
      const p = [positions[i], positions[i + 1], positions[i + 2]];
      if (p[a] * ax[a] < 0.99) continue;
      let c = clusters.find((q) => Math.hypot(q.s[0] / q.n - p[0], q.s[1] / q.n - p[1], q.s[2] / q.n - p[2]) < 0.25);
      if (!c) { c = { s: [0, 0, 0], n: 0 }; clusters.push(c); }
      for (let k = 0; k < 3; k++) c.s[k] += p[k];
      c.n++;
    }
    return clusters.map((c) => c.s.map((v) => v / c.n));
  });
}

// The DOM grid cell (1..9) a point of the up face falls in, seen from above.
export const gridCell = ([x, , z]) => (Math.round(z / 0.42) + 1) * 3 + Math.round(x / 0.42) + 1 + 1;

// The 24 rotations of a cube, as basis columns.
function cubeRotations() {
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const out = [];
  for (const i of [0, 1, 2]) for (const j of [0, 1, 2]) {
    if (i === j) continue;
    for (const si of [1, -1]) for (const sj of [1, -1]) {
      const X = axes[i].map((v) => v * si);
      const Y = axes[j].map((v) => v * sj);
      out.push([X, Y, [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]]]);
    }
  }
  return out;
}

let landings = null;
// Orientation that puts value `v` up with the DOM pip layout (2, 3 and 6 are not symmetric under a
// quarter turn, so the pose matters for a seamless hand-off to the DOM die).
export function landingQuaternion(v) {
  if (!landings) {
    const pips = pipCentres();
    landings = {};
    for (let value = 1; value <= 6; value++) {
      const face = MODEL_FACE_VALUES.indexOf(value);
      const want = [...DOM_PIPS[value]].sort((a, b) => a - b).join(',');
      for (const [X, Y, Z] of cubeRotations()) {
        const q = quatFromBasis(X, Y, Z);
        if (rotateVector(q, FACE_AXES[face])[1] < 0.5) continue;
        const cells = pips[face].map((p) => gridCell(rotateVector(q, p))).sort((a, b) => a - b).join(',');
        if (cells === want) { landings[value] = q; break; }
      }
      if (!landings[value]) throw new Error(`no orientation shows ${value} with the DOM pip layout`);
    }
  }
  return landings[v];
}

// Remaining share of the spin at time u (0..1): constant speed until SPIN.flat, then the speed
// falls quadratically to zero at u = 1 (continuous speed, no bounce).
export function spinRemaining(u, flat = SPIN.flat) {
  const t = Math.min(1, Math.max(0, u));
  const whole = flat + (1 - flat) / 3;
  const done = t <= flat ? t : flat + ((1 - flat) / 3) * (1 - (1 - (t - flat) / (1 - flat)) ** 3);
  return 1 - done / whole;
}

// A spin from `from` to `to` (quaternions): the residual turn between the two poses plus `turns`
// full turns about the same axis, compounded with `tumbles` full turns about `axis`; `r` is the
// remaining share (1 = start pose, 0 = end pose).
export function spinPlan(from, to, axis, turns = 1, tumbles = 1) {
  const rel = qMul(from, qConj(to)); // the world-frame turn that takes `to` back to `from`
  const sign = rel.w < 0 ? -1 : 1;
  const angle = 2 * Math.acos(Math.min(1, Math.abs(rel.w)));
  const s = Math.sqrt(Math.max(0, 1 - rel.w * rel.w));
  const relAxis = s > 1e-6 ? [(rel.x * sign) / s, (rel.y * sign) / s, (rel.z * sign) / s] : axis;
  return { to, relAxis, relAngle: angle + 2 * Math.PI * turns, axis, tumble: 2 * Math.PI * tumbles };
}

export function spinAt(plan, r) {
  return qMul(qAxisAngle(plan.axis, plan.tumble * r), qMul(qAxisAngle(plan.relAxis, plan.relAngle * r), plan.to));
}

// "Gravity between the dice" (owner, 01.11.2026): while they spin, the dice move apart so their
// tumbling corners clear each other, then fall back together, accelerating like a weight, and
// meet with a small knock. Share of the full spread at time u (0..1): a quick burst out, a hold,
// a gravity-like return (quadratic, fastest on arrival) and a short knock past the rest place.
export const SPREAD = Object.freeze({ out: 0.15, hold: 0.55, back: 0.9, knock: 0.15 });
export function spreadAt(u) {
  const t = Math.min(1, Math.max(0, u));
  if (t < SPREAD.out) return 1 - (1 - t / SPREAD.out) ** 3;
  if (t < SPREAD.hold) return 1;
  if (t < SPREAD.back) return 1 - ((t - SPREAD.hold) / (SPREAD.back - SPREAD.hold)) ** 2;
  return -SPREAD.knock * Math.sin((Math.PI * (t - SPREAD.back)) / (1 - SPREAD.back));
}
