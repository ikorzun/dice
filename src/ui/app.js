// Dice Snake — portrait mobile UI driving three rule sets: "Snake 4+4" (engine/game.js), "Poker 5"
// (engine/poker.js) and "Auto Hand" (engine/auto.js). Since the owner's Figma mockup (DARK,
// 01.11.2026) the screen shows Auto Hand only, as an endless run a missed target ends; the other modes keep their
// code but have no tab. All rules live in the engines; this file renders state, interprets pointer
// gestures, plays effects, runs the example-based tutorial and keeps a local event log per mode.

import { createRng } from '../engine/rng.js';
import { CATEGORY_LABELS, CATEGORY_ORDER, CATEGORY_OUTCOMES, SCORE_TABLES, PIPS_RULES, scoreHand } from '../engine/scoring.js';
import { CATEGORY5_LABELS, CATEGORY5_OUTCOMES, CATEGORY5_OUTCOMES_SMALL, SCORE_TABLES5, PIPS_RULES5, scoreHand5 } from '../engine/scoring5.js';
import { BONUS_KINDS, AUTO_MULT } from '../engine/hands.js';
import { areAdjacent, rowOf, colOf, orderedPathsOf } from '../engine/geometry.js';
import {
  createGame, toggleHold as snakeToggleHold, reroll as snakeReroll, toggleBonus as snakeToggleBonus,
  previewPath as snakePreviewPath, bankPath as snakeBankPath, hintFor as snakeHintFor, markHintUsed as snakeMarkHintUsed,
  remainingCells as snakeRemainingCells, canReroll as snakeCanReroll, snapshotGame as snakeSnapshot, restoreGame as snakeRestore,
  isOrdinary as snakeIsOrdinary, isBanked as snakeIsBanked, heldCount as snakeHeldCount, rerollTargets as snakeRerollTargets,
} from '../engine/game.js';
import {
  createPokerGame, toggleHold as pokerToggleHold, reroll as pokerReroll, toggleBonus as pokerToggleBonus,
  previewPath as pokerPreviewPath, bankPath as pokerBankPath, hintFor as pokerHintFor, markHintUsed as pokerMarkHintUsed,
  remainingCells as pokerRemainingCells, canReroll as pokerCanReroll, snapshotGame as pokerSnapshot, restoreGame as pokerRestore,
  isBanked as pokerIsBanked, isSealed as pokerIsSealed, heldCount as pokerHeldCount, isOrdinary as pokerIsOrdinary, rerollTargets as pokerRerollTargets,
} from '../engine/poker.js';
import {
  createAutoGame, toggleHold as autoToggleHold, reroll as autoReroll, toggleBonus as autoToggleBonus,
  playHand as autoPlayHand, currentHand as autoCurrentHand, hintFor as autoHintFor, markHintUsed as autoMarkHintUsed,
  diceCells as autoDiceCells, canReroll as autoCanReroll, snapshotGame as autoSnapshot, restoreGame as autoRestore,
  isDie as autoIsDie, heldCount as autoHeldCount, rerollTargets as autoRerollTargets, heldHand as autoHeldHand,
  carryOver as autoCarryOver, BANK, BANK_SIZE,
} from '../engine/auto.js';
import { generateLevel, nextTier, DIFFICULTY_RULE_TEXT, GENERATOR_VERSION } from '../engine/levels.js';
import { generatePokerLevel, GENERATOR5_VERSION } from '../engine/levels5.js';
import { generateRunLevel, runTarget, RUN3_VERSION } from '../engine/run3.js';
import { upgradeOffer, withUpgrade } from '../engine/upgrades3.js';
import { loadDice3D, rollDice3D, renderFaces, dice3dStatus, useMatcap } from './dice3d.js';
import { createFire } from './fire.js';
import { SOUNDS, setupSound, setSound, sfx } from './sound.js';
import { setupPuppets, animateArt } from './puppets.js';

const APP_VERSION = '0.2.0';
const STORAGE_KEY = 'dice-snake.v2';
const LOOK_KEY = 'dice-snake.look';
const DICE3D_KEY = 'dice-snake.dice3d';
const SOUND_KEY = 'dice-snake.sound';
const LOOKS = [
  { id: 'modern', name: 'Modern · black' },
  { id: 'manuscript', name: 'Manuscript · parchment and ink' },
  { id: 'tavern', name: 'Tavern · oak, bone and brass' },
  { id: 'keep', name: 'Keep · stone and heraldry' },
];
const LEGACY_KEY = 'dice-snake-3x3.v1';
const TAP_THRESHOLD = 10; // CSS px of movement before a press becomes a path
const LONG_PRESS_MS = 450; // a long press on a bonus die opens its description (owner, 01.11.2026)
const CORE_INSET = 0.18; // path hit region = central 64% of a cell (no corner cutting)
const LOG_LIMIT = 4000;
const SVG_NS = 'http://www.w3.org/2000/svg';
const MEDAL_STEP = 5; // a medal for clearing every fifth level of a run (owner's questionnaire В6, 04.11.2026)
const FIRE_HANDS = new Set(['four_kind', 'five_kind', 'straight']); // ×6 and ×8: their dice burn when played

const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = reduceMotion
  ? { roll: 0, rollSwap: 0, stagger: 0, bank: 60, refill: 0, reveal: 0, endDelay: 120, flash: 900, fire: 400 }
  : { roll: 640, rollSwap: 300, stagger: 45, bank: 560, refill: 520, reveal: 950, endDelay: 700, flash: 1400, fire: 750 };

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const els = { cells: [] };

// ---------- mode registry ----------
const snakeEngine = {
  create: createGame,
  toggleHold: snakeToggleHold,
  reroll: snakeReroll,
  toggleBonus: snakeToggleBonus,
  previewPath: snakePreviewPath,
  bankPath: (state, path) => snakeBankPath(state, path),
  hintFor: snakeHintFor,
  markHintUsed: snakeMarkHintUsed,
  remainingCells: snakeRemainingCells,
  canReroll: snakeCanReroll,
  snapshot: snakeSnapshot,
  restore: snakeRestore,
  isOrdinary: snakeIsOrdinary,
  isBanked: snakeIsBanked,
  isSealed: () => false,
  heldCount: snakeHeldCount,
  rerollCount: (g) => snakeRerollTargets(g).length,
  handsPlayed: (g) => g.hands.length,
  handsTotal: () => 2,
  isLastHand: (g) => g.hands.length === 1,
};

const pokerEngine = {
  create: createPokerGame,
  toggleHold: pokerToggleHold,
  reroll: pokerReroll,
  toggleBonus: pokerToggleBonus,
  previewPath: pokerPreviewPath,
  bankPath: (state, path, drawDie) => pokerBankPath(state, path, drawDie),
  hintFor: pokerHintFor,
  markHintUsed: pokerMarkHintUsed,
  remainingCells: pokerRemainingCells,
  canReroll: pokerCanReroll,
  snapshot: pokerSnapshot,
  restore: pokerRestore,
  isOrdinary: pokerIsOrdinary,
  isBanked: pokerIsBanked,
  isSealed: pokerIsSealed,
  heldCount: pokerHeldCount,
  rerollCount: (g) => pokerRerollTargets(g).length,
  handsPlayed: (g) => g.hands.length,
  handsTotal: (g) => g.hands.length + g.handsLeft,
  isLastHand: (g) => g.handsLeft === 1,
};

// Auto Hand has no path: "bank" plays the best hand on the board, the path is ignored.
const autoEngine = {
  create: createAutoGame,
  toggleHold: autoToggleHold,
  reroll: autoReroll,
  toggleBonus: autoToggleBonus,
  previewPath: () => ({ ok: false, code: 'NO_PATH', message: 'Press PLAY HAND' }),
  bankPath: (state, path, drawDie) => {
    const r = autoPlayHand(state, drawDie);
    return r.ok ? r : { ...r, state }; // the UI keeps the state of a rejected bank, like poker.js returns it
  },
  hintFor: autoHintFor,
  markHintUsed: autoMarkHintUsed,
  remainingCells: autoDiceCells,
  canReroll: autoCanReroll,
  snapshot: autoSnapshot,
  restore: autoRestore,
  isOrdinary: autoIsDie,
  isBanked: () => false,
  isSealed: () => false,
  heldCount: autoHeldCount,
  rerollCount: (g) => autoRerollTargets(g).length,
  handsPlayed: (g) => g.hands.length,
  handsTotal: (g) => g.hands.length + g.handsLeft,
  isLastHand: (g) => g.handsLeft === 1,
};

const show =(g, cells) => cells.map((i) => g.faces[i]).join(' → ');
const CELL_NAMES = ['top left', 'top', 'top right', 'left', 'centre', 'right', 'bottom left', 'bottom', 'bottom right'];
const describeCells = (g, cells) => cells.map((i) => `the ${g.faces[i]} (${CELL_NAMES[i]})`).join(' and ');

const MODES = {
  snake4: {
    id: 'snake4',
    name: 'Snake 4+4',
    handSize: 4,
    bonus: 'cell',
    refill: false,
    engine: snakeEngine,
    generatorVersion: GENERATOR_VERSION,
    defaultSettings: { settingsVersion: 3, maxHolds: null, scoreTable: 'pips', autoBonusOnFinalHand: true, pathMode: false },
    tableOptions: [
      { value: 'pips', label: 'Pips × rarity · sum of matching dice × 2/3/4/5/6 (3-3-3 = 36)' },
      { value: 'spec_v03', label: 'Flat v0.3 · 30 / 15 / 10 / 5 / 2 / 0' },
      { value: 'rarity', label: 'Flat by rarity · 30 / 15 / 12 / 10 / 2 / 0' },
    ],
    gameConfig: (st) => ({ maxHolds: st.maxHolds, scoreTable: st.scoreTable, autoBonusOnFinalHand: st.autoBonusOnFinalHand }),
    generate: ({ runSeed, levelIndex, tier, settings }) => generateLevel({ runSeed, levelIndex, tier, scoreTable: settings.scoreTable }),
    idleCopy: (g, pathMode) => {
      if (pathMode) return g.hands.length === 0 ? 'Tap 4 connected dice in order' : 'Tap the last 4 dice in order';
      return g.hands.length === 0 ? 'Drag through 4 dice to play · tap to hold' : 'Drag through the last 4 dice';
    },
    solverLine: (level) => `Best possible on the opening roll (no rerolls, with ×2): ${level.bestNoRerollWithBonus}`,
    help: {
      lead: 'Save a connected set of four for your second hand. The first hand must leave four dice you can still snake through.',
      rules: [
        'Eight dice and one gold ×2 cell on a 3×3 board.',
        'To play a hand, press a die and drag through four dice that touch edge to edge (no diagonals, no repeats) in one move, then lift. Example: 5 → 5 → 5 → 5 is FOUR OF A KIND. Tapping does not select dice. Both hands together use all eight dice.',
        'Tap a die to hold it. REROLL changes every unheld, unbanked die. Two rerolls per level, shared by both hands.',
        'Tap the gold cell (or the ×2 badge) to arm ×2 for the hand you bank next. If it is still unused on the last hand, it is applied there automatically.',
        'Reach the target with the two hands to clear the level.',
      ],
      scoreTitle: 'SCORING · FOUR DICE',
      scoreRows: (settings) => {
        const pips = settings.scoreTable === 'pips';
        const table = pips ? null : SCORE_TABLES[settings.scoreTable];
        const examples = { four_kind: [4, 4, 4, 4], straight: [1, 2, 3, 4], three_kind: [3, 3, 3, 1], two_pairs: [2, 2, 5, 5], pair: [6, 6, 3, 1], high: [1, 2, 4, 6] };
        return CATEGORY_ORDER.map((cat) => {
          const ex = examples[cat];
          const scored = scoreHand(ex, settings.scoreTable);
          return { label: CATEGORY_LABELS[cat], example: ex, points: pips ? `${PIPS_RULES[cat]} = ${scored.points}` : table[cat], odds: CATEGORY_OUTCOMES[cat] / 1296 };
        });
      },
      options: { table: true, small: false, endOnTarget: false, goldCell: false },
    },
    coachText(step, g, hint) {
      if (step === 'swipe') return `DRAG ${show(g, hint.cells)} IN ONE MOVE, THEN LIFT · ${hint.hand.label} ${hint.hand.points}`;
      return g.bonus.available
        ? `TAP GOLD ×2 TO DOUBLE THIS HAND, THEN DRAG THE LAST FOUR (${show(g, hint.cells)}) OR PRESS BANK LAST 4`
        : `DRAG THE LAST FOUR (${show(g, hint.cells)}) OR PRESS BANK LAST 4`;
    },
  },
  poker5: {
    id: 'poker5',
    name: 'Poker 5',
    handSize: 5,
    bonus: 'cell',
    refill: true,
    engine: pokerEngine,
    generatorVersion: GENERATOR5_VERSION,
    defaultSettings: { settingsVersion: 3, maxHolds: null, scoreTable: 'pips', smallStraight: false, endOnTarget: true, autoBonusOnFinalHand: true, pathMode: false, hands: 3, rerolls: 2, goldCell: true },
    tableOptions: [
      { value: 'pips', label: 'Pips × rarity · sum of matching dice × 2/3/4/5/6/8 (3-3-3 = 36)' },
      { value: 'poker5_v2', label: 'Flat · 50 / 30 / 25 / 20 / 10 / 5 / 2 / 0' },
      { value: 'poker5_v1', label: 'Flat steep · 60 / 40 / 25 / 20 / 10 / 6 / 2 / 0' },
    ],
    gameConfig: (st) => ({ maxHolds: st.maxHolds, scoreTable: st.scoreTable, smallStraight: st.smallStraight, endOnTarget: st.endOnTarget, autoBonusOnFinalHand: st.autoBonusOnFinalHand, hands: st.hands, rerolls: st.rerolls, bonusIndex: st.goldCell === false ? null : 8 }),
    generate: ({ runSeed, levelIndex, tier, settings }) => generatePokerLevel({ runSeed, levelIndex, tier, config: MODES.poker5.gameConfig(settings) }),
    idleCopy: (g, pathMode) => {
      const n = g.hands.length + 1;
      const total = g.hands.length + g.handsLeft;
      return pathMode ? `Hand ${n}/${total} · tap 5 dice in order` : `Hand ${n}/${total} · drag 5 dice · tap to hold`;
    },
    solverLine: (level) => `Best opening snake before any reroll: ${CATEGORY5_LABELS[level.openingCategory] || ''} ${level.openingBest}`,
    help: {
      lead: 'The dice you leave behind are the start of your next hand: plan the snake so the leftovers already match.',
      rules: [
        'Eight dice and one gold ×2 cell on a 3×3 board. A hand is a snake of exactly five dice that touch edge to edge (no diagonals, no repeats).',
        'To play a hand, press a die and drag through five dice in one move, then lift. Example: 4 → 4 → 4 → 2 → 2 is a FULL HOUSE.',
        'The five dice you played are replaced by fresh dice. The other three stay exactly as they are.',
        'Tap a die to hold it. REROLL changes every unheld die (the button says how many). Two rerolls per level, shared by all hands.',
        'Three hands per level. Tap the gold cell (or the ×2 badge) to double the hand you play next; an unused ×2 is applied to the last hand automatically.',
        'Reach the target and the level ends at once: cleared on hand 1 is three stars, on hand 2 two, on hand 3 one.',
      ],
      scoreTitle: 'SCORING · FIVE DICE (POKER)',
      scoreRows: (settings) => {
        const pips = settings.scoreTable === 'pips';
        const table = pips ? null : SCORE_TABLES5[settings.scoreTable] || SCORE_TABLES5.poker5_v2;
        const outcomes = settings.smallStraight ? CATEGORY5_OUTCOMES_SMALL : CATEGORY5_OUTCOMES;
        const examples = { five_kind: [5, 5, 5, 5, 5], four_kind: [4, 4, 4, 4, 1], straight: [1, 2, 3, 4, 5], full_house: [2, 2, 5, 5, 5], small_straight: [1, 2, 3, 4, 4], three_kind: [3, 3, 3, 1, 2], two_pairs: [2, 2, 6, 6, 3], pair: [6, 6, 3, 5, 1], bust: [1, 2, 4, 5, 6] };
        const order = ['five_kind', 'four_kind', 'straight', 'full_house', 'small_straight', 'three_kind', 'two_pairs', 'pair', 'bust'].filter((c) => settings.smallStraight || c !== 'small_straight');
        return order.map((cat) => {
          const ex = examples[cat];
          const scored = scoreHand5(ex, settings.scoreTable, { smallStraight: true });
          return { label: CATEGORY5_LABELS[cat], example: ex, points: pips ? `${PIPS_RULES5[cat]} = ${scored.points}` : table[cat], odds: outcomes[cat] / 7776 };
        });
      },
      options: { table: true, small: true, endOnTarget: true, goldCell: true },
    },
    coachText(step, g, hint) {
      if (step === 'swipe') return `DRAG ${show(g, hint.cells)} IN ONE MOVE, THEN LIFT · ${hint.hand.label} ${hint.hand.points}`;
      const n = g.hands.length + 1;
      const total = g.hands.length + g.handsLeft;
      const last = g.handsLeft === 1 && g.bonus.available ? ' · ×2 AUTO' : '';
      const left = g.geometry.free.length - M().handSize;
      return `HAND ${n}/${total} · THE OTHER ${left === 3 ? 'THREE' : 'FOUR'} STAYED · DRAG ${show(g, hint.cells)} · ${hint.hand.label} ${hint.hand.points}${last}`;
    },
  },
  auto: {
    id: 'auto',
    name: 'Auto Hand',
    handSize: 5,
    bonus: 'board',
    refill: true,
    engine: autoEngine,
    generatorVersion: RUN3_VERSION,
    defaultSettings: { settingsVersion: 1, maxHolds: null, scoreTable: 'pips', autoBonusOnFinalHand: false, pathMode: false, hands: 3, rerolls: 3 },
    gameConfig: (st) => ({ hands: st.hands, rerolls: st.rerolls }),
    // one curve for everyone (questionnaire В1 A, 04.11.2026): the level depends on the run seed and its number only
    generate: ({ runSeed, levelIndex, settings, bank, ups }) => generateRunLevel({ runSeed, levelIndex, bank, ups, config: MODES.auto.gameConfig(settings) }),
    scoringHtml: '<strong>Matching dice score their sum × a multiplier that grows with rarity.</strong> Pair × 2, two pairs × 3, three of a kind × 4, full house × 5, four of a kind × 6, straight × 8, five of a kind × 8. Bonus dice add up: ×2 and ×3 together make ×4.',
    difficultyText: 'One curve for everyone: each level asks for more than the one before, and its board is drawn to fit the level, never the player. A missed target ends the run.',
    summary: (g) => ({ recipe: g.level.recipe, chance: g.level.chance }),
    idleCopy: (g) => `Hand ${g.hands.length + 1}/${g.hands.length + g.handsLeft} · hold to keep · reroll or play`,
    solverLine: (level) => `Best opening hand before any reroll: ${CATEGORY5_LABELS[level.openingCategory] || ''} ${level.openingBest}`,
    help: {
      lead: 'Hold what you want to keep on a reroll; PLAY throws every die anew. Bonus dice wait on the board, switched off, until you switch one on for a hand that fits it.',
      rules: [
        'Dice, bonus dice and blocks on a 3×3 board. Positions do not matter: PLAY scores the best poker hand among all the dice, or the one you pick: when the dice you hold make a combination, the best of them plays. The counter shows the hand and its points; the board does not mark its dice.',
        'PLAY HAND scores it. Then every die burns and is thrown anew, held or not.',
        'Tap a die to hold it. REROLL changes every unheld die. Three rerolls per level, shared by all hands.',
        'Bonus dice: ×2 ANY HAND, ×3 STRAIGHT, ×3 PAIRS (pair, two pairs), ×3 TRIPS (three of a kind, full house), ★ JOKER (stands in for any face), +1 REFUND (the hand gives a reroll back). They start switched off: tap one to switch it on (tap again to keep it for later). Every bonus that is on and fits joins the hand; bonuses add up (×2 and ×3 together make ×4). A used bonus makes way for a new die, or for a bonus waiting above the board.',
        'Reach the target and the level ends at once; a level has three hands at most. Miss it and the run is over. There is no last level: each asks for more.',
        'Bonuses you did not play on a won level are kept for the next level of the run (three at most, the rest burn). They come in on its first reroll, each in place of a die being rerolled while six dice stay on the board; the rest wait above the board from then on: tap one there to switch it on like a card on the board.',
      ],
      scoreTitle: 'SCORING · THE HAND IS THE DICE OF THE COMBINATION',
      scoreRows: () => {
        const examples = { five_kind: [5, 5, 5, 5, 5], four_kind: [4, 4, 4, 4], straight: [1, 2, 3, 4, 5], full_house: [2, 2, 5, 5, 5], three_kind: [3, 3, 3], small_straight: [1, 2, 3, 4], two_pairs: [2, 2, 6, 6], pair: [6, 6] };
        return Object.entries(examples).map(([cat, ex]) => ({
          label: CATEGORY5_LABELS[cat], example: ex, points: `sum × ${AUTO_MULT[cat]} = ${ex.reduce((s, f) => s + f, 0) * AUTO_MULT[cat]}`, odds: null,
        }));
      },
      options: { table: false, small: false, endOnTarget: false, goldCell: false },
    },
    coachText(step, g, hint) {
      if (step === 'swipe') return `BEST HAND · ${hint.hand.label} ${hint.hand.total} · PRESS PLAY`;
      return `HAND ${g.hands.length + 1}/${g.hands.length + g.handsLeft} · NEW DICE · HOLD, REROLL OR PLAY`;
    },
  },
};

