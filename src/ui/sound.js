// Sound effects (owner, 02.11.2026: made with ElevenLabs, scripts/audio.py). One Web Audio context, made on the
// first touch or key (browsers keep sound off until then); each effect plays with a little random pitch. It sleeps
// while the page is hidden; the Sound setting turns it off and on. The files come as addresses from the caller
// (the build inlines them like the rest of the art).

export const SOUNDS = ['roll', 'hold', 'release', 'flip', 'on', 'off', 'score', 'fire', 'burn', 'drop', 'bonus', 'refund', 'win'];
const VOLUME = { roll: 0.8, hold: 0.7, release: 0.6, flip: 0.55, on: 0.6, off: 0.5, score: 0.7, fire: 0.6, burn: 0.45, drop: 0.5, bonus: 0.8, refund: 0.7, win: 0.8 };

let ctx = null;
let out = null;
let urlOf = () => null;
let enabled = true;
const bufs = {};

function unlock() {
  if (ctx) {
    if (ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden) ctx.resume(); // suspended, or iOS 'interrupted'
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  out = ctx.createGain();
  out.gain.value = enabled ? 1 : 0;
  out.connect(ctx.destination);
  for (const name of SOUNDS) {
    const url = urlOf(name);
    if (!url) continue;
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((a) => ctx.decodeAudioData(a))
      .then((b) => { bufs[name] = b; })
      .catch(() => {}); // a sound that fails to load stays silent
  }
}

export function setupSound(urls, on) {
  urlOf = urls;
  enabled = on;
  for (const type of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(type, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });
}

export function setSound(on) {
  enabled = on;
  if (out) out.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
}

export function sfx(name, { vol = 1, rate = 1 } = {}) {
  const b = bufs[name];
  if (!b || !enabled || ctx.state !== 'running') return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = b;
  src.playbackRate.value = rate * (0.96 + 0.08 * Math.random());
  gain.gain.value = (VOLUME[name] ?? 1) * vol;
  src.connect(gain);
  gain.connect(out);
  src.start();
}
