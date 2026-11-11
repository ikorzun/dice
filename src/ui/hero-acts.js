// The heroes' and keepers' acts: the owner's portrait comes alive for 4-5 s (owner, 11.11.2026: the monkey's act from
// Seedance 2.5, «Вставить в игру»; then every hero and keeper, «добавляй анимацию в сборку»). Each act is an animated
// AVIF 4:4:4 with its own alpha at 24 fps, packed by art/ai/2026-11-10-seedream/seedance/pack/pack.py (report.json):
// a hero's covers its portrait's whole square, a keeper's his face's square and the room his act takes past it.
// It plays once in an <img> laid over the portrait, which hides under it: from a fresh blob URL each time (a reused URL
// goes on along the old timeline), shown once its first frame is decoded, taken away at the act's end plus 300 ms (the
// file loops; its last frame is the portrait, held 1 s). The files are not in the page (14 MB): warmAct loads one the
// first time its card or keeper is near, one file at a time.
// When (owner, 11.11.2026): a card acts when it first appears on the board, once each time the player switches it on,
// and when it is played (the board waits for it, a tap skips: app.js); a keeper acts on his card, which stands until
// he has finished. Never with reduced motion. playAct always settles: at the act's end, when stopped, when its card or
// face is gone, or at once if the act cannot play (no file, no decoder: the portrait stays as it is).
export const ACTS = {
  // the heroes, by their card's kind
  x2_any: { name: 'knight', ms: 4000 },
  x3_straight: { name: 'elf', ms: 4000 },
  x3_pairs: { name: 'monkey', ms: 4000 },
  x3_trips: { name: 'witch', ms: 5000 },
  joker: { name: 'alien', ms: 5000 },
  refund: { name: 'dude', ms: 4000 },
  x3_kinds: { name: 'wizard', ms: 5000 },
  x3_small: { name: 'wizardgirl', ms: 4000 },
  x4_any: { name: 'skeleton', ms: 5000 },
  x3_sixes: { name: 'bigfoot', ms: 4000 },
  // the keepers, by their id (bosses3.js); side and top: the room the act takes past the face's square, as its share
  fatman: { name: 'fatman', ms: 5000, side: 0.00694, top: 0.01389 },
  ghoul: { name: 'ghoul', ms: 4000 },
  prisoner: { name: 'prisoner', ms: 4000 },
  robot: { name: 'robot_evil', ms: 4000 },
  ghoul_old: { name: 'ghoul_old', ms: 4000 },
  zombie: { name: 'zombie', ms: 5000, side: 0.03125, top: 0.0625 },
  knight_golden: { name: 'knight_golden', ms: 4000, side: 0.01042, top: 0.02083 },
  robot_golden: { name: 'robot_golden', ms: 3959 },
  skeleton_golden: { name: 'skeleton_golden', ms: 4000, side: 0.01736, top: 0.03472 },
};
const AFTER_MS = 300; // the act's picture leaves this long into the portrait's last held frame

const files = new Map(); // file name -> Promise of its Blob (null if it cannot load)
const loaded = new Set(); // file names whose Blob is in
const live = new Map(); // the host (.art or .boss-face) -> its act
let queue = Promise.resolve(); // one file at a time
let urlOf = () => null;
let still = true; // reduced motion, or no blob URLs: no acts at all

export function setupHeroActs({ reduceMotion, url }) {
  // a page opened as a file cannot fetch the acts' files (nor can npm run smoke's): its portraits stand still
  still = !!reduceMotion || location.protocol === 'file:' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function';
  urlOf = url;
  if (still) return;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') stopActs(); });
}

// Starts loading an act's file, so that it plays at once when its moment comes.
export function warmAct(key) {
  const act = ACTS[key];
  if (still || !act) return Promise.resolve(null);
  if (!files.has(act.name)) {
    const url = urlOf(`--act-${act.name}`);
    const load = queue.then(() => (url ? fetch(url) : null))
      .then((r) => (r && r.ok ? r.blob() : null))
      .then((blob) => { if (blob) loaded.add(act.name); return blob; }, () => null);
    queue = load;
    files.set(act.name, load);
  }
  return files.get(act.name);
}

// How long an act runs, in ms, if it can play at once (its file is in); 0 otherwise. The win moment waits this long.
export const actMs = (key) => (!still && ACTS[key] && loaded.has(ACTS[key].name) ? ACTS[key].ms : 0);

// The act playing on this host now, if any.
export const actingKind = (host) => (host && live.has(host) ? live.get(host).key : null);

// Plays an act once over its portrait. `host` is a card's picture (.art; its card must keep the kind) or a keeper's
// face (.boss-face). `wait`: how long it may wait for its file; past that it does not play this time.
export function playAct(host, key, { wait = 0 } = {}) {
  const act = ACTS[key];
  if (still || !host || !act) return Promise.resolve();
  stopAct(host);
  warmAct(key);
  if (!loaded.has(act.name) && !wait) return Promise.resolve();
  const card = host.classList.contains('art') ? host.parentElement : null;
  const run = { key, ended: false };
  live.set(host, run);
  return new Promise((resolve) => {
    let img = null;
    let url = null;
    let timer = 0;
    let watch = 0;
    run.end = () => {
      if (run.ended) return;
      run.ended = true;
      clearTimeout(timer);
      clearInterval(watch);
      if (live.get(host) === run) live.delete(host);
      host.classList.remove('hero-act');
      if (img) img.remove();
      if (url) URL.revokeObjectURL(url);
      resolve();
    };
    const gone = () => !host.isConnected || (card && !card.classList.contains(`kind-${key}`));
    timer = setTimeout(run.end, wait + 1000); // a file or a decoder that never answers holds nothing
    watch = setInterval(() => { if (gone()) run.end(); }, 150);
    warmAct(key).then(async (blob) => {
      if (run.ended) return;
      if (!blob || gone()) { run.end(); return; }
      url = URL.createObjectURL(blob);
      img = new Image();
      img.className = 'act-img';
      img.alt = '';
      img.decoding = 'async';
      if (act.side || act.top) Object.assign(img.style, { left: `${-act.side * 100}%`, bottom: 'auto', top: `${-act.top * 100}%`, width: `${(1 + 2 * act.side) * 100}%`, height: `${(1 + act.top) * 100}%` });
      img.src = url;
      try { await img.decode(); } catch { run.end(); return; }
      if (run.ended) return;
      if (gone()) { run.end(); return; }
      host.append(img);
      host.classList.add('hero-act');
      clearTimeout(timer);
      timer = setTimeout(run.end, act.ms + AFTER_MS);
    });
  });
}

export function stopAct(host) {
  const run = host && live.get(host);
  if (run) run.end();
}

export function stopActs() {
  for (const run of [...live.values()]) run.end();
}
