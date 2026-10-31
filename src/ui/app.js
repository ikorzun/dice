// Dice Snake — portrait mobile UI driving two rule sets, one tab each:
//   "Snake 4+4" (engine/game.js) and "Poker 5" (engine/poker.js).
// All rules live in the engines; this file renders state, interprets pointer gestures,
// plays effects, runs the example-based tutorial and keeps a local event log per mode.

import { createRng } from '../engine/rng.js';
import { CATEGORY_LABELS, CATEGORY_ORDER, CATEGORY_OUTCOMES, SCORE_TABLES } from '../engine/scoring.js';
import { CATEGORY5_LABELS, CATEGORY5_OUTCOMES, CATEGORY5_OUTCOMES_SMALL, SCORE_TABLES5 } from '../engine/scoring5.js';
import { areAdjacent, rowOf, colOf, orderedPathsOf } from '../engine/geometry.js';
import {
  createGame, toggleHold as snakeToggleHold, reroll as snakeReroll, toggleBonus as snakeToggleBonus,
  previewPath as snakePreviewPath, bankPath as snakeBankPath, hintFor as snakeHintFor, markHintUsed as snakeMarkHintUsed,
  remainingCells as snakeRemainingCells, canReroll as snakeCanReroll, snapshotGame as snakeSnapshot, restoreGame as snakeRestore,
  isOrdinary as snakeIsOrdinary, isBanked as snakeIsBanked, heldCount as snakeHeldCount,
} from '../engine/game.js';
import {
  createPokerGame, toggleHold as pokerToggleHold, reroll as pokerReroll, toggleBonus as pokerToggleBonus,
  previewPath as pokerPreviewPath, bankPath as pokerBankPath, hintFor as pokerHintFor, markHintUsed as pokerMarkHintUsed,
  remainingCells as pokerRemainingCells, canReroll as pokerCanReroll, snapshotGame as pokerSnapshot, restoreGame as pokerRestore,
  isBanked as pokerIsBanked, isSealed as pokerIsSealed, heldCount as pokerHeldCount,
} from '../engine/poker.js';
import { generateLevel, nextTier, DIFFICULTY_RULE_TEXT, GENERATOR_VERSION } from '../engine/levels.js';
import { generatePokerLevel, GENERATOR5_VERSION } from '../engine/levels5.js';

const APP_VERSION = '0.2.0';
const STORAGE_KEY = 'dice-snake.v2';
const LEGACY_KEY = 'dice-snake-3x3.v1';
const TAP_THRESHOLD = 10; // CSS px of movement before a press becomes a path
const CORE_INSET = 0.18; // path hit region = central 64% of a cell (no corner cutting)
const LOG_LIMIT = 4000;
const SVG_NS = 'http://www.w3.org/2000/svg';

const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = reduceMotion
  ? { roll: 0, rollSwap: 0, stagger: 0, bank: 60, refill: 0, reveal: 0, endDelay: 120, flash: 900 }
  : { roll: 640, rollSwap: 300, stagger: 45, bank: 560, refill: 520, reveal: 950, endDelay: 700, flash: 1400 };

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
  isOrdinary: () => true,
  isBanked: pokerIsBanked,
  isSealed: pokerIsSealed,
  heldCount: pokerHeldCount,
  handsPlayed: (g) => g.hands.length,
  handsTotal: (g) => g.hands.length + g.handsLeft,
  isLastHand: (g) => g.handsLeft === 1,
};

