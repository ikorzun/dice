// 3D dice: variant D of prototypes/dice-anim ("three.js по ключам"), put in the game by the owner on
// 01.11.2026 in place of the in-place spin after the reference video. A rerolled die crouches, rises
// a little, tumbles once about a nearly horizontal axis into the floor, touches down on an edge and
// is pulled flat onto the engine's value like a magnet, with no second bounce (owner, 01.11.2026);
// a shadow spot on the board follows it, and the dice start 45 ms apart in a shuffled order. No
// physics: the lift and the squash are WAAPI keyframes on the (hidden) cell and the GL die follows
// the cell's live box. The resting dice are pictures of the same model from the same camera
// (renderFaces), so nothing changes when the DOM die takes over. Each die is drawn by its own camera
// straight above it (viewport + scissor over one canvas laid over the board). three.js loads lazily
// from the CDN; when it is unavailable the caller keeps the CSS dice and their tumble.

import { landingQuaternion, tumblePlan, tumblePose, qAxisAngle, qMul, ROLL, dimpleNormals } from './dice3d-math.js';
import { DIE_PIPS, decodePart } from './dice-model.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// The die is rounded like the owner's Figma mockup (32 px on a 125.67 px die), in half-sides: a
// rounded box replaces the model's own body (bevel 0.224), and the model's pips are wrapped onto it.
const ROUND_R = (32 / 125.667) * 2;
const SEGMENTS = 32;   // per cube edge: ~8 steps across each rounded band, smooth at 3× pixel ratio
const CAM_DIST = 9;    // camera height above the die centre, in half-sides
const BLEED = 1.5;     // viewport side ÷ die side: room for the corners of a tumbling die
const FADE_MS = 100;   // the landed canvas fades out over the DOM die
// Lift of the cell (a tumbling cube already looks bigger, so it rises only 6%): crouch, rise, fall
// onto the board by the edge touch and stay down; one short squash as the face snaps flat.
const LIFT = [
  { offset: 0, transform: 'translate(0, 0) scale(1)', easing: 'cubic-bezier(.3, 0, .6, 1)' },
  { offset: ROLL.start, transform: 'translate(0, 1.5%) scale(.95)', easing: 'cubic-bezier(.2, .7, .35, 1)' },
  { offset: 0.455, transform: 'translate(0, -6%) scale(1.06)', easing: 'cubic-bezier(.55, 0, .85, .4)' },
  { offset: ROLL.edge, transform: 'translate(0, 0) scale(1)', easing: 'linear' },
  { offset: ROLL.flat - 0.03, transform: 'translate(0, 0) scale(1)', easing: 'cubic-bezier(.5, 0, 1, 1)' },
  { offset: ROLL.flat, transform: 'translate(0, 0) scale(1.03, .97)', easing: 'cubic-bezier(.2, .8, .4, 1)' },
  { offset: 1, transform: 'translate(0, 0) scale(1)' },
];
// Shadow spot under the die: it slides away and thins as the die rises, comes back as it falls and
// sits under it from the edge touch. The resting dice have no shadow, so it fades in during the
// crouch and out once the face is flat.
const SHADOW = [
  { offset: 0, transform: 'translate(5%, 7%) scale(1.04)', opacity: 0, easing: 'cubic-bezier(.3, 0, .6, 1)' },
  { offset: ROLL.start, transform: 'translate(4%, 6%) scale(1.02)', opacity: 0.6, easing: 'cubic-bezier(.2, .7, .35, 1)' },
  { offset: 0.455, transform: 'translate(17%, 22%) scale(.84)', opacity: 0.2, easing: 'cubic-bezier(.55, 0, .85, .4)' },
  { offset: ROLL.edge, transform: 'translate(5%, 7%) scale(1.04)', opacity: 0.6, easing: 'linear' },
  { offset: ROLL.flat, transform: 'translate(5%, 7%) scale(1.04)', opacity: 0.6, easing: 'ease-out' },
  { offset: 1, transform: 'translate(5%, 7%) scale(1.04)', opacity: 0 },
];

let THREE = null;      // the module once loaded, false when loading failed
let loading = null;
let geometries = null; // { body, pips } built once
let kit = null;        // one renderer, scene and die for every roll: shaders compile once
let matcapUrls = null; // matcaps for the dice body and the pips ({ body, pips }); null: the lit material

// Shade the dice with matcap images (call before loadDice3D): the body's image is tinted by the die
// colour (white, lime when held); the pips' dark image is their colour as it is (they are pressed in).
export function useMatcap(body, pips = null) { matcapUrls = { body, pips }; }

