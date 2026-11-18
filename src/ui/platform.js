// The host platform. On Playgama (the build whose page loads the Bridge script first in <head>) the game follows the
// Bridge's required steps: it starts after `bridge.initialize()`, reads every saved key in one `storage.get` before
// the first frame, writes only at moments that mean progress (a level started or ended, a purchase, a setting), stays
// silent while the platform mutes or pauses it, sends `game_ready` once the first screen can be tapped, and asks for
// an interstitial at every level change (the Bridge decides whether one shows). Everywhere else the browser keeps the
// saves in localStorage at once, as before, and the calls below do nothing.

let bridge = null;
let poki = null; // Poki's SDK (the build whose page loads poki-sdk.js): its saves stay in localStorage, it only brings ads and play states
let hosted = false; // the page loaded the Bridge: never fall back to the browser's storage (Playgama 3.2.1)
let readOnly = false; // the saves could not be read: writing now would put a fresh game over the player's run
let platformLang = null; // the language the platform reports (ISO 639-1), read once after initialize()
const cache = new Map();
const dirty = new Set();

const within = (promise, ms) => Promise.race([promise, new Promise((_, no) => { setTimeout(() => no(new Error('timeout')), ms); })]);

// Waits for the Bridge and the saves when the page has it; a page without it, or a Bridge that does not answer in
// time, plays on with the browser's storage (the game never waits on a platform for long).
export async function setupPlatform(keys) {
  if (window.PokiSDK && !window.bridge) return setupPoki();
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
  // the language comes from the platform only (Playgama 3.4.2, required step 3): read once; the game speaks English
  // only, its default and fallback, so every other language starts in English until a translation exists
  try { platformLang = String(b.platform.language || 'en').slice(0, 2).toLowerCase(); } catch { platformLang = 'en'; }
  document.documentElement.lang = 'en';
  const save = () => flushSaves();
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
  return true;
}

// Poki (https://developers.poki.com/guide/sdk-html5): init once, and play on whatever it answers. The game's saves stay in
// localStorage (every call is already in try/catch for incognito); no external link or ad of its own is ever shown.
async function setupPoki() {
  try { await within(window.PokiSDK.init(), 10000); } catch { /* "load your game anyway" */ }
  poki = window.PokiSDK;
  document.documentElement.lang = 'en';
  window.addEventListener('pointerdown', () => { pk.input = true; pokiStart(); }, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pokiStop(); else pokiStart(); });
  return true;
}

// Poki's rules: gameplayStart on the player's input (not on load), gameplayStop at any interruption, never twice in a row,
// none during an ad, and commercialBreak only when going back to play.
const pk = { input: false, wanted: false, playing: false, ad: false, apply: null };
function pokiCall(name, ...args) { try { return poki[name](...args); } catch { return undefined; } }
function pokiStart() {
  if (!poki || !pk.input || !pk.wanted || pk.playing || pk.ad || document.hidden) return;
  pk.playing = true;
  pokiCall('gameplayStart');
}
function pokiStop() {
  if (!poki || !pk.playing) return;
  pk.playing = false;
  pokiCall('gameplayStop');
}

export const onPlatform = () => !!bridge || !!poki;
export const platformBridge = () => bridge;
export const platformLanguage = () => platformLang;

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
  pk.apply = apply;
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
  if (poki) pokiCall('gameLoadingFinished');
  if (bridge) Promise.resolve(bridge.platform.sendMessage('game_ready')).catch(() => {});
}

// level_started, level_completed, level_failed: the platforms that relay them use them for analytics.
export function tellLevel(message, level) {
  if (poki) {
    if (message === 'level_started') { pk.wanted = true; pokiStart(); } else { pk.wanted = false; pokiStop(); }
  }
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
  if (poki) {
    // the break comes with the tap that leaves the receipt: gameplayStop already went at the level's end, gameplayStart waits for it
    if (pk.ad) return;
    pk.ad = true;
    const done = () => { pk.ad = false; if (pk.apply) pk.apply(false, false); pokiStart(); };
    let ask;
    try { ask = poki.commercialBreak(() => { if (pk.apply) pk.apply(true, true); }); } catch { done(); return; }
    Promise.resolve(ask).then(done, done);
    return;
  }
  if (bridge && bridge.advertisement && bridge.advertisement.isInterstitialSupported) {
    try { bridge.advertisement.showInterstitial(); } catch { /* the game goes on without it */ }
  }
}