const show = (g, cells) => cells.map((i) => g.faces[i]).join(' → ');
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
    defaultSettings: { maxHolds: null, scoreTable: 'spec_v03', autoBonusOnFinalHand: true, pathMode: false },
    gameConfig: (st) => ({ maxHolds: st.maxHolds, scoreTable: st.scoreTable, autoBonusOnFinalHand: st.autoBonusOnFinalHand }),
    generate: ({ runSeed, levelIndex, tier, settings }) => generateLevel({ runSeed, levelIndex, tier, scoreTable: settings.scoreTable }),
    idleCopy: (g, pathMode) => {
      if (pathMode) return g.hands.length === 0 ? 'Tap 4 connected dice in order' : 'Tap the last 4 dice in order';
      return g.hands.length === 0 ? 'Drag through 4 dice to play · tap to hold' : 'Drag through the last 4 dice';
    },
    solverLine: (level) => `Best possible on the opening roll (no rerolls, with ×2): ${level.bestNoRerollWithBonus}`,
    onboard: {
      lead: 'Two hands of four dice, dragged edge to edge like a snake. Both hands together use all eight dice.',
      note: 'The tutorial shows every move on your first board: hold, reroll, drag a hand, use the gold ×2.',
      demo: { values: [5, 5, 2, 3, 5, 5], path: [0, 1, 4, 5], label: 'SWIPE 5 → 5 → 5 → 5 = FOUR OF A KIND' },
    },
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
        const table = SCORE_TABLES[settings.scoreTable];
        const examples = { four_kind: [2, 2, 2, 2], straight: [1, 2, 3, 4], three_kind: [4, 4, 4, 1], two_pairs: [1, 1, 6, 6], pair: [1, 1, 3, 6], high: [1, 2, 4, 6] };
        return CATEGORY_ORDER.map((cat) => ({ label: CATEGORY_LABELS[cat], example: examples[cat], points: table[cat], odds: CATEGORY_OUTCOMES[cat] / 1296 }));
      },
      options: { table: true, small: false, endOnTarget: false },
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
    bonus: 'token',
    refill: true,
    engine: pokerEngine,
    generatorVersion: GENERATOR5_VERSION,
    defaultSettings: { maxHolds: null, smallStraight: true, endOnTarget: false, autoBonusOnFinalHand: true, pathMode: false, hands: 3, rerolls: 3 },
    gameConfig: (st) => ({ maxHolds: st.maxHolds, smallStraight: st.smallStraight, endOnTarget: st.endOnTarget, autoBonusOnFinalHand: st.autoBonusOnFinalHand, hands: st.hands, rerolls: st.rerolls }),
    generate: ({ runSeed, levelIndex, tier, settings }) => generatePokerLevel({ runSeed, levelIndex, tier, config: MODES.poker5.gameConfig(settings) }),
    idleCopy: (g, pathMode) => {
      const n = g.hands.length + 1;
      const total = g.hands.length + g.handsLeft;
      return pathMode ? `Hand ${n} of ${total} · tap 5 connected dice in order` : `Hand ${n} of ${total} · drag through 5 dice · tap to hold`;
    },
    solverLine: (level) => `Best opening snake before any reroll: ${CATEGORY5_LABELS[level.openingCategory] || ''} ${level.openingBest}`,
    onboard: {
      lead: 'Nine dice. Drag through five of them like a snake to play a poker hand. The five you used are replaced; the other four stay for your next hand.',
      note: 'Three hands and three rerolls per level. The tutorial shows every move on your first board.',
      demo: { values: [4, 4, 4, 3, 2, 2], path: [0, 1, 2, 5, 4], label: 'SWIPE 4 → 4 → 4 → 2 → 2 = FULL HOUSE' },
    },
    help: {
      lead: 'The four dice you leave behind are the start of your next hand: plan the snake so the leftovers already match.',
      rules: [
        'Nine dice on a 3×3 board. A hand is a snake of exactly five dice that touch edge to edge (no diagonals, no repeats).',
        'To play a hand, press a die and drag through five dice in one move, then lift. Example: 4 → 4 → 4 → 2 → 2 is a FULL HOUSE.',
        'The five dice you played are replaced by fresh dice. The other four stay exactly as they are.',
        'Tap a die to hold it. REROLL changes every unheld die. Three rerolls per level, shared by all hands.',
        'Three hands per level. Tap the ×2 badge to double the hand you play next; an unused ×2 is applied to the last hand automatically.',
        'Reach the target with the three hands to clear the level.',
      ],
      scoreTitle: 'SCORING · FIVE DICE (POKER)',
      scoreRows: (settings) => {
        const table = SCORE_TABLES5.poker5_v1;
        const outcomes = settings.smallStraight ? CATEGORY5_OUTCOMES_SMALL : CATEGORY5_OUTCOMES;
        const examples = { five_kind: [3, 3, 3, 3, 3], four_kind: [3, 3, 3, 3, 1], straight: [1, 2, 3, 4, 5], full_house: [2, 2, 5, 5, 5], small_straight: [1, 2, 3, 4, 4], three_kind: [4, 4, 4, 1, 2], two_pairs: [1, 1, 6, 6, 3], pair: [1, 1, 3, 5, 6], bust: [1, 2, 4, 5, 6] };
        const order = ['five_kind', 'four_kind', 'straight', 'full_house', 'small_straight', 'three_kind', 'two_pairs', 'pair', 'bust'].filter((c) => settings.smallStraight || c !== 'small_straight');
        return order.map((cat) => ({ label: CATEGORY5_LABELS[cat], example: examples[cat], points: table[cat], odds: outcomes[cat] / 7776 }));
      },
      options: { table: false, small: true, endOnTarget: true },
    },
    coachText(step, g, hint) {
      if (step === 'swipe') return `DRAG ${show(g, hint.cells)} IN ONE MOVE, THEN LIFT · ${hint.hand.label} ${hint.hand.points}`;
      const n = g.hands.length + 1;
      const total = g.hands.length + g.handsLeft;
      const last = g.handsLeft === 1 && g.bonus.available ? ' · ×2 AUTO' : '';
      return `HAND ${n}/${total} · THE OTHER FOUR STAYED · DRAG ${show(g, hint.cells)} · ${hint.hand.label} ${hint.hand.points}${last}`;
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
  };
}

