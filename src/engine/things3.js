// The pocket's things (portals plan, step 2; MODE3-PLAN §54; spec art/ai/2026-11-10-portals/spec.json). The owner's
// objects (New img/Things) replace the charms: a thing in the pocket works by itself for the rest of the run. The pocket
// holds 3 things, 4 once level 15 is cleared, 5 once level 35 is; it starts empty every run. The same thing again gives
// it a star (3 at most): a star changes its number, never its rule. Step 2 brought twenty, step 3c the other sixteen
// that change only the count (§57): sums, faces, the centre die, jokers and cards, a combination's multiplier, a card's
// own number, a hand's percent, bells and a keeper's level. Each is data the engine reads (auto.js handRules, run3.js
// generateRunLevel, shop3.js levelBells), never its name.
//   hook: sum (when: any, first, five, has + face), face (face), cell (the centre die), joker (each joker in the hand),
//   card (each card the hand uses), mult (category, or when: last, held), raise (a card's number; which: first, bank,
//   all), pct (when: first, last), bells (when: clear, hands, reroll, played + categories, keeper, times),
//   keeper (what: points, cut). n: the number at 1, 2 and 3 stars (BRAIN BOOST's: how many cards).
//   serves: the combinations it helps (the shop's fit); helps: the keepers it answers (the shop before a keeper).

import { UP_CATEGORIES } from './upgrades3.js';
import { createRng } from './rng.js';
import { BOSSES, bossOf, isBossLevel } from './bosses3.js';

const ALL = UP_CATEGORIES;
const FIVE = ['full_house', 'straight', 'five_kind']; // the five-die hands

const thing = (file, name, rarity, from, hook, n, rule, serves = ALL, helps = []) =>
  Object.freeze({ file, name, rarity, from, ...hook, n: Object.freeze(n), rule, serves: Object.freeze(serves), helps: Object.freeze(helps) });

