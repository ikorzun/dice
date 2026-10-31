// 3D physics dice for the reroll: three.js renders rounded boxes with pip textures over the
// board, cannon-es tumbles them inside their own cells. The outcome is decided by the engine
// before the throw: the simulation is run hidden first, the face that lands up is read from
// the resting orientation, and the textures are assigned so that face shows the engine's
// value; then the same deterministic simulation is replayed on screen. Libraries load lazily
// from the CDN; when they are unavailable the caller falls back to the CSS tumble.

import { upFaceIndex, assignFaceValues, snapQuaternion, FACE_AXES } from './dice3d-math.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const CANNON_URL = 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

let libs = null;      // { THREE, CANNON } once loaded, false when loading failed
let loading = null;
const textureCache = new Map();

export function loadDice3D() {
  if (libs !== null) return Promise.resolve(libs);
  if (loading) return loading;
  loading = Promise.all([import(/* webpackIgnore: true */ THREE_URL), import(/* webpackIgnore: true */ CANNON_URL)])
    .then(([THREE, CANNON]) => { libs = { THREE, CANNON }; return libs; })
    .catch(() => { libs = false; return libs; });
  return loading;
}

export const dice3dStatus = () => (libs === null ? (loading ? 'loading' : 'idle') : libs ? 'ready' : 'unavailable');