const app = {
  modeId: 'snake4',
  modes: { snake4: freshModeState(MODES.snake4), poker5: freshModeState(MODES.poker5) },
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
  ghostKey: '',
  ghostAnim: null,
};

const S = () => app.modes[app.modeId];
const M = () => MODES[app.modeId];
const E = () => MODES[app.modeId].engine;

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
  st.settings = { ...st.settings, ...(saved.settings || {}) };
  st.onboarded = !!saved.onboarded;
  st.coached = !!saved.coached;
  if (saved.coach && saved.coach.active) st.coach = { active: true, done: { hold: false, reroll: false, ...(saved.coach.done || {}) } };
  st.log = Array.isArray(saved.log) ? saved.log : [];
  st.levels = Array.isArray(saved.levels) ? saved.levels : [];
  if (saved.game && saved.game.phase === 'playing') {
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
  app.path = [];
  app.tapPath = [];
  app.hintCells = null;
  app.coachTargets = null;
  stopGhost();
  logEvent('level_start', {
    seed: level.seed, levelIndex: level.levelIndex, tier: level.tier, target: level.target, faces: level.faces, attempt,
    opening: level.bestNoRerollWithBonus ?? level.openingBest, config: mode.gameConfig(st.settings),
  });
  $('levelEnd').hidden = true;
  render();
  persist();
}

function newLevel() {
  const st = S();
  const level = M().generate({ runSeed: st.runSeed, levelIndex: st.levelIndex, tier: st.tier, settings: st.settings });
  startGame(level, 1);
}

function finishLevel() {
  const st = S();
  const g = st.game;
  const mode = M();
  const won = g.phase === 'won';
  const now = Date.now();
  const summary = {
    mode: mode.id, levelIndex: g.level.levelIndex, seed: g.level.seed, tier: g.level.tier, target: g.level.target, score: g.score, won, attempt: g.attempt,
    durationMs: now - st.levelStartedAt, timeToFirstHandMs: st.firstHandAt ? st.firstHandAt - st.levelStartedAt : null,
    hintsUsed: g.stats.hintsUsed, rejectedPaths: g.stats.rejectedPaths, rerollsUsed: g.stats.rerollsUsed, holdToggles: g.stats.holdToggles,
    categories: g.hands.map((h) => h.category), bonusOnHand: g.bonus.usedOnHand, bonusAuto: g.bonus.autoApplied,
    handsLeft: g.handsLeft ?? 0, opening: g.level.bestNoRerollWithBonus ?? g.level.openingBest,
  };
  st.levels.push(summary);
  logEvent('level_end', summary);
  st.pendingTier = nextTier(st.tier, won);
  persist();
  showLevelEnd();
}

function showLevelEnd() {
  const st = S();
  const g = st.game;
  const mode = M();
  const won = g.phase === 'won';
  if (st.pendingTier == null) st.pendingTier = nextTier(st.tier, won);
  $('endTitle').textContent = won ? 'LEVEL CLEARED' : 'TARGET MISSED';
  $('endTitle').className = `end-title ${won ? 'won' : 'lost'}`;
  $('endScore').textContent = g.score;
  $('endTarget').textContent = g.level.target;
  const list = $('endHands');
  list.innerHTML = '';
  g.hands.forEach((h, k) => {
    const li = document.createElement('li');
    const mini = h.faces.map((f) => `<b>${f}</b>`).join('');
    const mult = h.multiplier > 1 ? `<em>×${h.multiplier}</em>` : '';
    li.innerHTML = `<span class="mini">${mini}</span><span>HAND ${k + 1} · ${h.label}</span><span class="pts">${mult}${h.total}</span>`;
    list.appendChild(li);
  });
  const used = g.hands.find((h) => h.multiplier > 1);
  const spare = g.handsLeft > 0 ? ` · ${g.handsLeft} hand${g.handsLeft > 1 ? 's' : ''} to spare` : '';
  $('endBonus').textContent = (used
    ? `×2 ${used.bonusAuto ? 'auto-applied to' : 'used on'} hand ${used.index + 1} (${used.points} → ${used.total})`
    : '×2 was not used') + spare;
  $('endSolver').textContent = mode.solverLine(g.level);
  $('endTier').textContent = st.pendingTier === st.tier
    ? `Rule-based difficulty: stays at tier ${st.tier} / 5`
    : `Rule-based difficulty: tier ${st.tier} → ${st.pendingTier} / 5`;
  $('nextBtn').textContent = won ? 'NEXT LEVEL' : 'NEXT LEVEL (EASIER)';
  setTimeout(() => { $('levelEnd').hidden = false; }, T.endDelay);
}

