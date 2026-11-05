// The threshold breaks (owner's pick В11 A «Пробитый порог», 04.11.2026; GPT's production spec and its review of
// the build, art/ai/2026-11-04-win-production): a yellow line under THRESHOLD bows and cracks while the count runs
// down; at 0 the break spans the counter, a wide line that ruptures in the middle and snaps apart, and eighteen flat
// yellow shards with an ink outline burst from the rupture over the spreading black, drawn like our illustrations
// (no glow). On a medal level five of the largest fly into the medal. One canvas over the whole page, there only
// while the break plays; times are ms from the PLAY press.

const YELLOW = '#ffea3a';
const INK = '#000000';
const BOW = 420; // the line under THRESHOLD bows and cracks
const SNAP = 500; // the break spans the counter and ruptures; the shards fly
const RECOIL = 700; // the two halves of the wide line have snapped back to nothing
const GONE = 920; // the shards go
const MEDAL = 930; // on a medal level five shards are in the disc

// cubic-bezier(x1, y1, x2, y2) as a function of time 0..1
function bezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid; else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}
const burst = bezier(0.16, 1, 0.3, 1);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Eighteen shards, the same every time: shapes in units of half the length and width, length 26 down to 10 px and
// width a third to two thirds of it at the phone's scale, flying 40–120 px from the rupture on a golden-angle spread
// (shorter downward) and turning 35–160°. The first five are the largest: on a medal level they become the medal.
const SHAPES = [[[-1, 0.9], [1, 0.5], [-0.2, -1]], [[-1, 0.8], [0.7, 1], [1, -0.6], [-0.6, -1]], [[-1, 0.4], [1, 0.9], [0.9, -0.5], [-0.8, -0.8]]];
const SHARDS = Array.from({ length: 18 }, (_, k) => {
  const len = 26 - (16 * k) / 17;
  const a = (k * 137.5 * Math.PI) / 180;
  const down = Math.sin(a) > 0 ? 0.6 : 1; // canvas y grows downward: fewer and shorter flights down
  return {
    shape: SHAPES[k % 3], len, wid: len * (0.35 + (0.3 * ((k * 7) % 5)) / 4),
    dir: [Math.cos(a), Math.sin(a) * down], dist: 40 + ((k * 53) % 81), turn: (35 + ((k * 71) % 126)) * (k % 2 ? 1 : -1), spin: ((k * 37) % 360) - 180,
  };
});

