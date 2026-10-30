// Dice Snake 3×3 — portrait mobile UI. All rules live in ../engine; this file only renders
// state, interprets pointer gestures, plays effects and keeps a local event log.

import { createRng } from '../engine/rng.js';
import { CATEGORY_LABELS, CATEGORY_ORDER, CATEGORY_OUTCOMES, SCORE_TABLES } from '../engine/scoring.js';
import { areAdjacent, rowOf, colOf, orderedPathsOf } from '../engine/geometry.js';
import {
  createGame, toggleHold, reroll, toggleBonus, previewPath, bankPath, hintFor, markHintUsed,
  remainingCells, canReroll, snapshotGame, restoreGame, isOrdinary, isBanked,
} from '../engine/game.js';
import { generateLevel, nextTier, DIFFICULTY_RULE_TEXT, GENERATOR_VERSION } from '../engine/levels.js';

const APP_VERSION = '0.1.0';
const STORAGE_KEY = 'dice-snake-3x3.v1';
const TAP_THRESHOLD = 10; // CSS px of movement before a press becomes a path
const CORE_INSET = 0.18; // path hit region = central 64% of a cell (no corner cutting)
const LOG_LIMIT = 4000;
const SVG_NS = 'http://www.w3.org/2000/svg';

const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = reduceMotion
  ? { roll: 0, rollSwap: 0, stagger: 0, bank: 60, reveal: 0, endDelay: 120, flash: 900 }
  : { roll: 640, rollSwap: 300, stagger: 45, bank: 560, reveal: 950, endDelay: 700, flash: 1400 };

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const els = { cells: [] };

const app = {
  runSeed: null,
  levelIndex: 1,
  tier: 1,
  settings: { maxHolds: null, scoreTable: 'spec_v03', autoBonusOnFinalHand: true, pathMode: false },
  onboarded: false,
  game: null,
  rerollRng: null,
  levelStartedAt: 0,
  firstHandAt: null,
  log: [],
  levels: [],
  busy: false,
  path: [],
  tapPath: [],
  hintCells: null,
  hintTimer: null,
  cellRects: null,
  safeNext: null,
  gesture: null,
  toastTimer: null,
  pendingTier: null,
};

// ---------- persistence ----------
function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist() {
  const data = {
    version: APP_VERSION,
    runSeed: app.runSeed,
    levelIndex: app.levelIndex,
    tier: app.tier,
    settings: app.settings,
    onboarded: app.onboarded,
    game: app.game ? snapshotGame(app.game) : null,
    log: app.log.slice(-LOG_LIMIT),
    levels: app.levels.slice(-200),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: the game still works for this session */
  }
}

function logEvent(type, data = {}) {
  app.log.push({ t: Date.now(), dt: app.levelStartedAt ? Date.now() - app.levelStartedAt : 0, level: app.levelIndex, type, ...data });
  if (app.log.length > LOG_LIMIT) app.log.splice(0, app.log.length - LOG_LIMIT);
}

// ---------- level lifecycle ----------
function gameConfig() {
  return { maxHolds: app.settings.maxHolds, scoreTable: app.settings.scoreTable, autoBonusOnFinalHand: app.settings.autoBonusOnFinalHand };
}

function startGame(level, attempt) {
  app.game = createGame(level, gameConfig(), attempt);
  app.rerollRng = createRng(`${level.seed}/rerolls/attempt${attempt}`);
  app.levelStartedAt = Date.now();
  app.firstHandAt = null;
  app.path = [];
  app.tapPath = [];
  app.hintCells = null;
  app.pendingTier = null;
  logEvent('level_start', {
    seed: level.seed, levelIndex: level.levelIndex, tier: level.tier, target: level.target, faces: level.faces, attempt,
    bestNoReroll: level.bestNoReroll, bestNoRerollWithBonus: level.bestNoRerollWithBonus, config: gameConfig(),
  });
  $('levelEnd').hidden = true;
  render();
  persist();
}

function newLevel() {
  const level = generateLevel({ runSeed: app.runSeed, levelIndex: app.levelIndex, tier: app.tier, scoreTable: app.settings.scoreTable });
  startGame(level, 1);
}

