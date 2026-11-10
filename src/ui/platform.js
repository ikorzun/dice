// The host platform. On Playgama (the build whose page loads the Bridge script first in <head>) the game follows the
// Bridge's required steps: it starts after `bridge.initialize()`, reads every saved key in one `storage.get` before
// the first frame, writes only at moments that mean progress (a level started or ended, a purchase, a setting), stays
// silent while the platform mutes or pauses it, sends `game_ready` once the first screen can be tapped, and asks for
// an interstitial at every level change (the Bridge decides whether one shows). Everywhere else the browser keeps the
// saves in localStorage at once, as before, and the calls below do nothing.

let bridge = null;
let hosted = false; // the page loaded the Bridge: never fall back to the browser's storage (Playgama 3.2.1)
let readOnly = false; // the saves could not be read: writing now would put a fresh game over the player's run
const cache = new Map();
const dirty = new Set();

const within = (promise, ms) => Promise.race([promise, new Promise((_, no) => { setTimeout(() => no(new Error('timeout')), ms); })]);

// Waits for the Bridge and the saves when the page has it; a page without it, or a Bridge that does not answer in
// time, plays on with the browser's storage (the game never waits on a platform for long).
export async function setupPlatform(keys) {
  const b = window.bridge;
  if (!b) return false;
  hosted = true;
  try {
    await within(b.initialize(), 15000);
  } catch {
    return false; // no platform: the game plays with its saves in memory only
  }
  bridge = b;
  try {
    if (!b.storage) throw new Error('no storage');
    const values = await within(b.storage.get(keys), 15000);
    keys.forEach((key, k) => {
      const v = Array.isArray(values) ? values[k] : values && values[key];
      if (v != null) cache.set(key, typeof v === 'string' ? v : JSON.stringify(v));
    });
  } catch {
    readOnly = true; // the game starts fresh but keeps its hands off the player's saves
  }
  // the language comes from the platform only (Playgama 3.4.2); the game speaks English, its default and fallback
  document.documentElement.lang = 'en';
  const save = () => flushSaves();
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
  return true;
}

export const onPlatform = () => !!bridge;
export const platformBridge = () => bridge;

export function load(key) {
  if (hosted) return cache.has(key) ? cache.get(key) : null;
  try { return localStorage.getItem(key); } catch { return null; }
}

// `now`: progress that matters (Playgama's storage takes few, meaningful writes); otherwise the value waits in memory
// for the next such moment, the page being hidden, or the platform pausing the game.
export function save(key, value, { now = true } = {}) {
  if (!hosted) {
    try { localStorage.setItem(key, value); } catch { /* storage unavailable: the game still works for this session */ }
    return;
  }
  if (cache.get(key) !== value) {
    cache.set(key, value);
    dirty.add(key);
  }
  if (now) flushSaves();
}

export function flushSaves() {
  if (!bridge || readOnly || !dirty.size) return;
  const keys = [...dirty];
  dirty.clear();
  bridge.storage.set(keys, keys.map((k) => cache.get(k))).catch(() => { for (const k of keys) dirty.add(k); });
}

// `apply(silent, paused)`: silent while the platform mutes the game or pauses it; paused while an ad, another tab or a
// minimised window has the screen (the game's own timers wait then).
export function followHostAudio(apply) {
  if (!bridge) return;
  let audio = bridge.platform.isAudioEnabled !== false;
  let paused = false;
  const tell = () => apply(!audio || paused, paused);
  const { EVENT_NAME: EV } = bridge;
  bridge.platform.on(EV.AUDIO_STATE_CHANGED, (on) => { audio = !!on; tell(); });
  bridge.platform.on(EV.PAUSE_STATE_CHANGED, (on) => { paused = !!on; if (paused) flushSaves(); tell(); });
  if (bridge.advertisement && bridge.advertisement.interstitialState === 'opened') paused = true;
  tell();
}

export function gameReady() {
  if (bridge) Promise.resolve(bridge.platform.sendMessage('game_ready')).catch(() => {});
}

// level_started, level_completed, level_failed: the platforms that relay them use them for analytics.
export function tellLevel(message, level) {
  if (bridge) { try { Promise.resolve(bridge.platform.sendMessage(message, { level: String(level) })).catch(() => {}); } catch { /* not relayed here */ } }
}

// A moment worth counting: a built-in message (player_got_achievement) or one of the game's own for the Bridge's
// analytics (shop_opened, boss_defeated, run_over).
export function tell(message) {
  if (!bridge) return;
  try {
    const sent = message === 'player_got_achievement' ? bridge.platform.sendMessage(message) : bridge.platform.sendCustomMessage(message);
    Promise.resolve(sent).catch(() => {});
  } catch { /* an older Bridge without it */ }
}

// A natural pause between levels: the Bridge decides whether an ad shows now (its own delay between ads).
export function interstitial() {
  if (bridge && bridge.advertisement && bridge.advertisement.isInterstitialSupported) {
    try { bridge.advertisement.showInterstitial(); } catch { /* the game goes on without it */ }
  }
}