function onNext() {
  const st = S();
  if (st.pendingTier != null) st.tier = st.pendingTier;
  st.levelIndex += 1;
  newLevel();
}

function onRetry() {
  const st = S();
  logEvent('retry', { attempt: st.game.attempt + 1 });
  startGame(st.game.level, st.game.attempt + 1);
}

// ---------- mode switching ----------
function switchMode(id, { silent = false } = {}) {
  if (!MODES[id] || app.busy) return;
  if (app.gesture) return;
  const from = app.modeId;
  app.modeId = id;
  app.path = [];
  app.tapPath = [];
  app.hintCells = null;
  app.coachTargets = null;
  stopGhost();
  $('levelEnd').hidden = true;
  $('help').hidden = true;
  const st = S();
  if (!st.runSeed) st.runSeed = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (!st.game) newLevel();
  else if (st.game.phase !== 'playing') { render(); showLevelEnd(); }
  else render();
  if (!st.onboarded) showOnboarding();
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
    els.preview.hidden = false;
    els.rerollBtn.classList.remove('pulse');
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
  if (step === 'hold') {
    const c = hint.cells[0];
    text = `TAP THE ${g.faces[c]} TO HOLD IT. HELD DICE DO NOT CHANGE WHEN YOU REROLL.`;
    targets = [c];
    ghostPath = [c];
  } else if (step === 'reroll') {
    index = 2;
    text = E().canReroll(g)
      ? 'NOW PRESS REROLL. ONLY THE DICE WITHOUT HOLD CHANGE.'
      : 'EVERY DIE IS HELD. TAP ONE TO RELEASE IT, THEN PRESS REROLL.';
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
  bar.hidden = false;
  els.preview.hidden = true;
  $('coachStep').textContent = `${index} / 4`;
  $('coachText').textContent = text;
  els.rerollBtn.classList.toggle('pulse', step === 'reroll');
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
    cell.innerHTML = `<span class="face">${'<i></i>'.repeat(9)}</span><span class="x2">×2</span><span class="tag"></span><span class="order"></span>`;
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

function fitBoard() {
  const wrap = els.boardWrap;
  const size = Math.max(120, Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight)));
  els.board.style.setProperty('--board', `${size}px`);
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
  cell.className = 'cell';
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
  tag.textContent = stranded ? 'CUT OFF' : sealed ? 'FIXED' : 'HOLD';
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
  cell.setAttribute('aria-label', `Die ${g.faces[i]}${g.held[i] ? ', held' : ''}${sealed ? ', fixed' : ''}`);
}