export const THINGS = Object.freeze({
  sweet_scoop: thing('0006_icecream', 'SWEET SCOOP', 'common', 5, { hook: 'sum', when: 'any' }, [2, 3, 4], (n) => `EVERY HAND: SUM +${n}`, ALL, ['fatman']),
  three_greens: thing('0007_broccoli', 'THREE GREENS', 'common', 5, { hook: 'sum', when: 'has', face: 3 }, [3, 4, 5], (n) => `A HAND WITH A 3 IN IT: SUM +${n}`, ALL, ['skeleton_golden']),
  dead_one: thing('0091_skull_human', 'DEAD ONE', 'rare', 25, { hook: 'sum', when: 'has', face: 1 }, [8, 11, 14], (n) => `A HAND WITH A 1 IN IT: SUM +${n}`, ALL, ['ghoul']),
  full_head: thing('0017_cabbage', 'FULL HEAD', 'common', 5, { hook: 'sum', when: 'five' }, [3, 4, 5], (n) => `A FIVE-DIE HAND: SUM +${n}`, FIVE, ['fatman']),
  first_slice: thing('0105_pizza', 'FIRST SLICE', 'common', 5, { hook: 'sum', when: 'first' }, [4, 6, 8], (n) => `THE FIRST HAND OF A LEVEL: SUM +${n}`, ALL, ['fatman']),
  first_gear: thing('0114_rose_car', 'FIRST GEAR', 'rare', 25, { hook: 'sum', when: 'first' }, [10, 14, 18], (n) => `THE FIRST HAND OF A LEVEL: SUM +${n}`),
  five_slices: thing('0073_watermelon', 'FIVE SLICES', 'uncommon', 15, { hook: 'sum', when: 'five' }, [5, 7, 9], (n) => `A FIVE-DIE HAND: SUM +${n}`, FIVE, ['fatman']),
  magnified_one: thing('0085_monocle', 'MAGNIFIED ONE', 'common', 5, { hook: 'face', face: 1 }, [1, 2, 3], (n) => `EACH 1 ADDS ${n + 1} TO THE HAND SUM, NOT 1`, ALL, ['ghoul']),
  pip_growth: thing('0113_mushroom', 'PIP GROWTH', 'uncommon', 15, { hook: 'face', face: 1 }, [2, 3, 4], (n) => `EACH 1 ADDS ${n} MORE TO THE HAND SUM`, ALL, ['ghoul']),
  six_bite: thing('0095_tooth', 'SIX BITE', 'common', 5, { hook: 'face', face: 6 }, [1, 2, 3], (n) => `EACH 6 ADDS ${n} MORE TO THE HAND SUM`),
  cube_four: thing('0117_black_cube', 'CUBE FOUR', 'common', 10, { hook: 'face', face: 4 }, [1, 2, 3], (n) => `EACH 4 ADDS ${n} MORE TO THE HAND SUM`, ALL, ['ghoul', 'skeleton_golden']),
  center_knight: thing('0092_chess', 'CENTER KNIGHT', 'common', 10, { hook: 'cell' }, [3, 4, 5], (n) => `THE DIE IN THE CENTER ADDS ${n} MORE TO THE HAND SUM`),
  sharp_wit: thing('0010_sapience', 'SHARP WIT', 'common', 10, { hook: 'joker' }, [4, 6, 8], (n) => `A JOKER ADDS ${n} MORE TO THE HAND SUM`),
  space_wild: thing('0040_spacemonkey', 'SPACE WILD', 'uncommon', 20, { hook: 'joker' }, [8, 11, 14], (n) => `A JOKER ADDS ${n} MORE TO THE HAND SUM`),
  card_value: thing('0111_cards', 'CARD VALUE', 'common', 5, { hook: 'card' }, [3, 5, 7], (n) => `EACH CARD PLAYED IN A HAND ADDS ${n} TO ITS SUM`),
  matched_pair: thing('0061_earring', 'MATCHED PAIR', 'common', 5, { hook: 'mult', category: 'pair' }, [1, 2, 3], (n) => `ONE PAIR: COMBINATION MULTIPLIER +${n}, ×2 AS ×${2 + n}`, ['pair'], ['ghoul_old']),
  double_date: thing('0121_ring_golden', 'DOUBLE DATE', 'common', 5, { hook: 'mult', category: 'two_pairs' }, [1, 2, 3], (n) => `TWO PAIRS: COMBINATION MULTIPLIER +${n}, ×3 AS ×${3 + n}`, ['two_pairs'], ['ghoul_old']),
  full_arc: thing('0028_rainbow', 'FULL ARC', 'common', 5, { hook: 'mult', category: 'straight' }, [1, 2, 3], (n) => `STRAIGHT: COMBINATION MULTIPLIER +${n}, ×8 AS ×${8 + n}`, ['straight']),
  web_step: thing('0070_spider', 'WEB STEP', 'uncommon', 15, { hook: 'mult', category: 'small_straight' }, [1, 2, 3], (n) => `SMALL STRAIGHT: COMBINATION MULTIPLIER +${n}, ×3 AS ×${3 + n}`, ['small_straight']),
  five_carats: thing('0120_diamond', 'FIVE CARATS', 'rare', 25, { hook: 'mult', category: 'five_kind' }, [3, 4, 5], (n) => `FIVE OF A KIND: COMBINATION MULTIPLIER +${n}, ×8 AS ×${8 + n}`, ['five_kind'], ['ghoul_old']),
  late_bloom: thing('0066_rose', 'LATE BLOOM', 'uncommon', 15, { hook: 'mult', when: 'last' }, [1, 2, 3], (n) => `THE LAST HAND OF A LEVEL: COMBINATION MULTIPLIER +${n}`, ALL, ['robot', 'knight_golden']),
  solid_hold: thing('0025_hold', 'SOLID HOLD', 'uncommon', 10, { hook: 'mult', when: 'held' }, [1, 2, 3], (n) => `A HAND OF FIVE HELD DICE: COMBINATION MULTIPLIER +${n}`, FIVE),
  brain_boost: thing('0000_brain', 'BRAIN BOOST', 'uncommon', 10, { hook: 'raise', which: 'first' }, [1, 2, 3], (n) => `${n > 1 ? `A LEVEL'S FIRST ${n} CARDS PLAYED COUNT` : 'A LEVEL\'S FIRST CARD PLAYED COUNTS'} ONE HIGHER: ×2 AS ×3`),
  patient_beads: thing('0119_brushes', 'PATIENT BEADS', 'rare', 20, { hook: 'raise', which: 'bank' }, [2, 3, 4], (n) => `A LEVEL'S FIRST BANK CARD PLAYED COUNTS ${n} HIGHER: ×2 AS ×${2 + n}`),
  all_seeing: thing('0124_eye', 'ALL SEEING', 'legendary', 35, { hook: 'raise', which: 'all' }, [1, 2, 3], (n) => `EVERY CARD YOU PLAY COUNTS ${n} HIGHER: ×2 AS ×${2 + n}`),
  callback: thing('0089_nokia3310', 'CALLBACK', 'common', 10, { hook: 'pct', when: 'first' }, [20, 30, 40], (n) => `THE FIRST HAND OF A LEVEL SCORES ${n}% MORE`, ALL, ['robot']),
  bounce_back: thing('0104_toy', 'BOUNCE BACK', 'common', 10, { hook: 'pct', when: 'last' }, [15, 25, 35], (n) => `THE LAST HAND OF A LEVEL SCORES ${n}% MORE`, ALL, ['knight_golden']),
  lucky_coin: thing('0001_goldcoin', 'LUCKY COIN', 'common', 5, { hook: 'bells', when: 'clear' }, [2, 3, 4], (n) => `EVERY CLEARED LEVEL PAYS ${n} MORE BELLS`),
  spare_hat: thing('0018_hat_fur', 'SPARE HAT', 'common', 10, { hook: 'bells', when: 'hands' }, [1, 2, 3], (n) => `A CLEARED LEVEL PAYS ${n} MORE BELL${n > 1 ? 'S' : ''} FOR EACH HAND LEFT`),
  peace_bonus: thing('0072_piece', 'PEACE BONUS', 'rare', 25, { hook: 'bells', when: 'hands' }, [2, 3, 4], (n) => `A CLEARED LEVEL PAYS ${n} MORE BELLS FOR EACH HAND LEFT`),
  victory_honk: thing('0098_clack_sound', 'VICTORY HONK', 'common', 10, { hook: 'bells', when: 'reroll' }, [2, 3, 4], (n) => `A CLEARED LEVEL WITH A REROLL LEFT PAYS ${n} MORE BELLS`),
  chainmaker: thing('0035_satoshi', 'CHAINMAKER', 'uncommon', 15, { hook: 'bells', when: 'played', categories: Object.freeze(['straight', 'small_straight']) }, [3, 4, 5], (n) => `A CLEARED LEVEL WITH ANY STRAIGHT PLAYED PAYS ${n} MORE BELLS`, ['straight', 'small_straight']),
  royal_toll: thing('0014_crown_gold', 'ROYAL TOLL', 'uncommon', 10, { hook: 'bells', when: 'keeper' }, [5, 7, 9], (n) => `A BEATEN KEEPER PAYS ${n} MORE BELLS`),
  knockout_pay: thing('0128_kastet_gokd', 'KNOCKOUT PAY', 'rare', 20, { hook: 'bells', when: 'times' }, [2, 3, 4], (n) => `A BEATEN KEEPER'S LEVEL PAYS ITS BELLS ×${n}`),
  calm_start: thing('0110_budda_gold', 'CALM START', 'common', 5, { hook: 'keeper', what: 'points' }, [40, 60, 80], (n) => `A KEEPER'S LEVEL STARTS WITH ${n} POINTS SCORED`, ALL, ['*']),
  distraction: thing('0019_doll_head', 'DISTRACTION', 'common', 10, { hook: 'keeper', what: 'cut' }, [5, 8, 11], (n) => `A KEEPER'S THRESHOLD IS ${n}% LOWER`, ALL, ['*']),
});

