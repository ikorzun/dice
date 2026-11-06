// A small cutout rig on Canvas 2D (docs/RESEARCH-CHARACTER-ANIMATION.md §3, after prototypes/char-anim/rig.js).
// The parts are cut from one drawing (art/bonuses/anim/<name>-rig/cut.py); each is a bone with a pivot in the
// drawing's 1024 px frame. A pose moves a bone (rot in degrees, dx, dy, sx, sy about its pivot); a hanging part
// is a damped spring that lags behind its parent and overshoots, so motion overlaps by itself. Parts marked
// `clip` are cut at the card's edge the character peeks over.

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

// Keyframes: [[seconds, value, ease?], ...]; the ease shapes the way into that key (slow in and out by default).
const EASE = {
  lin: (u) => u,
  i: (u) => u * u * u,
  o: (u) => 1 - (1 - u) ** 3,
  io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
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

// def: { parts: [{ name, at, size, pivot, parent?, spring?, clip? }] (back to front), view: [x, y, w, h], edge }
// images: { name: HTMLImageElement } (any resolution: drawn at the part's size). pose(t, dt) returns
// { name: { rot, dx, dy, sx, sy } } for the time t in seconds.
export function createPuppet(canvas, def, images, pose) {
  const ctx = canvas.getContext('2d');
  const springs = {};
  for (const p of def.parts) if (p.spring) springs[p.name] = { off: 0, vel: 0, last: null, lastP: null, lastV: [0, 0] };
  const byName = Object.fromEntries(def.parts.map((p) => [p.name, p]));
  const depth = (p) => (p.parent ? 1 + depth(byName[p.parent]) : 0);
  const order = [...def.parts].sort((a, b) => depth(a) - depth(b));
  let lastT = null;
  return {
    draw(t) {
      const dt = lastT == null ? 0 : Math.min(0.05, Math.max(0, t - lastT));
      lastT = t;
      const bones = pose(t, dt);
      const world = {};
      for (const p of order) {
        const b = bones[p.name] || {};
        const parent = p.parent ? world[p.parent] : [1, 0, 0, 1, 0, 0];
        const s = springs[p.name];
        if (s && dt > 0) {
          // the parent's turn and the pivot's acceleration push the hanging part; it springs back
          const turn = Math.atan2(parent[1], parent[0]) / DEG;
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
        world[p.name] = mul(parent, local(p, { ...b, rot: (b.rot || 0) + (s ? s.off : 0) }));
      }
      const [vx, vy, vw] = def.view;
      const k = canvas.width / vw;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of def.parts) {
        const m = world[p.name];
        ctx.save();
        if (p.clip) {
          ctx.beginPath();
          ctx.rect(0, 0, canvas.width, (def.edge - vy) * k);
          ctx.clip();
        }
        ctx.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, (m[4] - vx) * k, (m[5] - vy) * k);
        ctx.drawImage(images[p.name], p.at[0], p.at[1], p.size[0], p.size[1]);
        ctx.restore();
      }
    },
  };
}
