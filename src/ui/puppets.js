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

// A breath of `frames` (0 → 1 → 0, slow in and out) at the time t.
const breath = (t, frames) => 0.5 - 0.5 * Math.cos((2 * Math.PI * (t % F(frames))) / F(frames));
const blinkY = (on, t) => (on.blink ? key(t - on.blink.t0, [[0, 1], [F(2), 0.1, 'i'], [F(3), 0.1, 'lin'], [F(4), 1.05, 'o'], [F(5), 1]]) : 1);

// ×3 STRAIGHT: the grumpy bug (storyboard §2). Its three feelers hang on springs and sway each on its own.
function bugPose(t, on) {
  const b = breath(t, 54);
  let sy = 1 + 0.022 * b;
  let sx = 1 - 0.011 * b;
  let rot = 0;
  let px = 0;
  let psy = blinkY(on, t);
  if (on.glance) { // 30 frames: anticipation, a 3-frame dart, a moving hold, back past centre
    const e = t - on.glance.t0;
    const d = on.glance.dir;
    px += key(e, [[0, 0], [F(4), -2 * d], [F(7), 10 * d, 'o'], [F(20), 9 * d, 'lin'], [F(29), -1 * d], [F(30), 0]]);
    rot += key(e, [[0, 0], [F(4), -0.5 * d], [F(7), 2 * d, 'o'], [F(20), 1.8 * d, 'lin'], [F(30), 0]]);
  }
  if (on.huff) { // 32 frames: rises, a 4-frame squash (the hit), overshoots, settles; the feelers whip
    const s = key(t - on.huff.t0, [[0, 1], [F(6), 1.04], [F(10), 0.9, 'i'], [F(14), 1.05, 'o'], [F(20), 0.98], [F(26), 1.01], [F(32), 1]]);
    sy *= s;
    sx *= 1 + (1 - s) * 0.7;
    psy *= key(t - on.huff.t0, [[0, 1], [F(6), 1], [F(10), 0.8], [F(20), 0.85], [F(32), 1]]); // a scowl
  }
  const sway = (phase, deg) => ({ rot: deg * Math.sin(2 * Math.PI * (t / 2.6 + phase)) });
  return {
    head: { rot, sx, sy },
    pupilL: { dx: px, sy: psy },
    pupilR: { dx: px, sy: psy },
    antL: sway(0, 2.5),
    antM: sway(0.33, 3),
    antR: sway(0.66, 2.5),
  };
}

// ×3 PAIRS: the tall one, slow and bored, and the little one, quick and keen (storyboard §3)
function pairPose(t, on) {
  const slow = breath(t, 84);
  let tallSy = 1 + 0.015 * slow;
  let tallDy = 0;
  const tallRot = 1.2 * Math.sin((2 * Math.PI * t) / 5);
  if (on.sigh) { // 48 frames: a long breath in, a slow sink out, back
    const e = t - on.sigh.t0;
    tallSy *= key(e, [[0, 1], [F(12), 1.04], [F(36), 0.96, 'o'], [F(48), 1]]);
    tallDy += key(e, [[0, 0], [F(12), 0], [F(36), 10, 'o'], [F(48), 0]]);
  }
  const quick = breath(t, 30);
  let kidSy = 1 + 0.025 * quick;
  let kidSx = 1 - 0.012 * quick;
  if (on.hop) { // 24 frames: crouch (squash), spring up (stretch), land (squash), settle
    const s = key(t - on.hop.t0, [[0, 1], [F(4), 0.9, 'o'], [F(8), 1.1, 'o'], [F(12), 0.95], [F(16), 1.02], [F(24), 1]]);
    kidSy *= s;
    kidSx *= 1 + (1 - s) * 0.7;
  }
  let px = 0;
  if (on.glance) { // 20 frames: the pupils dart in and back (they sit on the eyes' outer line: never past it)
    const e = t - on.glance.t0;
    px = key(e, [[0, 0], [F(3), 8, 'o'], [F(14), 7, 'lin'], [F(20), 0]]);
  }
  const pupil = { dx: px, sy: blinkY(on, t) };
  return { tall: { rot: tallRot, sy: tallSy, sx: 2 - tallSy, dy: tallDy }, kid: { sx: kidSx, sy: kidSy }, kidL: pupil, kidR: pupil };
}