function freshModeState(mode) {
  return {
    runSeed: null,
    levelIndex: 1,
    tier: 1,
    settings: { ...mode.defaultSettings },
    onboarded: false,
    coached: false,
    coach: { active: false, done: { hold: false, reroll: false } },
    game: null,
    log: [],
    levels: [],
    rerollRng: null,
    refillRng: null,
    levelStartedAt: 0,
    firstHandAt: null,
    pendingTier: null,
    allHeldToastShown: false,
    tips: {}, // one-time Auto Hand tips already shown (new bonus kinds, saving a bonus)
    bank: [], // Auto Hand: the bonus kinds kept from won levels for the next ones (owner, 02.11.2026)
    ups: {}, // Auto Hand: the run's upgrades of the combinations, +1 to the multiplier each (owner, 02.11.2026)
    runScore: 0, // Auto Hand: the points of this run's levels; ties of the record break on them (questionnaire В3)
    runMedals: [], // Auto Hand: this run's medals, { level, fresh } (fresh: first cleared on this device)
    best: null, // Auto Hand: the record on this device, { level, score }: the furthest level a run got to, then points
    medal: 0, // Auto Hand: the furthest medal level ever cleared (5, 10, 15…)
    lastEnd: null, // Auto Hand: what the last level end brought (medal, record), for its summary after a reload
  };
}

const app = {
  modeId: 'snake4',
  modes: { snake4: freshModeState(MODES.snake4), poker5: freshModeState(MODES.poker5), auto: freshModeState(MODES.auto) },
  autoHand: null, // best hand on the Auto Hand board, computed once per render
  fire: null, // the shader fire over the board (fire.js), made on the first strong hand
  sheetAt: 0, // when the bonus sheet opened (its opening finger must not close it)
  sheetQueue: [], // kinds whose sheet waits for the open one to close
  afterGuide: [], // card deals waiting for the guide to uncover the board
  launching: new Set(), // bank places whose card is about to fly to the board (flyFromBank)
  busy: false,
  path: [],
  tapPath: [],
  hintCells: null,
  hintTimer: null,
  coachTargets: null,
  safeNext: null,
  stranded: null,
  cellRects: null,
  gesture: null,
  toastTimer: null,
  revealTimer: null,
  scoreAnim: false,
  ghostKey: '',
  ghostAnim: null,
  endTimer: null,
  look: 'modern',
  dice3d: true,
};

// ---------- 3D physics dice (optional, CDN libraries) ----------
function setDice3D(on) {
  app.dice3d = !!on;
  try { localStorage.setItem(DICE3D_KEY, app.dice3d ? '1' : '0'); } catch { /* ignore */ }
  const box = $('optDice3d');
  if (box) box.checked = app.dice3d;
  if (app.dice3d) loadDice3D().then(applyRenderedFaces);
  else applyRenderedFaces();
}

// Resting dice drawn from the 3D model, like the rolling ones (owner, 01.11.2026), once three.js
// is ready; the CSS dice stay when 3D is off or unavailable. Redrawn when the look changes colours.
function applyRenderedFaces() {
  if (app.busy) return; // a roll owns the 3D canvas; the next call redraws
  const faces = app.dice3d && dice3dStatus() === 'ready' ? renderFaces({ colors: lookColors() }) : null;
  // the baked faces (styles.css) show until then; keys: value, then k for the held body ('3', '3k')
  if (faces) for (const [key, url] of Object.entries(faces)) els.board.style.setProperty(`--face-${key[0]}${key.endsWith('k') ? '-held' : ''}`, `url(${url})`);
}

function lookColors() {
  const cs = getComputedStyle(document.body);
  const pick = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
  return { die: pick('--die', '#ffffff'), pip: pick('--pip', '#000000'), held: pick('--hold', '#d4ff82') };
}

// ---------- looks (visual concepts) ----------
function setLook(id, { announce = false } = {}) {
  const look = LOOKS.find((l) => l.id === id) || LOOKS[0];
  app.look = look.id;
  document.body.dataset.look = look.id;
  try { localStorage.setItem(LOOK_KEY, look.id); } catch { /* ignore */ }
  const sel = $('optLook');
  if (sel) sel.value = look.id;
  const d3box = $('optDice3d');
  if (d3box) d3box.checked = app.dice3d;
  if (announce) toast(`LOOK: ${look.name}`, 'hint');
  if (app.modes[app.modeId] && app.modes[app.modeId].game) logEvent('look', { look: look.id });
  applyRenderedFaces();
}

function cycleLook() {
  const k = LOOKS.findIndex((l) => l.id === app.look);
  setLook(LOOKS[(k + 1) % LOOKS.length].id, { announce: true });
}

const S = () => app.modes[app.modeId];
const M = () => MODES[app.modeId];
const E = () => MODES[app.modeId].engine;
const engineOf = (mode) => mode.engine;

// ---------- persistence ----------
function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function serializeMode(st, engine) {
  return {
    runSeed: st.runSeed,
    levelIndex: st.levelIndex,
    tier: st.tier,
    settings: st.settings,
    onboarded: st.onboarded,
    coached: st.coached,
    coach: st.coach,
    pendingTier: st.pendingTier,
    tips: st.tips,
    bank: st.bank,
    ups: st.ups,
    runScore: st.runScore,
    runMedals: st.runMedals,
    best: st.best,
    medal: st.medal,
    lastEnd: st.lastEnd,
    game: st.game ? engine.snapshot(st.game) : null,
    log: st.log.slice(-LOG_LIMIT),
    levels: st.levels.slice(-200),
  };
}

function persist() {
  const data = { version: APP_VERSION, activeMode: app.modeId, modes: {} };
  for (const id of Object.keys(MODES)) data.modes[id] = serializeMode(app.modes[id], MODES[id].engine);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: the game still works for this session */
  }
}

function hydrateMode(id, saved) {
  const mode = MODES[id];
  const st = freshModeState(mode);
  if (!saved) return st;
  st.runSeed = saved.runSeed || null;
  st.levelIndex = saved.levelIndex || 1;
  st.tier = saved.tier || 1;
  // Settings are reset when their defaults change version (new table, economy); PATH mode is kept.
  const savedSettings = saved.settings && saved.settings.settingsVersion === mode.defaultSettings.settingsVersion ? saved.settings : { pathMode: !!(saved.settings && saved.settings.pathMode) };
  st.settings = { ...st.settings, ...savedSettings };
  st.onboarded = !!saved.onboarded;
  st.coached = !!saved.coached;
  if (saved.coach && saved.coach.active) st.coach = { active: true, done: { hold: false, reroll: false, ...(saved.coach.done || {}) } };
  st.log = Array.isArray(saved.log) ? saved.log : [];
  st.levels = Array.isArray(saved.levels) ? saved.levels : [];
  st.pendingTier = Number.isInteger(saved.pendingTier) ? saved.pendingTier : null;
  st.tips = saved.tips && typeof saved.tips === 'object' ? saved.tips : {};
  st.bank = Array.isArray(saved.bank) ? saved.bank.filter((k) => BONUS_KINDS[k]).slice(0, 3) : [];
  st.ups = saved.ups && typeof saved.ups === 'object' ? Object.fromEntries(Object.entries(saved.ups).filter(([c, n]) => AUTO_MULT[c] && Number.isInteger(n) && n > 0)) : {};
  st.runScore = Number.isFinite(saved.runScore) ? saved.runScore : 0;
  st.runMedals = Array.isArray(saved.runMedals) ? saved.runMedals.filter((m) => m && Number.isInteger(m.level)) : [];
  st.best = saved.best && Number.isInteger(saved.best.level) && Number.isFinite(saved.best.score) ? { level: saved.best.level, score: saved.best.score } : null;
  st.medal = Number.isInteger(saved.medal) ? saved.medal : 0;
  st.lastEnd = saved.lastEnd && typeof saved.lastEnd === 'object' ? saved.lastEnd : null;
  if (saved.game) {
    try {
      st.game = mode.engine.restore(saved.game);
      const seed = saved.game.level.seed;
      st.rerollRng = createRng(`${seed}/rerolls/attempt${saved.game.attempt}/resume${st.log.length}`);
      st.refillRng = createRng(`${seed}/refill/attempt${saved.game.attempt}/resume${st.log.length}`);
      st.levelStartedAt = Date.now();
    } catch {
      st.game = null;
    }
  }
  return st;
}

function logEvent(type, data = {}) {
  const st = S();
  st.log.push({ t: Date.now(), dt: st.levelStartedAt ? Date.now() - st.levelStartedAt : 0, mode: app.modeId, level: st.levelIndex, type, ...data });
  if (st.log.length > LOG_LIMIT) st.log.splice(0, st.log.length - LOG_LIMIT);
  coachOnEvent(type, data);
}

