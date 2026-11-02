// The pawnbroker bird (REFUND) on the cutout rig: who hangs from whom, the springs, and its three
// animations. Timing after the research plan: anticipation → action → follow-through → hold, arcs,
// overlapping parts (the springs), drawings swapped at the key moments.
import { key } from './rig.js';

// parent, pivot (the joint, in the 1024 px drawing) and spring of each part; `at` comes from parts.json
const BONES = {
  body: { pivot: [500, 965] }, // the feet: breathing squashes the whole bird from the ground
  tail: { parent: 'body', pivot: [330, 600], spring: { k: 90, c: 6, inertia: 0.9, swayX: 0.5 } },
  sack: { parent: 'body', pivot: [410, 235], spring: { k: 55, c: 4.5, inertia: 1.1, swayX: 0.8, swayY: 0.4 } },
  wingBack: { parent: 'body', pivot: [345, 330], spring: { k: 120, c: 8, inertia: 0.7, swayX: 0.4 } },
  plume: { parent: 'head', pivot: [590, 118], spring: { k: 70, c: 3.5, inertia: 1.3, swayX: 0.9, swayY: 0.3 } },
  head: { parent: 'body', pivot: [655, 300] },
  wingFront: { parent: 'body', pivot: [640, 445] },
  coin: { parent: 'wingFront', pivot: [750, 432] },
};

export async function birdDef(dir) {
  const meta = await (await fetch(`${dir}/parts.json`)).json();
  return {
    size: meta.size,
    parts: meta.parts.filter((p) => !p.swapFor && !p.overlayOf).map((p) => ({ ...p, ...BONES[p.name] })),
    swaps: meta.parts.filter((p) => p.swapFor),
    overlays: meta.parts.filter((p) => p.overlayOf),
    eyes: meta.eyes,
  };
}

// Eyes, drawn in code over the head (gaze edits of the picture came out off model): each eyeball, in the
// shape the drawing has, covers the drawn pupil; a pupil moves inside it (clipped, so the lid line still
// hides its top) in quick saccades with a little drift; a lid comes down in the lid colour with an ink edge
// parallel to the drawn lid line. A blink: the lid falls (60 ms), the drawn shut eyes (60 ms), the lid
// lifts (80 ms). The eyes move before the head.
const GAZE = { back: [0.1, 0.35], front: [0.48, 0.62], coin: [0.8, 0.74], up: [0.74, 0.3] };
const SACCADE = 0.07;
const INK = '#0d0b0f';
const fade = (u, d) => Math.max(0, Math.min(1, u / d));
const easeOut = (u) => 1 - (1 - u) ** 3;
const easeIn = (u) => u * u * u;

// a blink u seconds in: the lid's fall (0..1) and whether the drawn shut eyes show
function blinkAt(u) {
  if (u < 0 || u >= 0.2) return null;
  if (u < 0.06) return { lid: easeIn(u / 0.06) };
  if (u < 0.12) return { lid: 1, shut: true };
  return { lid: 1 - easeOut((u - 0.12) / 0.08) };
}

// the pupil's place for a gaze track [[t, gaze], ...]: a saccade from the last place, then a drift
function gazeAt(track, t) {
  let k = track.length - 1;
  while (k > 0 && track[k][0] > t) k--;
  const to = GAZE[track[k][1]];
  const from = k > 0 ? GAZE[track[k - 1][1]] : to;
  const u = easeOut(fade(t - track[k][0], SACCADE));
  return [from[0] + (to[0] - from[0]) * u + 0.02 * Math.sin(3.1 * t), from[1] + (to[1] - from[1]) * u + 0.02 * Math.sin(2.3 * t + 1)];
}

// the head's pose for the eyes: { eyes: { gaze, lid }, overlays } with a blink, a hold or the gaze
function eyesPose(track, t, { blink = null, lid = 0, hold = null } = {}) {
  const b = blink == null ? null : blinkAt(t - blink);
  const eyes = { gaze: gazeAt(track, t), lid: b ? Math.max(lid, b.lid) : lid };
  const overlays = hold ? [{ name: hold.name, alpha: hold.alpha ?? 1 }] : b && b.shut ? [{ name: 'eyes-closed', alpha: 1 }] : [];
  return { eyes, overlays };
}