function finishLevel() {
  const g = app.game;
  const won = g.phase === 'won';
  const now = Date.now();
  const summary = {
    levelIndex: g.level.levelIndex, seed: g.level.seed, tier: g.level.tier, target: g.level.target, score: g.score, won, attempt: g.attempt,
    durationMs: now - app.levelStartedAt, timeToFirstHandMs: app.firstHandAt ? app.firstHandAt - app.levelStartedAt : null,
    hintsUsed: g.stats.hintsUsed, rejectedPaths: g.stats.rejectedPaths, rerollsUsed: g.stats.rerollsUsed, holdToggles: g.stats.holdToggles,
    categories: g.hands.map((h) => h.category), bonusOnHand: g.bonus.usedOnHand, bonusAuto: g.bonus.autoApplied,
    solverNoReroll: g.level.bestNoRerollWithBonus, gapToSolver: g.level.bestNoRerollWithBonus - g.score,
  };
  app.levels.push(summary);
  logEvent('level_end', summary);
  app.pendingTier = nextTier(app.tier, won);
  persist();

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
  $('endBonus').textContent = used
    ? `×2 ${used.bonusAuto ? 'auto-applied to' : 'used on'} hand ${used.index + 1} (${used.points} → ${used.total})`
    : '×2 was not used';
  $('endSolver').textContent = `Best possible on the opening roll (no rerolls, with ×2): ${g.level.bestNoRerollWithBonus}`;
  $('endTier').textContent = app.pendingTier === app.tier
    ? `Rule-based difficulty: stays at tier ${app.tier} / 5`
    : `Rule-based difficulty: tier ${app.tier} → ${app.pendingTier} / 5`;
  $('nextBtn').textContent = won ? 'NEXT LEVEL' : 'NEXT LEVEL (EASIER)';
  setTimeout(() => { $('levelEnd').hidden = false; }, T.endDelay);
}

function onNext() {
  if (app.pendingTier != null) app.tier = app.pendingTier;
  app.levelIndex += 1;
  newLevel();
}

function onRetry() {
  logEvent('retry', { attempt: app.game.attempt + 1 });
  startGame(app.game.level, app.game.attempt + 1);
}

// ---------- rendering ----------
function currentPath() {
  return app.settings.pathMode ? app.tapPath : app.path;
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
}

function fitBoard() {
  const wrap = els.boardWrap;
  const size = Math.max(120, Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight)));
  els.board.style.setProperty('--board', `${size}px`);
  app.cellRects = null;
}

function renderCell(i) {
  const g = app.game;
  const cell = els.cells[i];
  const path = currentPath();
  const face = cell.querySelector('.face');
  const tag = cell.querySelector('.tag');
  const order = cell.querySelector('.order');
  cell.className = 'cell';
  if (!isOrdinary(g, i)) {
    cell.classList.add('bonus');
    if (!g.bonus.available) cell.classList.add('used');
    else if (g.bonus.armed) cell.classList.add('armed');
    tag.textContent = !g.bonus.available ? 'USED' : g.bonus.armed ? 'ARMED' : 'READY';
    cell.setAttribute('aria-label', `×2 bonus, ${tag.textContent.toLowerCase()}`);
    return;
  }
  if (isBanked(g, i)) {
    cell.classList.add('empty');
    cell.setAttribute('aria-label', 'Banked');
    tag.textContent = '';
    return;
  }
  cell.classList.add('die');
  face.dataset.value = String(g.faces[i]);
  tag.textContent = 'HOLD';
  if (g.held[i]) cell.classList.add('held');
  const k = path.indexOf(i);
  if (k >= 0) {
    cell.classList.add('in-path');
    order.textContent = String(k + 1);
  }
  if (app.hintCells && app.hintCells.includes(i)) cell.classList.add('hint');
  if (k < 0 && app.safeNext && app.safeNext.includes(i)) cell.classList.add('safe-next');
  cell.setAttribute('aria-label', `Die ${g.faces[i]}${g.held[i] ? ', held' : ''}`);
}

