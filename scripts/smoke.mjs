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
  const g = window.__diceSnake.app.game;
  return { score: g.score, hands: g.hands.length, phase: g.phase, rerollsLeft: g.rerollsLeft, held: g.held, bankedMask: g.bankedMask, bonus: g.bonus, faces: g.faces, target: g.level.target, rejected: g.stats.rejectedPaths };
});

const browser = await chromium.launch();
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: vp.mobile, isMobile: vp.mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => note(vp, `pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') note(vp, `console ${m.text()}`); });
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

  // unsafe first hand (S shape 0-1-4-5) must be rejected with the explanation
  await swipe(page, [0, 1, 4, 5]);
  await page.waitForTimeout(100);
  const toastText = await page.$eval('#toast', (t) => (t.hidden ? '' : t.textContent));
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
  await ctx.close();
}
await browser.close();
if (problems.length) {
  console.error('SMOKE PROBLEMS:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('smoke OK');