// ×3 TRIPS: three heads stacked in a cloak (storyboard §4). The bottom one sways; the middle and the top hang
// on springs above it, so each follows a moment later and overshoots (the hat most).
function trioPose(t, on) {
  const b = breath(t, 60);
  let rot = 1.5 * Math.sin((2 * Math.PI * t) / 3);
  if (on.teeter) { // 40 frames: leans back (anticipation), tips over, rights itself with an overshoot
    rot += key(t - on.teeter.t0, [[0, 0], [F(6), -2 * on.teeter.dir], [F(14), 4 * on.teeter.dir, 'o'], [F(26), -1 * on.teeter.dir], [F(40), 0]]);
  }
  return { bot: { rot, sy: 1 + 0.015 * b, sx: 1 - 0.008 * b }, mid: { sy: 1 + 0.012 * breath(t + F(6), 60) }, top: {} };
}

// ★ JOKER: the skull with a star in its eye (storyboard §5)
function jokerPose(t, on) {
  const b = breath(t, 56);
  let sy = 1 + 0.02 * b;
  let rot = 0;
  let dy = 0;
  let star = 1;
  let starRot = 0;
  let ix = 0;
  let iy = 0;
  const twinkle = (e) => {
    star *= key(e, [[0, 1], [F(3), 1.35, 'o'], [F(8), 0.9], [F(12), 1]]);
    starRot += key(e, [[0, 0], [F(3), 20, 'o'], [F(12), 0]]);
  };
  if (on.twinkle) twinkle(t - on.twinkle.t0);
  if (on.glance) { // 30 frames: the purple eye rolls up and aside
    const e = t - on.glance.t0;
    const d = on.glance.dir;
    ix = key(e, [[0, 0], [F(5), 10 * d, 'o'], [F(22), 9 * d, 'lin'], [F(30), 0]]);
    iy = key(e, [[0, 0], [F(5), -5, 'o'], [F(22), -4, 'lin'], [F(30), 0]]);
    rot += key(e, [[0, 0], [F(6), 2 * d, 'o'], [F(22), 1.8 * d, 'lin'], [F(30), 0]]);
  }
  if (on.cackle) { // 30 frames: three quick bobs, squashed at each low, the star going off with them
    const e = t - on.cackle.t0;
    const bob = key(e, [[0, 0], [F(4), 1], [F(8), 0], [F(12), 1], [F(16), 0], [F(20), 1], [F(26), 0], [F(30), 0]]);
    dy += 8 * bob;
    sy *= 1 - 0.04 * bob;
    rot += 1.5 * Math.sin((2 * Math.PI * e) / F(8));
    twinkle(e);
  }
  return { head: { rot, dy, sy, sx: 2 - sy }, star: { sx: star, sy: star, rot: starRot }, iris: { dx: ix, dy: iy } };
}

// +1 REFUND: the pawnbroker bird (storyboard §6). Its crest and its coin earring hang on springs.
function birdPose(t, on) {
  const b = breath(t, 64);
  let rot = 0;
  let dy = 0;
  if (on.lean) { // 40 frames: a twitch the other way, a lean toward the coin, a suspicious moving hold, back
    rot += key(t - on.lean.t0, [[0, 0], [F(6), 1], [F(14), -3.5, 'o'], [F(28), -3.2, 'lin'], [F(40), 0]]);
  }
  if (on.nod) { // 20 frames: a nod down and a little overshoot up
    dy += key(t - on.nod.t0, [[0, 0], [F(5), 7, 'o'], [F(11), -1.5], [F(20), 0]]);
  }
  let g = 0.85;
  let gr = 0;
  if (on.glint) { // 16 frames: the coin's sparkle flares and settles
    const e = t - on.glint.t0;
    g = key(e, [[0, 0.85], [F(4), 1.3, 'o'], [F(10), 0.75], [F(16), 0.85]]);
    gr = key(e, [[0, 0], [F(4), 45, 'o'], [F(16), 90]]);
  }
  return { head: { rot, dy, sy: 1 + 0.018 * b, sx: 1 - 0.009 * b }, glint: { sx: g, sy: g, rot: gr } };
}