// While the first hand is three dice long, mark which fourth dice keep a legal second hand.
function computeSafeNext() {
  const g = app.game;
  const path = currentPath();
  if (g.phase !== 'playing' || g.hands.length !== 0 || path.length !== 3) return null;
  const last = path[path.length - 1];
  let mask = 0;
  for (const c of path) mask |= 1 << c;
  return g.geometry.free.filter((i) => !path.includes(i) && !isBanked(g, i) && areAdjacent(last, i) && g.geometry.safeSet.has(mask | (1 << i)));
}

function renderHud() {
  const g = app.game;
  $('score').textContent = String(g.score);
  $('target').textContent = String(g.level.target);
  $('levelText').textContent = `LEVEL ${g.level.levelIndex}${g.attempt > 1 ? ` · TRY ${g.attempt}` : ''}`;
  $('tierText').textContent = `TIER ${g.level.tier} / 5 · RULE-BASED`;
}

function renderControls() {
  const g = app.game;
  const pips = els.rerollPips.querySelectorAll('i');
  pips.forEach((p, k) => p.classList.toggle('on', k < g.rerollsLeft));
  $('rerollText').textContent = g.rerollsLeft === 1 ? 'REROLL LEFT' : 'REROLLS LEFT';
  const bs = $('bonusStatus');
  bs.className = 'bonus-status';
  if (!g.bonus.available) bs.textContent = `×2 USED ON HAND ${g.bonus.usedOnHand + 1}`;
  else if (g.bonus.armed) { bs.textContent = '×2 ARMED FOR NEXT HAND'; bs.classList.add('armed'); }
  else { bs.textContent = '×2 READY · TAP GOLD'; bs.classList.add('ready'); }
  const playing = g.phase === 'playing';
  els.rerollBtn.disabled = app.busy || !canReroll(g);
  els.rerollBtn.textContent = g.rerollsLeft > 0 ? 'REROLL' : 'NO REROLLS LEFT';
  els.bankLastBtn.hidden = !(playing && g.hands.length === 1);
  els.bankLastBtn.disabled = app.busy;
  els.tapbar.hidden = !app.settings.pathMode || !playing;
  els.undoBtn.disabled = app.tapPath.length === 0;
  els.bankTapBtn.disabled = app.busy || app.tapPath.length !== 4;
  els.pathModeBtn.classList.toggle('on', app.settings.pathMode);
  els.pathModeBtn.setAttribute('aria-pressed', String(app.settings.pathMode));
  els.hintBtn.disabled = app.busy || !playing;
}

function cellCenter(i) {
  return [50 + colOf(i) * 100, 50 + rowOf(i) * 100];
}

function renderPath() {
  const path = currentPath();
  $('pathLine').setAttribute('points', path.length > 1 ? path.map((i) => cellCenter(i).join(',')).join(' ') : '');
  const hint = app.hintCells;
  $('hintLine').setAttribute('points', hint && hint.length > 1 ? hint.map((i) => cellCenter(i).join(',')).join(' ') : '');
}

function setPreview(text, mood = '') {
  const el = els.preview;
  el.textContent = text;
  el.className = `preview ${mood}`;
}

function renderPreview() {
  const g = app.game;
  if (app.hintCells) return;
  if (g.phase !== 'playing') { setPreview(g.phase === 'won' ? 'LEVEL CLEARED' : 'TARGET MISSED', g.phase === 'won' ? 'good' : 'bad'); return; }
  const path = currentPath();
  if (path.length === 0) {
    if (app.settings.pathMode) setPreview(g.hands.length === 0 ? 'Tap 4 connected dice in order' : 'Tap the last 4 dice in order');
    else setPreview(g.hands.length === 0 ? 'Swipe 4 connected dice · tap to hold' : 'Swipe the last 4 dice');
    return;
  }
  const p = previewPath(g, path);
  if (!p.ok) { setPreview(p.message, 'bad'); return; }
  if (p.partial) { setPreview(`${p.count} / 4`); return; }
  const mult = p.multiplier > 1 ? ` (${p.hand.points} ×${p.multiplier})` : '';
  if (!p.safe) setPreview(`${p.hand.label} ${p.total} · ${p.safetyMessage.replace(/\.$/, '')}`, 'bad');
  else setPreview(`${p.hand.label} +${p.total}${mult}${p.autoBonus ? ' · ×2 AUTO' : ''}`, 'good');
}