// ---------- level lifecycle ----------
function startGame(level, attempt) {
  const st = S();
  const mode = M();
  st.game = mode.engine.create(level, mode.gameConfig(st.settings), attempt);
  st.rerollRng = createRng(`${level.seed}/rerolls/attempt${attempt}`);
  st.refillRng = createRng(`${level.seed}/refill/attempt${attempt}`);
  st.levelStartedAt = Date.now();
  st.firstHandAt = null;
  st.pendingTier = null;
  st.allHeldToastShown = false;
  for (const c of els.cells) {
    c.classList.remove('bank-pop', 'burn', 'gone', 'rolling', 'refill', 'pressed', 'shake', 'safe-hint', 'stays', 'arriving', 'landed');
    c.flight = null; // a card still on its way to the last level's board
  }
  app.launching = new Set(); // the cards kept from the last level wait above until the first reroll (owner, 03.11.2026)
  app.path = [];
  app.tapPath = [];
  clearTimeout(app.hintTimer);
  app.hintCells = null;
  app.coachTargets = null;
  clearTimeout(app.endTimer);
  stopGhost();
  logEvent('level_start', {
    seed: level.seed, levelIndex: level.levelIndex, tier: level.tier, target: level.target, faces: level.faces, attempt,
    opening: level.bestNoRerollWithBonus ?? level.openingBest, config: mode.gameConfig(st.settings),
  });
  $('levelEnd').hidden = true;
  render();
  persist();
  autoTips();
  if (st.game.bank && st.game.bank.length && attempt === 1 && !st.tips.bankReroll) { // the first time the bank fills
    st.tips.bankReroll = true;
    toast('KEPT BONUSES COME IN ON THE FIRST REROLL', 'hint', 3600);
  }
}

function newLevel() {
  const st = S();
  const level = M().generate({ runSeed: st.runSeed, levelIndex: st.levelIndex, tier: st.tier, settings: st.settings, history: st.levels, bank: st.bank, ups: st.ups });
  startGame(level, 1);
}

function finishLevel() {
  const st = S();
  const g = st.game;
  const mode = M();
  const won = g.phase === 'won';
  if (won) sfx('win'); // only a real win is celebrated (digest §1, rule 27); a missed target stays quiet
  if (won && mode.id === 'auto') st.bank = autoCarryOver(g); // the unplayed bonuses wait for the next level
  if (mode.id === 'auto') tallyRun(st, g, won);
  const now = Date.now();
  const summary = {
    mode: mode.id, levelIndex: g.level.levelIndex, seed: g.level.seed, tier: g.level.tier, target: g.level.target, score: g.score, won, attempt: g.attempt,
    durationMs: now - st.levelStartedAt, timeToFirstHandMs: st.firstHandAt ? st.firstHandAt - st.levelStartedAt : null,
    hintsUsed: g.stats.hintsUsed, rejectedPaths: g.stats.rejectedPaths, rerollsUsed: g.stats.rerollsUsed, holdToggles: g.stats.holdToggles,
    categories: g.hands.map((h) => h.category), bonusOnHand: g.bonus ? g.bonus.usedOnHand : null, bonusAuto: g.bonus ? g.bonus.autoApplied : null,
    bonusesUsed: g.hands.map((h) => h.bonuses || []),
    handsLeft: g.handsLeft ?? 0, opening: g.level.bestNoRerollWithBonus ?? g.level.openingBest,
    ...(mode.summary ? mode.summary(g) : {}),
  };
  st.levels.push(summary);
  logEvent('level_end', summary);
  if (mode.id === 'auto' && !won) logEvent('run_end', { runSeed: st.runSeed, level: g.level.levelIndex, score: st.runScore, best: st.best, newBest: st.lastEnd.newBest });
  st.pendingTier = nextTier(st.tier, won);
  persist();
  showLevelEnd();
}

// The run's points, medals and record (owner, 03.11.2026: a missed target ends the run; questionnaire В3: the
// record is the furthest level, ties broken by points; В6: a medal for every fifth level cleared). `lastEnd`
// keeps what this level end brought for its summary, which a reload shows again.
function tallyRun(st, g, won) {
  const level = g.level.levelIndex;
  st.runScore += g.score;
  const end = { seed: g.level.seed };
  if (won) {
    if (level % MEDAL_STEP === 0) {
      end.medal = level;
      end.fresh = level > st.medal;
      st.medal = Math.max(st.medal, level);
      st.runMedals = [...st.runMedals, { level, fresh: end.fresh }];
    }
    end.passedBest = !!st.best && level === st.best.level; // from here on the run goes further than any before
  } else {
    end.newBest = !st.best || level > st.best.level || (level === st.best.level && st.runScore > st.best.score);
    if (end.newBest) st.best = { level, score: st.runScore };
  }
  st.lastEnd = end;
}

function showLevelEnd() {
  const st = S();
  const g = st.game;
  const mode = M();
  const won = g.phase === 'won';
  if (st.pendingTier == null) st.pendingTier = nextTier(st.tier, won);
  const over = mode.id === 'auto' && !won; // a missed target ends the run (owner, 03.11.2026)
  $('endTitle').textContent = won ? 'LEVEL CLEARED' : over ? 'RUN OVER' : 'TARGET MISSED';
  $('endTitle').className = `end-title ${won ? 'won' : 'lost'}`;
  $('levelEnd').classList.toggle('run-over', over);
  showRunEnd(st, g, won, over);
  $('endScore').textContent = g.score;
  $('endTarget').textContent = g.level.target;
  const list = $('endHands');
  list.innerHTML = '';
  g.hands.forEach((h, k) => {
    const li = document.createElement('li');
    const mini = h.faces.map((f) => `<b>${f}</b>`).join('');
    const mult = h.multiplier > 1 ? `<em>×${h.multiplier}</em>` : '';
    const how = st.settings.scoreTable === 'pips' && h.formula && h.points > 0 ? `<small>${h.formula}</small>` : '';
    li.innerHTML = `<span class="mini">${mini}</span><span>HAND ${k + 1} · ${h.label} ${how}</span><span class="pts">${mult}${h.total}</span>`;
    list.appendChild(li);
  });
  if (mode.id === 'poker5') {
    const left = g.geometry.free.filter((i) => !engineOf(mode).isBanked(g, i)).map((i) => `<b>${g.faces[i]}</b>`).join('');
    const li = document.createElement('li');
    li.className = 'left';
    li.innerHTML = `<span class="mini">${left}</span><span>LEFT ON THE TABLE</span><span class="pts">${won ? '★'.repeat(g.handsLeft + 1) + '☆'.repeat(2 - g.handsLeft) : ''}</span>`;
    list.appendChild(li);
  }
  const used = g.hands.find((h) => h.multiplier > 1);
  const spare = g.handsLeft > 0 ? ` · ${g.handsLeft} hand${g.handsLeft > 1 ? 's' : ''} to spare` : '';
  if (mode.id === 'auto') {
    const named = g.hands.filter((h) => h.bonuses.length).map((h) => `${h.bonuses.map((k) => `${BONUS_KINDS[k].symbol} ${BONUS_KINDS[k].label}`).join(' + ')} on hand ${h.index + 1}`);
    $('endBonus').textContent = named.length ? `Bonus dice: ${named.join(' · ')}` : 'No bonus dice used';
  } else {
    $('endBonus').textContent = (used
      ? `×2 ${used.bonusAuto ? 'auto-applied to' : 'used on'} hand ${used.index + 1} (${used.points} → ${used.total})`
      : '×2 was not used') + spare;
  }
  $('endSolver').textContent = mode.solverLine(g.level);
  $('endTier').hidden = mode.id === 'auto'; // Auto Hand adapts without telling the player
  $('endTier').textContent = st.pendingTier === st.tier
    ? `Rule-based difficulty: stays at tier ${st.tier} / 5`
    : `Rule-based difficulty: tier ${st.tier} → ${st.pendingTier} / 5`;
  $('nextBtn').textContent = won ? 'NEXT LEVEL' : over ? 'NEW RUN' : 'NEXT LEVEL (EASIER)';
  // a won level of the run offers three combinations to upgrade; the pick goes on (owner, 02.11.2026)
  const offer = mode.id === 'auto' && won ? upgradeOffer(st.runSeed, g.level.levelIndex) : [];
  $('upgrades').hidden = !offer.length;
  $('nextBtn').hidden = offer.length > 0;
  // a cleared level goes on through its upgrade (owner, 03.11.2026: RETRY confused); a missed one ends the run
  $('retryBtn').hidden = won || mode.id === 'auto';
  $('upList').innerHTML = offer.map((cat) => {
    const m = AUTO_MULT[cat] + (st.ups[cat] || 0);
    const dice = (GUIDE_COMBOS.find(([c]) => c === cat) || [cat, []])[1];
    return `<button class="up" type="button" data-cat="${cat}"><span class="gdice">${dice.map((v) => guideDie(v)).join('')}</span><b>${CATEGORY5_LABELS[cat]}</b><em>×${m} → ×${m + 1}</em></button>`;
  }).join('');
  $('levelEnd').dataset.mode = app.modeId;
  clearTimeout(app.endTimer);
  const forMode = app.modeId;
  // Auto Hand opens the summary at once: its last hand has already burnt away (owner, 02.11.2026)
  app.endTimer = setTimeout(() => { if (app.modeId === forMode) $('levelEnd').hidden = false; }, mode.id === 'auto' ? 0 : T.endDelay);
}

// The run's marks on the level's summary: on a clear, a medal every fifth level and the record passed; when the
// run is over, the level it got to, why it ended (digest rules 7 and 17: the player sees the cause), its points,
// the record and its medals.
function showRunEnd(st, g, won, over) {
  const end = st.lastEnd && st.lastEnd.seed === g.level.seed ? st.lastEnd : {};
  const marks = [];
  if (M().id === 'auto' && won && end.medal) marks.push(`<i class="medal${end.fresh ? ' fresh' : ''}">${end.medal}</i>${end.fresh ? 'NEW MEDAL' : 'MEDAL'}`);
  if (M().id === 'auto' && won && end.passedBest) marks.push(`NEW BEST · LEVEL ${g.level.levelIndex + 1}`);
  $('runMark').innerHTML = marks.join('<span class="end-sep">·</span>');
  $('runMark').hidden = !marks.length;
  for (const id of ['runReached', 'runWhy', 'runSum']) $(id).hidden = !over;
  if (!over) return;
  $('runLevel').textContent = String(g.level.levelIndex);
  const unused = g.rerollsLeft ? ` · ${g.rerollsLeft} REROLL${g.rerollsLeft > 1 ? 'S' : ''} UNUSED` : '';
  $('runWhy').textContent = `SHORT BY ${Math.max(0, g.level.target - g.score)}${unused}`;
  $('runStats').innerHTML = `RUN SCORE ${st.runScore}${end.newBest ? ' · <b>NEW BEST</b>' : st.best ? ` · BEST: LEVEL ${st.best.level}` : ''}`;
  $('medals').innerHTML = st.runMedals.map((m) => `<li class="medal${m.fresh ? ' fresh' : ''}">${m.level}</li>`).join('');
  $('medals').hidden = !st.runMedals.length;
}

function onNext() {
  const st = S();
  if ($('levelEnd').dataset.mode !== app.modeId || !st.game || st.game.phase === 'playing') return;
  if (st.pendingTier != null) st.tier = st.pendingTier;
  st.levelIndex += 1;
  if (app.modeId === 'auto' && st.game.phase === 'lost') {
    // a missed target ends the run (owner, 03.11.2026): a new one starts at level 1; the record and medals stay
    st.runSeed = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    st.levelIndex = 1;
    st.bank = []; // the bank lives for one run
    st.ups = {}; // and so do the upgrades
    st.runScore = 0;
    st.runMedals = [];
  }
  newLevel();
}

function onRetry() {
  const st = S();
  if ($('levelEnd').dataset.mode !== app.modeId || !st.game || st.game.phase === 'playing') return;
  logEvent('retry', { attempt: st.game.attempt + 1 });
  startGame(st.game.level, st.game.attempt + 1);
}

// After an await, the animated mode may have been switched or reset; only then touch the screen.
function stillCurrent(st, modeId) {
  return app.modeId === modeId && app.modes[modeId] === st;
}

// ---------- mode switching ----------
function switchMode(id, { silent = false } = {}) {
  if (!MODES[id] || app.busy) return;
  if (app.gesture) return;
  const from = app.modeId;
  app.modeId = id;
  app.path = [];
  app.tapPath = [];
  clearTimeout(app.hintTimer);
  app.hintCells = null;
  app.coachTargets = null;
  clearTimeout(app.endTimer);
  stopGhost();
  $('levelEnd').hidden = true;
  $('help').hidden = true;
  const st = S();
  if (!st.runSeed) st.runSeed = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (!st.game) newLevel();
  else if (st.game.phase !== 'playing') {
    render();
    // a reload during the last hand's count left the level unfinished: count it now (record, medal, bank)
    if (id === 'auto' && !(st.lastEnd && st.lastEnd.seed === st.game.level.seed)) finishLevel();
    else showLevelEnd();
  }
  else render();
  if (!st.onboarded) openGuide('intro');
  if (!silent && from !== id) logEvent('mode_switch', { from, to: id });
  persist();
}

// ---------- coach: interactive tutorial on the real board ----------
function coachStart(source) {
  const st = S();
  st.coach = { active: true, done: { hold: false, reroll: false } };
  logEvent('tutorial_start', { source });
  render();
  persist();
}

function coachStop(reason) {
  const st = S();
  if (!st.coach.active) return;
  st.coach.active = false;
  st.coached = true;
  app.coachTargets = null;
  stopGhost();
  logEvent('tutorial_end', { reason });
  render();
  persist();
}

function coachOnEvent(type, data) {
  const st = S();
  if (!st.coach.active) return;
  if (type === 'hold' && data.held) st.coach.done.hold = true;
  if (type === 'reroll' || type === 'bank') { st.coach.done.hold = true; st.coach.done.reroll = true; }
  if (type === 'level_end') coachStop('complete');
}

function coachCurrentStep() {
  const st = S();
  const g = st.game;
  if (!st.coach.active || !g || g.phase !== 'playing') return null;
  if (E().handsPlayed(g) === 0) {
    if (!st.coach.done.hold) return 'hold';
    if (!st.coach.done.reroll && g.rerollsLeft > 0) return 'reroll';
    return 'swipe';
  }
  return 'last';
}

function cellPercent(i) {
  return { left: `${((colOf(i) + 0.5) * 100) / 3}%`, top: `${((rowOf(i) + 0.5) * 100) / 3}%` };
}

function stopGhost() {
  if (app.ghostAnim) app.ghostAnim.cancel();
  app.ghostAnim = null;
  app.ghostKey = '';
  const ghost = $('ghost');
  if (ghost) ghost.style.opacity = '0';
}

