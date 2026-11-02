// Bonus characters alive on their cards (owner, 02.11.2026: "animate the bonuses, at least 24 frames a second,
// by a storyboard after Disney's rules"; docs/ANIM-STORYBOARDS.md). A card's picture becomes a cutout puppet
// (rig.js) drawn every display frame: a breath that never stops and events at random intervals, each timed in
// 24 fps frames as on the storyboard. A tap moves only the card, never the picture. One animation loop for
// every card; a card out of sight is skipped; with reduced motion the picture stands still.
import { createPuppet, key } from './rig.js';

const F = (n) => n / 24; // a storyboard frame, in seconds

// ×2 ANY HAND: the skeleton knight (storyboard §1), cut by art/bonuses/anim/knight-rig/cut.py
function knightPose(t, on) {
  // A. breath, 60 frames: the head stretches up from the edge and back, keeping its volume
  const u = (t % F(60)) / F(60);
  const breath = 0.5 - 0.5 * Math.cos(2 * Math.PI * u);
  let sy = 1 + 0.02 * breath;
  let sx = 1 - 0.01 * breath;
  let rot = 0;
  let dy = 0;
  let px = 0;
  let py = 0;
  let psy = 1;
  if (on.glance) { // C. 30 frames: anticipation, a 3-frame dart, a moving hold, the way back past centre
    const e = t - on.glance.t0;
    const d = on.glance.dir;
    px += key(e, [[0, 0], [F(4), -3 * d], [F(7), 16 * d, 'o'], [F(20), 15 * d, 'lin'], [F(29), -1.5 * d], [F(30), 0]]);
    rot += key(e, [[0, 0], [F(4), -0.5 * d], [F(7), 2.5 * d, 'o'], [F(20), 2.2 * d, 'lin'], [F(30), 0]]);
    dy += key(e, [[0, 0], [F(4), 0], [F(5.5), 4], [F(7), 0, 'o'], [F(30), 0]]); // the arc dips on its way
  }
  if (on.duck) { // D. 36 frames: up, duck behind the edge squashed, pop up stretched, settle
    const e = t - on.duck.t0;
    dy += key(e, [[0, 0], [F(6), 0], [F(12), 62, 'i'], [F(16), 58, 'lin'], [F(19), 0, 'o'], [F(24), 8], [F(30), 0], [F(36), 0]]);
    const s = key(e, [[0, 1], [F(6), 1.03], [F(11), 0.97], [F(12), 0.92, 'o'], [F(16), 0.95], [F(18), 1.06, 'o'], [F(19), 1.06, 'lin'], [F(24), 0.98], [F(30), 1.01], [F(36), 1]]);
    sy *= s;
    sx *= 1 + (1 - s) * 0.6;
    py += key(e, [[0, 0], [F(6), -10], [F(12), -4], [F(16), -4], [F(20), 0]]);
    px += key(e, [[0, 0], [F(12), 0], [F(13), -12], [F(14.5), 12], [F(16), 0]]);
  }
  if (on.blink) psy = key(t - on.blink.t0, [[0, 1], [F(2), 0.1, 'i'], [F(3), 0.1, 'lin'], [F(4), 1.05, 'o'], [F(5), 1]]); // B
  const pupil = { dx: px, dy: py, sy: psy };
  return { head: { rot, dy, sx, sy }, pupilL: pupil, pupilR: pupil };
}

export const CHARACTERS = { // by bonus kind (exported for prototypes/char-anim/knight.html)
  x2_any: {
    name: 'knight',
    view: [14, 210, 997, 814], // the card picture's frame in the 1024 px drawing
    edge: 884,
    parts: [
      { name: 'head', at: [148, 206], size: [767, 711], pivot: [512, 884], clip: true },
      { name: 'pupilL', at: [364, 672], size: [90, 102], pivot: [411, 720], parent: 'head', clip: true },
      { name: 'pupilR', at: [571, 668], size: [88, 106], pivot: [613, 720], parent: 'head', clip: true },
      { name: 'flower', at: [752, 272], size: [203, 234], pivot: [812, 303], parent: 'head', spring: { k: 60, c: 4, inertia: 1.2, swayX: 0.9, swayY: 0.6 } },
      { name: 'gear', at: [10, 574], size: [1005, 353], pivot: [512, 884] },
    ],
    // event: [shortest, longest] seconds between, and its length; glance and duck never overlap
    events: { blink: [3, 6, F(5)], glance: [5, 9, F(30)], duck: [10, 15, F(36)] },
    pose: knightPose,
  },
};
const BIG = ['glance', 'duck'];

const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const live = new Set();
const images = {};
let urlOf = () => null;
let raf = 0;

export function setupPuppets(urls) { urlOf = urls; }

function load(kind) {
  const c = CHARACTERS[kind];
  if (!images[kind]) {
    images[kind] = Promise.all(c.parts.map((p) => new Promise((ok, fail) => {
      const im = new Image();
      im.onload = () => ok([p.name, im]);
      im.onerror = fail;
      im.src = urlOf(c.name, p.name);
    }))).then(Object.fromEntries);
  }
  return images[kind];
}

// Gives the picture in `art` (a card's .art) its puppet, or takes it away (kind without one, or null).
export function animateArt(art, kind) {
  if (!art || art.dataset.puppet === (kind || '')) return;
  art.querySelector('canvas')?.remove();
  art.classList.remove('live');
  art.dataset.puppet = kind || '';
  const c = CHARACTERS[kind];
  if (!c || !urlOf(c.name, c.parts[0].name)) return;
  const canvas = document.createElement('canvas');
  load(kind).then((imgs) => {
    if (art.dataset.puppet !== kind) return; // the card changed while the parts loaded
    art.append(canvas);
    art.classList.add('live');
    const p = { canvas, c, puppet: createPuppet(canvas, c, imgs, (t) => c.pose(t, p.on)), on: {}, next: {}, start: performance.now() / 1000 - Math.random() * 2.5 };
    for (const [name, [lo, hi]] of Object.entries(c.events)) p.next[name] = lo / 2 + Math.random() * hi; // the first ones sooner
    live.add(p);
    if (!raf) raf = requestAnimationFrame(frame);
  }).catch(() => {}); // parts that fail to load leave the drawn picture
}

function tick(p, t) {
  for (const [name, [lo, hi, len]] of Object.entries(p.c.events)) {
    if (p.on[name] && t - p.on[name].t0 > len) delete p.on[name];
    if (t < p.next[name]) continue;
    if (BIG.includes(name) && BIG.some((b) => p.on[b])) { p.next[name] = t + 1; continue; } // one big event at a time
    p.on[name] = { t0: t, dir: Math.random() < 0.5 ? -1 : 1 };
    p.next[name] = t + lo + Math.random() * (hi - lo);
  }
  p.puppet.draw(t);
}

function frame(now) {
  raf = 0;
  for (const p of live) {
    const { canvas } = p;
    if (!canvas.isConnected) { live.delete(p); continue; }
    const r = canvas.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) continue; // hidden or out of sight
    const w = Math.round(r.width * Math.min(2, devicePixelRatio || 1));
    if (canvas.width !== w) {
      canvas.width = w;
      canvas.height = Math.round((w * p.c.view[3]) / p.c.view[2]);
    }
    tick(p, still ? 0 : now / 1000 - p.start);
    p.drawn = true;
  }
  if (live.size && (!still || [...live].some((p) => !p.drawn))) raf = requestAnimationFrame(frame); // still: each drawn once
}
