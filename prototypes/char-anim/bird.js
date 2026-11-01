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
    parts: meta.parts.filter((p) => !p.swapFor).map((p) => ({ ...p, ...BONES[p.name] })),
    swaps: meta.parts.filter((p) => p.swapFor),
  };
}

function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// Idle, looped on the tile: breathing from the feet, the head a beat behind it, the hand rubbing the
// coin; now and then a glance at the coin; blinks at random 2.5–6 s. Never fully still.
export function idle(seed = 1) {
  const r = rng(seed);
  const blinks = [];
  for (let t = 0.8 + r() * 2.5; t < 900; t += 2.5 + r() * 3.5) blinks.push(t);
  const glances = [];
  for (let t = 3 + r() * 4; t < 900; t += 6 + r() * 6) glances.push(t);
  const period = 2.8 + r() * 0.4;
  return (t) => {
    const w = (2 * Math.PI * t) / period;
    const breath = Math.sin(w);
    const blink = blinks.some((b) => t >= b && t < b + 0.13);
    const g = glances.find((x) => t >= x && t < x + 1.5);
    const glance = g == null ? 0 : key(t - g, [[0, 0], [0.2, 1, 'o'], [1.05, 1], [1.5, 0, 'io']]);
    return {
      bones: {
        body: { sy: 1 + 0.016 * breath, sx: 1 - 0.008 * breath },
        head: { rot: 2.6 * Math.sin(w - 0.8) + 9 * glance, dy: -3 * Math.sin(w - 0.6), swap: blink ? 'head-blink' : undefined },
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
export function react(t) {
  const sy = key(t, [[0, 1], [0.07, 0.9, 'o'], [0.19, 1.08, 'o'], [0.36, 0.97, 'io'], [0.6, 1, 'io']]);
  return {
    bones: {
      body: { sy, sx: 1 + (1 - sy) * 0.6, dy: key(t, [[0, 0], [0.07, 0], [0.2, -28, 'o'], [0.38, 0, 'i'], [0.6, 0]]) },
      head: { rot: key(t, [[0, 0], [0.1, -11, 'o'], [0.42, -4, 'io'], [0.6, 0, 'io']]), swap: t > 0.05 && t < 0.48 ? 'head-wide' : undefined },
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

export function trigger(t) {
  const sy = bodySy(t);
  const out = {
    bones: {
      body: { sy, sx: 1 + (1 - sy) * 0.5, dy: bodyDy(t) },
      head: {
        rot: key(t, [[0, 0], [0.25, 10, 'o'], [0.47, -7, 'io'], [0.72, 5, 'io'], [0.88, -11, 'io'], [0.96, 6, 'o'], [1.3, -2, 'io'], [1.6, 0, 'io'], [1.78, -10, 'o'], [2, -9]]),
        swap: t >= 0.3 && t < 0.74 ? 'head-sigh' : t >= 1.66 && t < 1.92 ? 'head-blink' : undefined,
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
