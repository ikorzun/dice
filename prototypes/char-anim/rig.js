// A small cutout rig on Canvas 2D (prototype; docs/RESEARCH-CHARACTER-ANIMATION.md). The parts are cut from
// one drawing (art/bonuses/anim/refund-rig/cut.py); each is a bone with a pivot in the drawing's 1024 px
// frame. An animation poses the bones every frame (rotation, offset, scale, a swapped drawing); hanging
// parts are damped springs that lag behind their parent and overshoot, so motion overlaps by itself.

const DEG = Math.PI / 180;

// [a, b, c, d, e, f] as in canvas setTransform
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// A bone's matrix: offset, then rotate and scale about its pivot (all in the rest frame).
function local(p, pose) {
  const r = (pose.rot || 0) * DEG;
  const sx = pose.sx ?? 1;
  const sy = pose.sy ?? 1;
  const [px, py] = p.pivot;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const a = cos * sx, b = sin * sx, c = -sin * sy, d = cos * sy;
  return [a, b, c, d, px - a * px - c * py + (pose.dx || 0), py - b * px - d * py + (pose.dy || 0)];
}

const loadImage = (src) => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = src; });

// def: { parts: [{ name, z, at, pivot, parent?, spring? }], swaps: [{ name, swapFor, at }] }
export async function loadRig(dir, def) {
  const images = {};
  await Promise.all([...def.parts, ...def.swaps].map(async (p) => { images[p.name] = await loadImage(`${dir}/${p.name}.webp`); }));
  return { ...def, images, byName: Object.fromEntries(def.parts.map((p) => [p.name, p])) };
}

// A character on one canvas. An animation is a function of the time t (seconds since it started) that
// returns { bones: { name: pose }, free?: { name: pose }, hide?: [name] }; `free` bones are posed in the
// drawing's frame, unparented. `view` is the square of the drawing's frame the canvas shows.
export function createPuppet(canvas, rig, { onTwos = false, view = { x: 0, y: 0, size: rig.size } } = {}) {
  const ctx2d = canvas.getContext('2d');
  const springs = {};
  for (const p of rig.parts) if (p.spring) springs[p.name] = { off: 0, vel: 0, last: null, lastV: [0, 0], lastP: null };
  let anim = null;
  let start = 0;
  let lastT = null;
  const puppet = {
    onTwos,
    play(fn, at = performance.now()) { anim = fn; start = at; },
    draw(now) {
      if (!anim) return;
      let t = (now - start) / 1000;
      if (puppet.onTwos) t = Math.floor(t * 12) / 12; // held drawings, 12 a second
      const dt = lastT == null ? 1 / 60 : Math.min(0.05, Math.max(0, t - lastT));
      lastT = t;
      const { bones = {}, free = {}, hide = [] } = anim(t);
      const world = {};
      const order = [...rig.parts].sort((a, b) => depth(a) - depth(b));
      for (const p of order) {
        const pose = bones[p.name] || {};
        const parent = p.parent ? world[p.parent] : [1, 0, 0, 1, 0, 0];
        const s = springs[p.name];
        if (s && dt > 0) {
          // the parent's turn and the pivot's acceleration push the hanging part; it springs back
          const [a, b] = parent;
          const turn = Math.atan2(b, a) / DEG;
          const pivot = apply(parent, p.pivot[0], p.pivot[1]);
          if (s.last != null) {
            const v = [(pivot[0] - s.lastP[0]) / dt, (pivot[1] - s.lastP[1]) / dt];
            const acc = [(v[0] - s.lastV[0]) / dt, (v[1] - s.lastV[1]) / dt];
            s.off -= (turn - s.last) * p.spring.inertia;
            s.vel -= (acc[0] * p.spring.swayX + acc[1] * (p.spring.swayY || 0)) * dt * 0.01;
            s.lastV = v;
          }
          s.last = turn;
          s.lastP = pivot;
          s.vel += (-p.spring.k * s.off - p.spring.c * s.vel) * dt;
          s.off += s.vel * dt;
        }
        world[p.name] = mul(parent, local(p, { ...pose, rot: (pose.rot || 0) + (s ? s.off : 0) }));
      }
      const k = canvas.width / view.size;
      const ox = -view.x * k;
      const oy = -view.y * k;
      ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      const drawn = [...rig.parts].sort((a, b) => a.z - b.z);
      for (const p of drawn) {
        if (hide.includes(p.name)) continue;
        const pose = free[p.name];
        const m = pose ? local(p, pose) : world[p.name];
        const swap = (pose || bones[p.name] || {}).swap;
        const img = swap ? rig.images[swap] : rig.images[p.name];
        const at = swap ? rig.swaps.find((s) => s.name === swap).at : p.at;
        ctx2d.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k + ox, m[5] * k + oy);
        ctx2d.drawImage(img, at[0], at[1]);
      }
    },
  };
  const depth = (p) => (p.parent ? 1 + depth(rig.byName[p.parent]) : 0);
  return puppet;
}

// Keyframes: [[t, value, ease?], ...]; ease shapes the way into that key.
const EASE = {
  lin: (u) => u,
  i: (u) => u * u * u,
  o: (u) => 1 - (1 - u) ** 3,
  io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  back: (u) => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2, // overshoots, then settles
};
export function key(t, frames) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let n = 1; n < frames.length; n++) {
    const [t1, v1, ease = 'io'] = frames[n];
    const [t0, v0] = frames[n - 1];
    if (t <= t1) return v0 + (v1 - v0) * EASE[ease]((t - t0) / (t1 - t0));
  }
  return frames[frames.length - 1][1];
}