export function loadDice3D() {
  if (THREE !== null) return Promise.resolve(THREE);
  if (loading) return loading;
  loading = import(/* webpackIgnore: true */ THREE_URL)
    .then(async (module) => {
      THREE = module;
      const load = async (url) => {
        const tex = url ? await new THREE.TextureLoader().loadAsync(url).catch(() => null) : null;
        if (tex) tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      };
      prepare(matcapUrls ? { body: await load(matcapUrls.body), pips: await load(matcapUrls.pips) } : {});
      return THREE;
    })
    .catch(() => { THREE = false; return THREE; });
  return loading;
}

export const dice3dStatus = () => (THREE === null ? (loading ? 'loading' : 'idle') : THREE ? 'ready' : 'unavailable');

// Pulls every point onto the rounded box of half-side 1 (radius `radius` around the inner box of
// half-side 1 - ROUND_R) and, when asked, writes the exact normal there.
function roundOnto(positions, radius, normals = null) {
  const lim = 1 - ROUND_R;
  for (let i = 0; i < positions.length; i += 3) {
    const c = [0, 1, 2].map((a) => Math.max(-lim, Math.min(lim, positions[i + a])));
    const d = [0, 1, 2].map((a) => positions[i + a] - c[a]);
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    for (let a = 0; a < 3; a++) {
      positions[i + a] = c[a] + (d[a] / l) * radius;
      if (normals) normals[i + a] = d[a] / l;
    }
  }
}

function modelGeometries() {
  if (geometries) return geometries;
  const body = new THREE.BoxGeometry(2, 2, 2, SEGMENTS, SEGMENTS, SEGMENTS);
  roundOnto(body.attributes.position.array, ROUND_R, body.attributes.normal.array);
  // The model's pips are flat discs 0.002 above each face; near the edges they follow the curve.
  // Each triangle is split in 16 first, or its long sides would cut under the rounded surface.
  const { positions, indices } = decodePart(DIE_PIPS);
  let tris = Array.from(indices, (i) => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]]);
  for (let pass = 0; pass < 2; pass++) {
    const split = [];
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    for (let t = 0; t < tris.length; t += 3) {
      const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
      const [ab, bc, ca] = [mid(a, b), mid(b, c), mid(c, a)];
      split.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    tris = split;
  }
  const flat = new Float32Array(tris.flat());
  const normals = new Float32Array(flat.length);
  roundOnto(flat, ROUND_R + 0.002, normals);
  dimpleNormals(flat, normals); // pressed in: shaded like a bowl under a matcap
  const pips = new THREE.BufferGeometry();
  pips.setAttribute('position', new THREE.BufferAttribute(flat, 3));
  pips.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometries = { body, pips };
  return geometries;
}

// Widest point of the resting die as the camera sees it (x ÷ depth over the rounded top edge and
// the side wall): framing the view on it makes the die's outline span its cell exactly.
function silhouette() {
  const lim = 1 - ROUND_R;
  let best = 0;
  for (let k = 0; k <= 90; k++) {
    const t = (k * Math.PI) / 180;
    best = Math.max(best, (lim + ROUND_R * Math.sin(t)) / (CAM_DIST - lim - ROUND_R * Math.cos(t)));
  }
  return best;
}