export const CHARACTERS = { // by bonus kind (exported for prototypes/char-anim/puppets.html)
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
    // event: [shortest, longest] seconds between, and its length; the `big` ones never overlap
    events: { blink: [3, 6, F(5)], glance: [5, 9, F(30)], duck: [10, 15, F(36)] },
    big: ['glance', 'duck'],
    pose: knightPose,
  },
  x3_straight: {
    name: 'bug',
    view: [24, 16, 1000, 1008],
    edge: 950,
    parts: [
      { name: 'antL', at: [20, 245], size: [341, 300], pivot: [350, 465], parent: 'head', spring: { k: 50, c: 3.5, inertia: 1.1, swayX: 0.8, swayY: 0.5 } },
      { name: 'antM', at: [369, 13], size: [266, 447], pivot: [428, 452], parent: 'head', spring: { k: 45, c: 3, inertia: 1.2, swayX: 0.9, swayY: 0.6 } },
      { name: 'antR', at: [507, 148], size: [292, 285], pivot: [522, 428], parent: 'head', spring: { k: 55, c: 3.5, inertia: 1, swayX: 0.8, swayY: 0.5 } },
      { name: 'head', at: [187, 331], size: [640, 652], pivot: [450, 950], clip: true },
      { name: 'pupilL', at: [342, 816], size: [46, 64], pivot: [364, 848], parent: 'head', clip: true },
      { name: 'pupilR', at: [611, 760], size: [46, 66], pivot: [633, 792], parent: 'head', clip: true },
      { name: 'gear', at: [25, 104], size: [999, 907], pivot: [512, 950] },
    ],
    events: { blink: [3, 6, F(5)], glance: [5, 9, F(30)], huff: [9, 14, F(32)] },
    big: ['glance', 'huff'],
    pose: bugPose,
  },
  x3_pairs: {
    name: 'pair',
    view: [25, 226, 989, 798],
    edge: 905,
    parts: [
      { name: 'tall', at: [21, 222], size: [629, 716], pivot: [300, 905], clip: true },
      { name: 'kid', at: [531, 470], size: [487, 503], pivot: [780, 905], clip: true },
      { name: 'kidL', at: [648, 683], size: [40, 62], pivot: [670, 716], parent: 'kid', clip: true },
      { name: 'kidR', at: [822, 723], size: [35, 61], pivot: [842, 752], parent: 'kid', clip: true },
      { name: 'gear', at: [21, 793], size: [982, 191], pivot: [512, 905] },
    ],
    events: { blink: [2.5, 5, F(5)], glance: [3, 6, F(20)], hop: [4, 8, F(24)], sigh: [8, 14, F(48)] },
    big: [],
    pose: pairPose,
  },
  x3_trips: {
    name: 'trio',
    view: [37, 7, 950, 1017],
    edge: 958,
    parts: [
      { name: 'top', at: [120, 2], size: [681, 621], pivot: [540, 560], parent: 'mid', spring: { k: 30, c: 2.5, inertia: 1.2, swayX: 0.8, swayY: 0.3 } },
      { name: 'mid', at: [309, 476], size: [433, 387], pivot: [540, 790], parent: 'bot', spring: { k: 40, c: 3, inertia: 1, swayX: 0.6, swayY: 0.2 } },
      { name: 'bot', at: [285, 677], size: [523, 314], pivot: [560, 958], clip: true },
      { name: 'gear', at: [33, 472], size: [958, 531], pivot: [512, 958] },
    ],
    events: { teeter: [6, 11, F(40)] },
    big: [],
    pose: trioPose,
  },
  joker: {
    name: 'joker',
    view: [18, 156, 986, 868],
    edge: 899,
    parts: [
      { name: 'head', at: [14, 150], size: [928, 782], pivot: [520, 899], clip: true },
      { name: 'star', at: [344, 456], size: [121, 135], pivot: [405, 515], parent: 'head' },
      { name: 'iris', at: [614, 582], size: [212, 120], pivot: [720, 640], parent: 'head' },
      { name: 'gear', at: [17, 766], size: [991, 178], pivot: [512, 899] },
    ],
    events: { twinkle: [1.5, 3, F(12)], glance: [5, 9, F(30)], cackle: [8, 12, F(30)] },
    big: ['glance', 'cackle'],
    pose: jokerPose,
  },
  refund: {
    name: 'bird',
    view: [0, 224, 1011, 800],
    edge: 881,
    parts: [
      { name: 'crest', at: [19, 317], size: [359, 254], pivot: [355, 430], parent: 'head', spring: { k: 45, c: 3, inertia: 1.3, swayX: 0.9, swayY: 0.5 } },
      { name: 'head', at: [160, 220], size: [855, 752], pivot: [560, 881] },
      { name: 'earring', at: [403, 414], size: [117, 142], pivot: [455, 418], parent: 'head', spring: { k: 70, c: 2.5, inertia: 1.6, swayX: 1.2, swayY: 0.8 } },
      { name: 'glint', at: [215, 677], size: [111, 128], pivot: [268, 742] },
      { name: 'gear', at: [0, 538], size: [1009, 457], pivot: [512, 881] },
    ],
    events: { glint: [2, 4, F(16)], nod: [5, 9, F(20)], lean: [7, 11, F(40)] },
    big: ['nod', 'lean'],
    pose: birdPose,
  },
};

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
    if (p.c.big.includes(name) && p.c.big.some((b) => p.on[b])) { p.next[name] = t + 1; continue; } // one big event at a time
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