// Animated "ghost finger": a tap demo on one cell, or a press-drag-lift demo along a path.
function startGhost(path) {
  const key = path ? path.join('-') : '';
  if (app.ghostKey === key) return;
  stopGhost();
  app.ghostKey = key;
  const ghost = $('ghost');
  if (!path || !ghost || reduceMotion || typeof ghost.animate !== 'function') return;
  const pts = path.map(cellPercent);
  const at = (p, extra) => ({ left: p.left, top: p.top, ...extra });
  let frames;
  if (pts.length === 1) {
    frames = [
      at(pts[0], { opacity: 0, transform: 'translate(-50%, -50%) scale(1.3)', offset: 0 }),
      at(pts[0], { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.25 }),
      at(pts[0], { opacity: 1, transform: 'translate(-50%, -50%) scale(0.72)', offset: 0.42 }),
      at(pts[0], { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.6 }),
      at(pts[0], { opacity: 0, transform: 'translate(-50%, -50%) scale(1.2)', offset: 0.85 }),
      at(pts[0], { opacity: 0, transform: 'translate(-50%, -50%) scale(1.2)', offset: 1 }),
    ];
  } else {
    const n = pts.length;
    frames = [at(pts[0], { opacity: 0, transform: 'translate(-50%, -50%) scale(1.3)', offset: 0 }), at(pts[0], { opacity: 1, transform: 'translate(-50%, -50%) scale(0.78)', offset: 0.12 })];
    for (let k = 1; k < n; k++) frames.push(at(pts[k], { opacity: 1, transform: 'translate(-50%, -50%) scale(0.78)', offset: 0.12 + (k / (n - 1)) * 0.58 }));
    frames.push(at(pts[n - 1], { opacity: 0, transform: 'translate(-50%, -50%) scale(1.2)', offset: 0.82 }));
    frames.push(at(pts[n - 1], { opacity: 0, transform: 'translate(-50%, -50%) scale(1.2)', offset: 1 }));
  }
  app.ghostAnim = ghost.animate(frames, { duration: pts.length === 1 ? 1700 : 2600 + 400 * (pts.length - 4), iterations: Infinity, easing: 'ease-in-out' });
}

function coachRender() {
  const step = coachCurrentStep();
  const bar = $('coach');
  if (!step) {
    bar.hidden = true;
    els.preview.hidden = M().id === 'auto'; // Auto Hand shows its hand in the BONES · MULTIPLY counter
    els.rerollBtn.classList.remove('pulse');
    els.playBtn.classList.remove('pulse');
    app.coachTargets = null;
    stopGhost();
    return;
  }
  const st = S();
  const g = st.game;
  const mode = M();
  const hint = E().hintFor(g);
  let text = '';
  let index = 1;
  let targets = [];
  let ghostPath = null;
  if (step === 'hold' && mode.id === 'auto') {
    // hold a keeper of the hand: it stays through the reroll that follows (holds last one throw)
    const c = hint.cells.reduce((b, i) => (g.faces[i] > g.faces[b] ? i : b), hint.cells[0]);
    text = `TAP THE ${g.faces[c]}: A HELD DIE STAYS ON REROLL`;
    targets = [c];
    ghostPath = [c];
  } else if (step === 'hold') {
    const c = hint.cells[0];
    text = `TAP THE ${g.faces[c]} TO HOLD IT. HELD DICE DO NOT CHANGE WHEN YOU REROLL.`;
    targets = [c];
    ghostPath = [c];
  } else if (step === 'reroll') {
    index = 2;
    if (mode.id === 'auto') text = E().canReroll(g) ? 'REROLL: THE REST CHANGE, THEN HOLDS CLEAR' : 'EVERY DIE IS HELD: RELEASE ONE, THEN REROLL';
    else text = E().canReroll(g)
      ? 'NOW PRESS REROLL. ONLY THE DICE WITHOUT HOLD CHANGE.'
      : 'EVERY DIE IS HELD. TAP ONE TO RELEASE IT, THEN PRESS REROLL.';
  } else if (step === 'swipe' && mode.id === 'auto' && autoIdleBonuses(g, hint.hand).length) {
    // bonus dice start off: first switch the one that fits on, then play
    index = 3;
    const b = autoIdleBonuses(g, hint.hand)[0];
    text = `TAP ${BONUS_KINDS[g.cells[b].kind].symbol} TO SWITCH IT ON, THEN PLAY`;
    targets = [b];
    ghostPath = [b];
  } else if (step === 'swipe') {
    index = 3;
    text = mode.coachText('swipe', g, hint);
    targets = hint.cells;
    ghostPath = hint.cells;
  } else {
    index = 4;
    text = mode.coachText('last', g, hint);
    targets = hint.cells;
    ghostPath = mode.bonus === 'cell' && g.bonus.available ? null : hint.cells;
  }
  if (mode.id === 'auto' && step !== 'hold' && !(ghostPath && ghostPath.length === 1)) ghostPath = null; // nothing to drag: the hand is already red
  bar.hidden = false;
  els.preview.hidden = true;
  $('coachStep').textContent = `${index} / 4`;
  $('coachText').textContent = text;
  els.rerollBtn.classList.toggle('pulse', step === 'reroll');
  els.playBtn.classList.toggle('pulse', mode.id === 'auto' && step === 'swipe' && !autoIdleBonuses(g, hint.hand).length);
  app.coachTargets = targets;
  startGhost(ghostPath);
}

// ---------- rendering ----------
function currentPath() {
  return S().settings.pathMode ? app.tapPath : app.path;
}

function buildBoard() {
  const board = els.board;
  board.innerHTML = '';
  els.cells = [];
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = String(i);
    cell.setAttribute('role', 'button');
    cell.tabIndex = 0;
    cell.innerHTML = `<span class="arch"></span><span class="art"></span><span class="face">${'<i></i>'.repeat(9)}</span><span class="x2">×2</span><span class="tag"></span><span class="order"></span><span class="back"></span>`;
    board.appendChild(cell);
    els.cells.push(cell);
  }
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'path-layer');
  svg.setAttribute('viewBox', '0 0 300 300');
  svg.setAttribute('aria-hidden', 'true');
  for (const id of ['hintLine', 'pathLine']) {
    const line = document.createElementNS(SVG_NS, 'polyline');
    line.id = id;
    svg.appendChild(line);
  }
  board.appendChild(svg);
  const reveal = document.createElement('div');
  reveal.className = 'reveal';
  reveal.id = 'reveal';
  reveal.innerHTML = '<div class="cat"></div><div class="pts"></div><div class="mult"></div>';
  board.appendChild(reveal);
  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.id = 'ghost';
  ghost.setAttribute('aria-hidden', 'true');
  board.appendChild(ghost);
}

// The screen is one of two mockups scaled by --k. Phone (portrait): a column 393 px wide with 616 px
// of rows (header 56, board 387, counter 45, buttons 80 and three 16 px gaps). Desktop and landscape
// (node 1287:1641): the 589.5 px board left of a 440 px panel, 82.5 px apart, 1112 × 580.5 px with
// the mockup's 84 px around it. The layout that gives the bigger board wins; k is then as large as
// the window allows, and every size in styles.css is a multiple of it, so the rows keep the
// mockup's proportions at any size. On the phone the tutorial line, when it shows, takes its height
// first; on desktop it sits above the panel.
const MOCKUP = Object.freeze({ width: 393, rows: 597, board: 360 }); // Figma 1285:1244: 64 + 16 + 360 + 16 + 45 + 16 + 80
const DESKTOP = Object.freeze({ width: 1134 + 2 * 73, height: 546 + 2 * 73, board: 546 }); // Figma 1287:1641: 546 + 42 + 546, 73 px round
function fitBoard() {
  const col = getComputedStyle(els.app);
  const width = document.documentElement.clientWidth - parseFloat(col.paddingLeft) - parseFloat(col.paddingRight);
  const height = document.documentElement.clientHeight - parseFloat(col.paddingTop) - parseFloat(col.paddingBottom);
  const phone = Math.min(width / MOCKUP.width, height / MOCKUP.rows);
  const desk = Math.min(width / DESKTOP.width, height / DESKTOP.height);
  const wide = DESKTOP.board * desk > MOCKUP.board * phone;
  document.body.classList.toggle('wide', wide);
  const coach = $('coach');
  const coachHeight = !wide && !coach.hidden ? coach.offsetHeight + 16 * phone : 0;
  const k = wide ? desk : Math.min(width / MOCKUP.width, (height - coachHeight) / MOCKUP.rows);
  els.app.style.setProperty('--k', Math.max(0.4, k).toFixed(4));
  app.cellRects = null;
}

// While the first hand is three dice long in Snake 4+4, mark which fourth dice keep a legal second hand.
function computeSafeNext() {
  const g = S().game;
  const path = currentPath();
  if (M().id !== 'snake4' || g.phase !== 'playing' || g.hands.length !== 0 || path.length !== 3) return null;
  const last = path[path.length - 1];
  let mask = 0;
  for (const c of path) mask |= 1 << c;
  return g.geometry.free.filter((i) => !path.includes(i) && !E().isBanked(g, i) && areAdjacent(last, i) && g.geometry.safeSet.has(mask | (1 << i)));
}

function renderCell(i) {
  const g = S().game;
  const engine = E();
  const cell = els.cells[i];
  const path = currentPath();
  const face = cell.querySelector('.face');
  const tag = cell.querySelector('.tag');
  const order = cell.querySelector('.order');
  // Effect classes that are still mid-animation survive a re-render; 'bank-pop' is not among
  // them because it fills forwards (opacity 0) and must be dropped by the render after the bank.
  const transient = ['shake', 'safe-hint', 'pressed', 'rolling', 'refill', 'stays', 'arriving', 'landed', 'on-fire', 'flip', 'hidden3d', 'gone'].filter((c) => cell.classList.contains(c));
  cell.className = ['cell', ...transient].join(' ');
  cell.querySelector('.x2').textContent = '×2';
  const special = M().id === 'auto' && g.cells && g.cells[i];
  animateArt(cell.querySelector('.art'), special && special.type === 'bonus' ? special.kind : null); // a living character
  if (M().id === 'auto' && !engine.isOrdinary(g, i)) {
    renderAutoSpecial(g, i, cell, tag);
    return;
  }
  if (!engine.isOrdinary(g, i)) {
    cell.classList.add('bonus');
    if (!g.bonus.available) cell.classList.add('used');
    else if (g.bonus.armed) cell.classList.add('armed');
    tag.textContent = !g.bonus.available ? 'USED' : g.bonus.armed ? 'ARMED' : 'READY';
    cell.setAttribute('aria-label', `×2 bonus, ${tag.textContent.toLowerCase()}`);
    return;
  }
  if (engine.isBanked(g, i)) {
    cell.classList.add('empty');
    cell.setAttribute('aria-label', 'Banked');
    tag.textContent = '';
    return;
  }
  cell.classList.add('die');
  face.dataset.value = String(g.faces[i]);
  const sealed = engine.isSealed(g, i);
  const stranded = app.stranded && app.stranded.includes(i);
  tag.textContent = stranded ? 'CUT OFF' : sealed ? 'FIXED' : cell.classList.contains('stays') && !g.held[i] ? 'STAYS' : 'HOLD';
  if (sealed) cell.classList.add('sealed');
  if (stranded) cell.classList.add('stranded');
  if (g.held[i]) cell.classList.add('held');
  const k = path.indexOf(i);
  if (k >= 0) {
    cell.classList.add('in-path');
    order.textContent = String(k + 1);
  }
  if (app.hintCells && app.hintCells.includes(i)) cell.classList.add('hint');
  if (app.coachTargets && app.coachTargets.includes(i) && k < 0) cell.classList.add('hint');
  if (k < 0 && app.safeNext && app.safeNext.includes(i)) cell.classList.add('safe-next');
  // Auto Hand does not mark the dice of its hand (owner, 01.11.2026): finding it is the game. Nor the dice
  // PLAY would burn: dimming them confused (owner, 02.11.2026), and since 03.11.2026 that is every die
  cell.style.setProperty('--die-img', `var(--face-${g.faces[i]}${g.held[i] ? '-held' : ''})`); // the rendered die, when 3D is on
  cell.style.setProperty('--die-plain', `var(--face-${g.faces[i]})`); // a burning die is not lime (owner, 01.11.2026)
  cell.setAttribute('aria-label', `Die ${g.faces[i]}${g.held[i] ? ', held' : ''}${sealed ? ', fixed' : ''}`);
}

// Auto Hand: bonus dice (a character or a ×3 label; red once on), blocks, and the holes of saves from before
// 03.11.2026 (a used bonus now makes way for a new die or a banked card).
function renderAutoSpecial(g, i, cell, tag) {
  const c = g.cells[i];
  if (c.type === 'block') {
    cell.classList.add('block');
    tag.textContent = '';
    cell.setAttribute('aria-label', 'Blocked cell');
    return;
  }
  if (c.type === 'hole') {
    cell.classList.add('empty');
    tag.textContent = '';
    cell.setAttribute('aria-label', 'Hole left by a used bonus');
    return;
  }
  const kind = BONUS_KINDS[c.kind];
  const h = app.autoHand;
  const joker = h ? h.jokerCells.indexOf(i) : -1;
  const inHand = !!h && (joker >= 0 || h.bonusCells.includes(i));
  cell.classList.add('bonus', `kind-${c.kind}`);
  if (g.off[i]) cell.classList.add('off');
  else cell.classList.add('on');
  if (inHand) cell.classList.add('armed');
  if (app.coachTargets && app.coachTargets.includes(i)) cell.classList.add('hint');
  // every card of a layout is dealt face down and turns over by itself, one after another (dealCard); a card
  // from the bank is known already and comes face up
  if (cell.dealtFor !== g.level || cell.dealtAt !== i) {
    cell.dealtFor = g.level;
    cell.dealtAt = i;
    if (c.fromBank == null) dealCard(g, i);
    else {
      clearTimeout(cell.dealTimer);
      cell.deal = null;
      cell.waiting = false;
    }
  }
  if (cell.waiting) cell.classList.add('face-down');
  // the card names its bonus, its sticker the multiplier; the joker in the hand names its face
  tag.textContent = joker >= 0 ? `JOKER = ${h.jokerFaces[joker]}` : cardLabel(c.kind);
  cell.querySelector('.x2').innerHTML = cardSticker(c.kind);
  cell.setAttribute('aria-label', `${kind.symbol} ${kind.label} bonus, ${g.off[i] ? 'off, tap to switch on' : inHand ? 'on, in the hand' : 'on'}`);
}

// Bonus dice that are off but would multiply the hand on the board (the joker fits any hand).
function autoIdleBonuses(g, h) {
  if (!h) return [];
  return g.cells.map((c, i) => i).filter((i) => g.cells[i].type === 'bonus' && g.off[i] && (BONUS_KINDS[g.cells[i].kind].wild || BONUS_KINDS[g.cells[i].kind].fits(h.category)));
}

function renderHud() {
  const st = S();
  const g = st.game;
  // THRESHOLD shows what the level still needs (owner, 02.11.2026): it counts down as hands score
  if (!app.scoreAnim) $('target').textContent = String(remaining(g.score, g));
  for (const el of document.querySelectorAll('.level-text')) el.textContent = String(g.level.levelIndex); // no last level (owner, 03.11.2026)
  for (const btn of els.tabs) btn.classList.toggle('on', btn.dataset.mode === app.modeId);
}

const remaining = (score, g) => Math.max(0, g.level.target - score);