export const THING_PRICE = Object.freeze({ common: 8, uncommon: 12, rare: 18, legendary: 26 });
export const MAX_STARS = 3;

// The pocket's places for a level: 3, a 4th once level 15 is cleared, a 5th once level 35 is.
export const pocketPlaces = (levelIndex) => 3 + (levelIndex > 15 ? 1 : 0) + (levelIndex > 35 ? 1 : 0);

// A thing's number and rule at its stars.
export const numberOf = ({ id, stars }) => THINGS[id].n[Math.min(MAX_STARS, stars) - 1];
export const ruleOf = (id, stars = 1) => THINGS[id].rule(THINGS[id].n[Math.min(MAX_STARS, stars) - 1]);
export const starsOf = (pocket, id) => ((pocket || []).find((t) => t.id === id) || { stars: 0 }).stars;
export const helpsAgainst = (id, keeper) => THINGS[id].helps.includes('*') || THINGS[id].helps.includes(keeper);

// A pocket as saved: known things, one entry each, 1 to 3 stars, as many as the places.
export function cleanPocket(pocket, places) {
  const seen = new Set();
  return (Array.isArray(pocket) ? pocket : [])
    .filter((t) => t && THINGS[t.id] && !seen.has(t.id) && seen.add(t.id))
    .map((t) => ({ id: t.id, stars: Math.max(1, Math.min(MAX_STARS, Math.floor(t.stars) || 1)) }))
    .slice(0, places);
}