function faceTexture(THREE, value, colors) {
  const key = `${value}|${colors.die}|${colors.pip}|${colors.edge}`;
  if (textureCache.has(key)) return textureCache.get(key);
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = colors.edge;
  ctx.fillRect(0, 0, size, size);
  const r = size * 0.16;
  ctx.fillStyle = colors.die;
  ctx.beginPath();
  ctx.roundRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92, r);
  ctx.fill();
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, 'rgba(255,255,255,.22)');
  grad.addColorStop(1, 'rgba(0,0,0,.14)');
  ctx.fillStyle = grad;
  ctx.fill();
  const pos = { 1: [[0.5, 0.5]], 2: [[0.25, 0.25], [0.75, 0.75]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]] };
  ctx.fillStyle = colors.pip;
  for (const [x, y] of pos[value]) {
    ctx.beginPath();
    ctx.arc(x * size, y * size, size * 0.085, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

// dice: [{ index, value }]; rects: DOMRect per cell index; rng: seeded, for throw variety.
export async function rollDice3D({ board, rects, dice, colors, rng, onLanded, maxSteps = 300 }) {
  const L = await loadDice3D();
  if (!L || !dice.length) return false;
  const { THREE, CANNON } = L;
  const boardRect = board.getBoundingClientRect();
  if (boardRect.width < 40) return false;

  const canvas = document.createElement('canvas');
  canvas.className = 'dice3d';
  board.appendChild(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch {
    canvas.remove();
    return false;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(boardRect.width, boardRect.height, false);
  renderer.setClearColor(0x000000, 0);

  // World: 1 unit = one cell pitch; the board spans x,z in [-1.5, 1.5]; y is up.
  const pitch = boardRect.width / 3;
  const scene = new THREE.Scene();
  const fov = 26;
  const camH = 1.5 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const camera = new THREE.PerspectiveCamera(fov, boardRect.width / boardRect.height, 0.1, 100);
  camera.position.set(0, camH, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-2, 6, -3);
  scene.add(key);

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -32, 0) });
  world.allowSleep = true;
  world.broadphase = new CANNON.SAPBroadphase(world);
  const floorMat = new CANNON.Material('floor');
  const dieMat = new CANNON.Material('die');
  world.addContactMaterial(new CANNON.ContactMaterial(floorMat, dieMat, { friction: 0.35, restitution: 0.35 }));
  world.addContactMaterial(new CANNON.ContactMaterial(dieMat, dieMat, { friction: 0.2, restitution: 0.3 }));
  const FLOOR_GROUP = 1 << 30;
  const floor = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: floorMat, collisionFilterGroup: FLOOR_GROUP, collisionFilterMask: -1 });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  const size = (rects[dice[0].index].width / pitch) * 0.9;
  const half = size / 2;
  const geometry = new THREE.BoxGeometry(size, size, size, 1, 1, 1);
  const items = dice.map((d, k) => {
    const r = rects[d.index];
    const cx = ((r.left + r.width / 2) - boardRect.left) / pitch - 1.5;
    const cz = ((r.top + r.height / 2) - boardRect.top) / pitch - 1.5;
    const group = 1 << k;
    const body = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(half, half, half)), material: dieMat, collisionFilterGroup: group, collisionFilterMask: FLOOR_GROUP | group, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.12, linearDamping: 0.02, angularDamping: 0.05 });
    body.position.set(cx + (rng.next() - 0.5) * 0.25, 1.4 + rng.next() * 0.6, cz + (rng.next() - 0.5) * 0.25);
    body.quaternion.setFromEuler(rng.next() * Math.PI * 2, rng.next() * Math.PI * 2, rng.next() * Math.PI * 2);
    body.velocity.set((rng.next() - 0.5) * 1.5, 1.5 + rng.next() * 2, (rng.next() - 0.5) * 1.5);
    body.angularVelocity.set((rng.next() - 0.5) * 24, (rng.next() - 0.5) * 24, (rng.next() - 0.5) * 24);
    world.addBody(body);
    // Invisible walls keep each die inside its own cell.
    const wallH = 4;
    const wallT = 0.05;
    const wallOffset = 0.5 + wallT;
    for (const [dx, dz, sx, sz] of [[wallOffset, 0, wallT, 0.5], [-wallOffset, 0, wallT, 0.5], [0, wallOffset, 0.5, wallT], [0, -wallOffset, 0.5, wallT]]) {
      const wall = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(sx, wallH / 2, sz)), material: floorMat, collisionFilterGroup: group, collisionFilterMask: group });
      wall.position.set(cx + dx, wallH / 2, cz + dz);
      world.addBody(wall);
    }
    const mesh = new THREE.Mesh(geometry, []);
    scene.add(mesh);
    return { die: d, body, mesh, cx, cz };
  });

  // Hidden pre-simulation with a fixed step: deterministic, so the replay lands identically.
  const dt = 1 / 60;
  const frames = [];
  for (let step = 0; step < maxSteps; step++) {
    world.step(dt);
    frames.push(items.map(({ body }) => ({ p: [body.position.x, body.position.y, body.position.z], q: { x: body.quaternion.x, y: body.quaternion.y, z: body.quaternion.z, w: body.quaternion.w } })));
    if (step > 45 && items.every(({ body }) => body.sleepState === CANNON.Body.SLEEPING || (body.velocity.length() < 0.08 && body.angularVelocity.length() < 0.2))) break;
  }
  const last = frames[frames.length - 1];
  items.forEach((it, k) => {
    const top = upFaceIndex(last[k].q);
    const values = assignFaceValues(top, it.die.value);
    it.mesh.material = values.map((v) => new THREE.MeshStandardMaterial({ map: faceTexture(THREE, v, colors), roughness: 0.55, metalness: 0.05 }));
    it.snapQ = snapQuaternion(last[k].q);
    it.restY = last[k].p[1];
  });

  // On-screen replay, then a short settle tween onto the cell centre.
  await new Promise((resolve) => {
    let frame = 0;
    let settleStart = 0;
    const settleMs = 160;
    const from = items.map(() => ({ p: null, q: null }));
    const tick = (now) => {
      if (frame < frames.length) {
        const f = frames[Math.min(frame, frames.length - 1)];
        items.forEach((it, k) => {
          it.mesh.position.set(f[k].p[0], f[k].p[1], f[k].p[2]);
          it.mesh.quaternion.set(f[k].q.x, f[k].q.y, f[k].q.z, f[k].q.w);
        });
        frame++;
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
        return;
      }
      if (!settleStart) {
        settleStart = now;
        items.forEach((it, k) => { from[k].p = it.mesh.position.clone(); from[k].q = it.mesh.quaternion.clone(); });
        if (onLanded) onLanded();
      }
      const t = Math.min(1, (now - settleStart) / settleMs);
      const e = 1 - (1 - t) * (1 - t);
      items.forEach((it, k) => {
        it.mesh.position.set(from[k].p.x + (it.cx - from[k].p.x) * e, from[k].p.y + (half - from[k].p.y) * e, from[k].p.z + (it.cz - from[k].p.z) * e);
        it.mesh.quaternion.slerpQuaternions(from[k].q, new THREE.Quaternion(it.snapQ.x, it.snapQ.y, it.snapQ.z, it.snapQ.w), e);
      });
      renderer.render(scene, camera);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });

  items.forEach((it) => it.mesh.material.forEach((m) => m.dispose()));
  geometry.dispose();
  renderer.dispose();
  canvas.remove();
  return true;
}

export { FACE_AXES };
