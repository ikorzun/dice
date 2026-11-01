// 3D dice, after the owner's reference video (01.11.2026). On a reroll every rolled die spins at its
// cell — no lift, no physics, no scale — at full speed from the first frame, slows only over the
// last ~20% of 500 ms and lands face-on on the engine's value, with motion blur while it is fast;
// the dice drift apart while they spin and fall back together ("gravity between the dice"). The
// resting dice are pictures of the same model from the same camera (renderFaces), so nothing
// changes when the DOM die takes over. Each die is drawn by its own camera straight above it
// (viewport + scissor over one canvas laid over the board). three.js loads lazily from the CDN;
// when it is unavailable the caller keeps the CSS dice and their tumble.

import { landingQuaternion, spinPlan, spinAt, spinRemaining, spreadAt, qAxisAngle, qMul, SPIN } from './dice3d-math.js';
import { DIE_BODY, DIE_PIPS, decodePart } from './dice-model.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const ROUND_R = 0.224; // bevel radius of the model, in half-sides (measured from the mesh)
const CAM_DIST = 9;    // camera height above the die centre, in half-sides
const BLEED = 1.5;     // viewport side ÷ die side: room for the corners of a spinning die
// Motion blur: the die is drawn `samples` times per frame over the last `shutter` of the roll
// (half a 60 fps frame of the 500 ms reference roll: an ~18° smear that keeps the pips readable as
// soft dots, like the reference; ~2.6° between samples so they do not strobe) and averaged.
const BLUR = Object.freeze({ samples: 8, shutter: 0.017 });
// Two extra turns plus one tumble: ~36° a frame and ~2.6 turns a roll, like the reference.
const TURNS = 2;
const SPREAD_SHARE = 0.2; // how far apart the dice drift, in cell pitches per pitch from the centre
const FADE_MS = 100;   // the landed canvas fades out over the DOM die

let THREE = null;      // the module once loaded, false when loading failed
let loading = null;
let geometries = null; // { body, pips } built once from dice-model.js
let kit = null;        // one renderer, scene and die for every roll: shaders compile once

export function loadDice3D() {
  if (THREE !== null) return Promise.resolve(THREE);
  if (loading) return loading;
  loading = import(/* webpackIgnore: true */ THREE_URL)
    .then((module) => { THREE = module; prepare(); return THREE; })
    .catch(() => { THREE = false; return THREE; });
  return loading;
}

export const dice3dStatus = () => (THREE === null ? (loading ? 'loading' : 'idle') : THREE ? 'ready' : 'unavailable');

function modelGeometries() {
  if (geometries) return geometries;
  const build = (part, rounded) => {
    const { positions, indices } = decodePart(part);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    if (rounded) {
      // Exact normals of a rounded box: smooth bevels and flat faces, whatever the decimation did.
      const n = new Float32Array(positions.length);
      const lim = 1 - ROUND_R;
      for (let i = 0; i < positions.length; i += 3) {
        const d = [0, 1, 2].map((a) => positions[i + a] - Math.max(-lim, Math.min(lim, positions[i + a])));
        const l = Math.hypot(d[0], d[1], d[2]) || 1;
        for (let a = 0; a < 3; a++) n[i + a] = d[a] / l;
      }
      g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    } else {
      g.computeVertexNormals();
    }
    return g;
  };
  geometries = { body: build(DIE_BODY, true), pips: build(DIE_PIPS, false) };
  return geometries;
}

// Built once after three.js loads, and its shaders compiled right away, so no roll ever waits for
// the GPU (a fresh renderer per roll stalled the first frame by ~0.4 s).
function prepare() {
  const canvas = document.createElement('canvas');
  canvas.className = 'dice3d';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  // Bright enough that a resting top face renders at the CSS die colour, so the hand-off does not flash.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.85);
  key.position.set(-2, 6, -3);
  scene.add(key);
  const geo = modelGeometries();
  // Transparent so the blur samples can be averaged; pips after the body so far-side pips stay hidden.
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, transparent: true });
  // Unlit pips: the light would grey them, and the DOM die (and the reference) has them flat black.
  const pipMat = new THREE.MeshBasicMaterial({ transparent: true });
  const model = new THREE.Group();
  const pips = new THREE.Mesh(geo.pips, pipMat);
  pips.renderOrder = 1;
  model.add(new THREE.Mesh(geo.body, bodyMat), pips);
  scene.add(model);
  // The top face (y = 1) spans exactly the cell's die at the edge of a BLEED-wide view.
  const camera = new THREE.PerspectiveCamera((2 * Math.atan(BLEED / (CAM_DIST - 1)) * 180) / Math.PI, 1, 0.5, 40);
  camera.position.set(0, CAM_DIST, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  renderer.compile(scene, camera);
  kit = { canvas, renderer, scene, camera, model, bodyMat, pipMat };
}