// Built once after three.js loads, and its shaders compiled right away, so no roll ever waits for
// the GPU (a fresh renderer per roll stalled the first frame by ~0.4 s).
function prepare(matcaps = {}) {
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
  const bodyMat = matcaps.body ? new THREE.MeshMatcapMaterial({ matcap: matcaps.body }) : new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
  // Unlit pips: the light would grey them, and the DOM die (and the reference) has them flat black.
  const pipMat = matcaps.pips ? new THREE.MeshMatcapMaterial({ matcap: matcaps.pips }) : new THREE.MeshBasicMaterial();
  pipMat.userData.ink = !matcaps.pips; // flat: the look's pip colour; a matcap carries its own
  const model = new THREE.Group();
  model.add(new THREE.Mesh(geo.body, bodyMat), new THREE.Mesh(geo.pips, pipMat));
  scene.add(model);
  // The resting die's outline spans exactly the middle 1/BLEED of the view (its cell).
  const camera = new THREE.PerspectiveCamera((2 * Math.atan(BLEED * silhouette()) * 180) / Math.PI, 1, 0.5, 40);
  camera.position.set(0, CAM_DIST, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  renderer.compile(scene, camera);
  kit = { canvas, renderer, scene, camera, model, bodyMat, pipMat };
}

// dice: [{ index, from, value }] (the face shown before and the engine's new value); cells: the cell
// elements by index (each rolled one hidden by the caller; its box carries the lift); rng: seeded,
// for the throw's variety. Resolves once the canvas has faded over the DOM.
export async function rollDice3D({ board, cells, dice, colors, rng, onLanded }) {
  if (!(await loadDice3D()) || !kit || !dice.length) return false;
  const boardRect = board.getBoundingClientRect();
  if (boardRect.width < 40) return false;
  // room for the corners of a tumbling die at its lift and peak scale
  const cellRect = cells[dice[0].index].getBoundingClientRect();
  const bleed = (cellRect.width * (BLEED * 1.06 - 1)) / 2 + cellRect.height * 0.06;
  const width = boardRect.width + 2 * bleed;
  const height = boardRect.height + 2 * bleed;
  const { canvas, renderer, scene, camera, model, bodyMat, pipMat } = kit;
  kit.rolling = true;
  Object.assign(canvas.style, { left: `${-bleed}px`, top: `${-bleed}px`, width: `${width}px`, height: `${height}px`, opacity: '1', transition: 'none' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(width, height, false);
  bodyMat.color.set(colors.die);
  pipMat.color.set(pipMat.userData.ink ? colors.pip : '#ffffff');

  // the cascade: a shuffled order, not a row
  const order = dice.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const k = Math.floor(rng.next() * (i + 1));
    [order[i], order[k]] = [order[k], order[i]];
  }
  const halfTurn = qAxisAngle([0, 1, 0], Math.PI); // a die turned 180° on the board shows the same layout
  const jobs = order.map((d, k) => {
    const end = rng.next() < 0.5 ? landingQuaternion(d.value) : qMul(halfTurn, landingQuaternion(d.value));
    const a = rng.next() * Math.PI * 2; // a nearly horizontal tumble axis: the die rolls over its edges
    const plan = tumblePlan(landingQuaternion(d.from ?? d.value), end, [Math.cos(a), 0.25 * (rng.next() - 0.5), Math.sin(a)]);
    const cell = cells[d.index];
    const timing = { duration: ROLL.durationMs, delay: k * ROLL.staggerMs, fill: 'backwards' };
    const r = cell.getBoundingClientRect();
    const shadow = document.createElement('div');
    shadow.className = 'dice3d-shadow';
    Object.assign(shadow.style, {
      left: `${r.left - boardRect.left + r.width * 0.03}px`,
      top: `${r.top - boardRect.top + r.height * 0.03}px`,
      width: `${r.width * 0.94}px`,
      height: `${r.height * 0.94}px`,
    });
    board.appendChild(shadow);
    shadow.animate(SHADOW, timing);
    return { plan, cell, shadow, delay: timing.delay, lift: cell.animate(LIFT, timing) };
  });
  board.appendChild(canvas);

  // Every die every frame, also before its turn (its old face, still) and after it lands (its new
  // face, flat): the board shows the canvas until the last die lands, then hands over at once.
  const draw = () => {
    const br = board.getBoundingClientRect();
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    const live = jobs.map((j) => ({ j, box: j.cell.getBoundingClientRect() })).sort((p, q) => p.box.width - q.box.width); // the lifted die on top
    for (const { j, box } of live) {
      const u = Math.min(1, Math.max(0, ((j.lift.currentTime ?? 0) - j.delay) / ROLL.durationMs));
      // the squash as the face snaps flat makes the box non-square: the picture squashes with it
      const w = box.width * BLEED;
      const h = box.height * BLEED;
      const x = box.left + box.width / 2 - br.left + bleed - w / 2;
      const y = height - (box.top + box.height / 2 - br.top + bleed + h / 2); // GL origin is bottom-left
      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);
      const q = tumblePose(j.plan, u);
      model.quaternion.set(q.x, q.y, q.z, q.w);
      renderer.clearDepth();
      renderer.render(scene, camera);
    }
  };

  let landed = false;
  Promise.all(jobs.map((j) => j.lift.finished)).catch(() => {}).then(() => { landed = true; });
  await new Promise((resolve) => {
    const tick = () => {
      draw();
      if (!landed) { requestAnimationFrame(tick); return; }
      // All landed face-on: the DOM dice take over underneath and the canvas fades out over them.
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
  jobs.forEach((j) => j.shadow.remove());
  kit.rolling = false;
  return true;
}

// Pictures of the resting die for every value, from the roll's scene and camera, so a DOM die drawn
// with them matches the last frame of a roll: keys are the value, then 'k' for the held body colour
// ('3', '3k'). Null until three.js is ready, and while a roll owns the canvas.
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
  const faces = {};
  pipMat.color.set(pipMat.userData.ink ? colors.pip : '#ffffff');
  for (const [body, die] of [['', colors.die], ['k', colors.held || colors.die]]) {
    bodyMat.color.set(die);
    for (let v = 0; v <= 6; v++) { // 0: the blank face a bonus die wears
      const q = landingQuaternion(v || 1);
      pipMat.visible = v > 0;
      model.quaternion.set(q.x, q.y, q.z, q.w);
      renderer.clear();
      renderer.render(scene, camera);
      ctx.clearRect(0, 0, px, px);
      ctx.drawImage(canvas, (view - px) / 2, (view - px) / 2, px, px, 0, 0, px, px);
      faces[`${v}${body}`] = out.toDataURL('image/png');
    }
  }
  pipMat.visible = true;
  return faces;
}