export function drawEyes(ctx, pose, rig) {
  const e = pose.eyes;
  if (!e) return;
  rig.eyes.forEach((eye, k) => {
    const [x0, y0, x1, y1] = eye.box;
    const hull = new Path2D();
    eye.hull.forEach(([x, y], n) => (n ? hull.lineTo(x, y) : hull.moveTo(x, y)));
    hull.closePath();
    ctx.save();
    ctx.clip(hull);
    ctx.fillStyle = eye.eye;
    ctx.fill(hull);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x0 + e.gaze[0] * (x1 - x0), y0 + e.gaze[1] * (y1 - y0), k ? 10 : 13, k ? 13 : 16, 0, 0, 2 * Math.PI);
    ctx.fill();
    if (e.lid > 0.02) {
      const d = e.lid * (y1 - y0 + 8);
      const edge = () => eye.top.forEach(([x, y], n) => (n ? ctx.lineTo(x, y + d) : ctx.moveTo(x, y + d)));
      ctx.beginPath();
      edge();
      ctx.lineTo(x1 + 12, y0 - 40);
      ctx.lineTo(x0 - 12, y0 - 40);
      ctx.closePath();
      ctx.fillStyle = eye.lid;
      ctx.fill();
      ctx.beginPath();
      edge();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  });
}

function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// Idle, looped on the tile: breathing from the feet, the head a beat behind it, the hand rubbing the
// coin; the eyes wander (back, at the player, at the coin) and blink at random 2.5–6 s; now and then a
// glance at the coin, the eyes first. Never fully still.
export function idle(seed = 1) {
  const r = rng(seed);
  const glances = [];
  for (let t = 3 + r() * 4; t < 900; t += 6 + r() * 6) glances.push(t);
  const track = [[0, 'back']];
  const blinks = [];
  let gaze = 'back';
  for (let t = 1 + r() * 2; t < 900; ) {
    const g = glances.find((x) => x - 0.12 >= t - 3.5 && x - 0.12 < t);
    if (g != null && track[track.length - 1][0] < g - 0.12) {
      track.push([g - 0.12, 'coin'], [g + 1.35, gaze]); // the eyes go to the coin before the head turns
      t = g + 1.35 + 1 + r() * 2;
      continue;
    }
    const options = ['back', 'front', 'coin', 'back', 'front'].filter((x) => x !== gaze);
    const next = options[Math.floor(r() * options.length)];
    if (r() < 0.3) blinks.push(t - 0.05); // a blink as the eyes shift
    track.push([t, next]);
    gaze = next;
    t += 1.2 + r() * 2.3;
  }
  for (let t = 0.8 + r() * 2.5; t < 900; t += 2.5 + r() * 3.5) blinks.push(t);
  blinks.sort((x, y) => x - y);
  const period = 2.8 + r() * 0.4;
  return (t) => {
    const w = (2 * Math.PI * t) / period;
    const breath = Math.sin(w);
    const g = glances.find((x) => t >= x && t < x + 1.6);
    const glance = g == null ? 0 : key(t - g, [[0, 0], [0.35, 1, 'io'], [1.1, 1], [1.6, 0, 'io']]);
    const b = blinks.find((x) => t >= x && t < x + 0.2);
    return {
      bones: {
        body: { sy: 1 + 0.016 * breath, sx: 1 - 0.008 * breath },
        head: { rot: 2.6 * Math.sin(w - 0.8) + 9 * glance, dy: -3 * Math.sin(w - 0.6), ...eyesPose(track, t, { blink: b ?? null, lid: 0.22 * glance }) }, // a greedy squint at the coin
        wingFront: { rot: 3.5 * Math.sin(2 * w + 1) - 7 * glance }, // rubs the coin; lifts it to the eye on a glance
        coin: { rot: 7 * Math.sin(2 * w) },
        wingBack: { rot: 2 * Math.sin(w - 1.3) },
        sack: { rot: 1.4 * Math.sin(w - 1.9) },
        tail: { rot: 2.2 * Math.sin(w - 2.3) },
      },
    };
  };
}

// The tap that switches the bonus on (0.6 s): a start — squash, hop, eyes wide, the coin clutched to
// the chest — then it settles into the idle.
export const REACT_S = 0.6;
const REACT_GAZE = [[0, 'back']];
export function react(t) {
  const sy = key(t, [[0, 1], [0.07, 0.9, 'o'], [0.19, 1.08, 'o'], [0.36, 0.97, 'io'], [0.6, 1, 'io']]);
  return {
    bones: {
      body: { sy, sx: 1 + (1 - sy) * 0.6, dy: key(t, [[0, 0], [0.07, 0], [0.2, -28, 'o'], [0.38, 0, 'i'], [0.6, 0]]) },
      head: {
        rot: key(t, [[0, 0], [0.1, -11, 'o'], [0.42, -4, 'io'], [0.6, 0, 'io']]),
        // wide at once, held, then a blink back to the usual look
        ...eyesPose(REACT_GAZE, t, { blink: 0.42, hold: t < 0.42 ? { name: 'eyes-wide', alpha: fade(t, 0.04) } : null }),
      },
      wingFront: { rot: key(t, [[0, 0], [0.1, -20, 'o'], [0.42, -13], [0.6, 0, 'io']]) },
    },
  };
}