// Takes a thing into the pocket: one already carried gains a star and takes no place; else the first free place, or with
// none free the place `replace` (the old thing is gone for this run). Returns { ok, pocket, star } or { ok: false, code }.
export function takeThing(pocket, id, places, replace = null) {
  if (!THINGS[id]) return { ok: false, code: 'NO_THING' };
  const owned = pocket.findIndex((t) => t.id === id);
  if (owned >= 0) {
    if (pocket[owned].stars >= MAX_STARS) return { ok: false, code: 'FULL_STARS' };
    const stars = pocket[owned].stars + 1;
    return { ok: true, pocket: pocket.map((t, k) => (k === owned ? { id, stars } : t)), star: stars };
  }
  if (pocket.length < places) return { ok: true, pocket: [...pocket, { id, stars: 1 }], star: 1 };
  if (replace === null || !pocket[replace]) return { ok: false, code: 'POCKET_FULL' };
  return { ok: true, pocket: pocket.map((t, k) => (k === replace ? { id, stars: 1 } : t)), star: 1 };
}

// What the things change in a hand's count (bestHand's rules): adds to the sum (when: any, five, has + face), adds to a
// face, to the centre die, for each joker and each card in the hand, ups to the combination's multiplier (category, every
// one, or a hand of five held dice), raises of a card's number, percents. `first`: no hand played on the level yet;
// `last`: this is the level's last hand; `cards`: the numbered cards played on the level so far; `bank`: whether one of
// them came from the bank. Each entry names its thing, so a hand can say which things it used.
export function thingRules(things, { first, last, cards = 0, bank = false }) {
  const r = { adds: [], faces: [], cells: [], jokers: [], cards: [], ups: [], raise: [], pct: [] };
  for (const t of things || []) {
    const T = THINGS[t.id];
    if (!T) continue;
    const n = numberOf(t);
    if (T.hook === 'sum' && (T.when !== 'first' || first)) r.adds.push({ id: t.id, n, when: T.when === 'first' ? 'any' : T.when, ...(T.when === 'has' ? { face: T.face } : {}) });
    if (T.hook === 'face') r.faces.push({ id: t.id, face: T.face, n });
    if (T.hook === 'cell') r.cells.push({ id: t.id, n });
    if (T.hook === 'joker') r.jokers.push({ id: t.id, n });
    if (T.hook === 'card') r.cards.push({ id: t.id, n });
    if (T.hook === 'mult' && (T.when !== 'last' || last)) r.ups.push({ id: t.id, n, category: T.category || null, ...(T.when === 'held' ? { held: true } : {}) });
    // BRAIN BOOST raises the level's first n cards by one each, PATIENT BEADS its first card from the bank by n, ALL SEEING
    // every card by n
    if (T.hook === 'raise' && T.which === 'first' && n > cards) r.raise.push({ id: t.id, n: 1, which: 'first', count: n - cards });
    if (T.hook === 'raise' && T.which === 'bank' && !bank) r.raise.push({ id: t.id, n, which: 'bank' });
    if (T.hook === 'raise' && T.which === 'all') r.raise.push({ id: t.id, n, which: 'all' });
    if (T.hook === 'pct' && ((T.when === 'first' && first) || (T.when === 'last' && last))) r.pct.push({ id: t.id, n });
  }
  return r;
}

