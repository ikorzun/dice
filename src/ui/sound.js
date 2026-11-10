// Sound effects (owner, 02.11.2026: made with ElevenLabs, scripts/audio.py). One Web Audio context, made on the
// first touch or key (browsers keep sound off until then); each effect plays with a little random pitch. It sleeps
// while the page is hidden; the Sound setting turns it off and on. The files come as addresses from the caller
// (the build inlines them like the rest of the art).
//
// The count (owner's pick В8 A, like Balatro; digest §8): one note per die on the win timeline's 83 ms grid, each higher,
// along a pentatonic so that any hand is in tune, and a reached target's chord where the ladder comes to rest. One pitch
// spread for a whole hand, its ladder and chord alike: a spread per note would put them out of tune with each other.
// The owner's ear (05.11.2026): not synthetic, medieval softness and ringing, softer still, like real instruments. So a lute's
// own notes, each sounding near its true pitch; a chord rolled across its strings, opening on the bare fifth of old music; a
// player's hand, never quite on the grid; and one stone hall that every instrument sits in. The objects share it: wooden dice
// on an oak table, a parchment card, a book's brass clasp, a chest's latch, a torch, a copper coin and a wooden bird whistle.

export const SOUNDS = ['roll', 'hold', 'flip', 'on', 'off', 'lute-c4', 'lute-g4', 'lute-a4', 'lute-b4', 'lute-c5', 'lute-d5', 'mult', 'crack', 'medal', 'fire', 'burn', 'drop', 'refund', 'bird', 'win', 'tally', 'stop', 'paper'];
const VOLUME = { roll: 0.4, hold: 0.6, flip: 0.55, on: 0.7, off: 0.4, 'lute-c4': 0.8, 'lute-g4': 0.8, 'lute-a4': 0.8, 'lute-b4': 0.8, 'lute-c5': 0.8, 'lute-d5': 0.8, mult: 0.55, crack: 0.45, medal: 0.4, fire: 0.6, burn: 0.45, drop: 0.4, refund: 0.5, bird: 0.35, win: 0.8, tally: 0.6, stop: 0.7, paper: 0.5 };

export const RING_STEP = 1 / 12; // s
const LADDER = [-5, -3, -1, 2, 4, 7, 9]; // semitones from C5: G major pentatonic, which rests on the chord's C
const CHORD = [-12, -5, 0, 4, 7]; // C4 G4 C5, the bare fifth and octave, then E5 and G5: a stronger hand gets more strings
const STRINGS = { 'lute-c4': -12, 'lute-g4': -5, 'lute-a4': -3, 'lute-b4': -1, 'lute-c5': 0, 'lute-d5': 2 }; // the notes sampled
const pitch = (semis) => 2 ** (semis / 12);

// The string nearest the note, and how far it must bend: a real note instead of one sample stretched over two octaves.
export function string(semis) {
  const [name, root] = Object.entries(STRINGS).reduce((a, b) => (Math.abs(b[1] - semis) < Math.abs(a[1] - semis) ? b : a));
  return { name, rate: pitch(semis - root) };
}

// One hand's rings. rich: 1 adds the thumb's bass, an octave under, to the last note, 2 to every note (stronger hands answer
// richer, digest rule 26).
export function ladder(n, rich = 0) {
  const notes = [];
  for (let k = 0; k < n; k++) {
    const semis = LADDER[Math.min(k, LADDER.length - 1)];
    const vol = 0.6 + (0.4 * k) / Math.max(1, n - 1); // it grows towards the top
    notes.push({ at: k * RING_STEP, semis, vol });
    if (rich === 2 || (rich === 1 && k === n - 1)) notes.push({ at: k * RING_STEP, semis: semis - 12, vol: vol * 0.5 });
  }
  return notes;
}

// The target's chord, `size` strings (3 to 5), rolled low to high by 45 ms as a thumb would.
export function chord(size = 3) {
  return CHORD.slice(0, size).map((semis, k) => ({ at: k * 0.045, semis, vol: 0.9 }));
}