// The bonus screen (2 s): eyes the coin, a long sigh, winds up, tosses the coin back (it flips and flies
// off in an arc), the empty wing follows through and settles, then a sulky turn away.
export const TRIGGER_S = 2;
const TOSS = 0.95;
const wingRot = (t) => key(t, [[0, 0], [0.25, -8, 'o'], [0.7, -4], [0.88, 22, 'io'], [0.96, -22, 'o'], [1.1, -28, 'o'], [1.45, 6, 'io'], [1.72, -2, 'io'], [2, 0, 'io']]);
const bodySy = (t) => key(t, [[0, 1], [0.25, 1], [0.47, 1.05, 'io'], [0.72, 0.955, 'io'], [0.88, 0.93, 'io'], [0.96, 1.07, 'o'], [1.15, 0.98, 'io'], [1.4, 1.01, 'io'], [2, 1, 'io']]);
const bodyDy = (t) => key(t, [[0, 0], [0.88, 7], [0.96, -16, 'o'], [1.2, 0, 'io']]);

// where the coin's centre is at the toss: turned with the wing about the shoulder, then the body's
// squash about the feet
function coinAtToss() {
  const r = (wingRot(TOSS) * Math.PI) / 180;
  const [px, py] = BONES.wingFront.pivot;
  const [cx, cy] = BONES.coin.pivot;
  let x = px + (cx - px) * Math.cos(r) - (cy - py) * Math.sin(r);
  let y = py + (cx - px) * Math.sin(r) + (cy - py) * Math.cos(r);
  const sy = bodySy(TOSS);
  const [fx, fy] = BONES.body.pivot;
  x = fx + (x - fx) * (1 + (1 - sy) * 0.5);
  y = fy + (y - fy) * sy + bodyDy(TOSS);
  return [x, y];
}

// on the coin first (the head follows), shut through the sigh, on the coin for the wind-up, after the coin
// as it flies, then back, and a sulky shut
const TRIGGER_GAZE = [[0, 'back'], [0.02, 'coin'], [0.97, 'up'], [1.5, 'back']];
function triggerEyes(t) {
  if (t >= 0.26 && t < 0.78) return eyesPose(TRIGGER_GAZE, t, { lid: t < 0.32 ? easeIn(fade(t - 0.26, 0.06)) : t < 0.7 ? 1 : 1 - easeOut(fade(t - 0.7, 0.08)), hold: t >= 0.32 && t < 0.7 ? { name: 'eyes-closed' } : null });
  return eyesPose(TRIGGER_GAZE, t, { blink: t >= 1.6 ? 1.62 : null, lid: t >= 1.68 && t < 1.88 ? 1 : 0, hold: t >= 1.68 && t < 1.88 ? { name: 'eyes-closed' } : null });
}

export function trigger(t) {
  const sy = bodySy(t);
  const out = {
    bones: {
      body: { sy, sx: 1 + (1 - sy) * 0.5, dy: bodyDy(t) },
      head: {
        rot: key(t, [[0, 0], [0.25, 10, 'o'], [0.47, -7, 'io'], [0.72, 5, 'io'], [0.88, -11, 'io'], [0.96, 6, 'o'], [1.3, -2, 'io'], [1.6, 0, 'io'], [1.78, -10, 'o'], [2, -9]]),
        swap: t >= 0.3 && t < 0.8 ? 'head-sigh' : undefined,
        swapAlpha: Math.min(fade(t - 0.3, 0.06), fade(0.8 - t, 0.06)), // the beak opens and shuts softly
        ...triggerEyes(t),
      },
      wingFront: { rot: wingRot(t), swap: t >= TOSS ? 'wingFront-empty' : undefined },
      coin: { rot: key(t, [[0, 0], [0.88, -20], [0.95, 10]]) },
    },
    hide: [],
  };
  if (t >= TOSS) {
    const u = (t - TOSS) / 0.62;
    if (u > 1) out.hide.push('coin');
    else {
      const [x0, y0] = coinAtToss();
      const [x1, y1] = [1260, -220];
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u - 300 * Math.sin(Math.PI * u); // an arc up and out
      const s = 1 + 0.6 * u;
      const [cx, cy] = BONES.coin.pivot;
      out.free = { coin: { dx: x - cx, dy: y - cy, sx: s * Math.cos(5 * Math.PI * u), sy: s, rot: 25 * u } };
    }
  }
  return out;
}
