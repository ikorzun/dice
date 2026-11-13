// Pixel effects on the game's moments (owner, 12.11.2026: «Прекрасные эффекты… Добавь подходящие в игру»; his picks):
// pixelfx's own code (vendor/pixelfx, MIT, scripts/pixelfx.py) draws each into a small canvas laid over the screen, one
// effect pixel 2 px on the phone and growing with the board like every size, and takes it away when it ends. Each plays
// once, for a real result (digest §8: an effect is a function of merit): a passed record's fireworks, a purchase's and
// an upgrade's burst in the bells' yellow and the board's lime. None under «reduce motion». (The keeper's Hex sigil went
// when his card became a notification at the top: MODE3-PLAN §48.)
// Off unless the page's address has ?fx (12.11.2026, MODE3-PLAN §47): asked to look at them critically, I found their
// pixel look foreign to the game, whose effects are drawn like its pictures (the fire: flat bands, an ink outline, no
// glow), so players do not see them while the owner tests them.
import { createFrame, clearFrame, createFx, composite } from '../../vendor/pixelfx/pfx-fx.js';
import { meta as burstMeta, create as burstCreate } from '../../vendor/pixelfx/pfx-collect-burst.js';
import { meta as fireworkMeta, create as fireworkCreate } from '../../vendor/pixelfx/pfx-firework-burst.js';

const EFFECTS = {
  burst: { meta: burstMeta, create: burstCreate }, // Collect burst: its burst stands 30 effect pixels over its origin
  firework: { meta: fireworkMeta, create: fireworkCreate }, // Firework burst: it bursts at its origin
};
export const BURST_RISE = 30;

// the game's colours as dark-to-bright ramps: the bells' yellow (#ffea3a), the board's lime (#bbf350; held #7cb823)
export const RAMPS = {
  gold: ['#1e1400', '#3d2900', '#6e4c00', '#a87600', '#f0b400', '#ffea3a', '#fff6b0', '#ffffff'],
  lime: ['#11200a', '#1f3a0e', '#355f14', '#5a8f1a', '#7cb823', '#bbf350', '#e3ffb0', '#ffffff'],
};

const still = !/[?&]fx\b/.test(location.search) || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const live = new Set();

// One effect pixel in CSS px: 2 at the phone's scale, the board's scale on the desktop (×1.5), whole device pixels
export function fxPixel() {
  const k = parseFloat(getComputedStyle(document.getElementById('app')).getPropertyValue('--k')) || 1;
  const kb = document.body.classList.contains('wide') ? 1.5 * k : k;
  const dpr = window.devicePixelRatio || 1;
  return Math.max(1, Math.round(2 * kb * dpr)) / dpr;
}

// Plays an effect with its origin at (x, y): window coordinates, or the parent's when one is given (the canvas then
// lies inside it, before its other children, so they cover it). anchor, a function giving [x, y], keeps the origin on a
// box that may still move (a card whose words settle). speed > 1 plays it faster. Returns { stop() }, or null when off
// (no ?fx) or under «reduce motion», and the moment then goes as it did before them; a stopped effect fades out in 0.3 s.
export function playFx(name, x, y, { opts = {}, parent = null, speed = 1, anchor = null } = {}) {
  if (still) return null;
  const mod = EFFECTS[name];
  const [w, h] = mod.meta.size;
  const [ox, oy] = mod.meta.origin;
  const px = fxPixel();
  const dpr = window.devicePixelRatio || 1;
  const snap = (v) => Math.round(v * dpr) / dpr;
  const canvas = document.createElement('canvas');
  canvas.className = 'pixel-fx';
  canvas.width = w;
  canvas.height = h;
  const place = (ax, ay) => Object.assign(canvas.style, { left: `${snap(ax - ox * px)}px`, top: `${snap(ay - oy * px)}px` });
  Object.assign(canvas.style, { width: `${w * px}px`, height: `${h * px}px` });
  place(x, y);
  canvas.setAttribute('aria-hidden', 'true');
  if (parent) parent.prepend(canvas);
  else document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const frame = createFrame(w, h);
  const img = new ImageData(w, h);
  const fx = createFx(mod, { x: ox, y: oy, ...opts });
  let last = performance.now();
  const handle = { stop: () => fx.stop() };
  const end = () => { live.delete(handle); canvas.remove(); };
  const tick = (now) => {
    if (!canvas.isConnected) { end(); return; }
    if (anchor) place(...anchor());
    fx.update(Math.min(0.05, (now - last) / 1000) * speed); // a hidden tab's gap is not played at once
    last = now;
    clearFrame(frame);
    fx.draw(frame);
    composite(frame, img.data, null);
    ctx.putImageData(img, 0, 0);
    if (fx.done()) end();
    else requestAnimationFrame(tick);
  };
  live.add(handle);
  requestAnimationFrame(tick);
  return handle;
}

// Every effect on screen fades out (the screen it belongs to is going)
export function stopFx() {
  for (const f of live) f.stop();
}