// What the things pay on a cleared level: [{ id, n }], each named on the receipt. `played`: the categories of the level's
// hands; `pay`: the level's own pay before the things. KNOCKOUT PAY comes last: on a keeper's level it multiplies the
// whole pay, the other things' bells among it.
export function thingBells(things, { handsLeft = 0, rerollsLeft = 0, keeper = false, played = [], pay = 0 }) {
  const paid = (things || []).flatMap((t) => {
    const T = THINGS[t.id];
    if (!T || T.hook !== 'bells' || T.when === 'times') return [];
    const n = numberOf(t);
    const v = T.when === 'clear' ? n
      : T.when === 'hands' ? n * handsLeft
        : T.when === 'reroll' ? (rerollsLeft > 0 ? n : 0)
          : T.when === 'played' ? (played.some((c) => T.categories.includes(c)) ? n : 0)
            : keeper ? n : 0;
    return v ? [{ id: t.id, n: v }] : [];
  });
  for (const t of things || []) {
    if (!keeper || !THINGS[t.id] || THINGS[t.id].when !== 'times') continue;
    const whole = pay + paid.reduce((a, p) => a + p.n, 0);
    if (whole) paid.push({ id: t.id, n: whole * (numberOf(t) - 1) });
  }
  return paid;
}

// What the things change on a keeper's level before it starts: the points it starts with, the threshold's cut in percent,
// and the things that did it (the screen pulses them as the level opens).
export function keeperHelp(things) {
  const help = { points: 0, cut: 0, by: [] };
  for (const t of things || []) {
    const T = THINGS[t.id];
    if (!T || T.hook !== 'keeper') continue;
    help[T.what] += numberOf(t);
    help.by.push(t.id);
  }
  return help;
}