// dice: [{ index, from, value }] (the face shown before and the engine's new value); rects: DOMRect
// per cell index; rng: seeded, for spin variety. Resolves once the canvas has faded over the DOM.
export async function rollDice3D({ board, rects, dice, colors, rng, onLanded, durationMs = SPIN.durationMs }) {
  if (!(await loadDice3D()) || !kit || !dice.length) return false;
  const boardRect = board.getBoundingClientRect();
  if (boardRect.width < 40) return false;
  // room for the corners of the outer dice, drifted out by the spread
  const bleed = (rects[dice[0].index].width * (BLEED - 1)) / 2 + (boardRect.width / 3) * SPREAD_SHARE;
  const width = boardRect.width + 2 * bleed;
  const height = boardRect.height + 2 * bleed;
  const { canvas, renderer, scene, camera, model, bodyMat, pipMat } = kit;
  kit.rolling = true;
  Object.assign(canvas.style, { left: `${-bleed}px`, top: `${-bleed}px`, width: `${width}px`, height: `${height}px`, opacity: '1', transition: 'none' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(width, height, false);
  bodyMat.color.set(colors.die);
  pipMat.color.set(colors.pip);
  board.appendChild(canvas);

  const halfTurn = qAxisAngle([0, 1, 0], Math.PI); // a die turned 180° on the board shows the same layout
  const jobs = dice.map((d) => {
    const end = rng.next() < 0.5 ? landingQuaternion(d.value) : qMul(halfTurn, landingQuaternion(d.value));
    // tumble about a uniformly random axis: the reference shows dice corner-on to the viewer as often as not
    const a = rng.next() * Math.PI * 2;
    const h = rng.next() * 2 - 1;
    const axis = [Math.sqrt(1 - h * h) * Math.cos(a), h, Math.sqrt(1 - h * h) * Math.sin(a)];
    const plan = spinPlan(landingQuaternion(d.from ?? d.value), end, axis, TURNS, 1);
    const r = rects[d.index];
    const size = r.width * BLEED;
    const cx = r.left + r.width / 2 - boardRect.left;
    const cy = r.top + r.height / 2 - boardRect.top;
    const x = cx + bleed - size / 2;
    const y = height - (cy + bleed + size / 2); // GL origin is bottom-left
    // the spread moves each die away from the board centre, in proportion to its distance from it
    return { plan, size, x, y, dx: (cx - boardRect.width / 2) * SPREAD_SHARE, dy: (cy - boardRect.height / 2) * SPREAD_SHARE };
  });

  const draw = (u) => {
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    const samples = spinRemaining(u) > 0 ? BLUR.samples : 1;
    for (const j of jobs) {
      for (let k = 0; k < samples; k++) {
        // oldest sample first; opacity 1/(k+1) keeps a running average of the samples drawn so far
        const uk = samples > 1 ? u - (BLUR.shutter * (samples - 1 - k)) / (samples - 1) : u;
        const s = spreadAt(uk);
        renderer.setViewport(j.x + j.dx * s, j.y - j.dy * s, j.size, j.size);
        renderer.setScissor(j.x + j.dx * s, j.y - j.dy * s, j.size, j.size);
        const q = spinAt(j.plan, spinRemaining(uk));
        model.quaternion.set(q.x, q.y, q.z, q.w);
        bodyMat.opacity = 1 / (k + 1);
        pipMat.opacity = bodyMat.opacity;
        renderer.clearDepth();
        renderer.render(scene, camera);
      }
    }
  };

  await new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => {
      const u = (now - t0) / durationMs;
      draw(Math.min(1, u));
      if (u < 1) { requestAnimationFrame(tick); return; }
      // Landed face-on: the DOM die takes over underneath and the canvas fades out over it.
      if (onLanded) onLanded();
      canvas.style.transition = `opacity ${FADE_MS}ms linear`;
      requestAnimationFrame(() => { canvas.style.opacity = '0'; });
      setTimeout(resolve, FADE_MS + 20);
    };
    requestAnimationFrame(tick);
  });

  renderer.setScissorTest(false);
  renderer.clear();
  canvas.remove(); // kept with its renderer for the next roll
  kit.rolling = false;
  return true;
}

// Pictures of the resting die for every value, from the roll's scene and camera, so a DOM die drawn
// with them matches the last frame of a roll: { 1: dataURL, …, 6, '1h': …, '6h' } (h: the hand's
// pip colour). Null until three.js is ready, and while a roll owns the canvas.
export function renderFaces({ colors, px = 384 }) {
  if (!kit || kit.rolling) return null;
  const { canvas, renderer, scene, camera, model, bodyMat, pipMat } = kit;
  const view = Math.round(px * BLEED); // the roll's framing: the die spans the middle 1/BLEED
  renderer.setPixelRatio(1);
  renderer.setSize(view, view, false);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, view, view);
  const out = document.createElement('canvas');
  out.width = px;
  out.height = px;
  const ctx = out.getContext('2d');
  bodyMat.color.set(colors.die);
  bodyMat.opacity = 1;
  pipMat.opacity = 1;
  const faces = {};
  for (const [suffix, pip] of [['', colors.pip], ['h', colors.hand]]) {
    pipMat.color.set(pip);
    for (let v = 1; v <= 6; v++) {
      const q = landingQuaternion(v);
      model.quaternion.set(q.x, q.y, q.z, q.w);
      renderer.clear();
      renderer.render(scene, camera);
      ctx.clearRect(0, 0, px, px);
      ctx.drawImage(canvas, (view - px) / 2, (view - px) / 2, px, px, 0, 0, px, px);
      faces[`${v}${suffix}`] = out.toDataURL('image/png');
    }
  }
  return faces;
}
