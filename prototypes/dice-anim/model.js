// Shared die scene for the prototype: the owner's model (decimated copy in vendor/dice-model.js),
// one camera per die looking straight down at its centre, and the orientation that shows each
// value with the same pip layout as the DOM die. Used by the live three.js variant (D) and by
// render-sprites.html, which bakes the sprite variant (C) from exactly the same scene.

import { MODEL_FACE_VALUES, DIE_BODY, DIE_PIPS, decodePart } from './vendor/dice-model.js';

export const BLEED = 1.5;   // frame side / die side: room for the tumbling corners
export const CAM_DIST = 9;  // camera height above the die centre, in half-sides (die spans -1..1)
export const ROUND_R = 0.224; // bevel radius of the model (measured from the mesh)

// DOM pip layout: cells 1..9 of a 3x3 grid, row-major (styles.css .face[data-value] rules)
const DOM_PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const FACE_AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function pipCentres() {
  const { positions } = decodePart(DIE_PIPS);
  return FACE_AXES.map((ax) => {
    const a = ax.findIndex((v) => v !== 0);
    const s = ax[a];
    const cl = [];
    for (let i = 0; i < positions.length; i += 3) {
      const p = [positions[i], positions[i + 1], positions[i + 2]];
      if (p[a] * s < 0.99) continue;
      let c = cl.find((q) => Math.hypot(q.x[0] / q.n - p[0], q.x[1] / q.n - p[1], q.x[2] / q.n - p[2]) < 0.25);
      if (!c) { c = { x: [0, 0, 0], n: 0 }; cl.push(c); }
      c.x[0] += p[0]; c.x[1] += p[1]; c.x[2] += p[2]; c.n++;
    }
    return cl.map((c) => c.x.map((v) => v / c.n));
  });
}

// The 24 rotations of a cube as 3x3 matrices (columns = images of x, y, z).
function cubeRotations() {
  const out = [];
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (const i of [0, 1, 2]) for (const j of [0, 1, 2]) {
    if (i === j) continue;
    for (const si of [1, -1]) for (const sj of [1, -1]) {
      const X = axes[i].map((v) => v * si);
      const Y = axes[j].map((v) => v * sj);
      const Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
      out.push([X, Y, Z]);
    }
  }
  return out;
}

// Orientation (as basis columns) that puts value v up with the DOM pip layout, in a world where
// y is up, screen right is +x and screen down is +z.
export function landingBases() {
  const pips = pipCentres();
  const rots = cubeRotations();
  const res = {};
  for (let v = 1; v <= 6; v++) {
    const k = MODEL_FACE_VALUES.indexOf(v);
    const want = DOM_PIPS[v].slice().sort((a, b) => a - b).join(',');
    for (const [X, Y, Z] of rots) {
      const mul = (p) => [X[0] * p[0] + Y[0] * p[1] + Z[0] * p[2], X[1] * p[0] + Y[1] * p[1] + Z[1] * p[2], X[2] * p[0] + Y[2] * p[1] + Z[2] * p[2]];
      if (mul(FACE_AXES[k])[1] < 0.5) continue;
      const cells = pips[k].map((p) => {
        const q = mul(p);
        const col = Math.round(q[0] / 0.42);
        const row = Math.round(q[2] / 0.42);
        return (row + 1) * 3 + (col + 1) + 1;
      }).sort((a, b) => a - b).join(',');
      if (cells === want) { res[v] = [X, Y, Z]; break; }
    }
    if (!res[v]) throw new Error(`no orientation matches the DOM layout for ${v}`);
  }
  return res;
}

let geoCache = null;
function geometries(THREE) {
  if (geoCache) return geoCache;
  const build = (part, analytic) => {
    const { positions, indices } = decodePart(part);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    if (analytic) {
      // Exact normals of a rounded box: smooth bevels, flat faces, whatever the decimation did.
      const n = new Float32Array(positions.length);
      const lim = 1 - ROUND_R;
      for (let i = 0; i < positions.length; i += 3) {
        const d = [0, 1, 2].map((a) => positions[i + a] - Math.max(-lim, Math.min(lim, positions[i + a])));
        const l = Math.hypot(d[0], d[1], d[2]) || 1;
        n[i] = d[0] / l; n[i + 1] = d[1] / l; n[i + 2] = d[2] / l;
      }
      g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    } else {
      g.computeVertexNormals();
    }
    return g;
  };
  geoCache = { body: build(DIE_BODY, true), pips: build(DIE_PIPS, false) };
  return geoCache;
}

// Scene with one die at the origin, lit from the top-left like the DOM board.
export async function createDieScene(THREE, renderer) {
  const scene = new THREE.Scene();
  try {
    const { RoomEnvironment } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js');
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    pmrem.dispose();
  } catch { /* lights alone are enough */ }
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x5a5246, 0.45));
  const key = new THREE.DirectionalLight(0xfff4e2, 1.9);
  key.position.set(-4, 7, -5);
  scene.add(key);
  const geo = geometries(THREE);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf3ecdc, roughness: 0.38, metalness: 0, envMapIntensity: 0.38 });
  const pipMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.55, metalness: 0, envMapIntensity: 0.4 });
  const die = new THREE.Group();
  die.add(new THREE.Mesh(geo.body, bodyMat));
  die.add(new THREE.Mesh(geo.pips, pipMat));
  scene.add(die);
  const fov = 2 * Math.atan(BLEED / (CAM_DIST - 1)) * 180 / Math.PI;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.5, 40);
  camera.position.set(0, CAM_DIST, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  const bases = landingBases();
  const landing = {};
  for (let v = 1; v <= 6; v++) {
    const [X, Y, Z] = bases[v];
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...X), new THREE.Vector3(...Y), new THREE.Vector3(...Z));
    landing[v] = new THREE.Quaternion().setFromRotationMatrix(m);
  }
  return { scene, camera, die, landing };
}

// Tumble that ends exactly on `qEnd`: a world-axis rotation by theta(t) applied on top of it,
// theta running from `total` down to 0 (through a small overshoot, the rock).
export function tumbleAt(THREE, qEnd, axis, theta, out = new THREE.Quaternion()) {
  out.setFromAxisAngle(axis, theta);
  return out.multiply(qEnd);
}

// Angle schedule shared by the live and the baked tumble, u in 0..1 over the roll (see PROFILE in
// index.html): spin from u=0.08 (after the crouch) into the first impact at u=0.62, landing tilted
// by `rock` on an edge, then tipping flat with one small overshoot by u=0.84.
export function tumbleTheta(u, total, rock = 0.16) {
  if (u <= 0.08) return total;
  if (u <= 0.62) {
    const k = (u - 0.08) / 0.54;
    const e = 1 - (1 - k) * (1 - k); // ease-out: fast off the hand, slowing into the floor
    return total * (1 - e) + rock * e;
  }
  if (u <= 0.84) {
    const k = (u - 0.62) / 0.22;
    return rock * Math.cos(1.5 * Math.PI * k) * (1 - k);
  }
  return 0;
}