// LEVEL · HAND · THRESHOLD (owner, 02.11.2026): the hand PLAY will play, named, with its total (bonus
// dice included) and, when a multiplying bonus that is on joins it, a ×N sticker on the number; LEVEL
// and what the level still needs are kept by renderHud.
function renderCounter() {
  const h = app.autoHand;
  const bonus = !!h && h.bonusMult > 1;
  els.bonesLabel.textContent = h ? h.label : 'BONES'; // the combination's name over its points (owner, 01.11.2026)
  // the sum of its dice × the combination's multiplier (owner, 02.11.2026); with a bonus on, the whole
  // multiplier on a lime sticker (Figma 1308:3041: 12 ×6 for a ×3 combination and a ×2 bonus)
  els.bones.innerHTML = h ? `${h.base}<small><i>×</i>${h.mult}</small>` : '0';
  if (bonus) els.multSticker.innerHTML = `<small>×</small>${h.mult * h.bonusMult}`;
  els.handStat.classList.toggle('on', bonus);
  // the desktop (Figma 1287:1641): the hand's total, and below the numbers its dice, its name and its whole multiplier
  $('handTotal').textContent = String(h ? h.total : 0);
  $('handDice').innerHTML = h ? h.faces.slice().sort((x, y) => x - y).map((v) => guideDie(v)).join('') : '';
  $('handName').textContent = h ? h.label : '';
  $('handMult').textContent = h ? `MULTI ×${h.mult * h.bonusMult}` : '';
  $('handRow').classList.toggle('on', bonus);
}

function renderControls() {
  const st = S();
  const g = st.game;
  const engine = E();
  const mode = M();
  const total = g.level.rerolls ?? g.config.rerolls;
  const pips = els.rerollPips;
  while (pips.children.length < total) pips.appendChild(document.createElement('i'));
  while (pips.children.length > total) pips.removeChild(pips.lastChild);
  Array.from(pips.children).forEach((p, k) => p.classList.toggle('on', k < g.rerollsLeft));
  $('rerollText').textContent = g.rerollsLeft === 1 ? 'REROLL LEFT' : 'REROLLS LEFT';
  const bs = $('bonusStatus');
  bs.className = 'bonus-status';
  bs.hidden = mode.bonus === 'board'; // Auto Hand: the bonus dice are on the board
  if (!bs.hidden) {
    if (!g.bonus.available) bs.textContent = `×2 USED ON HAND ${g.bonus.usedOnHand + 1}`;
    else if (g.bonus.armed) { bs.textContent = '×2 ARMED FOR NEXT HAND'; bs.classList.add('armed'); }
    else { bs.textContent = mode.bonus === 'cell' ? '×2 READY · TAP GOLD' : '×2 READY · TAP TO ARM'; bs.classList.add('ready'); }
    bs.disabled = app.busy || g.phase !== 'playing' || !g.bonus.available;
  }
  const playing = g.phase === 'playing';
  const auto = mode.id === 'auto';
  els.playBtn.hidden = !auto;
  if (auto) {
    els.playBtn.disabled = app.busy || !playing || !app.autoHand;
    els.playBtn.innerHTML = `PLAY<span class="dot">•</span><span class="cnt">${g.handsLeft}</span>`; // the desktop sets the count below
  }
  els.pathModeBtn.hidden = auto;
  els.rerollBtn.disabled = app.busy || !engine.canReroll(g);
  const n = engine.rerollCount(g);
  if (auto) els.rerollBtn.innerHTML = `REROLL<span class="dot">•</span><span class="cnt">${g.rerollsLeft}</span>`;
  else els.rerollBtn.textContent = g.rerollsLeft > 0 ? (n > 0 ? `REROLL ${n}` : 'REROLL · ALL HELD') : 'NO REROLLS LEFT';
  els.bankLastBtn.hidden = !(playing && mode.id === 'snake4' && g.hands.length === 1);
  els.bankLastBtn.disabled = app.busy;
  els.tapbar.hidden = !st.settings.pathMode || !playing || auto;
  els.undoBtn.disabled = app.tapPath.length === 0;
  els.bankTapBtn.disabled = app.busy || app.tapPath.length !== mode.handSize;
  els.pathModeBtn.classList.toggle('on', st.settings.pathMode);
  els.pathModeBtn.setAttribute('aria-pressed', String(st.settings.pathMode));
  els.hintBtn.disabled = app.busy || !playing;
  els.helpBtn.disabled = app.busy;
  els.pathModeBtn.disabled = app.busy;
  for (const btn of els.tabs) btn.disabled = app.busy;
}

function cellCenter(i) {
  return [50 + colOf(i) * 100, 50 + rowOf(i) * 100];
}

function renderPath() {
  const path = currentPath();
  $('pathLine').setAttribute('points', path.length > 1 ? path.map((i) => cellCenter(i).join(',')).join(' ') : '');
  // Auto Hand positions do not matter, so its hand is never drawn as a line.
  const hint = M().id === 'auto' ? null : app.hintCells || (app.coachTargets && app.coachTargets.length > 1 && path.length === 0 ? app.coachTargets : null);
  $('hintLine').setAttribute('points', hint && hint.length > 1 ? hint.map((i) => cellCenter(i).join(',')).join(' ') : '');
}

function setPreview(text, mood = '') {
  const el = els.preview;
  el.textContent = text;
  el.className = `preview ${mood}`;
}

function renderPreview() {
  const st = S();
  const g = st.game;
  const engine = E();
  const mode = M();
  if (app.hintCells) return;
  if (g.phase !== 'playing') { setPreview(g.phase === 'won' ? 'LEVEL CLEARED' : 'TARGET MISSED', g.phase === 'won' ? 'good' : 'bad'); return; }
  if (mode.id === 'auto') {
    const h = app.autoHand;
    if (!h) { setPreview('NO HAND · HOLD AND REROLL', 'bad'); return; }
    const bonus = h.bonusMult > 1 ? ` × ${h.bonusMult}` : '';
    const joker = h.jokerCells.length ? ` · ★ = ${h.jokerFaces.join(' ')}` : '';
    const idle = autoIdleBonuses(g, h).map((i) => BONUS_KINDS[g.cells[i].kind].symbol);
    setPreview(`${h.label} · ${h.formula}${bonus} = ${h.total}${joker}${idle.length ? ` · TAP ${idle.join(' ')}` : ''}`, 'good');
    return;
  }
  const path = currentPath();
  if (path.length === 0) {
    if (engine.heldCount(g) === engine.remainingCells(g).length) setPreview(`All held · drag through ${mode.handSize} dice to play a hand`, 'hint');
    else setPreview(mode.idleCopy(g, st.settings.pathMode));
    return;
  }
  const p = engine.previewPath(g, path);
  if (!p.ok) { setPreview(p.message, 'bad'); return; }
  if (p.partial) { setPreview(`${p.count} / ${mode.handSize}`); return; }
  const pipsOn = st.settings.scoreTable === 'pips';
  const how = pipsOn && p.hand.formula && p.hand.points > 0 ? `${p.hand.formula}${p.multiplier > 1 ? ` ×${p.multiplier}` : ''}` : (p.multiplier > 1 ? `${p.hand.points} ×${p.multiplier}` : '');
  const mult = how ? ` (${how})` : '';
  const leaves = p.leaves && p.leaves.length ? ` · leaves ${p.leaves.join(' ')}` : '';
  if (!p.safe && p.stranded && p.stranded.length) setPreview(`${p.hand.label} ${p.total} · CUTS OFF ${p.stranded.map((i) => `${g.faces[i]} ${CELL_NAMES[i]}`).join(' + ')}`, 'bad');
  else if (!p.safe) setPreview(`${p.hand.label} ${p.total} · ${p.safetyMessage.replace(/\.$/, '')}`, 'bad');
  else if (p.hand.points === 0) setPreview(`${p.hand.label} 0${leaves}`, 'bad');
  else setPreview(`${p.hand.label} +${p.total}${mult}${p.autoBonus ? ' · ×2 AUTO' : ''}${leaves}`, 'good');
}

function computeStranded() {
  const g = S().game;
  const path = currentPath();
  if (M().id !== 'snake4' || g.phase !== 'playing' || path.length !== M().handSize) return null;
  const p = E().previewPath(g, path);
  return p.ok && !p.partial && !p.safe && p.stranded && p.stranded.length ? p.stranded : null;
}

function render() {
  const g = S().game;
  app.autoHand = M().id === 'auto' && g.phase === 'playing' ? autoCurrentHand(g) : null;
  app.safeNext = computeSafeNext();
  app.stranded = computeStranded();
  coachRender();
  for (let i = 0; i < 9; i++) renderCell(i);
  renderHud();
  renderBank();
  if (M().id === 'auto') renderCounter();
  renderControls();
  renderPath();
  renderPreview();
  renderHeldFire();
}

// The bonus bank above the board (owner, 02.11.2026): the bonuses this level started with from earlier
// won levels that wait above the board. They come in on the first reroll (owner, 03.11.2026); from then on a
// tap switches one still waiting on or off like a card on the board. Place k holds card k until it is played
// or flies to the board, then a + (Figma 1308:3047). Cards new to the row slide in.
function renderBank() {
  const box = $('bank');
  const g = S().game;
  const bank = M().id === 'auto' && g && g.bank ? g.bank : [];
  const h = app.autoHand;
  const places = M().id === 'auto' ? BANK_SIZE : 0;
  for (let k = 0; k < places; k++) {
    const b = bank[k];
    const old = box.children[k];
    let el = old;
    if (b && !b.used && (!b.placed || app.launching.has(k))) {
      if (!el || el.dataset.kind !== b.kind) {
        el = document.createElement('template');
        el.innerHTML = guideTile(b.kind, false).replace('<span class="cell ', `<span role="button" tabindex="0" data-k="${k}" data-kind="${b.kind}" class="new cell `);
        el = el.content.firstElementChild;
      }
      el.classList.toggle('on', !b.off);
      el.classList.toggle('off', b.off);
      el.classList.toggle('armed', !!h && h.bonusCells.includes(BANK + k));
      el.setAttribute('aria-label', `${BONUS_KINDS[b.kind].symbol} ${BONUS_KINDS[b.kind].label} from the bank, ${!g.stats.rerollsUsed ? 'comes in on the first reroll' : b.off ? 'off, tap to switch on' : 'on'}`);
    } else if (!el || !el.classList.contains('slot')) {
      el = document.createElement('span');
      el.className = 'slot';
      el.setAttribute('aria-hidden', 'true');
    }
    if (el === old) continue;
    if (old) old.replaceWith(el);
    else box.append(el);
  }
  while (box.children.length > places) box.lastElementChild.remove();
}

// A card from the bank flies to the board (owner, 03.11.2026): on the level's first reroll into the cell of a die
// being rerolled, or into the cell of a card just played. The cell shows nothing until the card lands face up.
function flyFromBank(i, k, { delay = 0 } = {}) {
  const cell = els.cells[i];
  const flight = {};
  cell.flight = flight;
  cell.classList.add('arriving');
  const land = () => {
    if (cell.flight !== flight) return; // a new level came first
    cell.flight = null;
    app.launching.delete(k);
    cell.classList.remove('arriving');
    renderBank();
    if (reduceMotion) return;
    cell.classList.remove('landed');
    void cell.offsetWidth;
    cell.classList.add('landed');
    setTimeout(() => cell.classList.remove('landed'), 480);
    sfx('flip');
  };
  if (reduceMotion) { land(); return; }
  setTimeout(() => {
    if (cell.flight !== flight) return;
    const from = $('bank').children[k];
    if (!from || !from.classList.contains('cell')) { land(); return; }
    const a = from.getBoundingClientRect();
    const b = cell.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'bank bank-fly';
    fly.setAttribute('aria-hidden', 'true');
    fly.innerHTML = guideTile(from.dataset.kind, false);
    Object.assign(fly.style, { left: `${a.left}px`, top: `${a.top}px` });
    els.app.append(fly); // inside the app, for its scale (--k)
    app.launching.delete(k);
    renderBank(); // its place empties as it takes off
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = b.width / a.width;
    const up = Math.min(120, 0.35 * Math.hypot(dx, dy)); // an arc, higher for a longer flight
    fly.animate([
      { transform: 'translate(0, 0) scale(1) rotate(0)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - up}px) scale(${(1 + s) * 0.62}) rotate(-7deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0)` },
    ], { duration: 520, easing: 'cubic-bezier(.4, 0, .3, 1)' }).onfinish = () => {
      fly.remove();
      land();
    };
  }, delay);
}

// A strong hand burns as soon as the player holds it (owner, 01.11.2026): the held dice of a four of a
// kind, five of a kind or straight; the fire moves to the played hand on PLAY and dies with a reroll.
function renderHeldFire() {
  const g = S().game;
  if (M().id !== 'auto' || app.busy) return;
  const h = g && g.phase === 'playing' ? autoHeldHand(g) : null;
  const cells = h && FIRE_HANDS.has(h.category) ? [...h.cells, ...h.jokerCells] : [];
  const now = app.fire ? app.fire.burning() : [];
  if (cells.slice().sort().join() === now.slice().sort().join()) return;
  if (!cells.length) { app.fire.out(); return; }
  if (!now.length) sfx('fire'); // a fresh blaze, not a die more on it
  app.fire = app.fire || createFire(els.board);
  app.fire.ignite(cells.map((i) => els.cells[i]));
}

// ---------- effects ----------
function haptic(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* unsupported */ }
}

