// A hero's act on its card: the owner's portrait comes alive for a few seconds, now and then (owner, 11.11.2026: the
// monkey's act from Seedance 2.5, «Вставить в игру»). The act is a strip of frames laid in an atlas (10 columns),
// keyed off the video's green: art/ai/2026-11-10-seedream/seedance (seedance.py, atlas.py). While it plays, the card's
// still portrait gives way to the atlas, one frame every 1/24 s; the first and last frames are the portrait itself.
// When (bonus-animation decisions of 03.11): a hero stands as drawn and acts now and then; the first act 2-5 s after
// its card is face up, then 10-16 s of rest; one card at a time, at least 3 s between acts; none while the dice fly or
// a moment plays, nor within 4 s of a tap; never with reduced motion. A tap or a throw during an act ends it at once.
export const HERO_ACTS = {
  x3_pairs: { css: '--act-x3_pairs', frames: 97, cols: 10, fps: 24 }, // the monkey: «…, hoo, HOO!», a sigh (4 s)
};

const FIRST = [2000, 5000];
const REST = [10000, 16000];
const GAP = 3000;
const AFTER_TAP = 4000;

const between = ([a, b]) => a + Math.random() * (b - a);

export function setupHeroActs({ quiet, reduceMotion }) {
  if (reduceMotion || typeof requestAnimationFrame !== 'function') return;
  const ready = new Set(); // kinds whose atlas is decoded: an act never starts on a blank card
  const due = new WeakMap(); // art element -> when it may act next
  let lastTap = -Infinity;
  let lastEnd = -Infinity;
  let playing = null;

  for (const [kind, act] of Object.entries(HERO_ACTS)) {
    const m = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(document.documentElement).getPropertyValue(act.css));
    if (!m) continue;
    const img = new Image();
    img.src = m[1];
    (img.decode ? img.decode() : Promise.resolve()).then(() => ready.add(kind), () => {});
  }

  const stop = () => {
    if (!playing) return;
    cancelAnimationFrame(playing.raf);
    playing.art.classList.remove('hero-act');
    playing.art.style.backgroundPosition = '';
    due.set(playing.art, performance.now() + between(REST));
    playing = null;
    lastEnd = performance.now();
  };
  document.addEventListener('pointerdown', () => { lastTap = performance.now(); stop(); }, true);

  const blocked = () => document.visibilityState !== 'visible' || !quiet()
    || document.querySelector('.overlay:not([hidden]), #bonusSheet:not([hidden])');

  const play = (art, act) => {
    const t0 = performance.now();
    art.classList.add('hero-act');
    const rows = Math.ceil(act.frames / act.cols);
    const step = (now) => {
      const f = Math.floor(((now - t0) * act.fps) / 1000);
      if (f >= act.frames || !art.isConnected || art.parentElement.classList.contains('acting') || blocked()) { stop(); return; }
      const c = f % act.cols;
      const r = Math.floor(f / act.cols);
      art.style.backgroundPosition = `${(c / (act.cols - 1)) * 100}% ${(r / (rows - 1)) * 100}%`;
      playing.raf = requestAnimationFrame(step);
    };
    playing = { art, raf: 0 };
    playing.raf = requestAnimationFrame(step);
  };

  setInterval(() => {
    if (playing) return;
    const now = performance.now();
    const cards = [...document.querySelectorAll('#board .cell.bonus')].filter((c) => HERO_ACTS[[...c.classList].find((k) => k.startsWith('kind-'))?.slice(5)]);
    for (const card of cards) {
      const art = card.querySelector('.art');
      const up = !card.classList.contains('face-down') && !card.classList.contains('acting') && card.offsetParent !== null;
      if (!up) { due.delete(art); continue; } // face down or away: its first act waits for it to come up again
      if (!due.has(art)) due.set(art, now + between(FIRST));
    }
    if (blocked() || now - lastTap < AFTER_TAP || now - lastEnd < GAP) return;
    let best = null;
    for (const card of cards) {
      const art = card.querySelector('.art');
      const kind = [...card.classList].find((k) => k.startsWith('kind-')).slice(5);
      const at = due.get(art);
      if (at === undefined || at > now || !ready.has(kind)) continue;
      if (!best || at < best.at) best = { art, act: HERO_ACTS[kind], at };
    }
    if (best) play(best.art, best.act);
  }, 200);
}