function render() {
  app.safeNext = computeSafeNext();
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
function onTap(i) {
  const g = app.game;
  if (app.busy || g.phase !== 'playing') return;
  if (!isOrdinary(g, i)) {
    const r = toggleBonus(g);
    if (!r.ok) { toast(r.message, 'bad'); return; }
    app.game = r.state;
    pressFeedback(i);
    haptic(10);
    logEvent('bonus', { armed: r.armed });
    render();
    persist();
    return;
  }
  if (isBanked(g, i)) return;
  if (app.settings.pathMode) { tapPathAdd(i); return; }
  const r = toggleHold(g, i);
  if (!r.ok) { toast(r.message, 'bad'); shakeCells([i]); return; }
  app.game = r.state;
  pressFeedback(i);
  haptic(r.held ? 12 : 6);
  logEvent('hold', { cell: i, held: r.held });
  render();
  persist();
}

function tapPathAdd(i) {
  const p = app.tapPath;
  const last = p[p.length - 1];
  if (i === last) { p.pop(); render(); return; }
  if (p.includes(i)) { toast('Each die once per hand', 'bad'); return; }
  if (p.length >= 4) { toast('A hand has four dice', 'bad'); return; }
  if (p.length > 0 && !areAdjacent(last, i)) { toast('Dice must touch edge to edge', 'bad'); shakeCells([i]); return; }
  p.push(i);
  pressFeedback(i);
  haptic(8);
  render();
}

async function doReroll(source) {
  const g = app.game;
  if (app.busy) return;
  const r = reroll(g, () => app.rerollRng.die());
  if (!r.ok) { toast(r.message, 'bad'); return; }
  app.game = r.state;
  logEvent('reroll', { source, rolled: r.rolled, held: g.geometry.free.filter((i) => g.held[i]), left: app.game.rerollsLeft });
  app.busy = true;
  clearPath();
  renderControls();
  haptic(8);
  r.rolled.forEach((i, k) => {
    const c = els.cells[i];
    c.style.setProperty('--delay', `${k * T.stagger}ms`);
    c.classList.add('rolling');
    setTimeout(() => { c.querySelector('.face').dataset.value = String(app.game.faces[i]); }, T.rollSwap + k * T.stagger);
  });
  await wait(T.roll + T.stagger * Math.max(0, r.rolled.length - 1));
  r.rolled.forEach((i) => els.cells[i].classList.remove('rolling'));
  app.busy = false;
  render();
  persist();
}

async function attemptBank(path, source) {
  if (app.busy) return;
  const g = app.game;
  const r = bankPath(g, path);
  app.game = r.state;
  if (!r.ok) {
    logEvent('path_rejected', { source, code: r.code, path });
    toast(r.message, 'bad');
    shakeCells(path);
    if (r.code === 'STRANDS') {
      const h = hintFor(app.game);
      if (h) flashCells(h.cells, 'safe-hint', T.flash);
    }
    clearPath();
    render();
    persist();
    return;
  }
  const hand = r.hand;
  if (hand.index === 0) app.firstHandAt = Date.now();
  logEvent('bank', { source, hand: hand.index, cells: hand.cells, faces: hand.faces, category: hand.category, points: hand.points, multiplier: hand.multiplier, total: hand.total, auto: hand.bonusAuto });
  app.busy = true;
  app.hintCells = null;
  clearPath();
  haptic(hand.points >= 10 ? [14, 40, 18] : 12);
  showReveal(hand);
  hand.cells.forEach((i) => els.cells[i].classList.add('bank-pop'));
  renderHud();
  renderControls();
  renderPath();
  setPreview(`${hand.label} +${hand.total}`, 'good');
  await wait(T.bank);
  app.busy = false;
  render();
  persist();
  if (app.game.phase !== 'playing') finishLevel();
}

function clearPath() {
  app.path = [];
  app.tapPath = [];
}

function onHint() {
  const g = app.game;
  if (app.busy || g.phase !== 'playing') return;
  const h = hintFor(g);
  if (!h) return;
  app.game = markHintUsed(g);
  logEvent('hint', { cells: h.cells, category: h.hand.category, useBonus: h.useBonus, projected: h.projected });
  app.hintCells = h.cells;
  clearTimeout(app.hintTimer);
  app.hintTimer = setTimeout(() => { app.hintCells = null; render(); }, 2600);
  render();
  const arm = h.useBonus && !g.bonus.armed ? ' · ARM ×2' : '';
  setPreview(`HINT · ${h.hand.label} ${h.hand.points}${arm} → ${h.projected}`, 'hint');
  persist();
}

function onBankLast() {
  const g = app.game;
  if (app.busy || g.phase !== 'playing' || g.hands.length !== 1) return;
  const cells = remainingCells(g);
  const paths = orderedPathsOf(cells);
  if (!paths.length) { toast('No path through the remaining dice', 'bad'); return; }
  attemptBank(paths[0], 'button');
}

function togglePathMode() {
  app.settings.pathMode = !app.settings.pathMode;
  clearPath();
  logEvent('path_mode', { on: app.settings.pathMode });
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
  return i >= 0 && isOrdinary(app.game, i) && !isBanked(app.game, i);
}

// Extends the swipe path with a sampled cell: adjacent step, retrace (undo), or an
// unambiguous straight jump over one skipped cell. Diagonal jumps are ignored.
function extendPath(path, cell) {
  if (!canUseInPath(cell)) return false;
  const last = path[path.length - 1];
  if (cell === last) return false;
  if (path.length >= 2 && cell === path[path.length - 2]) { path.pop(); return true; }
  if (path.includes(cell)) return false;
  if (path.length >= 4) return false;
  if (areAdjacent(last, cell)) { path.push(cell); return true; }
  const dr = rowOf(cell) - rowOf(last);
  const dc = colOf(cell) - colOf(last);
  if ((Math.abs(dr) === 2 && dc === 0) || (Math.abs(dc) === 2 && dr === 0)) {
    const mid = last + (dr / 2) * 3 + dc / 2;
    if (canUseInPath(mid) && !path.includes(mid) && path.length <= 2) { path.push(mid, cell); return true; }
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
  if (isOrdinary(app.game, cell) && !isBanked(app.game, cell)) els.cells[cell].classList.add('pressed');
  e.preventDefault();
}

function onPointerMove(e) {
  const gs = app.gesture;
  if (!gs || e.pointerId !== gs.id) return;
  if (gs.mode === 'pending') {
    const dist = Math.hypot(e.clientX - gs.x, e.clientY - gs.y);
    if (dist < TAP_THRESHOLD) return;
    els.cells[gs.startCell].classList.remove('pressed');
    const g = app.game;
    if (app.settings.pathMode || g.phase !== 'playing' || !canUseInPath(gs.startCell)) { gs.mode = 'dead'; return; }
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
  if (path.length === 4) { attemptBank(path, 'swipe'); return; }
  if (path.length >= 2) { logEvent('path_abandoned', { path }); toast('Trace four connected dice'); }
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

// ---------- help / settings / data ----------
function renderScoreTable() {
  const table = SCORE_TABLES[app.settings.scoreTable];
  const examples = { four_kind: [2, 2, 2, 2], straight: [1, 2, 3, 4], three_kind: [4, 4, 4, 1], two_pairs: [1, 1, 6, 6], pair: [1, 1, 3, 6], high: [1, 2, 4, 6] };
  const rows = CATEGORY_ORDER.map((cat) => {
    const ex = examples[cat].map((f) => `<b>${f}</b>`).join('');
    return `<tr><td>${CATEGORY_LABELS[cat]}</td><td class="ex">${ex}</td><td class="num">${table[cat]}</td><td class="num">${(100 * CATEGORY_OUTCOMES[cat] / 1296).toFixed(1)}%</td></tr>`;
  });
  $('scoreTable').innerHTML = `<tr><th>HAND</th><th>EXAMPLE</th><th class="num">POINTS</th><th class="num">ODDS</th></tr>${rows.join('')}`;
}

function openHelp() {
  renderScoreTable();
  $('optHoldCap').checked = app.settings.maxHolds != null;
  $('optTable').value = app.settings.scoreTable;
  $('optAutoBonus').checked = app.settings.autoBonusOnFinalHand;
  $('runInfo').textContent = `Run ${app.runSeed} · level ${app.levelIndex} · tier ${app.tier} · generator ${GENERATOR_VERSION} · ${app.log.length} events logged locally`;
  $('difficultyRule').textContent = DIFFICULTY_RULE_TEXT;
  $('logOut').hidden = true;
  $('help').hidden = false;
}

function applySettings() {
  app.settings.maxHolds = $('optHoldCap').checked ? 3 : null;
  app.settings.scoreTable = $('optTable').value;
  app.settings.autoBonusOnFinalHand = $('optAutoBonus').checked;
  logEvent('settings', { ...app.settings });
  persist();
}

async function exportLog() {
  const payload = { app: APP_VERSION, generator: GENERATOR_VERSION, exportedAt: new Date().toISOString(), runSeed: app.runSeed, settings: app.settings, levels: app.levels, events: app.log };
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
  app.runSeed = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  app.levelIndex = 1;
  app.tier = 1;
  app.log = [];
  app.levels = [];
  $('help').hidden = true;
  newLevel();
  toast('Progress reset', 'good');
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
  els.rerollBtn.addEventListener('click', () => doReroll('button'));
  els.bankLastBtn.addEventListener('click', onBankLast);
  els.hintBtn.addEventListener('click', onHint);
  els.pathModeBtn.addEventListener('click', togglePathMode);
  els.undoBtn.addEventListener('click', () => { app.tapPath.pop(); render(); });
  els.bankTapBtn.addEventListener('click', () => attemptBank(app.tapPath.slice(), 'tap'));
  els.helpBtn.addEventListener('click', openHelp);
  $('closeHelpBtn').addEventListener('click', () => { $('help').hidden = true; });
  $('optHoldCap').addEventListener('change', applySettings);
  $('optTable').addEventListener('change', applySettings);
  $('optAutoBonus').addEventListener('change', applySettings);
  $('exportBtn').addEventListener('click', exportLog);
  $('resetBtn').addEventListener('click', resetProgress);
  $('nextBtn').addEventListener('click', onNext);
  $('retryBtn').addEventListener('click', onRetry);
  $('onboardOk').addEventListener('click', () => { app.onboarded = true; $('onboarding').hidden = true; logEvent('onboarded'); persist(); });
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
  buildBoard();
  bind();
  const saved = readStorage();
  if (saved && saved.version === APP_VERSION) {
    app.runSeed = saved.runSeed || null;
    app.levelIndex = saved.levelIndex || 1;
    app.tier = saved.tier || 1;
    app.settings = { ...app.settings, ...(saved.settings || {}) };
    app.onboarded = !!saved.onboarded;
    app.log = Array.isArray(saved.log) ? saved.log : [];
    app.levels = Array.isArray(saved.levels) ? saved.levels : [];
    if (saved.game && saved.game.phase === 'playing') {
      try {
        app.game = restoreGame(saved.game);
        app.rerollRng = createRng(`${saved.game.level.seed}/rerolls/attempt${saved.game.attempt}/resume${app.log.length}`);
        app.levelStartedAt = Date.now();
        logEvent('level_resume', { seed: saved.game.level.seed });
      } catch {
        app.game = null;
      }
    }
  }
  if (!app.runSeed) app.runSeed = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  fitBoard();
  if (!app.game) newLevel();
  else render();
  if (!app.onboarded) $('onboarding').hidden = false;
  requestAnimationFrame(fitBoard);
  window.__diceSnake = { app, version: APP_VERSION };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
