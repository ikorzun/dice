#!/usr/bin/env node
// Playwright smoke test for the built page: three phone viewports plus desktop. Exercises
// hold, swipe path (safe and unsafe), diagonal rejection, reroll, ×2, both banks and the
// level-end screen; captures screenshots to dist/shots and fails on console errors,
// horizontal overflow or controls outside the viewport.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // preinstalled globally in the cloud session
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = pathToFileURL(resolve('dist/index.html')).href;
const shots = resolve('dist/shots');
mkdirSync(shots, { recursive: true });
const viewports = [
  { w: 375, h: 812, mobile: true },
  { w: 390, h: 844, mobile: true },
  { w: 430, h: 932, mobile: true },
  { w: 1280, h: 800, mobile: false },
];
const problems = [];
const note = (vp, msg) => problems.push(`${vp.w}x${vp.h}: ${msg}`);

async function center(page, index) {
  return page.$eval(`#board .cell[data-index="${index}"]`, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}
async function swipe(page, cells) {
  const pts = [];
  for (const c of cells) pts.push(await center(page, c));
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (let i = 1; i < pts.length; i++) await page.mouse.move(pts[i].x, pts[i].y, { steps: 6 });
  await page.mouse.up();
}
async function tap(page, cell) {
  const p = await center(page, cell);
  await page.mouse.click(p.x, p.y);
}
const state = (page) => page.evaluate(() => {
  const g = window.__diceSnake.state().game;
  return { mode: window.__diceSnake.mode().id, score: g.score, hands: g.hands.length, handsLeft: g.handsLeft ?? null, phase: g.phase, rerollsLeft: g.rerollsLeft, held: g.held, bankedMask: g.bankedMask, bonus: g.bonus, faces: g.faces, target: g.level.target, rejected: g.stats.rejectedPaths };
});
const hintCells = (page) => page.evaluate(() => window.__diceSnake.hint().cells);
// A 3D throw (when the CDN is reachable) outlasts the CSS tumble: wait until the game is free again.
const idle = (page) => page.waitForFunction(() => !window.__diceSnake.app.busy, null, { timeout: 10000 });

const browser = await chromium.launch();
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: vp.mobile, isMobile: vp.mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => note(vp, `pageerror ${e.message}`));
  // Blocked CDN resources (fonts, three.js) are expected offline; everything else is a problem.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) note(vp, `console ${m.text()}`); });
  await page.goto(url);
  await page.waitForSelector('#board .cell');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-0-onboarding.png` });
  await page.click('#onboardStart');
  await page.waitForTimeout(150);
  const coachVisible = await page.$eval('#coach', (el) => !el.hidden);
  if (!coachVisible) note(vp, 'tutorial bar not shown after START TUTORIAL');
  const step1 = await page.$eval('#coachText', (el) => el.textContent);
  if (!/HOLD/.test(step1)) note(vp, `unexpected first tutorial step: ${step1}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-0b-tutorial-hold.png` });

  const layout = await page.evaluate(() => {
    const d = document.documentElement;
    const b = document.getElementById('board').getBoundingClientRect();
    const cell = document.querySelector('#board .cell').getBoundingClientRect();
    const reroll = document.getElementById('rerollBtn').getBoundingClientRect();
    const toolbar = document.querySelector('.toolbar').getBoundingClientRect();
    return { scrollW: d.scrollWidth, clientW: d.clientWidth, scrollH: d.scrollHeight, clientH: d.clientHeight, board: b.width, cell: cell.width, rerollBottom: reroll.bottom, toolbarBottom: toolbar.bottom };
  });
  if (layout.scrollW > layout.clientW) note(vp, `horizontal overflow ${layout.scrollW}>${layout.clientW}`);
  if (layout.toolbarBottom > vp.h + 0.5) note(vp, `toolbar below viewport (${layout.toolbarBottom.toFixed(0)} > ${vp.h})`);
  if (layout.cell < 44) note(vp, `cell too small (${layout.cell.toFixed(0)}px)`);
  console.log(`${vp.w}x${vp.h}: board ${layout.board.toFixed(0)}px, cell ${layout.cell.toFixed(0)}px, reroll bottom ${layout.rerollBottom.toFixed(0)}, toolbar bottom ${layout.toolbarBottom.toFixed(0)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-1-start.png` });
  await page.waitForTimeout(1500);
  const d3 = await page.evaluate(() => window.__diceSnake.dice3d());
  console.log(`${vp.w}x${vp.h}: 3D dice status ${d3}`);

  // hold / release (advances the tutorial to the reroll step)
  await tap(page, 0);
  let s = await state(page);
  if (!s.held[0]) note(vp, 'tap did not hold die 0');
  const step2 = await page.$eval('#coachText', (el) => el.textContent);
  if (!/REROLL/.test(step2)) note(vp, `tutorial did not advance to reroll: ${step2}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-2-hold.png` });
  await tap(page, 0);
  s = await state(page);
  if (s.held[0]) note(vp, 'second tap did not release die 0');
  // holding every die must trigger the "hold only protects" hint once
  for (let i = 0; i < 8; i++) await tap(page, i);
  const allHeldToast = await page.$eval('#toast', (t) => (t.hidden ? '' : t.textContent));
  if (!/press a die and drag/i.test(allHeldToast)) note(vp, `missing all-held hint, toast="${allHeldToast}"`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-2b-allheld.png` });
  for (let i = 0; i < 8; i++) await tap(page, i);
  s = await state(page);
  if (s.held.some(Boolean)) note(vp, 'dice still held after releasing all');

  // diagonal swipe must not create a path through the diagonal
  await swipe(page, [0, 4, 8]);
  await page.waitForTimeout(200);
  s = await state(page);
  if (s.hands !== 0) note(vp, 'diagonal swipe banked a hand');

  // unsafe first hand (S shape 0-1-4-5): while the finger is still down the cut-off dice are marked,
  // and on release the rejection names them
  {
    const pts = [];
    for (const c of [0, 1, 4, 5]) pts.push(await center(page, c));
    await page.mouse.move(pts[0].x, pts[0].y);
    await page.mouse.down();
    for (let i = 1; i < pts.length; i++) await page.mouse.move(pts[i].x, pts[i].y, { steps: 6 });
    const strandedNow = await page.$$eval('#board .cell.stranded', (els) => els.map((e) => e.dataset.index));
    if (strandedNow.join(',') !== '2') note(vp, `expected the top-right die to be marked cut off, got [${strandedNow}]`);
    const previewText = await page.$eval('#preview', (el) => el.textContent);
    if (!/CUTS OFF/.test(previewText)) note(vp, `preview does not name the cut-off die: ${previewText}`);
    await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-3a-stranded-preview.png` });
    await page.mouse.up();
  }
  await page.waitForTimeout(100);
  const toastText = await page.$eval('#toast', (t) => (t.hidden ? '' : t.textContent));
  if (!/would be cut off/.test(toastText)) note(vp, `rejection toast does not name the cut-off die: ${toastText}`);
  s = await state(page);
  if (s.hands !== 0) note(vp, 'unsafe path was banked');
  if (!/no valid second hand/i.test(toastText)) note(vp, `missing strand explanation, toast="${toastText}"`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-3-rejected.png` });

  // reroll with one die held
  await tap(page, 3);
  const before = (await state(page)).faces;
  await page.click('#rerollBtn');
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-4-rolling.png` });
  await page.waitForTimeout(1100);
  await idle(page);
  s = await state(page);
  if (s.rerollsLeft !== 1) note(vp, `rerollsLeft ${s.rerollsLeft} after one reroll`);
  const step3 = await page.$eval('#coachText', (el) => el.textContent);
  if (!/DRAG/.test(step3)) note(vp, `tutorial did not reach the swipe step: ${step3}`);
  const ghostOn = await page.$eval('#ghost', (el) => el.getAnimations().length > 0);
  if (!ghostOn) note(vp, 'ghost finger demo not animating on the swipe step');
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-4b-tutorial-swipe.png` });
  if (s.faces[3] !== before[3]) note(vp, 'held die changed on reroll');
  if (s.faces[8] !== null) note(vp, 'bonus cell got a face');

  // arm ×2 then bank a safe first hand by swipe (partial live preview on the way)
  await tap(page, 8);
  s = await state(page);
  if (!s.bonus.armed) note(vp, 'bonus did not arm');
  await swipe(page, [0, 1, 2, 5]);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-5-banking.png` });
  await page.waitForTimeout(800);
  s = await state(page);
  if (s.hands !== 1) note(vp, `first hand not banked (hands=${s.hands})`);
  if (s.bonus.available) note(vp, 'bonus not consumed on armed bank');
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-6-after-first.png` });

  // hint and second reroll, then bank the remaining four with the button
  await page.click('#hintBtn');
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-7-hint.png` });
  await page.click('#rerollBtn');
  await page.waitForTimeout(1200);
  await idle(page);
  s = await state(page);
  if (s.rerollsLeft !== 0) note(vp, `rerollsLeft ${s.rerollsLeft} after two rerolls`);
  const disabled = await page.$eval('#rerollBtn', (b) => b.disabled);
  if (!disabled) note(vp, 'reroll button enabled with zero rerolls');
  await page.click('#bankLastBtn');
  await page.waitForTimeout(900);
  s = await state(page);
  if (s.hands !== 2 || s.bankedMask !== 0b11111111) note(vp, `second hand not banked (hands=${s.hands}, mask=${s.bankedMask})`);
  if (!['won', 'lost'].includes(s.phase)) note(vp, `phase ${s.phase} after two hands`);
  await page.waitForTimeout(900);
  const endVisible = await page.$eval('#levelEnd', (el) => !el.hidden);
  if (!endVisible) note(vp, 'level-end overlay not shown');
  const coachGone = await page.$eval('#coach', (el) => el.hidden);
  if (!coachGone) note(vp, 'tutorial bar still visible after the level ended');
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-8-end.png` });
  console.log(`${vp.w}x${vp.h}: finished level with ${s.score}/${s.target} (${s.phase}), rejected paths ${s.rejected}`);

  // next level, then PATH mode tap flow and help sheet
  await page.click('#nextBtn');
  await page.waitForTimeout(200);
  await page.click('#pathModeBtn');
  for (const c of [0, 1, 2, 5]) await tap(page, c);
  const bankTapDisabled = await page.$eval('#bankTapBtn', (b) => b.disabled);
  if (bankTapDisabled) note(vp, 'tap path of four did not enable BANK PATH');
  await page.click('#undoBtn');
  await tap(page, 5);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-9-pathmode.png` });
  await page.click('#bankTapBtn');
  await page.waitForTimeout(900);
  s = await state(page);
  if (s.hands !== 1) note(vp, 'tap-mode bank failed');
  await page.click('#pathModeBtn');
  await page.click('#helpBtn');
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-10-help.png` });
  await page.click('#closeHelpBtn');

  // persistence: reload restores the in-progress level
  const beforeReload = await state(page);
  await page.reload();
  await page.waitForSelector('#board .cell');
  const after = await state(page);
  if (after.hands !== beforeReload.hands || JSON.stringify(after.faces) !== JSON.stringify(beforeReload.faces)) note(vp, 'state not restored after reload');

  // ---- Poker 5 tab ----
  await page.click('#tabPoker5');
  await page.waitForTimeout(200);
  const obVisible = await page.$eval('#onboarding', (el) => !el.hidden);
  if (!obVisible) note(vp, 'poker onboarding not shown on first visit');
  const demoLabel = await page.$eval('#demoLabel', (el) => el.textContent);
  if (!/FULL HOUSE/.test(demoLabel)) note(vp, `poker demo label: ${demoLabel}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-11-poker-onboarding.png` });
  await page.click('#onboardStart');
  await page.waitForTimeout(150);
  s = await state(page);
  if (s.mode !== 'poker5') note(vp, `mode after tab click: ${s.mode}`);
  const bonusCells = await page.$$eval('#board .cell.bonus', (els) => els.length);
  if (bonusCells !== 1) note(vp, `poker board has ${bonusCells} bonus cells, expected the gold ×2`);
  const dice = await page.$$eval('#board .cell.die', (els) => els.length);
  if (dice !== 8) note(vp, `poker board has ${dice} dice, expected 8`);
  const handsText = await page.$eval('#handsText', (el) => el.textContent);
  if (!/HAND 1 \/ 3/.test(handsText)) note(vp, `hands text: ${handsText}`);
  const pips = await page.$$eval('#rerollPips i', (els) => els.length);
  if (pips !== 2) note(vp, `poker shows ${pips} reroll pips`);
  const rerollLabel = await page.$eval('#rerollBtn', (b) => b.textContent);
  if (!/^REROLL \d/.test(rerollLabel)) note(vp, `reroll label without count: ${rerollLabel}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-12-poker-start.png` });
  await tap(page, 4);
  s = await state(page);
  if (!s.held[4]) note(vp, 'poker tap did not hold die 4');
  await page.click('#rerollBtn');
  await page.waitForTimeout(1200);
  await idle(page);
  s = await state(page);
  if (s.rerollsLeft !== 1) note(vp, `poker rerollsLeft ${s.rerollsLeft} after one reroll`);
  await tap(page, 8);
  s = await state(page);
  if (!s.bonus.armed) note(vp, 'tapping the gold cell did not arm x2 in poker');
  await page.click('#bonusStatus');
  s = await state(page);
  if (s.bonus.armed) note(vp, 'x2 badge did not disarm');
  await page.click('#bonusStatus');
  s = await state(page);
  if (!s.bonus.armed) note(vp, 'poker x2 badge did not arm');
  const hint1 = await hintCells(page);
  if (hint1.length !== 5) note(vp, `poker hint has ${hint1.length} cells`);
  await swipe(page, hint1);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-13-poker-banking.png` });
  await page.waitForTimeout(1500);
  s = await state(page);
  if (s.hands !== 1 || s.handsLeft !== 2) note(vp, `poker first hand: hands=${s.hands} left=${s.handsLeft}`);
  if (s.bonus.available) note(vp, 'poker x2 not consumed');
  const diceAfter = await page.$$eval('#board .cell.die', (els) => els.length);
  if (diceAfter !== 8) note(vp, `after refill ${diceAfter} dice`);
  const hiddenAfter = await page.$$eval('#board .cell.die', (els) => els.filter((e) => Number(getComputedStyle(e).opacity) < 0.9).map((e) => e.dataset.index));
  if (hiddenAfter.length) note(vp, `dice invisible after refill: [${hiddenAfter}]`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-14-poker-after-first.png` });
  for (let h = 0; h < 2; h++) {
    s = await state(page);
    if (s.phase !== 'playing') break; // end-on-target may finish the level early
    const hc = await hintCells(page);
    await swipe(page, hc);
    await page.waitForTimeout(1700);
  }
  s = await state(page);
  if (s.phase === 'playing') note(vp, `poker level still playing after three hands (hands=${s.hands}, left=${s.handsLeft})`);
  if (!['won', 'lost'].includes(s.phase)) note(vp, `poker phase ${s.phase}`);
  await page.waitForTimeout(900);
  const pokerEnd = await page.$eval('#levelEnd', (el) => !el.hidden);
  if (!pokerEnd) note(vp, 'poker level-end overlay not shown');
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-15-poker-end.png` });
  console.log(`${vp.w}x${vp.h}: poker level finished with ${s.score}/${s.target} (${s.phase})`);
  await page.click('#nextBtn');
  await page.waitForTimeout(200);
  const invisible = await page.$$eval('#board .cell.die', (els) => els.filter((e) => e.classList.contains('bank-pop') || Number(getComputedStyle(e).opacity) < 0.9).map((e) => e.dataset.index));
  if (invisible.length) note(vp, `dice invisible after a new level: [${invisible}]`);
  await page.click('#helpBtn');
  await page.waitForTimeout(100);
  const helpTitle = await page.$eval('#helpTitle', (el) => el.textContent);
  if (!/POKER 5/.test(helpTitle)) note(vp, `help title in poker mode: ${helpTitle}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-16-poker-help.png` });
  await page.click('#closeHelpBtn');
  await page.click('#tabSnake4');
  await page.waitForTimeout(200);
  const back = await state(page);
  if (back.mode !== 'snake4' || back.hands !== 1) note(vp, `snake state lost after tab switch (mode=${back.mode}, hands=${back.hands})`);
  await page.reload();
  await page.waitForSelector('#board .cell');
  const restored = await state(page);
  if (restored.mode !== 'snake4') note(vp, `active mode not restored after reload: ${restored.mode}`);
  await page.click('#tabPoker5');
  await page.waitForTimeout(200);
  const pokerRestored = await state(page);
  if (pokerRestored.mode !== 'poker5' || pokerRestored.hands !== 0 || pokerRestored.handsLeft !== 3) note(vp, `poker state not restored (hands=${pokerRestored.hands}, left=${pokerRestored.handsLeft})`);

  // ---- Auto Hand tab ----
  const auto = () => page.evaluate(() => {
    const g = window.__diceSnake.state().game;
    return { mode: window.__diceSnake.mode().id, cells: g.cells.map((c) => c.type), faces: g.faces, held: g.held, off: g.off, hands: g.hands.length, handsLeft: g.handsLeft, rerollsLeft: g.rerollsLeft, phase: g.phase, score: g.score, target: g.level.target, hand: window.__diceSnake.hint() };
  });
  await page.click('#tabAuto');
  await page.waitForTimeout(200);
  if (!(await page.$eval('#onboarding', (el) => !el.hidden))) note(vp, 'auto onboarding not shown on first visit');
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-17-auto-onboarding.png` });
  await page.click('#onboardStart');
  await page.waitForTimeout(150);
  let a = await auto(page);
  // tutorial step 1 points at a die outside the hand: held dice survive the hand
  const holdText = await page.$eval('#coachText', (el) => el.textContent);
  if (!/SURVIVE/.test(holdText)) note(vp, `auto tutorial hold step: ${holdText}`);
  const coachTarget = await page.$$eval('#board .cell.hint', (els) => els.map((e) => Number(e.dataset.index)));
  if (coachTarget.length !== 1 || a.hand.cells.includes(coachTarget[0])) note(vp, `auto tutorial hold target [${coachTarget}] should be one die outside the hand [${a.hand.cells}]`);
  if (a.mode !== 'auto') note(vp, `mode after auto tab click: ${a.mode}`);
  if (a.cells.filter((t) => t === 'die').length !== 8 || a.cells[8] !== 'bonus') note(vp, `auto level 1 layout: ${a.cells}`);
  const red = await page.$$eval('#board .cell.in-hand', (els) => els.map((e) => Number(e.dataset.index)));
  if (red.join(',') !== a.hand.cells.join(',')) note(vp, `red dice [${red}] differ from the hand [${a.hand.cells}]`);
  const pipColors = await page.evaluate(() => [
    getComputedStyle(document.querySelector('#board .cell.in-hand .face i')).backgroundColor,
    getComputedStyle(document.querySelector('#board .cell.die:not(.in-hand) .face i')).backgroundColor,
  ]);
  if (pipColors[0] === pipColors[1]) note(vp, `hand dots are not red (${pipColors[0]})`);
  // with 3D on, resting dice are pictures of the model: the hand's dice use the red-pip pictures
  const handPictures = await page.$$eval('#board .cell.in-hand', (els) => els.map((e) => e.style.getPropertyValue('--die-img')));
  if (handPictures.some((v) => !/-hand\)$/.test(v))) note(vp, `hand dice without the red-pip picture: ${handPictures}`);
  const autoLayout = await page.evaluate(() => ({ toolbar: document.querySelector('.toolbar').getBoundingClientRect().bottom, play: document.getElementById('playBtn').getBoundingClientRect().height, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
  if (autoLayout.toolbar > vp.h + 0.5) note(vp, `auto toolbar below viewport (${autoLayout.toolbar.toFixed(0)} > ${vp.h})`);
  if (autoLayout.play < 40) note(vp, 'PLAY HAND button not shown');
  if (autoLayout.scrollW > autoLayout.clientW) note(vp, `auto horizontal overflow ${autoLayout.scrollW}>${autoLayout.clientW}`);
  // REROLL and PLAY HAND live in different zones: a mistaken PLAY burns a hand
  const zoneGap = await page.evaluate(() => document.getElementById('playBtn').getBoundingClientRect().top - document.getElementById('rerollBtn').getBoundingClientRect().bottom);
  if (zoneGap < 40) note(vp, `REROLL and PLAY HAND too close (${zoneGap.toFixed(0)}px)`);
  const scoringText = await page.$eval('#onboardScoring', (el) => el.textContent);
  if (!/straight × 8/.test(scoringText)) note(vp, `auto scoring text does not say straight × 8: ${scoringText}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-18-auto-start.png` });
  // dragging does not play a hand
  await swipe(page, a.hand.cells.slice(0, 3));
  await page.waitForTimeout(200);
  if ((await auto(page)).hands !== 0) note(vp, 'a drag played an auto hand');
  // hold a die outside the hand; reroll keeps it and the bonus
  const keep = coachTarget[0] ?? a.cells.findIndex((t, i) => t === 'die' && !a.hand.cells.includes(i));
  await tap(page, keep);
  if (!/REROLL/.test(await page.$eval('#coachText', (el) => el.textContent))) note(vp, 'auto tutorial did not advance to the reroll step');
  const keptFace = a.faces[keep];
  await page.click('#rerollBtn');
  await page.waitForTimeout(1200);
  await idle(page);
  a = await auto(page);
  if (!a.held[keep] || a.faces[keep] !== keptFace) note(vp, 'auto reroll changed the held die');
  if (a.rerollsLeft !== 2 || a.cells[8] !== 'bonus') note(vp, `auto reroll: left=${a.rerollsLeft}, cell 8=${a.cells[8]}`);
  // bonus dice start off: the tutorial asks to switch the ×2 on first, then to play
  if (!a.off[8]) note(vp, 'the ×2 does not start switched off');
  const switchStep = await page.$eval('#coachText', (el) => el.textContent);
  if (!/SWITCH IT ON/.test(switchStep)) note(vp, `auto tutorial does not ask to switch the ×2 on: "${switchStep}"`);
  await tap(page, 8);
  if ((await auto(page)).off[8]) note(vp, 'tapping the bonus did not switch it on');
  const playPulse = await page.$eval('#playBtn', (b) => b.classList.contains('pulse'));
  const playStep = await page.$eval('#coachText', (el) => el.textContent);
  if (!playPulse || !/PRESS PLAY/.test(playStep)) note(vp, `auto tutorial play step: pulse=${playPulse}, "${playStep}"`);
  // off again keeps it for later, on again uses it
  await tap(page, 8);
  if (!(await auto(page)).off[8]) note(vp, 'tapping the bonus again did not switch it off');
  await tap(page, 8);
  a = await auto(page);
  if (a.off[8]) note(vp, 'tapping the bonus a third time did not switch it on');
  const keepInHand = a.hand.cells.includes(keep);
  await page.click('#playBtn');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-19-auto-playing.png` });
  await page.waitForTimeout(1500);
  await idle(page);
  const b = await auto(page);
  if (b.hands !== 1 || b.handsLeft !== 2) note(vp, `auto first hand: hands=${b.hands} left=${b.handsLeft}`);
  if (b.cells[8] !== 'hole') note(vp, `the ×2 did not leave a hole (cell 8=${b.cells[8]})`);
  if (!keepInHand && (!b.held[keep] || b.faces[keep] !== a.faces[keep])) note(vp, 'held die outside the hand did not survive the hand');
  const autoHidden = await page.$$eval('#board .cell.die', (els) => els.filter((e) => Number(getComputedStyle(e).opacity) < 0.9).map((e) => e.dataset.index));
  if (autoHidden.length) note(vp, `auto dice invisible after the hand: [${autoHidden}]`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-20-auto-after-first.png` });
  for (let h = 0; h < 2; h++) {
    await page.click('#playBtn');
    await page.waitForTimeout(1700);
    await idle(page);
  }
  a = await auto(page);
  if (!['won', 'lost'].includes(a.phase) || a.hands !== 3) note(vp, `auto level after three hands: phase=${a.phase}, hands=${a.hands}`);
  await page.waitForTimeout(900);
  if (!(await page.$eval('#levelEnd', (el) => !el.hidden))) note(vp, 'auto level-end overlay not shown');
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-21-auto-end.png` });
  console.log(`${vp.w}x${vp.h}: auto level finished with ${a.score}/${a.target} (${a.phase})`);
  await page.click('#nextBtn');
  await page.waitForTimeout(200);
  a = await auto(page);
  if (a.cells.filter((t) => t === 'die').length < 6) note(vp, `auto level 2 has ${a.cells.filter((t) => t === 'die').length} dice`);
  const intro = await page.$eval('#toast', (t) => (t.hidden ? '' : t.textContent));
  if (!/NEW BONUS/.test(intro)) note(vp, `auto level 2 does not introduce its new bonus, toast="${intro}"`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-22-auto-level2.png` });
  await page.click('#helpBtn');
  await page.waitForTimeout(100);
  if (!/AUTO HAND/.test(await page.$eval('#helpTitle', (el) => el.textContent))) note(vp, 'help title in auto mode');
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-23-auto-help.png` });
  await page.click('#closeHelpBtn');
  await page.click('#tabPoker5');
  await page.waitForTimeout(150);
  // visual concepts: screenshot both tabs in every look (phone only)
  if (vp.w === 390) {
    for (const look of ['manuscript', 'tavern', 'keep', 'modern']) {
      await page.evaluate((id) => window.__diceSnake.setLook(id), look);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${shots}/look-${look}-poker.png` });
      await page.click('#tabSnake4');
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${shots}/look-${look}-snake.png` });
      await page.click('#tabPoker5');
      await page.waitForTimeout(150);
    }
    const bodyLook = await page.evaluate(() => document.body.dataset.look);
    if (bodyLook !== 'modern') note(vp, `look did not reset to modern: ${bodyLook}`);
  }
  await ctx.close();
}
await browser.close();
if (problems.length) {
  console.error('SMOKE PROBLEMS:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('smoke OK');