function toast(message, mood = '', ms = 1700) {
  const t = els.toast;
  t.textContent = message;
  t.className = `toast ${mood}`;
  t.hidden = false;
  clearTimeout(app.toastTimer);
  app.toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// Auto Hand tips, each shown once per mode at the moment it matters: a level that brings a new
// bonus kind names it; the first time a switched-off bonus would multiply the hand, say how to use it.
const BONUS_INTRO = {
  x2_any: 'NEW BONUS ×2: DOUBLES ANY HAND',
  x3_straight: 'NEW BONUS ×3: TRIPLES A STRAIGHT',
  x3_pairs: 'NEW BONUS ×3: TRIPLES PAIRS AND TWO PAIRS',
  x3_trips: 'NEW BONUS ×3: TRIPLES TRIPS AND FULL HOUSE',
  joker: 'NEW BONUS ★: THE JOKER BECOMES ANY FACE',
  refund: 'NEW BONUS +1: PLAY IT AND GET A REROLL BACK',
};
function autoTips() {
  const st = S();
  const g = st.game;
  if (M().id !== 'auto' || !g || g.phase !== 'playing' || st.coach.active || !$('guide').hidden) return;
  const fresh = g.cells.map((c, i) => i).find((i) => g.cells[i].type === 'bonus' && !st.tips[`new:${g.cells[i].kind}`]);
  if (fresh !== undefined) {
    st.tips[`new:${g.cells[fresh].kind}`] = true;
    // the ×2 of level 1 is taught by the board and the tutorial; later kinds get a line
    if (g.level.levelIndex > 1) {
      // a kind never seen gets its sheet when its card turns over; a seen one a line
      if (cardSeen(g.cells[fresh].kind)) toast(BONUS_INTRO[g.cells[fresh].kind], 'hint', 3200);
      flashCells([fresh], 'safe-hint', 1600);
    }
    persist();
    return;
  }
  const idle = autoIdleBonuses(g, app.autoHand);
  if (!st.tips.switchOn && g.level.levelIndex > 1 && idle.length) {
    st.tips.switchOn = true;
    toast(`BONUS DICE START OFF: TAP ${BONUS_KINDS[g.cells[idle[0]].kind].symbol} TO USE IT`, 'hint', 3200);
    flashCells([idle[0]], 'safe-hint', 1600);
    persist();
  }
}

function flashCells(cells, cls, ms) {
  cells.forEach((i) => els.cells[i].classList.add(cls));
  setTimeout(() => cells.forEach((i) => els.cells[i].classList.remove(cls)), ms);
}

// A number runs from `from` to `to` (up or down) once the reveal has shown every step (`delay`). With
// `guard` renderHud leaves THRESHOLD alone meanwhile (the bank keeps the UI busy longer).
function countUp(el, from, to, delay = 0, ms = 420, guard = true) {
  if (reduceMotion || from === to) { el.textContent = String(to); return; }
  el.textContent = String(from);
  if (guard) app.scoreAnim = true;
  setTimeout(() => {
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      el.textContent = String(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
      if (t < 1) requestAnimationFrame(step);
      else if (guard) app.scoreAnim = false;
    };
    requestAnimationFrame(step);
  }, delay);
}

function shakeCells(cells) {
  cells.forEach((i) => {
    const c = els.cells[i];
    c.classList.remove('shake');
    void c.offsetWidth;
    c.classList.add('shake');
  });
}

function pressFeedback(i) {
  const c = els.cells[i];
  c.classList.add('pressed');
  setTimeout(() => c.classList.remove('pressed'), 120);
}

function sparkBurst(count, gold) {
  for (let k = 0; k < count; k++) {
    const s = document.createElement('span');
    s.className = `spark${gold ? ' gold' : ''}`;
    const a = (k / count) * Math.PI * 2;
    const d = 90 + (k % 3) * 25;
    s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    els.board.appendChild(s);
    setTimeout(() => s.remove(), 700);
  }
}

// `remaining` is what the level still needed before this hand (Auto Hand lights the fire when one hand covers it).
function showReveal(hand, { remaining = Infinity } = {}) {
  const r = $('reveal');
  const ptsEl = r.querySelector('.pts');
  const multEl = r.querySelector('.mult');
  r.querySelector('.cat').textContent = hand.label;
  const pipsOn = S().settings.scoreTable === 'pips' && hand.formula && hand.points > 0;
  const base = pipsOn ? hand.formula : String(hand.points);
  const full = hand.multiplier > 1 ? `${base} ×${hand.multiplier}${hand.bonusAuto ? ' AUTO' : ''}` : (pipsOn ? base : '');
  // Auto Hand builds the total in visible steps: the combination first, then the bonus dice hit.
  const auto = M().id === 'auto';
  const staged = auto && hand.multiplier > 1 && !reduceMotion;
  sfx(hand.multiplier > 1 && !staged ? 'bonus' : 'score'); // a staged bonus sounds when it hits
  const fire = auto && remaining > 0 && hand.total >= remaining;
  ptsEl.textContent = `+${staged ? hand.points : hand.total}`;
  multEl.textContent = staged ? base : full;
  clearTimeout(app.revealTimer);
  r.classList.remove('show', 'long', 'hit', 'fire');
  void r.offsetWidth;
  r.classList.add('show');
  r.classList.toggle('long', staged);
  r.classList.toggle('fire', fire);
  if (reduceMotion) setTimeout(() => r.classList.remove('show'), 400);
  // effect grows with the result: Auto Hand scales the burst by the share of the target
  const sparks = auto ? Math.min(24, 8 + Math.round((16 * hand.total) / Math.max(1, S().game.level.target))) : 10;
  if (hand.points >= 10) sparkBurst(staged ? 8 : sparks, hand.multiplier > 1 && !staged);
  if (staged) {
    app.revealTimer = setTimeout(() => {
      ptsEl.textContent = `+${hand.total}`;
      multEl.textContent = full;
      r.classList.add('hit');
      sparkBurst(sparks, true);
      haptic(14);
      sfx('bonus');
    }, 380);
  }
  $('targetStat').classList.remove('bump');
  void $('targetStat').offsetWidth;
  $('targetStat').classList.add('bump');
}

// ---------- actions ----------
function armBonus(source, cell) {
  const st = S();
  const g = st.game;
  if (app.busy || g.phase !== 'playing') return;
  const r = E().toggleBonus(g, cell); // Auto Hand switches the tapped bonus die off/on; Poker 5 and Snake ignore the cell
  if (!r.ok) { toast(r.message, 'bad'); return; }
  st.game = r.state;
  haptic(10);
  sfx((cell >= BANK ? st.game.bank[cell - BANK].off : st.game.off && st.game.off[cell]) ? 'off' : 'on');
  logEvent('bonus', { armed: r.armed, off: r.off, cell, source });
  render();
  persist();
}

// Bonus cards (owner, 02.11.2026). A kind is seen once a card of it was turned over (or, before cards, its
// sheet was shown).
const cardSeen = (kind) => !!(S().tips[`seen:${kind}`] || S().tips[`sheet:${kind}`]);
const cardLabel = (kind) => BONUS_KINDS[kind].label; // the name alone: the multiplier is on the sticker
// The sticker's sign smaller than its number, as on the mockup (×3, +1); the joker has none.
const cardSticker = (kind) => (kind === 'joker' ? '' : `<small>${BONUS_KINDS[kind].symbol[0]}</small>${BONUS_KINDS[kind].symbol.slice(1)}`);
const DEAL_FIRST_MS = 250;  // the first card of a deal turns over this long after it lands
const DEAL_NEXT_MS = 2000;  // each next card this long after the one before (owner, 02.11.2026)

// Turns a card over (after `delay` ms): it shrinks to an edge on its back and opens on its face.
function flipCard(cell, delay = 0) {
  if (reduceMotion) return;
  cell.style.setProperty('--flip-delay', `${delay}ms`);
  cell.classList.remove('flip');
  void cell.offsetWidth;
  cell.classList.add('flip');
  const done = (e) => {
    if (e.animationName !== 'cardFlip') return;
    cell.classList.remove('flip');
    cell.removeEventListener('animationend', done);
  };
  cell.addEventListener('animationend', done);
}

// A new layout deals every card face down; they turn over by themselves in board order, 2 s apart, counted
// from when the board shows (the first visit's guide covers it until it closes).
function dealCard(g, i) {
  const cell = els.cells[i];
  const order = g.cells.slice(0, i).filter((c) => c.type === 'bonus' && c.fromBank == null).length;
  clearTimeout(cell.dealTimer);
  cell.waiting = true;
  const deal = {};
  cell.deal = deal;
  const start = () => { if (cell.deal === deal) cell.dealTimer = setTimeout(() => turnCard(i), DEAL_FIRST_MS + DEAL_NEXT_MS * order); };
  if ($('guide').hidden && S().onboarded) start(); // a first visit draws the board just before its guide opens
  else app.afterGuide.push(start);
}

// Turns a dealt card face up (on time, or at once when tapped or pressed). The first card of a kind ever
// seen brings its sheet a second later (digest §3: the rule at the moment it matters); it switches nothing.
function turnCard(i, { sheet = true } = {}) {
  const cell = els.cells[i];
  clearTimeout(cell.dealTimer);
  if (!cell.waiting) return;
  cell.waiting = false;
  const st = S();
  const c = st.game && st.game.cells[i];
  if (!c || c.type !== 'bonus') return;
  const first = !cardSeen(c.kind);
  st.tips[`seen:${c.kind}`] = true;
  renderCell(i);
  flipCard(cell);
  sfx('flip');
  if (!first) return;
  logEvent('card', { kind: c.kind, cell: i });
  persist();
  if (sheet) setTimeout(() => queueSheet(c.kind), 1000);
}

// Sheets come one at a time: a card's sheet waits while another is open.
function queueSheet(kind) {
  if ($('bonusSheet').hidden && !app.sheetQueue.length) showBonusSheet(kind);
  else app.sheetQueue.push(kind);
}

function closeBonusSheet() {
  $('bonusSheet').hidden = true;
  const next = app.sheetQueue.shift();
  if (next) setTimeout(() => showBonusSheet(next), 250);
}

const BONUS_WHAT = {
  x2_any: 'Doubles any hand you play with it.',
  x3_straight: 'Triples a straight.',
  x3_pairs: 'Triples a pair or two pairs.',
  x3_trips: 'Triples three of a kind or a full house.',
  joker: 'Becomes the face your hand needs most.',
  refund: 'Play it and get one reroll back.',
};

// A bottom sheet with the bonus die, its name and what it does (owner, 01.11.2026).
function showBonusSheet(kind) {
  S().tips[`sheet:${kind}`] = true;
  app.sheetAt = performance.now(); // the finger that opened it lifts over the backdrop: that is not a close
  $('bonusSheetTile').innerHTML = guideTile(kind, true);
  animateTiles($('bonusSheetTile'));
  $('bonusSheetName').textContent = BONUS_KINDS[kind].label; // the multiplier is on the card's sticker
  $('bonusSheetWhat').textContent = BONUS_WHAT[kind];
  $('bonusSheet').hidden = false;
  persist();
}

function onTap(i) {
  const st = S();
  const g = st.game;
  const engine = E();
  if (app.busy || g.phase !== 'playing') return;
  if (!engine.isOrdinary(g, i)) {
    if (M().id === 'auto' && g.cells[i].type !== 'bonus') return; // blocks and holes do nothing
    pressFeedback(i);
    if (M().id === 'auto' && els.cells[i].waiting) { turnCard(i); return; } // a tap turns a dealt card at once
    armBonus('cell', i);
    return;
  }
  if (engine.isBanked(g, i)) return;
  if (st.settings.pathMode) { tapPathAdd(i); return; }
  const r = engine.toggleHold(g, i);
  if (!r.ok) { toast(r.message, 'bad'); shakeCells([i]); return; }
  st.game = r.state;
  pressFeedback(i);
  haptic(r.held ? 12 : 6);
  sfx(r.held ? 'hold' : 'release');
  logEvent('hold', { cell: i, held: r.held });
  render();
  persist();
  if (r.held && engine.heldCount(st.game) === engine.remainingCells(st.game).length && !st.allHeldToastShown) {
    st.allHeldToastShown = true;
    toast(M().id === 'auto'
      ? 'Every die is held: REROLL has nothing to change. Release some, or press PLAY HAND.'
      : `Hold only protects dice from REROLL. To play a hand, press a die and drag through ${M().handSize}.`, 'hint');
  }
}

function tapPathAdd(i) {
  const p = app.tapPath;
  const last = p[p.length - 1];
  const size = M().handSize;
  if (i === last) { p.pop(); render(); return; }
  if (p.includes(i)) { toast('Each die once per hand', 'bad'); return; }
  if (p.length >= size) { toast(`A hand has ${size} dice`, 'bad'); return; }
  if (p.length > 0 && !areAdjacent(last, i)) { toast('Dice must touch edge to edge', 'bad'); shakeCells([i]); return; }
  p.push(i);
  pressFeedback(i);
  haptic(8);
  render();
}

async function doReroll(source) {
  const st = S();
  const g = st.game;
  if (app.busy) return;
  const modeId = app.modeId;
  const r = E().reroll(g, () => st.rerollRng.die());
  if (!r.ok) { toast(r.message, 'bad'); return; }
  st.game = r.state;
  logEvent('reroll', { source, rolled: r.rolled, held: [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => g.held[i]), left: st.game.rerollsLeft });
  persist(); // the spent reroll and the new faces survive a reload during the animation
  app.busy = true;
  clearPath();
  clearTimeout(app.hintTimer);
  app.hintCells = null;
  renderControls();
  haptic(8);
  sfx('roll');
  // the kept cards come in on the level's first reroll, each in place of a die (owner, 03.11.2026)
  for (const { cell, from } of r.placed || []) { app.launching.add(from); els.cells[cell].classList.add('arriving'); renderCell(cell); }
  (r.placed || []).forEach(({ cell, from }, n) => flyFromBank(cell, from, { delay: 120 * n }));
  let rolled3d = false;
  if (app.dice3d && !reduceMotion && dice3dStatus() === 'ready') {
    r.rolled.forEach((i) => els.cells[i].classList.add('hidden3d'));
    try {
      rolled3d = await rollDice3D({
        board: els.board,
        cells: els.cells,
        dice: r.rolled.map((i) => ({ index: i, from: g.faces[i], value: st.game.faces[i] })),
        colors: lookColors(),
        rng: createRng(`${st.game.level.seed}/throw/${st.game.stats.rerollsUsed}/${st.game.attempt}`),
        // the dice come back with their new faces under the landed canvas, which then fades out over them
        // (hidden until here, or they blink: owner, 02.11.2026)
        onLanded: () => { r.rolled.forEach((i) => els.cells[i].classList.remove('hidden3d')); if (stillCurrent(st, modeId)) render(); },
      });
    } catch {
      rolled3d = false;
    }
    r.rolled.forEach((i) => els.cells[i].classList.remove('hidden3d'));
  }
  if (!rolled3d) {
    r.rolled.forEach((i, k) => {
      const c = els.cells[i];
      c.style.setProperty('--delay', `${k * T.stagger}ms`);
      c.classList.add('rolling');
      setTimeout(() => { c.querySelector('.face').dataset.value = String(st.game.faces[i]); }, T.rollSwap + k * T.stagger);
    });
    await wait(T.roll + T.stagger * Math.max(0, r.rolled.length - 1));
    r.rolled.forEach((i) => els.cells[i].classList.remove('rolling'));
  }
  app.busy = false;
  if (!stillCurrent(st, modeId)) return;
  render();
  persist();
  autoTips();
}

async function attemptBank(path, source) {
  if (app.busy) return;
  const st = S();
  const g = st.game;
  const mode = M();
  const modeId = app.modeId;
  const r = E().bankPath(g, path, () => st.refillRng.die());
  st.game = r.state;
  if (!r.ok) {
    logEvent('path_rejected', { source, code: r.code, path, stranded: r.stranded || [] });
    const cutOff = r.code === 'STRANDS' && r.stranded && r.stranded.length ? ` ${describeCells(g, r.stranded)} would be cut off.` : '';
    toast(`${r.message}${cutOff}`, 'bad');
    clearPath();
    render();
    shakeCells(path);
    if (r.code === 'STRANDS') {
      if (r.stranded && r.stranded.length) flashCells(r.stranded, 'stranded', T.flash);
      const h = E().hintFor(st.game);
      if (h) flashCells(h.cells, 'safe-hint', T.flash);
    }
    persist();
    return;
  }
  const hand = r.hand;
  if (hand.index === 0) st.firstHandAt = Date.now();
  logEvent('bank', { source, hand: hand.index, cells: hand.cells, faces: hand.faces, category: hand.category, points: hand.points, multiplier: hand.multiplier, total: hand.total, auto: hand.bonusAuto, refilled: r.refilled || [], refund: hand.refund || 0 });
  persist(); // the irreversible hand survives a reload during the animation
  app.busy = true;
  clearTimeout(app.hintTimer);
  app.hintCells = null;
  app.coachTargets = null;
  stopGhost();
  clearPath();
  haptic(hand.points >= 10 ? [14, 40, 18] : 12);
  // A strong hand catches fire first (the combination), then the count follows
  const burning = mode.id === 'auto' && FIRE_HANDS.has(hand.category) ? [...hand.cells, ...(hand.jokerCells || [])] : [];
  if (burning.length) {
    app.fire = app.fire || createFire(els.board);
    app.fire.ignite(burning.map((i) => els.cells[i]));
    sfx('fire');
    await wait(T.fire);
    if (!stillCurrent(st, modeId)) { app.fire.out(); app.busy = false; return; }
  }
  // A hand with a bonus is counted on the board like any other: the combination, then the bonus's hit
  // (owner, 03.11.2026: no full-screen bonus screen)
  showReveal(hand, { remaining: g.level.target - g.score });
  // Auto Hand also burns the bonus dice the hand used (they pop with it) and every other die
  // (those fade out); the other modes pop only the hand. With the 3D dice the burnt
  // dice are thrown anew in place like a reroll (owner, 02.11.2026): only the used cards pop.
  // The level's last hand (the target reached, or no hands left) brings no new dice: its dice burn away and the
  // level's summary opens (owner, 02.11.2026)
  const last = mode.id === 'auto' && st.game.phase !== 'playing';
  const throw3d = !last && mode.id === 'auto' && mode.refill && r.refilled && r.refilled.length > 0 && app.dice3d && !reduceMotion && dice3dStatus() === 'ready';
  const spent = r.spent || []; // the cards the hand used: a new die or a card from the bank takes each cell
  const popped = throw3d ? spent : [...hand.cells, ...spent];
  const faded = throw3d ? [] : r.burned ? r.burned.filter((i) => !hand.cells.includes(i)) : [];
  popped.forEach((i) => els.cells[i].classList.add('bank-pop'));
  faded.forEach((i) => els.cells[i].classList.add('burn'));
  if (!throw3d) sfx('burn');
  renderHud();
  if (mode.id === 'auto') countUp($('target'), remaining(g.score, g), remaining(st.game.score, g), 250);
  renderControls();
  if (hand.refund) { // the reroll the refund gave back lands on its button, with the bird's coin
    els.rerollBtn.classList.remove('bump');
    void els.rerollBtn.offsetWidth;
    els.rerollBtn.classList.add('bump');
    sfx('refund');
  }
  renderPath();
  setPreview(`${hand.label} +${hand.total}`, 'good');
  await wait(last ? Math.max(T.bank, T.reveal) : T.bank); // the last hand's count finishes first
  if (burning.length) app.fire.out(); // the dice have burnt away: before they come back for the refill
  if (last) [...r.burned, ...spent].forEach((i) => els.cells[i].classList.add('gone')); // they stay away under the summary
  popped.forEach((i) => els.cells[i].classList.remove('bank-pop'));
  faded.forEach((i) => els.cells[i].classList.remove('burn'));
  if (!stillCurrent(st, modeId)) { app.busy = false; return; }
  if (throw3d) {
    r.refilled.forEach((i) => els.cells[i].classList.add('hidden3d'));
    for (const { cell, from } of r.placed) { app.launching.add(from); els.cells[cell].classList.add('arriving'); }
    render(); // the new board under the throw, drawn from the old faces until each die turns
    r.placed.forEach(({ cell, from }) => flyFromBank(cell, from));
    sfx('roll');
    await rollDice3D({
      board: els.board,
      cells: els.cells,
      dice: r.refilled.map((i) => ({ index: i, from: g.faces[i], value: st.game.faces[i] })),
      colors: lookColors(),
      rng: createRng(`${st.game.level.seed}/play/${st.game.hands.length}/${st.game.attempt}`),
      onLanded: () => { r.refilled.forEach((i) => els.cells[i].classList.remove('hidden3d')); if (stillCurrent(st, modeId)) render(); },
    }).catch(() => false);
    r.refilled.forEach((i) => els.cells[i].classList.remove('hidden3d'));
    if (st.game.phase === 'playing') {
      const stays = E().remainingCells(st.game).filter((i) => !r.refilled.includes(i));
      flashCells(stays, 'stays', 700);
    }
  } else if (!last && mode.refill && r.refilled && (r.refilled.length || (r.placed && r.placed.length))) {
    for (const { cell, from } of r.placed || []) { app.launching.add(from); els.cells[cell].classList.add('arriving'); }
    render();
    (r.placed || []).forEach(({ cell, from }) => flyFromBank(cell, from));
    r.refilled.forEach((i, k) => {
      const c = els.cells[i];
      c.style.setProperty('--delay', `${k * 60}ms`);
      c.classList.add('refill');
    });
    sfx('drop');
    await wait(T.refill + 60 * r.refilled.length);
    r.refilled.forEach((i) => els.cells[i].classList.remove('refill'));
    if (st.game.phase === 'playing') {
      const stays = E().remainingCells(st.game).filter((i) => !r.refilled.includes(i));
      flashCells(stays, 'stays', 700);
    }
  }
  app.busy = false;
  if (!stillCurrent(st, modeId)) return;
  render();
  persist();
  if (st.game.phase !== 'playing') finishLevel();
  else autoTips();
}

function clearPath() {
  app.path = [];
  app.tapPath = [];
}

function onHint() {
  const st = S();
  const g = st.game;
  if (app.busy || g.phase !== 'playing') return;
  const h = E().hintFor(g);
  if (!h) return;
  st.game = E().markHintUsed(g);
  logEvent('hint', { cells: h.cells, category: h.hand.category, useBonus: h.useBonus, projected: h.projected });
  app.hintCells = h.cells;
  clearTimeout(app.hintTimer);
  app.hintTimer = setTimeout(() => { app.hintCells = null; if (!app.busy) render(); }, 2600);
  render();
  const arm = h.useBonus && !g.bonus.armed ? ' · ARM ×2' : '';
  setPreview(`HINT · ${h.hand.label} ${h.hand.points}${arm} → ${h.projected}`, 'hint');
  persist();
}

function onBankLast() {
  const st = S();
  const g = st.game;
  if (app.busy || g.phase !== 'playing' || M().id !== 'snake4' || g.hands.length !== 1) return;
  const cells = E().remainingCells(g);
  const paths = orderedPathsOf(cells);
  if (!paths.length) { toast('No path through the remaining dice', 'bad'); return; }
  attemptBank(paths[0], 'button');
}

function togglePathMode() {
  if (app.busy) return;
  const st = S();
  st.settings.pathMode = !st.settings.pathMode;
  clearPath();
  logEvent('path_mode', { on: st.settings.pathMode });
  render();
  persist();
}

// ---------- pointer gestures ----------
function cacheRects() {
  app.cellRects = els.cells.map((c) => c.getBoundingClientRect());
}

function hitTest(x, y, core = false) {
  if (!app.cellRects) cacheRects();
  for (let i = 0; i < 9; i++) {
    const r = app.cellRects[i];
    const ix = core ? r.width * CORE_INSET : 0;
    const iy = core ? r.height * CORE_INSET : 0;
    if (x >= r.left + ix && x <= r.right - ix && y >= r.top + iy && y <= r.bottom - iy) return i;
  }
  return -1;
}

function canUseInPath(i) {
  const g = S().game;
  return M().id !== 'auto' && i >= 0 && E().isOrdinary(g, i) && !E().isBanked(g, i);
}

// Extends the swipe path with a sampled cell: adjacent step, retrace (undo), or an
// unambiguous straight jump over one skipped cell. Diagonal jumps are ignored.
function extendPath(path, cell) {
  if (!canUseInPath(cell)) return false;
  const size = M().handSize;
  const last = path[path.length - 1];
  if (cell === last) return false;
  if (path.length >= 2 && cell === path[path.length - 2]) { path.pop(); return true; }
  if (path.includes(cell)) return false;
  if (path.length >= size) return false;
  if (areAdjacent(last, cell)) { path.push(cell); return true; }
  const dr = rowOf(cell) - rowOf(last);
  const dc = colOf(cell) - colOf(last);
  if ((Math.abs(dr) === 2 && dc === 0) || (Math.abs(dc) === 2 && dr === 0)) {
    const mid = last + (dr / 2) * 3 + dc / 2;
    if (canUseInPath(mid) && !path.includes(mid) && path.length <= size - 2) { path.push(mid, cell); return true; }
  }
  return false;
}

// A gesture left open (its release never came) is dropped by the next first finger: it must never block taps.
function dropGesture() {
  const gs = app.gesture;
  if (!gs) return;
  clearTimeout(gs.longTimer);
  els.cells[gs.startCell].classList.remove('pressed');
  try { els.board.releasePointerCapture(gs.id); } catch { /* already released */ }
  app.gesture = null;
}

function onPointerDown(e) {
  if (app.gesture && e.isPrimary) dropGesture(); // a new first finger: nothing else is down
  if (app.busy || app.gesture) return;
  if (e.button != null && e.button !== 0) return;
  cacheRects();
  const cell = hitTest(e.clientX, e.clientY);
  if (cell < 0) return;
  const gs = { id: e.pointerId, x: e.clientX, y: e.clientY, startCell: cell, mode: 'pending' };
  app.gesture = gs;
  try { els.board.setPointerCapture(e.pointerId); } catch { /* not needed on all platforms */ }
  const c = S().game.cells[cell];
  if (M().id === 'auto' && c && c.type === 'bonus') {
    gs.longTimer = setTimeout(() => {
      if (app.gesture !== gs || gs.mode !== 'pending') return;
      dropGesture(); // the gesture ends here: the sheet takes the finger, its release switches nothing
      haptic(12);
      turnCard(cell, { sheet: false }); // a face-down card turns over with it
      showBonusSheet(c.kind);
    }, LONG_PRESS_MS);
  }
  if (canUseInPath(cell)) els.cells[cell].classList.add('pressed');
  e.preventDefault();
}

function onPointerMove(e) {
  const gs = app.gesture;
  if (!gs || e.pointerId !== gs.id) return;
  if (gs.mode === 'pending') {
    const dist = Math.hypot(e.clientX - gs.x, e.clientY - gs.y);
    if (dist < TAP_THRESHOLD) return;
    els.cells[gs.startCell].classList.remove('pressed');
    const g = S().game;
    if (S().settings.pathMode || g.phase !== 'playing' || !canUseInPath(gs.startCell)) { gs.mode = 'dead'; return; }
    gs.mode = 'path';
    app.path = [gs.startCell];
    app.hintCells = null;
    render();
  }
  if (gs.mode !== 'path') return;
  const cell = hitTest(e.clientX, e.clientY, true);
  if (cell < 0) return;
  if (extendPath(app.path, cell)) {
    haptic(4);
    render();
  }
}

function onPointerUp(e) {
  const gs = app.gesture;
  if (!gs || e.pointerId !== gs.id) return;
  app.gesture = null;
  clearTimeout(gs.longTimer);
  els.cells[gs.startCell].classList.remove('pressed');
  try { els.board.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  if (gs.mode === 'pending') { onTap(gs.startCell); return; }
  if (gs.mode !== 'path') return;
  const path = app.path.slice();
  const size = M().handSize;
  if (path.length === size) { attemptBank(path, 'swipe'); return; }
  if (path.length >= 2) { logEvent('path_abandoned', { path }); toast(`Trace ${size} connected dice`); }
  clearPath();
  render();
}

function onPointerCancel(e) {
  const gs = app.gesture;
  if (!gs || e.pointerId !== gs.id) return;
  app.gesture = null;
  clearTimeout(gs.longTimer);
  els.cells[gs.startCell].classList.remove('pressed');
  if (gs.mode === 'path') logEvent('path_cancelled', { path: app.path.slice() });
  clearPath();
  render();
}

// ---------- first screen, guide, settings / data ----------
// The title (DICEFOOL, owner 02.11.2026; DICE TWICE before) and three short pages, combinations first (owner): a line
// of words next to a picture of the game on each (digest §3: no wall of text before play, dice drawn as
// pips). The Bible opens the same pages without the title, with every bonus and a link to the settings.
const GUIDE_COMBOS = [['pair', [6, 6]], ['two_pairs', [2, 2, 6, 6]], ['small_straight', [1, 2, 3, 4]], ['three_kind', [3, 3, 3]], ['full_house', [2, 2, 5, 5, 5]], ['four_kind', [4, 4, 4, 4]], ['straight', [1, 2, 3, 4, 5]], ['five_kind', [5, 5, 5, 5, 5]]];
const GUIDE_BONUSES = { x2_any: 'ANY HAND', x3_straight: 'STRAIGHT', x3_pairs: 'PAIR, TWO PAIRS', x3_trips: 'TRIPS, FULL HOUSE', joker: 'ANY FACE', refund: 'A REROLL BACK' };
const guideDie = (v, held) => `<i class="gdie" style="--f: var(--face-${v}${held ? '-held' : ''})"></i>`; // the baked faces
const guideTile = (kind, on) => `<span class="cell bonus kind-${kind} ${on ? 'on' : 'off'}"><span class="arch"></span><span class="art" data-kind="${kind}"></span><span class="tag">${cardLabel(kind)}</span><span class="x2">${cardSticker(kind)}</span></span>`; // a card face up
const animateTiles = (root) => root.querySelectorAll('.art[data-kind]').forEach((art) => animateArt(art, art.dataset.kind)); // their characters live too

function openGuide(mode) {
  const guide = $('guide');
  const ups = mode === 'help' ? S().ups || {} : {}; // the Bible shows the run's multipliers, upgrades in yellow
  $('combos').innerHTML = GUIDE_COMBOS.map(([cat, dice]) => `<li><span class="gdice">${dice.map((v) => guideDie(v)).join('')}</span><b>${CATEGORY5_LABELS[cat]}</b><em${ups[cat] ? ' class="up"' : ''}>×${AUTO_MULT[cat] + (ups[cat] || 0)}</em></li>`).join('');
  $('holdPic').innerHTML = `<span class="grp"><span>${[6, 6, 6].map((v) => guideDie(v, true)).join('')}</span><small>TAP = HOLD</small></span><span class="grp roll"><span>${[2, 4].map((v) => guideDie(v)).join('')}</span><small>REROLL</small></span>`;
  const help = mode === 'help';
  $('bonusPic').innerHTML = help
    ? `<ul class="bonus-list">${Object.keys(GUIDE_BONUSES).map((k) => `<li>${guideTile(k, false)}<small>${GUIDE_BONUSES[k]}</small></li>`).join('')}</ul>`
    : `<span class="tap">${guideTile('x2_any', false)}</span><span class="goal"><small>THRESHOLD</small><b>${runTarget(1)}</b><small>IN 3 HANDS</small></span>`;
  animateTiles($('bonusPic'));
  $('bonusNote').textContent = help ? 'TAP TO SWITCH ON · THEY ADD UP' : 'MISS ONE AND THE RUN IS OVER';
  app.guide = { mode, page: help ? 1 : 0 };
  guide.classList.toggle('help', help);
  $('guideSkip').textContent = help ? 'CLOSE' : 'SKIP';
  $('guideSettings').hidden = !help;
  showGuidePage(app.guide.page);
  guide.hidden = false;
}

// The guide's REROLL dice throw like the game's (owner, 02.11.2026): the same 3D roll, about every 2 s
// while their page shows. The CSS tumble stays until three.js is there, and without it. A new loop waits
// for the one before to end its throw: every throw draws on the one canvas.
function guideRolls() {
  const token = {};
  app.guideRoll = token;
  app.guideRolled = (app.guideRolled || Promise.resolve()).then(() => guideRollLoop(token)).catch(() => {});
}

async function guideRollLoop(token) {
  if (app.guideRoll !== token) return;
  const grp = $('holdPic').querySelector('.roll');
  const box = grp && grp.firstElementChild;
  if (!box || reduceMotion || !app.dice3d || !(await loadDice3D())) return;
  const dice = [...box.querySelectorAll('.gdie')];
  const rng = createRng(`guide/${Date.now()}`);
  let faces = [2, 4];
  const showing = () => app.guideRoll === token && !$('guide').hidden && app.guide.page === 2;
  grp.classList.add('three');
  while (showing()) {
    const next = faces.map((f) => { let v = f; while (v === f) v = 1 + Math.floor(rng.next() * 6); return v; });
    dice.forEach((d) => d.classList.add('hidden3d'));
    const ok = await rollDice3D({
      board: box,
      cells: dice,
      dice: next.map((value, index) => ({ index, from: faces[index], value })),
      colors: lookColors(),
      rng,
      onLanded: () => dice.forEach((d, k) => { d.style.setProperty('--f', `var(--face-${next[k]})`); d.classList.remove('hidden3d'); }), // under the fading canvas
    }).catch(() => false);
    dice.forEach((d) => d.classList.remove('hidden3d'));
    if (!ok) break;
    faces = next;
    await wait(1400);
  }
  if (app.guideRoll === token) grp.classList.remove('three');
}

function showGuidePage(page) {
  app.guide.page = page;
  if (page === 2) guideRolls();
  $('guide').querySelectorAll('.guide-page').forEach((el) => { el.hidden = Number(el.dataset.page) !== page; });
  $('guideDots').querySelectorAll('i').forEach((dot, k) => dot.classList.toggle('on', k === page - 1));
  $('guideDots').hidden = page === 0;
  $('guideSkip').hidden = page === 0;
  $('guideNext').textContent = page === 0 ? 'PLAY' : page < 3 ? 'NEXT' : app.guide.mode === 'help' ? 'GOT IT' : "LET'S ROLL";
}

function guideNext() {
  if (app.guide.page < 3) showGuidePage(app.guide.page + 1);
  else closeGuide(true);
}

// The first visit ends in the tutorial on the board, or straight in the game after SKIP.
// The guide is gone: the board shows, and a deal waiting behind it starts.
function guideGone() {
  $('guide').hidden = true;
  app.afterGuide.splice(0).forEach((start) => start());
}

function closeGuide(tutorial) {
  guideGone();
  if (app.guide.mode !== 'intro') return;
  const st = S();
  st.onboarded = true;
  logEvent('onboarded', { tutorial });
  if (tutorial) {
    coachStart('onboarding');
    return;
  }
  st.coached = true;
  persist();
}

function renderScoreTable() {
  const list = M().help.scoreRows(S().settings);
  const odds = list.some((r) => r.odds != null); // Auto Hand has no fixed-size roll to quote odds for
  const rows = list.map((r) => {
    const ex = r.example.map((f) => `<b>${f}</b>`).join('');
    return `<tr><td>${r.label}</td><td class="ex">${ex}</td><td class="num">${r.points}</td>${odds ? `<td class="num">${(100 * r.odds).toFixed(1)}%</td>` : ''}</tr>`;
  });
  $('scoreTable').innerHTML = `<tr><th>HAND</th><th>EXAMPLE</th><th class="num">POINTS</th>${odds ? '<th class="num">ODDS</th>' : ''}</tr>${rows.join('')}`;
}

function openHelp() {
  if (app.busy) return;
  const st = S();
  const mode = M();
  // Auto Hand's rules are the guide's pages: this sheet is its settings
  $('helpTitle').textContent = mode.id === 'auto' ? 'SETTINGS' : `HOW TO PLAY · ${mode.name.toUpperCase()}`;
  $('helpRules').hidden = mode.id === 'auto';
  $('helpScoring').innerHTML = mode.scoringHtml || els.defaultScoring.help;
  $('helpLead').textContent = mode.help.lead;
  $('helpRuleList').innerHTML = mode.help.rules.map((r) => `<li>${r}</li>`).join('');
  $('helpScoreTitle').textContent = mode.help.scoreTitle;
  renderScoreTable();
  $('optHoldCap').checked = st.settings.maxHolds != null;
  $('optTableRow').hidden = !mode.help.options.table;
  if (mode.help.options.table) $('optTable').innerHTML = mode.tableOptions.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  $('optSmallRow').hidden = !mode.help.options.small;
  $('optEndRow').hidden = !mode.help.options.endOnTarget;
  $('optGoldRow').hidden = !mode.help.options.goldCell;
  if (mode.help.options.goldCell) $('optGold').checked = st.settings.goldCell !== false;
  if (mode.help.options.table) $('optTable').value = st.settings.scoreTable;
  if (mode.help.options.small) $('optSmall').checked = !!st.settings.smallStraight;
  if (mode.help.options.endOnTarget) $('optEndOnTarget').checked = !!st.settings.endOnTarget;
  $('optAutoBonus').checked = st.settings.autoBonusOnFinalHand;
  // Hold cap and the auto ×2 belong to the snake modes
  $('optHoldCap').closest('label').hidden = mode.id === 'auto';
  $('optAutoBonus').closest('label').hidden = mode.id === 'auto';
  const run = mode.id === 'auto' && st.game ? ` · layout ${st.game.level.recipe || '—'} · run score ${st.runScore}${st.best ? ` · best level ${st.best.level} (${st.best.score})` : ''}` : ` · tier ${st.tier}`;
  $('runInfo').textContent = `${mode.name} · run ${st.runSeed} · level ${st.levelIndex}${run} · generator ${mode.generatorVersion} · ${st.log.length} events logged locally`;
  $('difficultyRule').textContent = mode.difficultyText || DIFFICULTY_RULE_TEXT;
  $('logOut').hidden = true;
  $('help').hidden = false;
}

function applySettings() {
  const st = S();
  const mode = M();
  st.settings.maxHolds = $('optHoldCap').checked ? 3 : null;
  if (mode.help.options.table) st.settings.scoreTable = $('optTable').value;
  if (mode.help.options.small) st.settings.smallStraight = $('optSmall').checked;
  if (mode.help.options.endOnTarget) st.settings.endOnTarget = $('optEndOnTarget').checked;
  if (mode.help.options.goldCell) st.settings.goldCell = $('optGold').checked;
  st.settings.autoBonusOnFinalHand = $('optAutoBonus').checked;
  logEvent('settings', { ...st.settings });
  if (mode.help.options.small) renderScoreTable();
  persist();
}

async function exportLog() {
  const st = S();
  const payload = { app: APP_VERSION, mode: app.modeId, generator: M().generatorVersion, exportedAt: new Date().toISOString(), runSeed: st.runSeed, settings: st.settings, levels: st.levels, events: st.log };
  const text = JSON.stringify(payload);
  const out = $('logOut');
  out.value = text;
  out.hidden = false;
  try {
    await navigator.clipboard.writeText(text);
    toast('Event log copied to clipboard', 'good');
  } catch {
    out.focus();
    out.select();
    toast('Clipboard blocked: log shown below, select and copy');
  }
}

function resetProgress() {
  if (app.busy) return;
  logEvent('reset');
  const fresh = freshModeState(M());
  fresh.onboarded = true;
  fresh.coached = true;
  fresh.runSeed = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  app.modes[app.modeId] = fresh;
  $('help').hidden = true;
  newLevel();
  toast(`${M().name} progress reset`, 'good');
}

// ---------- init ----------
function bind() {
  const board = els.board;
  board.addEventListener('pointerdown', onPointerDown);
  board.addEventListener('pointermove', onPointerMove);
  board.addEventListener('pointerup', onPointerUp);
  board.addEventListener('pointercancel', onPointerCancel);
  board.addEventListener('lostpointercapture', (e) => { if (app.gesture && app.gesture.id === e.pointerId) onPointerCancel(e); });
  board.addEventListener('contextmenu', (e) => e.preventDefault());
  board.addEventListener('keydown', (e) => {
    const cell = e.target.closest && e.target.closest('.cell');
    if (!cell) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(Number(cell.dataset.index)); }
  });
  for (const btn of els.tabs) btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  els.rerollBtn.addEventListener('click', () => doReroll('button'));
  els.playBtn.addEventListener('click', () => { if (M().id === 'auto') attemptBank([], 'button'); });
  els.bankLastBtn.addEventListener('click', onBankLast);
  els.hintBtn.addEventListener('click', onHint);
  els.pathModeBtn.addEventListener('click', togglePathMode);
  els.undoBtn.addEventListener('click', () => { if (app.busy) return; app.tapPath.pop(); render(); });
  els.bankTapBtn.addEventListener('click', () => attemptBank(app.tapPath.slice(), 'tap'));
  els.helpBtn.addEventListener('click', () => { if (!app.busy) openGuide('help'); });
  $('lookBtn').addEventListener('click', cycleLook);
  $('optLook').addEventListener('change', () => setLook($('optLook').value));
  $('optDice3d').addEventListener('change', () => setDice3D($('optDice3d').checked));
  $('upList').addEventListener('click', (e) => {
    const b = e.target.closest('.up');
    const st = S();
    if (!b || !st.game || st.game.phase !== 'won') return;
    st.ups = withUpgrade(st.ups, b.dataset.cat);
    logEvent('upgrade', { category: b.dataset.cat, ups: st.ups });
    onNext();
  });
  $('bank').addEventListener('click', (e) => {
    const card = e.target.closest('.cell[data-k]');
    if (card) armBonus('bank', BANK + Number(card.dataset.k));
  });
  $('optSound').addEventListener('change', () => {
    setSound($('optSound').checked);
    try { localStorage.setItem(SOUND_KEY, $('optSound').checked ? '1' : '0'); } catch { /* ignore */ }
  });
  // every other button taps: the dice, cards, PLAY and REROLL have sounds of their own
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && !b.disabled && b !== els.playBtn && b !== els.rerollBtn) sfx('hold', { vol: 0.5, rate: 1.3 });
  }, true);
  $('bonusStatus').addEventListener('click', () => armBonus('badge'));
  $('closeHelpBtn').addEventListener('click', () => { $('help').hidden = true; });
  for (const id of ['optHoldCap', 'optTable', 'optSmall', 'optEndOnTarget', 'optGold', 'optAutoBonus']) $(id).addEventListener('change', applySettings);
  $('exportBtn').addEventListener('click', exportLog);
  $('resetBtn').addEventListener('click', resetProgress);
  $('nextBtn').addEventListener('click', onNext);
  $('retryBtn').addEventListener('click', onRetry);
  $('bonusSheetOk').addEventListener('click', closeBonusSheet);
  $('bonusSheet').addEventListener('click', (e) => { if (e.target === e.currentTarget && performance.now() - app.sheetAt > 500) closeBonusSheet(); });
  $('guideNext').addEventListener('click', guideNext);
  $('guideSkip').addEventListener('click', () => closeGuide(false));
  $('guideSettings').addEventListener('click', () => { guideGone(); openHelp(); });
  let swipeX = null; // swiping the guide turns its pages
  $('guide').addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
  $('guide').addEventListener('pointerup', (e) => {
    const dx = swipeX == null ? 0 : e.clientX - swipeX;
    swipeX = null;
    if (dx < -50 && app.guide.page < 3) showGuidePage(app.guide.page + 1);
    if (dx > 50 && app.guide.page > (app.guide.mode === 'help' ? 1 : 0)) showGuidePage(app.guide.page - 1);
  });
  $('coachSkip').addEventListener('click', () => coachStop('skipped'));
  $('tutorialBtn').addEventListener('click', () => { if (app.busy) return; $('help').hidden = true; coachStart('help'); });
  window.addEventListener('keydown', (e) => {
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'r' || e.key === 'R') doReroll('key');
    if (e.key === 'h' || e.key === 'H') onHint();
    if (e.key === 'Escape') { $('help').hidden = true; if (!$('bonusSheet').hidden) closeBonusSheet(); if (app.guide && app.guide.mode === 'help') $('guide').hidden = true; if (!app.busy) { clearPath(); render(); } }
  });
  const refit = () => { fitBoard(); };
  window.addEventListener('resize', refit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', refit);
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(refit);
    ro.observe(els.app);
    ro.observe($('coach')); // the tutorial line takes height from the board while it shows
  }
}