function renderHud() {
  const st = S();
  const g = st.game;
  const engine = E();
  $('score').textContent = String(g.score);
  $('target').textContent = String(g.level.target);
  $('levelText').textContent = `LEVEL ${g.level.levelIndex}${g.attempt > 1 ? ` · TRY ${g.attempt}` : ''}`;
  $('tierText').textContent = `TIER ${g.level.tier} / 5 · RULE-BASED`;
  const handsEl = $('handsText');
  if (M().id === 'poker5') {
    handsEl.hidden = false;
    handsEl.textContent = g.phase === 'playing' ? `HAND ${engine.handsPlayed(g) + 1} / ${engine.handsTotal(g)}` : `${g.hands.length} HANDS PLAYED`;
  } else {
    handsEl.hidden = true;
  }
  for (const btn of els.tabs) btn.classList.toggle('on', btn.dataset.mode === app.modeId);
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
  if (!g.bonus.available) bs.textContent = `×2 USED ON HAND ${g.bonus.usedOnHand + 1}`;
  else if (g.bonus.armed) { bs.textContent = '×2 ARMED FOR NEXT HAND'; bs.classList.add('armed'); }
  else { bs.textContent = mode.bonus === 'cell' ? '×2 READY · TAP GOLD' : '×2 READY · TAP TO ARM'; bs.classList.add('ready'); }
  bs.disabled = app.busy || g.phase !== 'playing' || !g.bonus.available;
  const playing = g.phase === 'playing';
  els.rerollBtn.disabled = app.busy || !engine.canReroll(g);
  els.rerollBtn.textContent = g.rerollsLeft > 0 ? 'REROLL' : 'NO REROLLS LEFT';
  els.bankLastBtn.hidden = !(playing && mode.id === 'snake4' && g.hands.length === 1);
  els.bankLastBtn.disabled = app.busy;
  els.tapbar.hidden = !st.settings.pathMode || !playing;
  els.undoBtn.disabled = app.tapPath.length === 0;
  els.bankTapBtn.disabled = app.busy || app.tapPath.length !== mode.handSize;
  els.pathModeBtn.classList.toggle('on', st.settings.pathMode);
  els.pathModeBtn.setAttribute('aria-pressed', String(st.settings.pathMode));
  els.hintBtn.disabled = app.busy || !playing;
  for (const btn of els.tabs) btn.disabled = app.busy;
}

function cellCenter(i) {
  return [50 + colOf(i) * 100, 50 + rowOf(i) * 100];
}

function renderPath() {
  const path = currentPath();
  $('pathLine').setAttribute('points', path.length > 1 ? path.map((i) => cellCenter(i).join(',')).join(' ') : '');
  const hint = app.hintCells || (app.coachTargets && app.coachTargets.length > 1 && path.length === 0 ? app.coachTargets : null);
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
  const path = currentPath();
  if (path.length === 0) {
    if (engine.heldCount(g) === engine.remainingCells(g).length) setPreview(`All held · drag through ${mode.handSize} dice to play a hand`, 'hint');
    else setPreview(mode.idleCopy(g, st.settings.pathMode));
    return;
  }
  const p = engine.previewPath(g, path);
  if (!p.ok) { setPreview(p.message, 'bad'); return; }
  if (p.partial) { setPreview(`${p.count} / ${mode.handSize}`); return; }
  const mult = p.multiplier > 1 ? ` (${p.hand.points} ×${p.multiplier})` : '';
  if (!p.safe && p.stranded && p.stranded.length) setPreview(`${p.hand.label} ${p.total} · CUTS OFF ${p.stranded.map((i) => `${g.faces[i]} ${CELL_NAMES[i]}`).join(' + ')}`, 'bad');
  else if (!p.safe) setPreview(`${p.hand.label} ${p.total} · ${p.safetyMessage.replace(/\.$/, '')}`, 'bad');
  else setPreview(`${p.hand.label} +${p.total}${mult}${p.autoBonus ? ' · ×2 AUTO' : ''}`, 'good');
}

function computeStranded() {
  const g = S().game;
  const path = currentPath();
  if (M().id !== 'snake4' || g.phase !== 'playing' || path.length !== M().handSize) return null;
  const p = E().previewPath(g, path);
  return p.ok && !p.partial && !p.safe && p.stranded && p.stranded.length ? p.stranded : null;
}

function render() {
  app.safeNext = computeSafeNext();
  app.stranded = computeStranded();
  coachRender();
  for (let i = 0; i < 9; i++) renderCell(i);
  renderHud();
  renderControls();
  renderPath();
  renderPreview();
}

// ---------- effects ----------
function haptic(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* unsupported */ }
}

function toast(message, mood = '') {
  const t = els.toast;
  t.textContent = message;
  t.className = `toast ${mood}`;
  t.hidden = false;
  clearTimeout(app.toastTimer);
  app.toastTimer = setTimeout(() => { t.hidden = true; }, 1700);
}

