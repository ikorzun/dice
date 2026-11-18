// The host platform. On Playgama (the build whose page loads the Bridge script first in <head>) the game follows the
// Bridge's required steps: it starts after `bridge.initialize()`, reads every saved key in one `storage.get` before
// the first frame, writes only at moments that mean progress (a level started or ended, a purchase, a setting), stays
// silent while the platform mutes or pauses it, sends `game_ready` once the first screen can be tapped, and asks for
// an interstitial at every level change (the Bridge decides whether one shows). Everywhere else the browser keeps the
// saves in localStorage at once, as before, and the calls below do nothing.

let crazy = null; // CrazyGames: window.CrazyGames.SDK once its init() has answered (build with the SDK script in <head>)
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
  if (window.CrazyGames && window.CrazyGames.SDK) return setupCrazy();
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

// CrazyGames (HTML5 SDK v3): init() first, then the saves through the data module (the same calls as localStorage: the
// SDK keeps them in the account for a signed-in player and in localStorage for a guest), loadingStart/Stop around the
// first frame, gameplayStart/Stop around a level, a midgame ad between levels, happytime for a record or a keeper beaten,
// silence while an ad plays or the site's muteAudio is on. Off CrazyGames' domains (environment 'disabled') every SDK call
// throws: the game then plays as in a plain browser.
const ad = { pending: false, playing: false, timer: 0 };
let playing = false; // the game wants gameplayStart; the SDK hears it only while no ad has the screen
let heard = false;
let muteAudio = false;
let hostApply = null;

const sdkCall = (fn) => { try { return fn(); } catch { return undefined; } };

async function setupCrazy() {
  const sdk = window.CrazyGames.SDK;
  try {
    await within(sdk.init(), 15000);
    if (sdk.environment === 'disabled') throw new Error('not on CrazyGames');
  } catch {
    return false;
  }
  crazy = sdk;
  sdkCall(() => sdk.game.loadingStart());
  muteAudio = !!sdkCall(() => sdk.game.settings.muteAudio);
  sdkCall(() => sdk.game.addSettingsChangeListener((settings) => { muteAudio = !!settings.muteAudio; syncHost(); }));
  document.documentElement.lang = 'en'; // English is required; the game speaks nothing else
  return true;
}

const syncHost = () => { if (hostApply) hostApply(muteAudio || ad.playing, ad.pending || ad.playing); };

function syncGameplay() {
  const want = playing && !ad.pending && !ad.playing;
  if (want === heard) return;
  heard = want;
  sdkCall(() => (want ? crazy.game.gameplayStart() : crazy.game.gameplayStop()));
}

function adEnds() {
  clearTimeout(ad.timer);
  ad.pending = false;
  ad.playing = false;
  syncGameplay();
  syncHost();
}

function midgame() {
  if (ad.pending || ad.playing) return;
  ad.pending = true; // the game waits from the request, and is silent only once the ad plays
  syncGameplay();
  syncHost();
  ad.timer = setTimeout(adEnds, 15000); // an ad that never starts must not hold the game
  try {
    crazy.ad.requestAd('midgame', {
      adStarted: () => { clearTimeout(ad.timer); ad.pending = false; ad.playing = true; syncHost(); },
      adFinished: adEnds,
      adError: adEnds,
    });
  } catch { adEnds(); }
}

export const onPlatform = () => !!bridge || !!poki || !!crazy;
export const platformBridge = () => bridge;
export const platformLanguage = () => platformLang;

// CrazyGames' data module answers like localStorage; if it is switched off for the game, localStorage keeps the saves.
const store = () => (crazy && crazy.data) || localStorage;

export function load(key) {
  if (hosted) return cache.has(key) ? cache.get(key) : null;
  try { return store().getItem(key); } catch { try { return localStorage.getItem(key); } catch { return null; } }
}

// `now`: progress that matters (Playgama's storage takes few, meaningful writes); otherwise the value waits in memory
// for the next such moment, the page being hidden, or the platform pausing the game.
export function save(key, value, { now = true } = {}) {
  if (!hosted) {
    try { store().setItem(key, value); } catch {
      try { localStorage.setItem(key, value); } catch { /* storage unavailable: the game still works for this session */ }
    }
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
  if (crazy) { hostApply = apply; syncHost(); return; }
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
  if (crazy) sdkCall(() => crazy.game.loadingStop());
  if (bridge) Promise.resolve(bridge.platform.sendMessage('game_ready')).catch(() => {});
}

// level_started, level_completed, level_failed: the platforms that relay them use them for analytics.
export function tellLevel(message, level) {
  if (poki) {
    if (message === 'level_started') { pk.wanted = true; pokiStart(); } else { pk.wanted = false; pokiStop(); }
  }
  if (crazy) { playing = message === 'level_started'; syncGameplay(); return; }
  if (bridge) { try { Promise.resolve(bridge.platform.sendMessage(message, { level: String(level) })).catch(() => {}); } catch { /* not relayed here */ } }
}

// A moment worth counting: a built-in message (player_got_achievement) or one of the game's own for the Bridge's
// analytics (shop_opened, boss_defeated, run_over).
export function tell(message) {
  if (crazy) { if (message === 'player_got_achievement' || message === 'boss_defeated') sdkCall(() => crazy.game.happytime()); return; }
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
  if (crazy) { midgame(); return; }
  if (bridge && bridge.advertisement && bridge.advertisement.isInterstitialSupported) {
    try { bridge.advertisement.showInterstitial(); } catch { /* the game goes on without it */ }
  }
}
