#!/usr/bin/env node
// Playwright smoke test for the built page: three phone viewports plus desktop. The screen is the
// owner's Figma mockup (Auto Hand only): the title and guide, the tutorial, hold (lime), reroll, a bonus
// switched on, the bonus screen and SKIP, three hands, the level end, LEVEL n/25 and the help
// sheet; captures screenshots to dist/shots and fails on console errors, horizontal overflow or
// controls outside the viewport.
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
async function swipe(page, cells) { // a drag must not play anything in Auto Hand
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
  const auto = () => page.evaluate(() => {
    const g = window.__diceSnake.state().game;
    return { mode: window.__diceSnake.mode().id, cells: g.cells.map((c) => c.type), faces: g.faces, held: g.held, off: g.off, hands: g.hands.length, handsLeft: g.handsLeft, rerollsLeft: g.rerollsLeft, phase: g.phase, score: g.score, target: g.level.target, level: g.level.levelIndex, hand: window.__diceSnake.hint() };
  });
  const text = (sel) => page.$eval(sel, (el) => el.textContent);
  // the first visit: the title, then three pages, combinations first; no page scrolls
  if (!(await page.$eval('#guide', (el) => !el.hidden))) note(vp, 'the first screen is not shown on the first visit');
  const name = await page.$eval('#gameName', (e) => e.textContent.replace(/\s+/g, ' ').trim());
  if (name !== 'DICE TWICE') note(vp, `title: ${name}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-0-title.png` });
  for (let n = 1; n <= 3; n++) {
    await page.click('#guideNext');
    await page.waitForTimeout(250);
    const pg = await page.evaluate(() => { const g = document.getElementById('guide'); return { over: g.scrollHeight - g.clientHeight, page: [...g.querySelectorAll('.guide-page')].findIndex((el) => !el.hidden) }; });
    if (pg.page !== n || pg.over > 0) note(vp, `guide page ${n}: ${JSON.stringify(pg)}`);
    if (n === 1 && !/STRAIGHT\s*×8/.test(await text('#combos'))) note(vp, 'the combinations page does not list the straight × 8');
    await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-0-guide-${n}.png` });
  }
  await page.click('#guideNext'); // LET'S ROLL: the tutorial on the board
  await page.waitForTimeout(150);
  let a = await auto();
  if (a.mode !== 'auto') note(vp, `mode on screen: ${a.mode}`);
  if (await page.$eval('#tabs', (el) => !el.hidden)) note(vp, 'mode tabs are visible');

  // the mockup's rows: header, board, counter, buttons; nothing outside the viewport
  const layout = await page.evaluate(() => {
    const d = document.documentElement;
    const box = (sel) => document.querySelector(sel).getBoundingClientRect();
    return { wide: document.body.classList.contains('wide'), scrollW: d.scrollWidth, clientW: d.clientWidth, board: box('#board').width, cell: box('#board .cell').width, controlsBottom: box('.controls').bottom, counterTop: box('.counter').top, boardTop: box('#board').top, boardBottom: box('#board').bottom, panelTop: Math.min(box('.hud').top, document.getElementById('coach').hidden ? Infinity : box('#coach').top), play: box('#playBtn'), reroll: box('#rerollBtn') };
  });
  if (layout.scrollW > layout.clientW) note(vp, `horizontal overflow ${layout.scrollW}>${layout.clientW}`);
  if (layout.controlsBottom > vp.h + 0.5) note(vp, `buttons below viewport (${layout.controlsBottom.toFixed(0)} > ${vp.h})`);
  if (layout.cell < 44) note(vp, `cell too small (${layout.cell.toFixed(0)}px)`);
  // phone: rows under the board, PLAY and REROLL side by side; desktop: a panel level with the board,
  // PLAY over REROLL (the two Figma layouts)
  if (layout.wide !== (vp.w > vp.h)) note(vp, `layout ${layout.wide ? 'desktop' : 'phone'} on a ${vp.w}x${vp.h} window`);
  if (!layout.wide && Math.abs(layout.counterTop - layout.boardBottom - layout.play.height / 5) > 1) note(vp, `counter not 16/80 of a button under the board (${(layout.counterTop - layout.boardBottom).toFixed(1)})`);
  if (!layout.wide && (Math.abs(layout.play.width - layout.reroll.width) > 0.5 || Math.abs(layout.play.top - layout.reroll.top) > 0.5)) note(vp, 'PLAY and REROLL are not side by side');
  if (layout.wide && (Math.abs(layout.panelTop - layout.boardTop) > 1 || Math.abs(layout.controlsBottom - layout.boardBottom) > 1.5 || Math.abs(layout.play.left - layout.reroll.left) > 0.5)) note(vp, 'desktop panel not level with the board, or PLAY not over REROLL');
  console.log(`${vp.w}x${vp.h}: board ${layout.board.toFixed(0)}px, cell ${layout.cell.toFixed(0)}px, buttons bottom ${layout.controlsBottom.toFixed(0)}`);
  if ((await text('#levelText')) !== '1/25') note(vp, `level text: ${await text('#levelText')}`);
  if (Number(await text('#target')) !== a.target) note(vp, 'THRESHOLD is not the target');
  if ((await text('#playBtn')) !== 'PLAY•3' || (await text('#rerollBtn')) !== 'REROLL•3') note(vp, `button labels: ${await text('#playBtn')} / ${await text('#rerollBtn')}`);
  if (Number(await text('#bones')) !== a.hand.hand.points) note(vp, `BONES ${await text('#bones')} is not the hand (${a.hand.hand.points})`);
  if ((await text('#bonesLabel')) !== a.hand.hand.label) note(vp, `the label over BONES is ${await text('#bonesLabel')}, not the hand's name (${a.hand.hand.label})`);
  if ((await text('#mult')) !== '0' || Number(await text('#score')) !== 0) note(vp, 'MULTIPLY / TOTAL do not start at 0');
  await page.waitForTimeout(1500);
  console.log(`${vp.w}x${vp.h}: 3D dice status ${await page.evaluate(() => window.__diceSnake.dice3d())}`);

  // tutorial step 1 points at a die of the hand: a held die stays on the reroll that follows
  const holdText = await text('#coachText');
  if (!/STAYS ON REROLL/.test(holdText)) note(vp, `tutorial hold step: ${holdText}`);
  const coachTarget = await page.$$eval('#board .cell.hint', (els) => els.map((e) => Number(e.dataset.index)));
  if (coachTarget.length !== 1 || !a.hand.cells.includes(coachTarget[0])) note(vp, `tutorial hold target [${coachTarget}] should be one die of the hand [${a.hand.cells}]`);
  if (a.cells.filter((t) => t === 'die').length !== 8 || a.cells[8] !== 'bonus') note(vp, `level 1 layout: ${a.cells}`);
  // the hand is not marked on the board (owner, 01.11.2026): every die has the same pips and picture
  const pipColors = await page.$$eval('#board .cell.die .face i', (els) => [...new Set(els.map((e) => getComputedStyle(e).backgroundColor))]);
  if (pipColors.length !== 1) note(vp, `dice pips differ in colour: ${pipColors}`);
  const pictures = await page.$$eval('#board .cell.die', (els) => els.map((e) => e.style.getPropertyValue('--die-img')));
  if (pictures.some((v) => /-hand/.test(v))) note(vp, `a die uses a hand picture: ${pictures}`);
  // the whole screen scales with the window: k fits the mockup's 393 × 616 px of rows
  const k = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('app')).getPropertyValue('--k')));
  if (!(k > 0.4) || Math.abs(layout.board - 385 * k * (layout.wide ? 1.5 : 1)) > 1) note(vp, `board ${layout.board.toFixed(1)}px does not follow k=${k}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-1-start.png` });
  // dragging does not play a hand
  await swipe(page, a.hand.cells.slice(0, 3));
  await page.waitForTimeout(200);
  if ((await auto()).hands !== 0) note(vp, 'a drag played a hand');
  // hold the die the tutorial points at: lime; REROLL keeps its face, then clears the hold (owner, 01.11.2026)
  const keep = coachTarget[0] ?? a.hand.cells[0];
  await tap(page, keep);
  const heldLook = await page.$eval(`#board .cell[data-index="${keep}"]`, (e) => ({ cls: e.className, img: e.style.getPropertyValue('--die-img'), tag: getComputedStyle(e.querySelector('.tag')).display }));
  if (!/held/.test(heldLook.cls) || !/-held/.test(heldLook.img) || heldLook.tag !== 'none') note(vp, `held die look: ${JSON.stringify(heldLook)}`);
  if (!/REROLL/.test(await text('#coachText'))) note(vp, 'tutorial did not advance to the reroll step');
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-2-hold.png` });
  const keptFace = a.faces[keep];
  await page.click('#rerollBtn');
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-3-rolling.png` });
  await page.waitForTimeout(1100);
  await idle(page);
  a = await auto();
  if (a.faces[keep] !== keptFace) note(vp, 'reroll changed the held die');
  if (a.held.some(Boolean)) note(vp, `holds not cleared by the reroll: ${a.held}`);
  if (a.rerollsLeft !== 2 || a.cells[8] !== 'bonus') note(vp, `reroll: left=${a.rerollsLeft}, cell 8=${a.cells[8]}`);
  if ((await text('#rerollBtn')) !== 'REROLL•2') note(vp, `reroll label after one reroll: ${await text('#rerollBtn')}`);
  // bonus dice start off: the tutorial asks to switch the ×2 on first, then to play
  if (!a.off[8]) note(vp, 'the ×2 does not start switched off');
  if (!/SWITCH IT ON/.test(await text('#coachText'))) note(vp, `tutorial does not ask to switch the ×2 on: "${await text('#coachText')}"`);
  await tap(page, 8);
  if ((await auto()).off[8]) note(vp, 'tapping the bonus did not switch it on');
  // the first tap on a kind raises its sheet, once
  await page.waitForTimeout(300);
  const sheet = await page.evaluate(() => ({ open: !document.getElementById('bonusSheet').hidden, name: document.getElementById('bonusSheetName').textContent }));
  if (!sheet.open || !/ANY HAND/.test(sheet.name)) note(vp, `bonus sheet: ${JSON.stringify(sheet)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-3b-bonus-sheet.png` });
  await page.click('#bonusSheetOk');
  const on = await page.evaluate(() => ({ cell: document.querySelector('#board .cell[data-index="8"]').className, mult: document.getElementById('mult').textContent, stat: document.getElementById('multStat').className }));
  if (!/\bon\b/.test(on.cell) || on.mult !== 'x2' || !/\bon\b/.test(on.stat)) note(vp, `bonus on: ${JSON.stringify(on)}`);
  const playPulse = await page.$eval('#playBtn', (b) => b.classList.contains('pulse'));
  if (!playPulse || !/PRESS PLAY/.test(await text('#coachText'))) note(vp, `tutorial play step: pulse=${playPulse}, "${await text('#coachText')}"`);
  // off again keeps it for later, on again uses it
  await tap(page, 8);
  if (!(await auto()).off[8]) note(vp, 'tapping the bonus again did not switch it off');
  if (!(await page.$eval('#bonusSheet', (el) => el.hidden))) note(vp, 'the bonus sheet came up a second time');
  await tap(page, 8);
  if ((await auto()).off[8]) note(vp, 'tapping the bonus a third time did not switch it on');
  // a switched-on bonus counts for one throw: a reroll switches it off again
  await page.click('#rerollBtn');
  await page.waitForTimeout(300);
  await idle(page);
  if (!(await auto()).off[8]) note(vp, 'a reroll did not switch the bonus off');
  await tap(page, 8);
  // held dice outside the hand survive it: hold one now, after the last reroll
  a = await auto();
  const keep2 = a.cells.findIndex((t, i) => t === 'die' && !a.hand.cells.includes(i));
  if (keep2 >= 0) await tap(page, keep2);
  a = await auto();
  if (a.off[8] || (keep2 >= 0 && !a.held[keep2])) note(vp, `before the hand: bonus off=${a.off[8]}, hold ${keep2}=${a.held[keep2]}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-4-bonus-on.png` });
  // a hand with a bonus: the bonus screen (blurred board, skeleton, ×2 sticker, SKIP)
  await page.click('#playBtn');
  // four of a kind, five of a kind and the straight burn first (owner, 01.11.2026): only the hand's dice
  await page.waitForTimeout(120);
  const burning = await page.$$eval('#board .cell.on-fire', (els) => els.map((e) => Number(e.dataset.index)).sort());
  const strong = ['four_kind', 'five_kind', 'straight'].includes(a.hand.hand.category);
  const shouldBurn = strong ? [...a.hand.cells, ...(a.hand.hand.jokerCells || [])].sort() : [];
  if (burning.join() !== shouldBurn.join()) note(vp, `fire on [${burning}] for a ${a.hand.hand.category} on [${shouldBurn}]`);
  const fireLayer = await page.evaluate(() => { const c = document.querySelector('.fire-layer'); return c ? getComputedStyle(c).display : 'none'; });
  if (strong && fireLayer !== 'block') note(vp, `the shader fire is not drawn (canvas ${fireLayer})`);
  await page.waitForFunction(() => document.getElementById('app').classList.contains('bonus-show'), null, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(330);
  const screen = await page.evaluate(() => ({ cls: document.getElementById('app').className, skip: getComputedStyle(document.getElementById('skipBtn')).display, play: getComputedStyle(document.getElementById('playBtn')).display, hero: getComputedStyle(document.getElementById('bonusHero')).display, sticker: document.getElementById('multSticker').textContent }));
  if (!/bonus-show/.test(screen.cls) || screen.skip === 'none' || screen.play !== 'none' || screen.hero === 'none' || screen.sticker !== 'x2') note(vp, `bonus screen: ${JSON.stringify(screen)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-5-bonus-screen.png` });
  await page.click('#skipBtn');
  await idle(page);
  const b = await auto();
  if (await page.$eval('#app', (el) => el.classList.contains('bonus-show'))) note(vp, 'SKIP did not close the bonus screen');
  if (b.hands !== 1 || b.handsLeft !== 2 || (b.score >= b.target) !== (b.phase === 'won')) note(vp, `first hand: hands=${b.hands} left=${b.handsLeft} phase=${b.phase}`);
  if (b.cells[8] !== 'hole') note(vp, `the ×2 did not leave a hole (cell 8=${b.cells[8]})`);
  if (keep2 >= 0 && b.phase === 'playing' && b.faces[keep2] !== a.faces[keep2]) note(vp, 'held die outside the hand did not survive the hand');
  if (b.held.some(Boolean)) note(vp, `dice still selected after the hand: ${b.held}`);
  if (b.phase === 'playing' && (Number(await text('#score')) !== b.score || (await text('#playBtn')) !== 'PLAY•2')) note(vp, `after the hand: TOTAL ${await text('#score')} (score ${b.score}), ${await text('#playBtn')}`);
  const hidden = await page.$$eval('#board .cell.die', (els) => els.filter((e) => Number(getComputedStyle(e).opacity) < 0.9).map((e) => e.dataset.index));
  if (hidden.length) note(vp, `dice invisible after the hand: [${hidden}]`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-6-after-first.png` });
  // the level ends at the target (owner, 01.11.2026) or after the third hand
  for (let h = 0; h < 2 && (await auto()).phase === 'playing'; h++) {
    await page.click('#playBtn');
    await page.waitForTimeout(1700);
    await idle(page);
  }
  a = await auto();
  if (!(a.phase === 'won' ? a.score >= a.target : a.phase === 'lost' && a.hands === 3)) note(vp, `level end: phase=${a.phase}, hands=${a.hands}, ${a.score}/${a.target}`);
  await page.waitForTimeout(900);
  if (!(await page.$eval('#levelEnd', (el) => !el.hidden))) note(vp, 'level-end overlay not shown');
  if (!(await page.$eval('#coach', (el) => el.hidden))) note(vp, 'tutorial bar still visible after the level ended');
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-7-end.png` });
  console.log(`${vp.w}x${vp.h}: auto level finished with ${a.score}/${a.target} (${a.phase})`);
  await page.click('#nextBtn');
  await page.waitForTimeout(200);
  a = await auto();
  if ((await text('#levelText')) !== '2/25') note(vp, `level text on level 2: ${await text('#levelText')}`);
  if (a.cells.filter((t) => t === 'die').length < 6) note(vp, `level 2 has ${a.cells.filter((t) => t === 'die').length} dice`);
  const intro = await page.$eval('#toast', (t) => (t.hidden ? '' : t.textContent));
  if (!/NEW BONUS/.test(intro)) note(vp, `level 2 does not introduce its new bonus, toast="${intro}"`);
  const invisible = await page.$$eval('#board .cell.die', (els) => els.filter((e) => e.classList.contains('bank-pop') || Number(getComputedStyle(e).opacity) < 0.9).map((e) => e.dataset.index));
  if (invisible.length) note(vp, `dice invisible after a new level: [${invisible}]`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-8-level2.png` });
  // the Bible: the guide's pages without the title, every bonus, then the settings
  await page.click('#helpBtn');
  await page.waitForTimeout(300);
  const bible = await page.evaluate(() => ({ open: !document.getElementById('guide').hidden, page: [...document.querySelectorAll('.guide-page')].findIndex((el) => !el.hidden), close: document.getElementById('guideSkip').textContent }));
  if (!bible.open || bible.page !== 1 || bible.close !== 'CLOSE') note(vp, `Bible: ${JSON.stringify(bible)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-9-help.png` });
  await page.click('#guideNext');
  await page.click('#guideNext');
  if ((await page.$$eval('.bonus-list li', (l) => l.length)) !== 6) note(vp, 'the Bible does not show the six bonus dice');
  await page.click('#guideSettings');
  await page.waitForTimeout(100);
  if ((await text('#helpTitle')) !== 'SETTINGS' || !(await page.$eval('#helpRules', (el) => el.hidden))) note(vp, 'the settings sheet still shows the rules');
  await page.click('#closeHelpBtn');

  // persistence: reload restores the level in progress
  const beforeReload = await auto();
  await page.reload();
  await page.waitForSelector('#board .cell');
  const after = await auto();
  if (after.level !== beforeReload.level || JSON.stringify(after.faces) !== JSON.stringify(beforeReload.faces)) note(vp, 'state not restored after reload');
  await ctx.close();
}
await browser.close();
if (problems.length) {
  console.error('SMOKE PROBLEMS:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('smoke OK');