function flashCells(cells, cls, ms) {
  cells.forEach((i) => els.cells[i].classList.add(cls));
  setTimeout(() => cells.forEach((i) => els.cells[i].classList.remove(cls)), ms);
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

function showReveal(hand) {
  const r = $('reveal');
  r.querySelector('.cat').textContent = hand.label;
  r.querySelector('.pts').textContent = `+${hand.total}`;
  r.querySelector('.mult').textContent = hand.multiplier > 1 ? `${hand.points} ×${hand.multiplier}${hand.bonusAuto ? ' AUTO' : ''}` : '';
  r.classList.remove('show');
  void r.offsetWidth;
  r.classList.add('show');
  if (reduceMotion) setTimeout(() => r.classList.remove('show'), 400);
  if (hand.points >= 10) {
    for (let k = 0; k < 10; k++) {
      const s = document.createElement('span');
      s.className = `spark${hand.multiplier > 1 ? ' gold' : ''}`;
      const a = (k / 10) * Math.PI * 2;
      const d = 90 + (k % 3) * 25;
      s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      s.style.setProperty('--dy', `${Math.sin(a) * d}px`);
      els.board.appendChild(s);
      setTimeout(() => s.remove(), 700);
    }
  }
  $('scoreStat').classList.remove('bump');
  void $('scoreStat').offsetWidth;
  $('scoreStat').classList.add('bump');
}

// ---------- actions ----------
function armBonus(source) {
  const st = S();
  const g = st.game;
  if (app.busy || g.phase !== 'playing') return;
  const r = E().toggleBonus(g);
  if (!r.ok) { toast(r.message, 'bad'); return; }
  st.game = r.state;
  haptic(10);
  logEvent('bonus', { armed: r.armed, source });
  render();
  persist();
}

function onTap(i) {
  const st = S();
  const g = st.game;
  const engine = E();
  if (app.busy || g.phase !== 'playing') return;
  if (!engine.isOrdinary(g, i)) { pressFeedback(i); armBonus('cell'); return; }
  if (engine.isBanked(g, i)) return;
  if (st.settings.pathMode) { tapPathAdd(i); return; }
  const r = engine.toggleHold(g, i);
  if (!r.ok) { toast(r.message, 'bad'); shakeCells([i]); return; }
  st.game = r.state;
  pressFeedback(i);
  haptic(r.held ? 12 : 6);
  logEvent('hold', { cell: i, held: r.held });
  render();
  persist();
  if (r.held && engine.heldCount(st.game) === engine.remainingCells(st.game).length && !st.allHeldToastShown) {
    st.allHeldToastShown = true;
    toast(`Hold only protects dice from REROLL. To play a hand, press a die and drag through ${M().handSize}.`, 'hint');
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
  const r = E().reroll(g, () => st.rerollRng.die());
  if (!r.ok) { toast(r.message, 'bad'); return; }
  st.game = r.state;
  logEvent('reroll', { source, rolled: r.rolled, held: [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => g.held[i]), left: st.game.rerollsLeft });
  app.busy = true;
  clearPath();
  renderControls();
  haptic(8);
  r.rolled.forEach((i, k) => {
    const c = els.cells[i];
    c.style.setProperty('--delay', `${k * T.stagger}ms`);
    c.classList.add('rolling');
    setTimeout(() => { c.querySelector('.face').dataset.value = String(st.game.faces[i]); }, T.rollSwap + k * T.stagger);
  });
  await wait(T.roll + T.stagger * Math.max(0, r.rolled.length - 1));
  r.rolled.forEach((i) => els.cells[i].classList.remove('rolling'));
  app.busy = false;
  render();
  persist();
}

async function attemptBank(path, source) {
  if (app.busy) return;
  const st = S();
  const g = st.game;
  const mode = M();
  const r = E().bankPath(g, path, () => st.refillRng.die());
  st.game = r.state;
  if (!r.ok) {
    logEvent('path_rejected', { source, code: r.code, path, stranded: r.stranded || [] });
    const cutOff = r.code === 'STRANDS' && r.stranded && r.stranded.length ? ` ${describeCells(g, r.stranded)} would be cut off.` : '';
    toast(`${r.message}${cutOff}`, 'bad');
    shakeCells(path);
    if (r.code === 'STRANDS') {
      if (r.stranded && r.stranded.length) flashCells(r.stranded, 'stranded', T.flash);
      const h = E().hintFor(st.game);
      if (h) flashCells(h.cells, 'safe-hint', T.flash);
    }
    clearPath();
    render();
    persist();
    return;
  }
  const hand = r.hand;
  if (hand.index === 0) st.firstHandAt = Date.now();
  logEvent('bank', { source, hand: hand.index, cells: hand.cells, faces: hand.faces, category: hand.category, points: hand.points, multiplier: hand.multiplier, total: hand.total, auto: hand.bonusAuto, refilled: r.refilled || [] });
  app.busy = true;
  app.hintCells = null;
  app.coachTargets = null;
  stopGhost();
  clearPath();
  haptic(hand.points >= 10 ? [14, 40, 18] : 12);
  showReveal(hand);
  hand.cells.forEach((i) => els.cells[i].classList.add('bank-pop'));
  renderHud();
  renderControls();
  renderPath();
  setPreview(`${hand.label} +${hand.total}`, 'good');
  await wait(T.bank);
  if (mode.refill && r.refilled && r.refilled.length) {
    render();
    r.refilled.forEach((i, k) => {
      const c = els.cells[i];
      c.style.setProperty('--delay', `${k * 60}ms`);
      c.classList.add('refill');
    });
    await wait(T.refill + 60 * r.refilled.length);
    r.refilled.forEach((i) => els.cells[i].classList.remove('refill'));
  }
  app.busy = false;
  render();
  persist();
  if (st.game.phase !== 'playing') finishLevel();
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
  app.hintTimer = setTimeout(() => { app.hintCells = null; render(); }, 2600);
  render();
  const arm = h.useBonus && !g.bonus.armed && M().bonus === 'cell' ? ' · ARM ×2' : '';
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
  return i >= 0 && E().isOrdinary(g, i) && !E().isBanked(g, i);
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

function onPointerDown(e) {
  if (app.busy || app.gesture) return;
  if (e.button != null && e.button !== 0) return;
  cacheRects();
  const cell = hitTest(e.clientX, e.clientY);
  if (cell < 0) return;
  app.gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, startCell: cell, mode: 'pending' };
  try { els.board.setPointerCapture(e.pointerId); } catch { /* not needed on all platforms */ }
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
  els.cells[gs.startCell].classList.remove('pressed');
  if (gs.mode === 'path') logEvent('path_cancelled', { path: app.path.slice() });
  clearPath();
  render();
}

// ---------- onboarding / help / settings / data ----------
function showOnboarding() {
  const mode = M();
  const ob = mode.onboard;
  $('onboardTitle').textContent = mode.name.toUpperCase();
  $('onboardLead').textContent = ob.lead;
  $('onboardNote').textContent = ob.note;
  const grid = $('demoGrid');
  grid.innerHTML = ob.demo.values.map((v, k) => `<i data-value="${v}"${ob.demo.path.includes(k) ? ' class="on"' : ''}></i>`).join('');
  const pt = (k) => [50 + (k % 3) * 100, 50 + Math.floor(k / 3) * 100];
  $('demoLine').setAttribute('points', ob.demo.path.map((k) => pt(k).join(',')).join(' '));
  $('demoLabel').textContent = ob.demo.label;
  const finger = $('demoFinger');
  if (app.demoAnim) app.demoAnim.cancel();
  if (!reduceMotion && typeof finger.animate === 'function') {
    const pts = ob.demo.path.map((k) => ({ left: `${((k % 3) + 0.5) * 100 / 3}%`, top: `${(Math.floor(k / 3) + 0.5) * 100 / 3 * (200 / 230)}%` }));
    const n = pts.length;
    const frames = [{ ...pts[0], opacity: 0, offset: 0 }, { ...pts[0], opacity: 1, offset: 0.12 }];
    for (let k = 1; k < n; k++) frames.push({ ...pts[k], opacity: 1, offset: 0.12 + (k / (n - 1)) * 0.6 });
    frames.push({ ...pts[n - 1], opacity: 0, offset: 0.88 }, { ...pts[n - 1], opacity: 0, offset: 1 });
    app.demoAnim = finger.animate(frames, { duration: 2800, iterations: Infinity, easing: 'ease-in-out' });
  }
  $('onboarding').hidden = false;
}

function renderScoreTable() {
  const rows = M().help.scoreRows(S().settings).map((r) => {
    const ex = r.example.map((f) => `<b>${f}</b>`).join('');
    return `<tr><td>${r.label}</td><td class="ex">${ex}</td><td class="num">${r.points}</td><td class="num">${(100 * r.odds).toFixed(1)}%</td></tr>`;
  });
  $('scoreTable').innerHTML = `<tr><th>HAND</th><th>EXAMPLE</th><th class="num">POINTS</th><th class="num">ODDS</th></tr>${rows.join('')}`;
}

function openHelp() {
  const st = S();
  const mode = M();
  $('helpTitle').textContent = `HOW TO PLAY · ${mode.name.toUpperCase()}`;
  $('helpLead').textContent = mode.help.lead;
  $('helpRules').innerHTML = mode.help.rules.map((r) => `<li>${r}</li>`).join('');
  $('helpScoreTitle').textContent = mode.help.scoreTitle;
  renderScoreTable();
  $('optHoldCap').checked = st.settings.maxHolds != null;
  $('optTableRow').hidden = !mode.help.options.table;
  $('optSmallRow').hidden = !mode.help.options.small;
  $('optEndRow').hidden = !mode.help.options.endOnTarget;
  if (mode.help.options.table) $('optTable').value = st.settings.scoreTable;
  if (mode.help.options.small) $('optSmall').checked = !!st.settings.smallStraight;
  if (mode.help.options.endOnTarget) $('optEndOnTarget').checked = !!st.settings.endOnTarget;
  $('optAutoBonus').checked = st.settings.autoBonusOnFinalHand;
  $('runInfo').textContent = `${mode.name} · run ${st.runSeed} · level ${st.levelIndex} · tier ${st.tier} · generator ${mode.generatorVersion} · ${st.log.length} events logged locally`;
  $('difficultyRule').textContent = DIFFICULTY_RULE_TEXT;
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
  board.addEventListener('lostpointercapture', (e) => { if (app.gesture && app.gesture.mode === 'path') onPointerCancel(e); });
  board.addEventListener('contextmenu', (e) => e.preventDefault());
  board.addEventListener('keydown', (e) => {
    const cell = e.target.closest && e.target.closest('.cell');
    if (!cell) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(Number(cell.dataset.index)); }
  });
  for (const btn of els.tabs) btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  els.rerollBtn.addEventListener('click', () => doReroll('button'));
  els.bankLastBtn.addEventListener('click', onBankLast);
  els.hintBtn.addEventListener('click', onHint);
  els.pathModeBtn.addEventListener('click', togglePathMode);
  els.undoBtn.addEventListener('click', () => { app.tapPath.pop(); render(); });
  els.bankTapBtn.addEventListener('click', () => attemptBank(app.tapPath.slice(), 'tap'));
  els.helpBtn.addEventListener('click', openHelp);
  $('bonusStatus').addEventListener('click', () => armBonus('badge'));
  $('closeHelpBtn').addEventListener('click', () => { $('help').hidden = true; });
  for (const id of ['optHoldCap', 'optTable', 'optSmall', 'optEndOnTarget', 'optAutoBonus']) $(id).addEventListener('change', applySettings);
  $('exportBtn').addEventListener('click', exportLog);
  $('resetBtn').addEventListener('click', resetProgress);
  $('nextBtn').addEventListener('click', onNext);
  $('retryBtn').addEventListener('click', onRetry);
  $('onboardStart').addEventListener('click', () => { S().onboarded = true; $('onboarding').hidden = true; logEvent('onboarded', { tutorial: true }); coachStart('onboarding'); });
  $('onboardSkip').addEventListener('click', () => { S().onboarded = true; S().coached = true; $('onboarding').hidden = true; logEvent('onboarded', { tutorial: false }); persist(); });
  $('coachSkip').addEventListener('click', () => coachStop('skipped'));
  $('tutorialBtn').addEventListener('click', () => { $('help').hidden = true; coachStart('help'); });
  window.addEventListener('keydown', (e) => {
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'r' || e.key === 'R') doReroll('key');
    if (e.key === 'h' || e.key === 'H') onHint();
    if (e.key === 'Escape') { $('help').hidden = true; clearPath(); render(); }
  });
  const refit = () => { fitBoard(); };
  window.addEventListener('resize', refit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', refit);
  if (typeof ResizeObserver === 'function') new ResizeObserver(refit).observe(els.boardWrap);
}

function init() {
  for (const id of ['board', 'boardWrap', 'preview', 'rerollBtn', 'bankLastBtn', 'hintBtn', 'pathModeBtn', 'helpBtn', 'tapbar', 'undoBtn', 'bankTapBtn', 'rerollPips', 'toast']) els[id] = $(id);
  els.tabs = Array.from(document.querySelectorAll('.tab'));
  buildBoard();
  bind();
  const saved = readJson(STORAGE_KEY);
  if (saved && saved.modes) {
    for (const id of Object.keys(MODES)) app.modes[id] = hydrateMode(id, saved.modes[id]);
    if (MODES[saved.activeMode]) app.modeId = saved.activeMode;
  } else {
    const legacy = readJson(LEGACY_KEY);
    if (legacy && legacy.runSeed) app.modes.snake4 = hydrateMode('snake4', legacy);
  }
  fitBoard();
  switchMode(app.modeId, { silent: true });
  requestAnimationFrame(fitBoard);
  window.__diceSnake = { app, version: APP_VERSION, state: () => S(), mode: () => M(), hint: () => E().hintFor(S().game), switchMode };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