// ---------- the gallery (portals spec, step 3b; MODE3-PLAN §56) ----------
// Every thing of the spec, 53 for the pocket and 6 cards, in its order: id, the owner's picture, kind. A device keeps the
// ids it has seen in a portal or bought (app.js st.gallery), for good; the gallery shows those, the others as a dark
// shape. The things not built yet (THINGS has the built ones) come with their steps: the cards in step 4, the ones that
// change the dice, the rerolls, the plays or the board in step 6. PAIR CHIME waits for the owner: its picture is the bell
// that means money everywhere in the game (assets/ui/bell.webp).
export const CATALOGUE = Object.freeze([
  ['brain_boost', '0000_brain', 'pocket'],
  ['lucky_coin', '0001_goldcoin', 'pocket'],
  ['best_guess', '0002_magicball', 'pocket'],
  ['pair_chime', '0004_bell', 'pocket'],
  ['sweet_scoop', '0006_icecream', 'pocket'],
  ['three_greens', '0007_broccoli', 'pocket'],
  ['second_shot', '0008_rogatka', 'pocket'],
  ['sharp_wit', '0010_sapience', 'pocket'],
  ['royal_toll', '0014_crown_gold', 'pocket'],
  ['big_bang', '0016_bomb', 'card'],
  ['full_head', '0017_cabbage', 'pocket'],
  ['spare_hat', '0018_hat_fur', 'pocket'],
  ['distraction', '0019_doll_head', 'pocket'],
  ['hat_trick', '0020_usa_hat', 'pocket'],
  ['second_wind', '0021_heart', 'card'],
  ['locked_in', '0023_handcuffs', 'pocket'],
  ['solid_hold', '0025_hold', 'pocket'],
  ['full_arc', '0028_rainbow', 'pocket'],
  ['six_arms', '0033_snowflake', 'pocket'],
  ['chainmaker', '0035_satoshi', 'pocket'],
  ['space_wild', '0040_spacemonkey', 'pocket'],
  ['toad_hop', '0044_toadz', 'pocket'],
  ['first_flight', '0045_butterfly', 'pocket'],
  ['odd_punk', '0047_punkhead', 'card'],
  ['matched_pair', '0061_earring', 'pocket'],
  ['power_paint', '0065_spray_color', 'card'],
  ['late_bloom', '0066_rose', 'pocket'],
  ['even_floor', '0069_disco_ball', 'card'],
  ['web_step', '0070_spider', 'pocket'],
  ['lucky_six', '0071_podkova', 'pocket'],
  ['peace_bonus', '0072_piece', 'pocket'],
  ['five_slices', '0073_watermelon', 'pocket'],
  ['hidden_move', '0077_anonim_mask', 'pocket'],
  ['six_grip', '0078_tanos', 'pocket'],
  ['magnified_one', '0085_monocle', 'pocket'],
  ['flying_pips', '0087_fly', 'pocket'],
  ['callback', '0089_nokia3310', 'pocket'],
  ['dead_one', '0091_skull_human', 'pocket'],
  ['center_knight', '0092_chess', 'pocket'],
  ['six_bite', '0095_tooth', 'pocket'],
  ['victory_honk', '0098_clack_sound', 'pocket'],
  ['face_spread', '0101_virus', 'pocket'],
  ['hot_trips', '0103_spray_hot', 'card'],
  ['bounce_back', '0104_toy', 'pocket'],
  ['first_slice', '0105_pizza', 'pocket'],
  ['one_shot', '0109_blaster', 'pocket'],
  ['calm_start', '0110_budda_gold', 'pocket'],
  ['card_value', '0111_cards', 'pocket'],
  ['pip_growth', '0113_mushroom', 'pocket'],
  ['first_gear', '0114_rose_car', 'pocket'],
  ['lucky_pair', '0115_clever', 'pocket'],
  ['cube_four', '0117_black_cube', 'pocket'],
  ['rewind', '0118_type_audio', 'pocket'],
  ['patient_beads', '0119_brushes', 'pocket'],
  ['five_carats', '0120_diamond', 'pocket'],
  ['double_date', '0121_ring_golden', 'pocket'],
  ['lifeline', '0123_cross', 'pocket'],
  ['all_seeing', '0124_eye', 'pocket'],
  ['knockout_pay', '0128_kastet_gokd', 'pocket'],
].map(([id, file, kind]) => Object.freeze({ id, file, kind })));

// In the shop's pool from the first run, found or not; the rest of the pocket's things join it once the device has
// found them (a portal shows every one of them from the first run).
export const STARTERS = Object.freeze(['sweet_scoop', 'lucky_coin', 'lucky_six', 'first_slice', 'full_head', 'matched_pair', 'six_bite', 'magnified_one', 'full_arc', 'double_date', 'second_shot', 'three_greens']);

// A gallery as saved: known ids, once each.
export const cleanGallery = (gallery) => [...new Set((Array.isArray(gallery) ? gallery : []).filter((id) => CATALOGUE.some((t) => t.id === id)))];

// The pocket's things the shop may offer after this level: a starter or a find of this device whose level is reached,
// not at 3 stars in the pocket.
export const shopPool = (levelIndex, pocket = [], gallery = []) => Object.keys(THINGS)
  .filter((id) => THINGS[id].from <= levelIndex && starsOf(pocket, id) < MAX_STARS && (STARTERS.includes(id) || gallery.includes(id)));

// ---------- the portal (portals spec, step 3; MODE3-PLAN §55) ----------
// A beaten keeper opens a portal with a thing inside it. Three seeded draws from the run seed and the level: the ring, the
// hands that hold it and the thing. The ring and the hands are the owner's decoration (assets/ui/portal, scripts/portal.py):
// they never hint at the thing, neither repeats one of the last two portals, and the golden hands come from level 35.
export const PORTAL_RINGS = Object.freeze(['anus', 'bread', 'cristall', 'hole', 'kpss', 'man', 'mouth', 'mucus', 'rick', 'snake', 'spaghetti', 'torba']);
export const PORTAL_HANDS = Object.freeze(['alien', 'fatman', 'ghoul', 'ghoul_nofinger', 'man', 'man_nofinger', 'monkey', 'monkey_ice', 'robot_gold',
  'robot_silver', 'skeleton', 'wizard_blue', 'wizard_gold', 'wizard_metall', 'wizard_old', 'wizard_purple', 'wizard_red', 'zombie', 'zombie_old']);
