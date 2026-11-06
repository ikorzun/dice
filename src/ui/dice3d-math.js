// Pure math for the 3D reroll throw (no three.js dependency, unit-tested): the orientation that
// shows each value face-up with the same pip layout as the DOM die, and the keyframed tumble of
// variant D (prototypes/dice-anim, put in the game by the owner on 01.11.2026) that turns a die from
// its old face to its new one. World: y is up (the camera looks straight down), screen right is +x,
// screen down is +z. Quaternions are plain { x, y, z, w }.

import { MODEL_FACE_VALUES } from './dice-model.js';

// Local face axes, in the order MODEL_FACE_VALUES lists them: +x, -x, +y, -y, +z, -z.
export const FACE_AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// DOM pip layout: cells 1..9 of the face's 3×3 grid, row-major (styles.css .face[data-value] rules).
export const DOM_PIPS = Object.freeze({ 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] });

// One die's throw (490 ms): crouch to 10%, rise to 45%, fall onto an edge at 78%, then the face
// is pulled flat like a magnet by 90% and the die stays put (owner, 01.11.2026: no second bounce);
// the dice start `staggerMs` apart in a shuffled order.
export const ROLL = Object.freeze({
  durationMs: 490,
  staggerMs: 45,
  start: 0.1,  // the tumble starts after the crouch
  edge: 0.78,  // first touch, on an edge
  flat: 0.9,   // the face snaps flat onto the board
  rock: 0.16,  // tilt (radians) of the die on the edge it touches first
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

// The pips as the owner's mockup draws them (Figma 1296:657, 02.11.2026: a 110.4 px die, pips 24 px
// across, the 1 28 px), as offsets in px from the face's centre (x right, y down); 55.2 px is a half-side.
export const PIP_PX = Object.freeze({
  1: [[0, 0]],
  2: [[22.63, -22.63], [-22.63, 22.63]],
  3: [[22.63, -22.63], [0, 0], [-22.63, 22.63]],
  4: [[-22, -22], [22, -22], [-22, 22], [22, 22]],
  5: [[-23, -23], [23, -23], [0, 0], [-23, 23], [23, 23]],
  6: [[-22, -28], [22, -28], [-22, 0], [22, 0], [-22, 28], [22, 28]],
});
export const pipRadiusPx = (value) => (value === 1 ? 14 : 12);

// A face's axis and its two in-plane axes.
function faceFrame(ax) {
  const a = ax.findIndex((v) => v !== 0);
  const [b, c] = [0, 1, 2].filter((k) => k !== a);
  return { a, b, c, s: ax[a] };
}

// Pip centres per face (FACE_AXES order), in half-sides on the flat face. `view` turns the mockup's px
// into model units as the camera sees the top face (a top-face point looks a little bigger than its share
// of the die, whose outline is its widest, lower rim).
export function pipCentres(view = 1) {
  return FACE_AXES.map((ax, f) => {
    const { a, b, c, s } = faceFrame(ax);
    return PIP_PX[MODEL_FACE_VALUES[f]].map(([x, y]) => {
      const p = [0, 0, 0];
      p[a] = s;
      p[b] = (x / 55.2) * view;
      p[c] = (y / 55.2) * view;
      return p;
    });
  });
}

// Every pip as a flat disc on its face (`rings` × `segments` triangles, fine enough to follow the rounded
// edge once wrapped), with, per vertex, the tilt that makes it a dimple, to subtract from the surface normal.
// The dimple is a round pit (owner, 02.11.2026: the shine must follow the dent's shape): its wall leans as on
// a sphere, flat in the middle and steep at the rim (`rim`: the sine of the wall's slope there, 72°), so the
// pit mirrors the whole matcap and its shine curves round along the rim.
export function pipMesh(view = 1, { rings = 10, segments = 36, rim = 0.95 } = {}) {
  const pos = [];
  const tilt = [];
  const centres = pipCentres(view);
  FACE_AXES.forEach((ax, f) => {
    const { a, b, c, s } = faceFrame(ax);
    const r = (pipRadiusPx(MODEL_FACE_VALUES[f]) / 55.2) * view;
    // b × c is +a for x and z faces, -a for y faces: wind every triangle to face out of the die
    const out = (a === 1 ? -1 : 1) * s > 0;
    for (const centre of centres[f]) {
      const at = (ring, k) => {
        const t = (2 * Math.PI * k) / segments;
        const p = centre.slice();
        const d = [0, 0, 0];
        d[b] = (r * ring * Math.cos(t)) / rings;
        d[c] = (r * ring * Math.sin(t)) / rings;
        const sin = (rim * ring) / rings;
        return [p.map((v, i) => v + d[i]), d.map((v) => (rim * v) / r / Math.sqrt(1 - sin * sin))];
      };
      const push = (v0, v1, v2) => (out ? [v0, v1, v2] : [v0, v2, v1]).forEach(([p, d]) => { pos.push(...p); tilt.push(...d); });
      for (let k = 0; k < segments; k++) {
        push(at(0, 0), at(1, k), at(1, k + 1));
        for (let ring = 1; ring < rings; ring++) {
          push(at(ring, k), at(ring + 1, k), at(ring + 1, k + 1));
          push(at(ring, k), at(ring + 1, k + 1), at(ring, k + 1));
        }
      }
    }
  });
  return { positions: new Float32Array(pos), dimple: new Float32Array(tilt) };
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

// Angle still to turn at time u (0..1 of one die's throw): the tumble eases out into the edge touch,
// still tilted by `rock`, then the face is pulled flat faster and faster and stops dead on it: the
// angle only ever shrinks, with no overshoot.
export function tumbleTheta(u, total, rock = ROLL.rock) {
  if (u <= ROLL.start) return total;
  if (u <= ROLL.edge) {
    const k = (u - ROLL.start) / (ROLL.edge - ROLL.start);
    const e = 1 - (1 - k) * (1 - k); // fast off the hand, slowing into the floor
    return total * (1 - e) + rock * e;
  }
  if (u < ROLL.flat) {
    const k = (u - ROLL.edge) / (ROLL.flat - ROLL.edge);
    return rock * (1 - k * k); // the magnet: accelerating onto the face
  }
  return 0;
}

// A throw from pose `from` to pose `to` (quaternions): the residual turn between the two poses, and
// one full tumble about `axis` on top of it.
export function tumblePlan(from, to, axis) {
  const rel = qMul(from, qConj(to)); // the world-frame turn that takes `to` back to `from`
  const sign = rel.w < 0 ? -1 : 1;
  const s = Math.sqrt(Math.max(0, 1 - rel.w * rel.w));
  const relAxis = s > 1e-6 ? [(rel.x * sign) / s, (rel.y * sign) / s, (rel.z * sign) / s] : axis;
  return { to, relAxis, relAngle: 2 * Math.acos(Math.min(1, Math.abs(rel.w))), axis };
}

// Pose at time u: the residual turn is done by the edge touch; the tumble touches tilted by the rock
// and snaps flat.
export function tumblePose(plan, u) {
  return qMul(qAxisAngle(plan.axis, tumbleTheta(u, 2 * Math.PI)), qMul(qAxisAngle(plan.relAxis, tumbleTheta(u, plan.relAngle, 0)), plan.to));
}