let ctx = null;
let out = null;
let urlOf = () => null;
let enabled = true;
let hostSilent = false; // the platform mutes or pauses the game: an ad, another tab (Playgama 2.1.6, 3.3.4)
const bufs = {};
let room = null; // the hall every instrument sits in
const DRY = new Set(['tally', 'stop', 'paper']); // the lost run's receipt: no hall, no tail (GPT's spec)
const voices = new Set(); // what is playing or scheduled, for hush
let key = 1; // this hand's pitch spread

// A small stone hall: a second of noise, darkening and dying away.
function hall() {
  const len = ctx.sampleRate | 0;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let dark = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      dark += ((Math.random() * 2 - 1) - dark) * (0.35 - 0.3 * t); // the high goes first
      d[i] = dark * Math.exp(-6 * t);
    }
  }
  return ir;
}

function unlock() {
  if (ctx) {
    if (ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden && !hostSilent) ctx.resume(); // suspended, or iOS 'interrupted'
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  out = ctx.createGain();
  out.gain.value = enabled && !hostSilent ? 1 : 0;
  const limiter = ctx.createDynamicsCompressor(); // a chord's voices stack: they must not clip
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.15;
  const trim = ctx.createGain(); // the limiter adds about 5 dB of its own: recorded, a chord peaked at +2.9 dBFS without this
  trim.gain.value = 0.5;
  out.connect(limiter);
  limiter.connect(trim);
  trim.connect(ctx.destination);
  room = ctx.createConvolver();
  room.buffer = hall();
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  room.connect(wet);
  wet.connect(out);
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
    else if (!hostSilent) ctx.resume();
  });
}

export function setSound(on) {
  enabled = on;
  if (out) out.gain.setTargetAtTime(on && !hostSilent ? 1 : 0, ctx.currentTime, 0.05);
}

// Silent while the platform says so, whatever the player's own setting; the setting comes back with it.
export function setHostSilent(silent) {
  hostSilent = !!silent;
  if (!ctx) return;
  out.gain.setTargetAtTime(enabled && !hostSilent ? 1 : 0, ctx.currentTime, 0.02);
  if (hostSilent) ctx.suspend();
  else if (!document.hidden) ctx.resume();
}

// at: seconds from now, on the audio clock (timers jitter on a phone, an 83 ms rhythm would limp). spread: false keeps the pitch.
export function sfx(name, { vol = 1, rate = 1, at = 0, spread = true } = {}) {
  const b = bufs[name];
  if (!b || !enabled || hostSilent || ctx.state !== 'running') return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = b;
  src.playbackRate.value = rate * (spread ? 0.96 + 0.08 * Math.random() : 1);
  gain.gain.value = (VOLUME[name] ?? 1) * vol;
  src.connect(gain);
  gain.connect(out);
  if (!DRY.has(name)) gain.connect(room);
  src.when = ctx.currentTime + at;
  src.onended = () => voices.delete(src);
  voices.add(src);
  src.start(src.when);
}

// A tap skipped the moment: what has not started yet stays silent; what rings, rings out.
export function hush() {
  for (const v of voices) if (v.when > ctx.currentTime) { v.onended = null; v.stop(); voices.delete(v); }
}

// A note as a player's hand plays it: a few ms off the grid, a little softer or firmer, the hand's tuning for the whole hand.
const pluck = ({ at, semis, vol }) => {
  const { name, rate } = string(semis);
  sfx(name, { at: at + Math.random() * 0.01, rate: rate * key, vol: vol * (0.92 + 0.16 * Math.random()), spread: false });
};
export function ringCount(n, rich) {
  key = 0.994 + 0.012 * Math.random(); // a real instrument stays in tune: a breath of spread, each note is a new one anyway
  ladder(n, rich).forEach(pluck);
}
export function ringChord(size) {
  chord(size).forEach(pluck);
}
export function ringNote(step, vol) { // one note of the ladder, in the last hand's key
  pluck({ at: 0, semis: LADDER[step], vol });
}