// line: the line under THRESHOLD {x, y, w, h} in page px; span: {x0, x1}, where the break runs across the counter;
// scale: page px per spec px; power: how far the shards fly (1..1.35); medal: {x, y, r} of the medal disc in page px
// or a function giving it when the line snaps, or null; still: reduced motion (the line cracks in place); onMedal:
// called when the medal's shards are in. Returns { stop }.
export function breakLine({ line, span, scale = 1, power = 1, medal = null, still = false, start = performance.now(), onMedal = null }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'shards-layer';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  let raf = 0;
  let medalled = false;
  let disc = null; // the medal's place, asked for when the line snaps (the cleared screen is laid out by then)
  const size = () => {
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  };
  size();
  const cy = line.y + line.h / 2;
  const cx = (span.x0 + span.x1) / 2;

  // a stroke of yellow with an ink edge
  function bar(points, width, edge) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = INK;
    ctx.lineWidth = width + 2 * edge;
    ctx.stroke();
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawLine(t) {
    const bow = t < BOW ? 0 : 3 * scale * clamp01((t - BOW) / (SNAP - BOW));
    const mid = line.x + line.w / 2;
    bar([[line.x, cy], [mid, cy + bow], [line.x + line.w, cy]], line.h, scale);
    if (t < BOW) return;
    ctx.strokeStyle = INK; // three black branches open from the middle
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    for (const [dx, dy] of [[-7, -4], [6, -5], [2, 6]]) {
      ctx.moveTo(mid, cy + bow);
      ctx.lineTo(mid + dx * scale * 0.6, cy + bow + dy * scale * 0.5);
      ctx.lineTo(mid + dx * scale, cy + bow + dy * scale);
    }
    ctx.stroke();
  }

  // the break across the counter: two halves snap apart from the rupture and shrink back to their ends
  function drawSpan(t) {
    const p = burst(clamp01((t - SNAP) / (RECOIL - SNAP)));
    const gap = 18 * scale + (cx - span.x0) * p;
    if (cx - gap > span.x0) bar([[span.x0, cy], [cx - gap, cy]], 5 * scale, 2 * scale);
    if (cx + gap < span.x1) bar([[cx + gap, cy], [span.x1, cy]], 5 * scale, 2 * scale);
    if (t > SNAP + 140) return;
    const g = burst(clamp01((t - SNAP) / 140)); // the rupture: a jagged star 36 px across that bursts and is gone
    const r = 18 * scale * (0.6 + 0.6 * g);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      const rr = i % 2 ? r * 0.38 : r * (0.85 + (0.15 * ((i * 5) % 3)) / 2);
      if (i) ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
      else ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = YELLOW;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2 * scale;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function drawShard(s, x, y, turn, k = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((turn * Math.PI) / 180);
    ctx.scale(k, k);
    ctx.beginPath();
    s.shape.forEach(([u, v], i) => {
      if (i) ctx.lineTo((u * s.len * scale) / 2, (v * s.wid * scale) / 2);
      else ctx.moveTo((u * s.len * scale) / 2, (v * s.wid * scale) / 2);
    });
    ctx.closePath();
    ctx.fillStyle = YELLOW;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = (2 * scale) / k;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function frame(now) {
    raf = 0;
    const t = now - start;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (still) { // reduced motion: the line, then the same line cracked, in place
      drawLine(t < 200 ? 0 : SNAP);
      if (t < SNAP) raf = requestAnimationFrame(frame);
      else stop();
      return;
    }
    if (t < SNAP) drawLine(t);
    else {
      if (t < RECOIL) drawSpan(t);
      if (medal) disc = disc || (typeof medal === 'function' ? medal() : medal);
      SHARDS.forEach((s, k) => {
        if (disc && k < 5) { // to the medal: along a curve, shrinking in the last 100 ms
          if (t >= MEDAL) return;
          const p = burst(clamp01((t - SNAP) / (MEDAL - SNAP)));
          const side = k % 2 ? 1 : -1;
          const qx = (cx + disc.x) / 2 + side * 28 * scale;
          const qy = (cy + disc.y) / 2 - 28 * scale;
          const x = (1 - p) ** 2 * cx + 2 * (1 - p) * p * qx + p * p * disc.x;
          const y = (1 - p) ** 2 * cy + 2 * (1 - p) * p * qy + p * p * disc.y;
          drawShard(s, x, y, s.spin + s.turn * p, 1 - 0.7 * clamp01((t - (MEDAL - 100)) / 100));
          return;
        }
        if (t >= GONE) return;
        const p = burst(clamp01((t - SNAP) / (GONE - SNAP)));
        const d = s.dist * power * scale * p;
        drawShard(s, cx + s.dir[0] * d, cy + s.dir[1] * d, s.spin + s.turn * p);
      });
      if (disc && t >= MEDAL && !medalled) { medalled = true; if (onMedal) onMedal(); }
    }
    if (t < (medal ? MEDAL : GONE)) raf = requestAnimationFrame(frame);
    else stop();
  }
  raf = requestAnimationFrame(frame);
  addEventListener('resize', size);

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    removeEventListener('resize', size);
    canvas.remove();
  }
  return { stop };
}

// The threshold holds (owner's pick В12 A «Честный чек», 04.11.2026; GPT's production spec,
// art/ai/2026-11-04-loss-production): on the run's last hand the line under THRESHOLD is drawn red from the left,
// takes the count with a 2 px bow and stays whole: no crack, no shards. line: {x, y, w, h} in page px (y is the
// stroke's middle); scale: page px per spec px; still: reduced motion (drawn at once). The canvas stays until
// stop(); the moment fades it out with the counter.
const RED = '#ff5442';
const draw = bezier(0.4, 0, 0.2, 1);
export function holdLine({ line, scale = 1, still = false, start = performance.now() }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'loss-line';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  let raf = 0;
  function frame(now) {
    raf = 0;
    const t = still ? 1e9 : now - start;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const p = draw(clamp01(t / 120)); // drawn from the left
    const bow = 2 * scale * Math.sin(Math.PI * draw(clamp01((t - 420) / 100))); // the count's weight, then straight
    if (p > 0) {
      ctx.beginPath();
      ctx.moveTo(line.x, line.y);
      ctx.lineTo(line.x + line.w * Math.min(p, 0.5), line.y + bow * Math.min(1, p * 2));
      if (p > 0.5) ctx.lineTo(line.x + line.w * p, line.y);
    }
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = RED;
    ctx.lineWidth = line.h;
    if (p > 0) ctx.stroke();
    if (t < 520) raf = requestAnimationFrame(frame);
  }
  const size = () => {
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    frame(performance.now());
  };
  size();
  addEventListener('resize', size);
  return {
    canvas,
    stop() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', size);
      canvas.remove();
    },
  };
}
