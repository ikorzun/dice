// Pure math for the 3D dice roller (no three.js dependency, unit-tested):
// which local face ends up on top, how to label the faces so the pre-simulated landing
// shows the value the engine decided, and how to snap a resting die to the grid axes.

// Local face axes in the order three.js BoxGeometry assigns materials: +x, -x, +y, -y, +z, -z.
export const FACE_AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export const OPPOSITE = [1, 0, 3, 2, 5, 4];

export function rotateVector(q, v) {
  const { x, y, z, w } = q;
  const [vx, vy, vz] = v;
  // t = 2 * cross(q.xyz, v); v' = v + w * t + cross(q.xyz, t)
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

// Index (0-5) of the local face whose outward normal points most upward in world space.
export function upFaceIndex(q) {
  let best = 0;
  let bestY = -Infinity;
  FACE_AXES.forEach((axis, k) => {
    const y = rotateVector(q, axis)[1];
    if (y > bestY) { bestY = y; best = k; }
  });
  return best;
}

// Values for the six faces so that face `top` shows `value`; opposite faces always sum to 7.
export function assignFaceValues(top, value) {
  const values = new Array(6).fill(0);
  values[top] = value;
  values[OPPOSITE[top]] = 7 - value;
  const rest = [1, 2, 3, 4, 5, 6].filter((v) => v !== value && v !== 7 - value);
  const pairs = [];
  while (rest.length) {
    const a = rest.shift();
    const b = 7 - a;
    rest.splice(rest.indexOf(b), 1);
    pairs.push([a, b]);
  }
  for (let k = 0; k < 6; k += 2) {
    if (values[k]) continue;
    const [a, b] = pairs.shift();
    values[k] = a;
    values[k + 1] = b;
  }
  return values;
}

// Snap a (nearly) resting orientation to the closest axis-aligned one, keeping the up face.
export function snapQuaternion(q) {
  const cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotateVector(q, axis));
  const snapped = cols.map((c) => {
    const i = [0, 1, 2].reduce((m, k) => (Math.abs(c[k]) > Math.abs(c[m]) ? k : m), 0);
    const out = [0, 0, 0];
    out[i] = Math.sign(c[i]) || 1;
    return out;
  });
  // keep the matrix right-handed: z = x × y
  const [x, y] = snapped;
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  const m = [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]; // row-major 3x3, columns = basis
  const tr = m[0] + m[4] + m[8];
  let qx; let qy; let qz; let qw;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    qw = 0.25 * s; qx = (m[7] - m[5]) / s; qy = (m[2] - m[6]) / s; qz = (m[3] - m[1]) / s;
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2;
    qw = (m[7] - m[5]) / s; qx = 0.25 * s; qy = (m[1] + m[3]) / s; qz = (m[2] + m[6]) / s;
  } else if (m[4] > m[8]) {
    const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2;
    qw = (m[2] - m[6]) / s; qx = (m[1] + m[3]) / s; qy = 0.25 * s; qz = (m[5] + m[7]) / s;
  } else {
    const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2;
    qw = (m[3] - m[1]) / s; qx = (m[2] + m[6]) / s; qy = (m[5] + m[7]) / s; qz = 0.25 * s;
  }
  return { x: qx, y: qy, z: qz, w: qw };
}