const GOLD_HANDS_FROM = 35;
const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];

// Each portal's decoration up to this level, drawn portal by portal without the last two, as the keepers are.
function decor(runSeed, levelIndex, kind) {
  const all = kind === 'ring' ? PORTAL_RINGS : PORTAL_HANDS;
  const drawn = [];
  for (let level = 5; level <= levelIndex; level += 5) {
    const pool = all.filter((id) => !drawn.slice(-2).includes(id) && (level >= GOLD_HANDS_FROM || !/_gold$/.test(id)));
    drawn.push(pool[createRng(`${runSeed}/portal/${level}/${kind}`).int(pool.length)]);
  }
  return drawn[drawn.length - 1];
}

// The rarity's odds in percent by depth (common, uncommon, rare, legendary); after a golden keeper rare or better, in the
// same proportion as at that depth.
export function portalOdds(levelIndex, golden = false) {
  const odds = levelIndex <= 15 ? [70, 25, 5, 0] : levelIndex <= 30 ? [50, 32, 15, 3] : levelIndex <= 45 ? [35, 35, 23, 7] : [25, 35, 28, 12];
  return golden ? odds.map((p, k) => (k < 2 ? 0 : p)) : odds;
}

// The rarity the portal of this level draws, before an empty one falls to the next lower.
export function portalRarity(runSeed, levelIndex) {
  const keeper = bossOf(runSeed, levelIndex);
  const odds = portalOdds(levelIndex, !!(keeper && BOSSES[keeper].golden));
  let x = createRng(`${runSeed}/portal/${levelIndex}/rarity`).next() * odds.reduce((a, b) => a + b, 0);
  for (let k = 0; k < odds.length; k++) {
    x -= odds[k];
    if (x < 0) return RARITIES[k];
  }
  return RARITIES.filter((_, k) => odds[k] > 0).pop(); // a rounding hair past the end
}

// The portal after a keeper's level, or null on any other level: { ring, hands, thing, star, fresh }. The thing is one of
// that rarity whose level is reached and that the pocket does not carry at 3 stars; one the device has not found yet
// (`gallery`, the ids it has seen) counts double. An empty rarity falls to the next lower one; with none below, the next
// higher. `star`: the star it brings (1 for a new one), `fresh`: a first find. thing is null only when every thing is
// at 3 stars.
export function portalOf(runSeed, levelIndex, { pocket = [], gallery = [] } = {}) {
  if (!isBossLevel(levelIndex)) return null;
  const open = (id) => THINGS[id].from <= levelIndex && starsOf(pocket, id) < MAX_STARS;
  const r = RARITIES.indexOf(portalRarity(runSeed, levelIndex));
  const order = [...RARITIES.slice(0, r + 1).reverse(), ...RARITIES.slice(r + 1)];
  const rarity = order.find((x) => Object.keys(THINGS).some((id) => THINGS[id].rarity === x && open(id)));
  const pool = Object.keys(THINGS).filter((id) => THINGS[id].rarity === rarity && open(id));
  const weight = (id) => (gallery.includes(id) ? 1 : 2);
  let x = createRng(`${runSeed}/portal/${levelIndex}/thing`).next() * pool.reduce((a, id) => a + weight(id), 0);
  const thing = pool.find((id) => (x -= weight(id)) < 0) || pool[pool.length - 1] || null;
  return { ring: decor(runSeed, levelIndex, 'ring'), hands: decor(runSeed, levelIndex, 'hands'), thing, star: thing ? starsOf(pocket, thing) + 1 : 0, fresh: !!thing && !gallery.includes(thing) };
}