// A file the stylesheet names in a custom property, as an address the page can fetch: the build inlines it
// like the rest of the art, and in development the browser resolves it against the stylesheet.
function cssUrl(prop) {
  const probe = document.createElement('i');
  probe.hidden = true; // never shown, so never loaded as a picture
  probe.style.backgroundImage = `var(${prop})`;
  document.body.appendChild(probe);
  const m = /url\("?(.*?)"?\)$/.exec(getComputedStyle(probe).backgroundImage);
  probe.remove();
  return m ? m[1] : null;
}

// The dice wear the ivory matcap and their pressed-in pips a black metal one (owner, 02.11.2026: ivory,
// a little less yellow); ?matcap=porcelain|toon|clay tries another body, ?matcap=none the lit material.
function tryMatcap() {
  const name = new URLSearchParams(location.search).get('matcap') || 'ivory';
  if (name === 'none' || !/^[a-z]+$/.test(name)) return;
  const url = (v) => cssUrl(`--matcap-${v}`);
  if (url(name)) useMatcap(url(name), url('pip'));
}

function init() {
  tryMatcap();
  for (const id of ['app', 'board', 'boardWrap', 'preview', 'playBtn', 'rerollBtn', 'bankLastBtn', 'hintBtn', 'pathModeBtn', 'helpBtn', 'tapbar', 'undoBtn', 'bankTapBtn', 'rerollPips', 'toast', 'bones', 'bonesLabel', 'handStat', 'multSticker']) els[id] = $(id);
  els.tabs = Array.from(document.querySelectorAll('.tab'));
  els.controls = document.querySelector('.controls');
  // the snake modes share the scoring paragraphs written in index.html; Auto Hand brings its own
  els.defaultScoring = { help: $('helpScoring').innerHTML };
  buildBoard();
  bind();
  setLook('modern'); // the mockup's black screen; the other looks have no switch any more
  let soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== '0'; } catch { /* ignore */ }
  $('optSound').checked = soundOn;
  const sounds = Object.fromEntries(SOUNDS.map((n) => [n, cssUrl(`--sfx-${n}`)]));
  setupSound((n) => sounds[n], soundOn);
  setupPuppets((character, part) => cssUrl(`--rig-${character}-${part}`), () => app.busy); // no turn while the dice fly or count
  let d3 = true;
  try { d3 = localStorage.getItem(DICE3D_KEY) !== '0'; } catch { /* ignore */ }
  app.dice3d = d3;
  if (d3 && !reduceMotion) setTimeout(() => loadDice3D().then(applyRenderedFaces), 800);
  const saved = readJson(STORAGE_KEY);
  if (saved && saved.modes) {
    for (const id of Object.keys(MODES)) app.modes[id] = hydrateMode(id, saved.modes[id]);
  } else {
    const legacy = readJson(LEGACY_KEY);
    if (legacy && legacy.runSeed) app.modes.snake4 = hydrateMode('snake4', legacy);
  }
  app.modeId = 'auto'; // the only mode on screen
  fitBoard();
  switchMode(app.modeId, { silent: true });
  requestAnimationFrame(fitBoard);
  window.__diceSnake = { app, version: APP_VERSION, state: () => S(), mode: () => M(), hint: () => E().hintFor(S().game), switchMode, setLook, LOOKS, dice3d: dice3dStatus, setDice3D };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
