#!/usr/bin/env node
// Playwright smoke test for the built page: three phone viewports plus desktop. The screen is the
// owner's Figma mockup (Auto Hand only): the title and guide, the tutorial, hold (lime), reroll, a bonus
// switched on, the bonus screen and SKIP, three hands, the level end, the endless LEVEL n, the help
// sheet, a missed target ending the run (its receipt: NEW RUN within 1.5 s, the record kept, a reload in the middle)
// and a cleared level's moment (the pick within 1.9 s, a reload in the middle); captures screenshots to dist/shots
// and fails on console errors, horizontal overflow or controls outside the viewport.
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
// a computed colour as [r, g, b, a] (r, g, b 0-255): rgb() and rgba(), or color(srgb …), a mixed colour in Chromium
const rgba = (s) => {
  const m = s.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  const c = s.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/);
  return c ? [c[1] * 255, c[2] * 255, c[3] * 255, c[4] === undefined ? 1 : +c[4]] : null;
};

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
const gotIt = async (page) => { await page.waitForTimeout(550); await page.click('#bonusSheetOk'); }; // a sheet answers half a second after it comes
// the splash covers every start for 3 s (checked once, on the first page); elsewhere it goes at once
const unsplash = async (page) => { await page.evaluate(() => window.__diceSnake.endSplash()); await page.waitForTimeout(350); };

// The play screen is the owner's base and nothing else (owner, 06.11.2026): every text on it outside the board.
const BASE_TEXT = new Set(['bank', 'toast', 'levelStat', 'levelText', 'bonesLabel', 'bones', 'handTotal', 'multSticker', 'targetStat', 'target', 'playBtn', 'rerollBtn', 'helpBtn', 'handName', 'handMult']);
const extras = (page) => page.evaluate((base) => {
  const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  const found = [];
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim();
    const el = walker.currentNode.parentElement;
    if (!text || el.closest('#board') || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const id = el.closest('[id]').id;
    if (!base.includes(id)) found.push(`${id}: ${text}`);
  }
  return found;
}, [...BASE_TEXT]);

const browser = await chromium.launch();
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: vp.mobile, isMobile: vp.mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => note(vp, `pageerror ${e.message}`));
  // Blocked CDN resources (fonts, three.js) are expected offline; everything else is a problem.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) note(vp, `console ${m.text()}`); });
  await page.goto(url);
  await page.waitForSelector('#board .cell');
  // the splash (owner, 11.11.2026; Figma 1333:1876): over everything at every start, any hands and three things one
  // second each, the game held under it; 3 s later it is gone and the game goes on
  const splash = await page.evaluate(() => {
    const s = document.getElementById('splash');
    const things = [...s.querySelectorAll('.splash-thing')].map((e) => e.style.backgroundImage);
    return { shown: !s.hidden, run: s.classList.contains('run'), things: new Set(things.filter(Boolean)).size, hands: !!s.querySelector('.splash-hands').style.backgroundImage, held: window.__diceSnake.app.hostPaused };
  });
  if (!splash.shown || !splash.run || splash.things !== 3 || !splash.hands || !splash.held) note(vp, `the splash: ${JSON.stringify(splash)}`);
  // the first visit has no title and no guide (owner, 11.11.2026: «этого экрана нигде быть не должно, после него сразу
  // игровое поле»): under the splash the board waits with its tutorial and the ×2 card face down
  const first = await page.evaluate(() => ({ guide: !document.getElementById('guide').hidden, title: !!document.getElementById('gameName'), tutorial: window.__diceSnake.state().coach.active, down: document.querySelector('#board .cell[data-index="8"]').classList.contains('face-down') }));
  if (first.guide || first.title || !first.tutorial || !first.down) note(vp, `the first visit under the splash: ${JSON.stringify(first)}`);
  await page.waitForFunction(() => document.getElementById('splash').hidden, null, { timeout: 4500 });
  if (await page.evaluate(() => window.__diceSnake.app.hostPaused)) note(vp, 'the game stayed held after the splash');
  const auto = () => page.evaluate(() => {
    const g = window.__diceSnake.state().game;
    return { mode: window.__diceSnake.mode().id, cells: g.cells.map((c) => c.type), faces: g.faces, held: g.held, off: g.off, hands: g.hands.length, handsLeft: g.handsLeft, rerollsLeft: g.rerollsLeft, phase: g.phase, score: g.score, target: g.level.target, level: g.level.levelIndex, hand: window.__diceSnake.hint() };
  });
  const text = (sel) => page.$eval(sel, (el) => el.textContent);
  // after the splash the ×2 card turns over by itself (owner, 02.11.2026); a kind never seen brings its sheet a
  // second later, and the bonus stays off
  await page.waitForFunction(() => !document.querySelector('#board .cell[data-index="8"]').classList.contains('face-down'), null, { timeout: 1500 }).catch(() => {});
  const turning = await page.$eval('#board .cell[data-index="8"]', (e) => ({ cls: e.className, anim: getComputedStyle(e).animationName }));
  if (/face-down/.test(turning.cls) || !/^cardFlip\b/.test(turning.anim)) note(vp, `the ×2 card did not turn over by itself: ${JSON.stringify(turning)}`);
  await page.waitForFunction(() => !document.getElementById('bonusSheet').hidden, null, { timeout: 3000 }).catch(() => {});
  // no line about switching the card on in it (owner, 11.11.2026: «убери эту строку во всех попапах и на всех платформах»)
  const sheet = await page.evaluate(() => ({ open: !document.getElementById('bonusSheet').hidden, name: document.getElementById('bonusSheetName').textContent, off: window.__diceSnake.state().game.off[8], switchLine: /SWITCH IT ON/.test(document.getElementById('bonusSheet').textContent) }));
  if (!sheet.open || sheet.name !== 'Any hand' || !sheet.off || sheet.switchLine) note(vp, `bonus sheet: ${JSON.stringify(sheet)}`);
  // the card's popup (Figma 1340:923, 1333:1761): a 90 % black mate; the hero's card in its acting look, 160 of the mockup's
  // px, on the phone 139 below the board's top, on the desktop centred on the board and panel; the line in Basteleur
  // Moonlight; a white PLAY. Measured once it has come in (the mate fades 200 ms, the column rises 160 ms)
  await page.waitForTimeout(250);
  const pop = await page.evaluate(() => {
    const k = parseFloat(document.documentElement.style.getPropertyValue('--k'));
    const card = document.querySelector('#bonusSheetTile .cell').getBoundingClientRect();
    const board = document.getElementById('board').getBoundingClientRect();
    const col = document.querySelector('#bonusSheet .popup-card').getBoundingClientRect();
    const ok = getComputedStyle(document.getElementById('bonusSheetOk'));
    const wide = document.body.classList.contains('wide');
    return {
      wide,
      mate: getComputedStyle(document.getElementById('bonusSheet')).backgroundColor,
      acting: document.querySelector('#bonusSheetTile .cell').classList.contains('acting'),
      size: card.width / k,
      off: wide ? (col.top + col.height / 2 - (board.top + board.height / 2)) / k : (card.top - board.top) / k, // the desktop's board is as tall as its panel
      light: document.fonts.check(`300 18px "Basteleur Moonlight"`) && getComputedStyle(document.getElementById('bonusSheetWhat')).fontFamily.replace(/"/g, '').startsWith('Basteleur Moonlight'),
      ok: [document.getElementById('bonusSheetOk').textContent, ok.backgroundColor],
    };
  });
  if (pop.mate !== 'rgba(0, 0, 0, 0.9)' || !pop.acting || Math.abs(pop.size - 160) > 1 || Math.abs(pop.off - (pop.wide ? 0 : 139)) > 2 || !pop.light || pop.ok.join() !== 'PLAY,rgb(255, 255, 255)') note(vp, `card popup: ${JSON.stringify(pop)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-0-bonus-sheet.png` });
  if (await page.evaluate(() => { window.__diceSnake.app.sheetAt = performance.now(); document.getElementById('bonusSheetOk').click(); return document.getElementById('bonusSheet').hidden; })) note(vp, 'PLAY closed the card popup the moment it came');
  await gotIt(page);
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
  // phone: rows under the board; desktop: a panel level with the board (Figma 1287:1641); PLAY and REROLL side
  // by side on both
  if (layout.wide !== (vp.w > vp.h)) note(vp, `layout ${layout.wide ? 'desktop' : 'phone'} on a ${vp.w}x${vp.h} window`);
  if (!layout.wide && Math.abs(layout.counterTop - layout.boardBottom - layout.play.height / 5) > 1) note(vp, `counter not 16/80 of a button under the board (${(layout.counterTop - layout.boardBottom).toFixed(1)})`);
  if (!layout.wide && (Math.abs(layout.play.width - layout.reroll.width) > 0.5 || Math.abs(layout.play.top - layout.reroll.top) > 0.5)) note(vp, 'PLAY and REROLL are not side by side');
  if (layout.wide && (Math.abs(layout.panelTop - layout.boardTop) > 1 || Math.abs(layout.controlsBottom - layout.boardBottom) > 1.5 || Math.abs(layout.play.top - layout.reroll.top) > 0.5 || layout.play.right > layout.reroll.left)) note(vp, 'desktop panel not level with the board, or PLAY not beside REROLL');
  console.log(`${vp.w}x${vp.h}: board ${layout.board.toFixed(0)}px, cell ${layout.cell.toFixed(0)}px, buttons bottom ${layout.controlsBottom.toFixed(0)}`);
  if ((await text('#levelText')) !== '1/5') note(vp, `level text: ${await text('#levelText')}`); // the level out of the first keeper's
  if (Number(await text('#target')) !== a.target) note(vp, 'THRESHOLD is not the target');
  if ((await text('#playBtn')) !== 'PLAY•3' || (await text('#rerollBtn')) !== 'REROLL•3') note(vp, `button labels: ${await text('#playBtn')} / ${await text('#rerollBtn')}`);
  if ((await text('#bones')) !== `${a.hand.hand.base}×${a.hand.hand.mult}`) note(vp, `the hand's value ${await text('#bones')} is not its sum × multiplier (${a.hand.hand.base}×${a.hand.hand.mult})`);
  if ((await text('#bonesLabel')) !== a.hand.hand.label) note(vp, `the label over BONES is ${await text('#bonesLabel')}, not the hand's name (${a.hand.hand.label})`);
  // under the dice: LEVEL · the hand · THRESHOLD (owner, 02.11.2026); no MULTIPLY or TOTAL column
  if (await page.$('#score') || await page.$('#multStat')) note(vp, 'a MULTIPLY or TOTAL column is back');
  // the desktop orders them the hand · THRESHOLD · LEVEL (Figma 1287:1641)
  const shown = await page.$$eval('.counter .stat', (els) => els.filter((e) => getComputedStyle(e).display !== 'none').sort((x, y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left).map((e) => e.id));
  if (shown.join() !== (layout.wide ? 'handStat,targetStat,levelStat' : 'levelStat,handStat,targetStat')) note(vp, `counter order: ${shown}`);
  await page.waitForTimeout(1500);
  console.log(`${vp.w}x${vp.h}: 3D dice status ${await page.evaluate(() => window.__diceSnake.dice3d())}`);

  // tutorial step 1 (Figma 1340:1340) points at a die of the hand: a held die stays on the reroll that follows; the
  // die wears the lime «Tap» glow, and the counter and both buttons lie at 20 %
  const holdText = `${await text('#coachText')} / ${await text('#coachSub')}`;
  if (!/^Tap the [1-6] \/ a held die stays on reroll$/.test(holdText)) note(vp, `tutorial hold step: ${holdText}`);
  const coachTarget = await page.$$eval('#board .cell.hint', (els) => els.map((e) => Number(e.dataset.index)));
  if (coachTarget.length !== 1 || !a.hand.cells.includes(coachTarget[0])) note(vp, `tutorial hold target [${coachTarget}] should be one die of the hand [${a.hand.cells}]`);
  const dimmed = async () => (await page.waitForTimeout(200)) || page.evaluate(() => { // the buttons fade in 150 ms
    const o = (sel) => Number(getComputedStyle(document.querySelector(sel)).opacity);
    return { step: document.getElementById('app').dataset.coach || '', counter: o('#handStat'), play: o('#playBtn'), reroll: o('#rerollBtn') };
  });
  const holdLook = { ...(await dimmed()), glow: await page.$eval('#board .cell.hint', (e) => { const g = getComputedStyle(e, '::before'); return { shadow: g.boxShadow, share: parseFloat(g.width) / e.getBoundingClientRect().width }; }) };
  // the desktop's counter shares the notification's tile and stays lit (Figma 1392:2866)
  if (holdLook.step !== 'hold' || holdLook.counter !== (layout.wide ? 1 : 0.2) || holdLook.play !== 0.2 || holdLook.reroll !== 0.2 || !/rgb\(192, 255, 71\).*inset|inset.*rgb\(192, 255, 71\)/.test(holdLook.glow.shadow) || Math.abs(holdLook.glow.share - 107 / 116) > 0.01) note(vp, `tutorial hold look: ${JSON.stringify(holdLook)}`);
  if (a.cells.filter((t) => t === 'die').length !== 8 || a.cells[8] !== 'bonus') note(vp, `level 1 layout: ${a.cells}`);
  // the hand is not marked on the board (owner, 01.11.2026): every die has the same pips and picture
  const pipColors = await page.$$eval('#board .cell.die .face i', (els) => [...new Set(els.map((e) => getComputedStyle(e).backgroundColor))]);
  if (pipColors.length !== 1) note(vp, `dice pips differ in colour: ${pipColors}`);
  const pictures = await page.$$eval('#board .cell.die', (els) => els.map((e) => e.style.getPropertyValue('--die-img')));
  if (pictures.some((v) => /-hand/.test(v))) note(vp, `a die uses a hand picture: ${pictures}`);
  // the whole screen scales with the window: k fits the mockup's 393 × 597 px of rows (Figma 1285:1244: a 360 px
  // board on the phone; Figma 1287:1641: a 546 px board on the desktop)
  const k = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('app')).getPropertyValue('--k')));
  if (!(k > 0.4) || Math.abs(layout.board - (layout.wide ? 546 : 360) * k) > 1) note(vp, `board ${layout.board.toFixed(1)}px does not follow k=${k}`);
  // the tutorial's notification lies over the header row, from 19 px above it to 5 px below it on the phone (Figma
  // 1340:1340), on the panel's header tile on the desktop: it takes no height from the owner's rows and leaves the board
  const line = await page.evaluate(() => { const box = (sel) => document.querySelector(sel).getBoundingClientRect(); const c = box('#coach'); const h = box('.hud'); const b = box('#board'); return { shown: !document.getElementById('coach').hidden, top: c.top - h.top, bottom: c.bottom - h.bottom, board: b.top - c.bottom, skip: !!document.getElementById('coachSkip') }; });
  if (!line.shown || line.skip || line.top > 1 || line.bottom < -1 || (!layout.wide && line.board < -0.5)) note(vp, `the tutorial's notification is not over the header row: ${JSON.stringify(line)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-1-start.png` });
  // dragging does not play a hand
  await swipe(page, a.hand.cells.slice(0, 3));
  await page.waitForTimeout(200);
  if ((await auto()).hands !== 0) note(vp, 'a drag played a hand');
  // hold the die the tutorial points at: it stays white in a frame of #7cb823 at 60 % (Figma 1340:1566; owner, 12.11.2026);
  // REROLL keeps its face, then clears the hold (owner, 01.11.2026)
  const keep = coachTarget[0] ?? a.hand.cells[0];
  await tap(page, keep);
  const heldLook = await page.$eval(`#board .cell[data-index="${keep}"]`, (e) => {
    const frame = getComputedStyle(e, '::after');
    return { cls: e.className, img: e.style.getPropertyValue('--die-img'), tag: getComputedStyle(e.querySelector('.tag')).display, frame: frame.borderTopColor, width: parseFloat(frame.borderTopWidth), glow: frame.boxShadow };
  });
  if (!/held/.test(heldLook.cls) || /-held/.test(heldLook.img) || heldLook.tag !== 'none' || heldLook.frame !== 'rgba(124, 184, 35, 0.6)' || heldLook.width < 3 || !/inset/.test(heldLook.glow)) note(vp, `held die look: ${JSON.stringify(heldLook)}`);
  // step 2 (Figma 1340:1566): REROLL to tap, a band of light passing across it; the counter and PLAY at 20 % (the desktop,
  // Figma 1392:3100: PLAY alone; the band there too, owner 12.11.2026)
  const rerollStep = { line: `${await text('#coachText')} / ${await text('#coachSub')}`, ...(await dimmed()), sweep: await page.$eval('#rerollBtn', (b) => getComputedStyle(b).animationName) };
  if (rerollStep.line !== 'Reroll the rest / cards and bonuses stay' || rerollStep.step !== 'reroll' || rerollStep.counter !== (layout.wide ? 1 : 0.2) || rerollStep.play !== 0.2 || rerollStep.reroll !== 1 || rerollStep.sweep !== 'rerollSweep') note(vp, `tutorial reroll step: ${JSON.stringify(rerollStep)}`);
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
  // bonus cards start off: the tutorial asks to switch the ×2 on, then to play
  if (!a.off[8]) note(vp, 'the ×2 does not start switched off');
  // step 3 (Figma 1392:2485): the card to tap glows white within and in its colour under itself; both buttons at 20 %
  const cardStep = { line: `${await text('#coachText')} / ${await text('#coachSub')}`, ...(await dimmed()), target: await page.$$eval('#board .cell.hint', (els) => els.map((e) => Number(e.dataset.index))), glow: await page.$eval('#board .cell[data-index="8"]', (e) => getComputedStyle(e, '::before').boxShadow) };
  if (cardStep.line !== 'Tap the bonus card / then tap to play' || cardStep.step !== 'card' || cardStep.counter !== 1 || cardStep.play !== 0.2 || cardStep.reroll !== 0.2 || cardStep.target.join() !== '8' || !/rgb\(255, 255, 255\)/.test(cardStep.glow)) note(vp, `tutorial does not ask to switch the ×2 on: ${JSON.stringify(cardStep)}`);
  await tap(page, 8);
  if ((await auto()).off[8]) note(vp, 'tapping the turned card did not switch it on');
  // the card switched on glows under itself in its own colour at 48 %, nothing over its picture (Figma 1308:2958, 1392:2641;
  // owner, 11.11.2026: «выделение не должно быть поверх рисунка. Сделай подсветку под выбранной картой», «у выбранной карты
  // используй подсветку на основе ее фонового цвета»; 12.11.2026: the tutorial's look for the whole game), and the hand's
  // name over its points turns lime
  const on = await page.evaluate(() => ({ cell: document.querySelector('#board .cell[data-index="8"]').className, glow: getComputedStyle(document.querySelector('#board .cell[data-index="8"]')).filter, ground: getComputedStyle(document.querySelector('#board .cell[data-index="8"]')).backgroundColor, ring: getComputedStyle(document.querySelector('#board .cell[data-index="8"]'), '::after').content, sticker: document.querySelector('#multSticker .ink')?.textContent, whole: `×${window.__diceSnake.hint().hand.mult * window.__diceSnake.hint().hand.bonusMult}`, shown: getComputedStyle(document.getElementById('multSticker')).display, stat: document.getElementById('handStat').className, label: getComputedStyle(document.getElementById('bonesLabel')).color,
    // the sticker's lime is a layer under its letters: drawn with them, the number's lime covered the × (owner, 11.11.2026)
    layers: (() => { const pad = document.querySelector('#multSticker .pad'); const ink = document.querySelector('#multSticker .ink'); return !!pad && !!ink && pad.textContent === ink.textContent && getComputedStyle(pad).color === 'rgba(0, 0, 0, 0)' && getComputedStyle(ink).position === 'absolute' && getComputedStyle(ink).textShadow === 'none'; })() }));
  // the whole multiplier: on the lime sticker on the phone, in the hand's row on the desktop
  const multiplier = layout.wide ? (await text('#handMult')).replace('MULTI ', '') : on.sticker;
  const glow = rgba(on.glow);
  const ground = rgba(on.ground);
  const glowOk = !!glow && !!ground && glow.slice(0, 3).every((v, i) => Math.abs(v - ground[i]) < 1.5) && Math.abs(glow[3] - 0.48) < 0.01;
  if (!/\bon\b/.test(on.cell) || !glowOk || on.ring !== 'none' || multiplier !== on.whole || (!layout.wide && on.shown === 'none') || !/\bon\b/.test(on.stat) || on.label !== 'rgb(187, 243, 80)' || !on.layers) note(vp, `bonus on: ${JSON.stringify({ ...on, multiplier })}`);
  // step 4 (Figma 1392:2641): the same words, PLAY to tap, REROLL at 20 %
  const playStep = { line: `${await text('#coachText')} / ${await text('#coachSub')}`, ...(await dimmed()) };
  if (playStep.line !== 'Tap the bonus card / then tap to play' || playStep.step !== 'play' || playStep.counter !== 1 || playStep.play !== 1 || playStep.reroll !== 0.2) note(vp, `tutorial play step: ${JSON.stringify(playStep)}`);
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
  // a held die outside the hand burns with the rest (owner, 03.11.2026): hold one now, after the last
  // reroll; no hold is left after the hand
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
  // no full-screen bonus screen (owner, 03.11.2026): the hand is counted on the board, the ×2 hits in a step
  await page.waitForFunction(() => document.getElementById('reveal').classList.contains('hit'), null, { timeout: 4000 }).catch(() => {});
  const count = await page.evaluate(() => ({ hit: document.getElementById('reveal').classList.contains('hit'), mult: document.querySelector('#reveal .mult').textContent, play: getComputedStyle(document.getElementById('playBtn')).display, board: getComputedStyle(document.getElementById('board')).filter }));
  if (!count.hit || !/×2/.test(count.mult) || count.play === 'none' || count.board !== 'none') note(vp, `the bonus hand's count on the board: ${JSON.stringify(count)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-5-bonus-count.png` });
  await idle(page);
  const b = await auto();
  if (b.hands !== 1 || b.handsLeft !== 2 || (b.score >= b.target) !== (b.phase === 'won')) note(vp, `first hand: hands=${b.hands} left=${b.handsLeft} phase=${b.phase}`);
  if (b.cells[8] !== 'die') note(vp, `a new die did not take the played ×2's cell (cell 8=${b.cells[8]})`);
  if (b.held.some(Boolean)) note(vp, `dice still selected after the hand: ${b.held}`);
  // THRESHOLD counts down to what the level still needs (owner, 02.11.2026)
  await page.waitForTimeout(600);
  if (b.phase === 'playing' && (Number(await text('#target')) !== b.target - b.score || (await text('#playBtn')) !== 'PLAY•2')) note(vp, `after the hand: THRESHOLD ${await text('#target')} (needs ${b.target - b.score}), ${await text('#playBtn')}`);
  const hidden = await page.$$eval('#board .cell.die', (els) => els.filter((e) => Number(getComputedStyle(e).opacity) < 0.9).map((e) => e.dataset.index));
  if (hidden.length) note(vp, `dice invisible after the hand: [${hidden}]`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-6-after-first.png` });
  // the tutorial's last line says its one thing and goes with the player's next move
  if (b.phase === 'playing' && `${await text('#coachText')} / ${await text('#coachSub')}` !== "New dice every hand / rerolls don't refill") note(vp, `the tutorial's last line: ${await text('#coachText')} / ${await text('#coachSub')}`);
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
  const firstWon = a.phase === 'won';
  // the pick goes on; a door's shop opens after it, and leaving it goes on too
  // the pick's lime burst holds the cleared screen PICK_MS (500 ms) before the way on (owner's pick, 12.11.2026)
  const gone = () => page.waitForFunction(() => document.getElementById('levelEnd').hidden || !document.getElementById('shop').hidden, null, { timeout: 3000 });
  const pick = async () => {
    await page.click('#upList .up');
    await gone();
    await page.waitForTimeout(80);
    if (await page.$eval('#shop', (e) => !e.hidden)) { await page.click('#shopLeave'); await page.waitForTimeout(150); }
  };
  if (firstWon) { // a won level offers three combinations to upgrade; the pick goes on (owner, 02.11.2026)
    const offer = await page.$$eval('#upList .up', (els) => els.map((e) => e.dataset.cat));
    if (offer.length !== 3 || !(await page.$eval('#nextBtn', (e) => e.hidden)) || !(await page.$eval('#retryBtn', (e) => e.hidden))) note(vp, `upgrade offer: ${offer}`);
    await page.click('#upList .up');
    await gone();
    const ups = await page.evaluate(() => window.__diceSnake.state().ups);
    if (!ups || ups[offer[0]] !== 1) note(vp, `the pick did not upgrade ${offer[0]}: ${JSON.stringify(ups)}`);
  } else { // level 1 is almost never lost; when it is, the run is over and a new one starts at level 1
    console.log(`${vp.w}x${vp.h}: level 1 missed, the run starts again`);
    await page.click('#nextBtn');
    await page.waitForTimeout(200);
  }
  a = await auto();
  if ((await text('#levelText')) !== (firstWon ? '2/5' : '1/5')) note(vp, `level text after level 1: ${await text('#levelText')}`);
  if (a.cells.filter((t) => t === 'die').length < 6) note(vp, `level 2 has ${a.cells.filter((t) => t === 'die').length} dice`);
  // level 2: its cards are dealt face down and turn over one by one, 2 s apart; each new kind's sheet follows
  const dealt = await page.$$eval('#board .cell.bonus', (els) => els.map((e) => e.classList.contains('face-down')));
  if (firstWon && (!dealt.length || dealt.some((d) => !d))) note(vp, `level 2 cards not dealt face down: ${dealt}`);
  // level 2 without the tutorial: the same rows, and nothing but the base on them
  const plain = await page.$eval('#board', (e) => e.getBoundingClientRect().width);
  if (Math.abs(plain - layout.board) > 0.5) note(vp, `the board is ${plain} without the tutorial, ${layout.board} with it`);
  const said = await extras(page);
  if (said.length) note(vp, `more than the base on the play screen: ${said}`);
  for (let n = 0; n < 2 && dealt.length; n++) {
    const got = await page.waitForFunction(() => !document.getElementById('bonusSheet').hidden, null, { timeout: 4500 }).then(() => true, () => false);
    if (!got) break;
    await gotIt(page);
  }
  await page.waitForTimeout(400);
  const turned = await page.$$eval('#board .cell.bonus', (els) => els.filter((e) => e.classList.contains('face-down')).length);
  if (turned) note(vp, `${turned} level 2 card(s) still face down after the deal`);
  const invisible = await page.$$eval('#board .cell.die', (els) => els.filter((e) => e.classList.contains('bank-pop') || Number(getComputedStyle(e).opacity) < 0.9).map((e) => e.dataset.index));
  if (invisible.length) note(vp, `dice invisible after a new level: [${invisible}]`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-8-level2.png` });
  // the Bible: the run's page once it has bells, else the guide's pages, every bonus, then the settings
  await page.click('#helpBtn');
  await page.waitForTimeout(300);
  const bible = await page.evaluate(() => ({ open: !document.getElementById('guide').hidden, page: Number(document.querySelector('.guide-page:not([hidden])').dataset.page), close: document.getElementById('guideSkip').textContent }));
  if (!bible.open || bible.page !== (firstWon ? 4 : 1) || bible.close !== 'CLOSE') note(vp, `Bible: ${JSON.stringify(bible)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-9-help.png` });
  for (let n = firstWon ? 0 : 1; n < 3; n++) await page.click('#guideNext');
  if ((await page.$$eval('.bonus-list li', (l) => l.length)) !== 6) note(vp, 'the Bible does not show the six bonus dice');
  await page.click('#guideSettings');
  await page.waitForTimeout(100);
  if ((await text('#helpTitle')) !== 'Settings' || !(await page.$eval('#helpRules', (el) => el.hidden))) note(vp, 'the settings sheet still shows the rules');
  await page.click('#closeHelpBtn');

  // persistence: reload restores the level in progress
  const beforeReload = await auto();
  await page.reload();
  await page.waitForSelector('#board .cell');
  await unsplash(page);
  const after = await auto();
  if (after.level !== beforeReload.level || JSON.stringify(after.faces) !== JSON.stringify(beforeReload.faces)) note(vp, 'state not restored after reload');

  // a missed target ends the run (owner, 03.11.2026), forced here by putting the target out of reach; its moment
  // (owner's pick В12 A «Честный чек», 04.11.2026): NEW RUN tappable within 1.5 s of PLAY, the receipt on pure black
  // with the board as its last hand was played, the last hand outlined red, NEW RUN white, nothing of the moment left
  await idle(page);
  const reachedLevel = after.level;
  const sheetAway = async () => { if (!(await page.$eval('#bonusSheet', (el) => el.hidden))) await gotIt(page); };
  const toLastHand = async () => {
    await page.evaluate(() => { window.__diceSnake.state().game.level.target = 99999; });
    while ((await auto()).handsLeft > 1) {
      await sheetAway();
      await page.click('#playBtn');
      await page.waitForTimeout(1700);
      await idle(page);
    }
    await sheetAway();
  };
  const receipt = () => page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const st = window.__diceSnake.state();
    const next = $('nextBtn').getBoundingClientRect();
    return {
      shown: !$('levelEnd').hidden, cls: $('levelEnd').className, title: $('endTitle').textContent,
      reached: $('runReached').hidden ? null : $('runLevel').textContent, short: $('endOver').hidden ? null : $('endOver').textContent,
      board: $('endBoard').hidden ? 0 : $('endBoard').querySelectorAll('.cell').length, rows: [...document.querySelectorAll('#endHands li')].map((li) => li.classList.contains('lose')).join(),
      stats: $('runSum').hidden ? null : $('runStats').textContent, next: $('nextBtn').hidden ? null : $('nextBtn').textContent, nextBottom: next.bottom,
      nextBg: getComputedStyle($('nextBtn')).backgroundColor, nextOpacity: getComputedStyle($('nextBtn')).opacity,
      retry: !$('retryBtn').hidden, upgrades: !$('upgrades').hidden, best: st.best, runScore: st.runScore,
      left: document.querySelectorAll('.loss-line, .loss-count, .loss-short').length, busy: window.__diceSnake.app.busy,
    };
  });
  const receiptOk = (o) => o.shown && /\brun-over\b/.test(o.cls) && !/playing|waiting/.test(o.cls) && o.title === 'Run over' && /^SHORT BY \d+$/.test(o.short || '')
    && o.board === 9 && o.rows === 'false,false,true' && o.next === 'NEW RUN' && o.nextBg === 'rgb(255, 255, 255)' && o.nextOpacity === '1' && !o.retry && !o.upgrades && !o.left && !o.busy;
  await toLastHand();
  const lossAt = Date.now();
  await page.click('#playBtn');
  await page.waitForFunction(() => {
    const end = document.getElementById('levelEnd');
    const b = document.getElementById('nextBtn');
    if (end.hidden || end.classList.contains('waiting')) return false;
    const r = b.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('#nextBtn') === b;
  }, null, { timeout: 5000, polling: 16 }).catch(() => note(vp, 'NEW RUN never became tappable'));
  const newRunMs = Date.now() - lossAt;
  if (newRunMs > 1500) note(vp, `NEW RUN took ${newRunMs} ms after PLAY`);
  await page.waitForTimeout(200);
  const over = await receipt();
  if (!receiptOk(over) || over.reached !== String(reachedLevel)) note(vp, `run over: ${JSON.stringify(over)}`);
  if (!over.best || over.best.level !== reachedLevel || (firstWon && over.best.score !== over.runScore) || !/RUN SCORE \d+/.test(over.stats || '')) note(vp, `the record after the run: ${JSON.stringify(over)}`);
  if (over.nextBottom > vp.h + 0.5) note(vp, `NEW RUN below the viewport (${over.nextBottom.toFixed(0)} > ${vp.h})`);
  console.log(`${vp.w}x${vp.h}: NEW RUN tappable ${newRunMs} ms after PLAY`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-10-run-over.png` });
  await page.click('#nextBtn');
  await page.waitForTimeout(300);
  const fresh = await page.evaluate(() => { const st = window.__diceSnake.state(); return { level: st.game.level.levelIndex, phase: st.game.phase, runScore: st.runScore, ups: st.ups, bank: st.bank, best: st.best }; });
  if (fresh.level !== 1 || fresh.phase !== 'playing' || fresh.runScore !== 0 || Object.keys(fresh.ups).length || fresh.bank.length || (await text('#levelText')) !== '1/5') note(vp, `new run: ${JSON.stringify(fresh)}`);
  await page.reload();
  await page.waitForSelector('#board .cell');
  await unsplash(page);
  const kept = await page.evaluate(() => window.__diceSnake.state().best);
  if (!kept || kept.level !== reachedLevel) note(vp, `the record did not survive a reload: ${JSON.stringify(kept)}`);

  // a cleared level (owner's pick В11 A «Пробитый порог», 04.11.2026): the line breaks, the screen goes black from
  // the break and the pick is tappable within 1.9 s of PLAY; the moment leaves nothing behind; LEVEL CLEARED is white
  await idle(page);
  await page.evaluate(() => { window.__diceSnake.state().game.level.target = 1; });
  const playAt = Date.now();
  await page.click('#playBtn');
  await page.waitForFunction(() => {
    const b = document.querySelector('#upList .up');
    if (!b || document.getElementById('levelEnd').classList.contains('waiting')) return false;
    const r = b.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.up') === b;
  }, null, { timeout: 5000, polling: 16 }).catch(() => note(vp, 'the pick never became tappable'));
  const pickMs = Date.now() - playAt;
  if (pickMs > 1900) note(vp, `the pick took ${pickMs} ms after PLAY`);
  await page.waitForTimeout(200);
  const cleared = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const ups = [...document.querySelectorAll('#upList .up')].map((b) => { const r = b.getBoundingClientRect(); return { bottom: r.bottom, right: r.right, opacity: getComputedStyle(b).opacity }; });
    return {
      cls: $('levelEnd').className, title: $('endTitle').textContent, color: getComputedStyle($('endTitle')).color, over: $('endOver').hidden ? null : $('endOver').textContent,
      ups, left: document.querySelectorAll('.win-black, .win-chip, .win-over, .shards-layer').length, busy: window.__diceSnake.app.busy,
      act: $('endAct').hidden ? null : { text: $('endAct').textContent, opacity: getComputedStyle($('endAct')).opacity, bottom: $('endAct').getBoundingClientRect().bottom },
    };
  });
  if (cleared.act) note(vp, `level 1's clear has a next step to name: ${JSON.stringify(cleared.act)}`); // the next level needs no word
  if (!/\bwon\b/.test(cleared.cls) || /playing|waiting/.test(cleared.cls) || cleared.title !== 'Level cleared' || cleared.color !== 'rgb(255, 255, 255)' || cleared.over || cleared.busy) note(vp, `cleared screen: ${JSON.stringify(cleared)}`);
  if (cleared.ups.length !== 3 || cleared.ups.some((u) => u.bottom > vp.h + 0.5 || u.right > vp.w + 0.5 || u.opacity !== '1')) note(vp, `upgrades: ${JSON.stringify(cleared.ups)}`);
  if (cleared.left) note(vp, `${cleared.left} layer(s) of the moment left behind`);
  console.log(`${vp.w}x${vp.h}: the pick tappable ${pickMs} ms after PLAY`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-11-cleared.png` });
  await pick();
  await page.waitForTimeout(300);
  // a reload in the middle of the moment shows the cleared screen at once, as drawn
  await idle(page);
  await page.evaluate(() => { window.__diceSnake.state().game.level.target = 1; });
  await page.click('#playBtn');
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForSelector('#board .cell');
  await unsplash(page);
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => ({ shown: !document.getElementById('levelEnd').hidden, cls: document.getElementById('levelEnd').className, ups: [...document.querySelectorAll('#upList .up')].map((b) => getComputedStyle(b).opacity) }));
  if (!back.shown || !/\bwon\b/.test(back.cls) || /playing|waiting/.test(back.cls) || back.ups.length !== 3 || back.ups.some((o) => o !== '1')) note(vp, `reload in the win moment: ${JSON.stringify(back)}`);
  // a reload in the middle of the loss moment shows the receipt at once, its board drawn from the saved one
  await pick();
  await page.waitForTimeout(300);
  await idle(page);
  await toLastHand();
  await page.click('#playBtn');
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('dicefool-portals.v1')).modes.auto; return { phase: m.game.phase, counted: !!m.lastEnd && m.lastEnd.seed === m.game.level.seed, board: !!(m.lastEnd && m.lastEnd.board) }; });
  if (saved.phase !== 'lost' || !saved.counted || !saved.board) note(vp, `the run was not counted with its board at PLAY: ${JSON.stringify(saved)}`);
  await page.reload();
  await page.waitForSelector('#board .cell');
  await unsplash(page);
  await page.waitForTimeout(300);
  const again = await receipt();
  if (!receiptOk(again)) note(vp, `reload in the loss moment: ${JSON.stringify(again)}`);
  // the best runs from the receipt
  await page.click('#runsBtn');
  await page.waitForTimeout(150);
  const runs = await page.evaluate(() => ({ shown: !document.getElementById('runsSheet').hidden, rows: document.querySelectorAll('#runsList li:not(.none)').length, title: document.getElementById('runsTitle').textContent }));
  if (!runs.shown || runs.rows < 1 || runs.title !== 'Your best runs') note(vp, `best runs: ${JSON.stringify(runs)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-12-runs.png` });
  await page.click('#runsClose');
  // the door before a boss: the shop fits the screen, a reload finds it, a good sells once, the boss's level has its rule
  await page.evaluate(() => {
    const d = window.__diceSnake;
    const st = d.state();
    st.levelIndex = 4;
    st.bells = 30;
    st.charms = ['bellwether'];
    st.bank = ['joker', 'x2_any', 'refund'];
    st.game = null;
    st.shop = null;
    d.switchMode('auto', { silent: true });
    st.game.level.target = 1;
  });
  await idle(page);
  if ((await extras(page)).length) note(vp, `more than the base with bells, a charm and a bank: ${await extras(page)}`);
  // the bank's cards are the small card (Figma 1339:2155 Card-mini, 11.11.2026): the hero's own lighter colour, the name
  // black, no arch, the hero's whole portrait 64 px from 14 px over the top, never cut
  const minis = await page.$$eval('#bank .cell.bonus', (els) => els.map((c) => {
    const art = c.querySelector('.art');
    const a = art.getBoundingClientRect();
    const r = c.getBoundingClientRect();
    const s = 64 / r.width;
    const hex = getComputedStyle(c).getPropertyValue('--mini-card').trim();
    const own = /^#[0-9a-f]{6}$/i.test(hex) ? `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})` : hex;
    return { kind: c.className.match(/kind-(\S+)/)?.[1], ground: getComputedStyle(c).backgroundColor, own, ink: getComputedStyle(c.querySelector('.tag')).color, cut: getComputedStyle(art).clipPath, arch: getComputedStyle(c.querySelector('.arch')).display, hero: [a.left - r.left, a.top - r.top, a.width].map((v) => Math.round(v * s)) };
  }));
  for (const m of minis) if (m.ground !== m.own || m.ink !== 'rgb(0, 0, 0)' || m.cut !== 'none' || m.arch !== 'none' || String(m.hero) !== '0,-14,64') note(vp, `a bank card: ${JSON.stringify(m)}`);
  // a tap on a kept card before the first reroll: the rule, in gold, over the header row and not over the dice
  await page.click('#bank .cell[data-k="0"]');
  const told = await page.evaluate(() => { const box = (sel) => document.querySelector(sel).getBoundingClientRect(); const t = box('#toast'); const h = box('.hud'); return { text: document.getElementById('toast').textContent, cls: document.getElementById('toast').className, top: t.top, bottom: t.bottom, hud: [h.top, h.bottom] }; });
  if (told.text !== 'COMES IN ON THE FIRST REROLL' || !/hint/.test(told.cls) || told.top < told.hud[0] - 12 || told.bottom > told.hud[1] + 12) note(vp, `the kept card's rule: ${JSON.stringify(told)}`);
  await page.click('#playBtn');
  await page.waitForFunction(() => document.querySelector('#upList .up') && !document.getElementById('levelEnd').hidden && !document.getElementById('levelEnd').classList.contains('waiting'), null, { timeout: 6000 });
  await page.waitForTimeout(2200);
  const paid = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const st = window.__diceSnake.state();
    const pick = $('upSub').getBoundingClientRect();
    return { bells: st.bells, shown: !$('endBells').hidden, text: $('endBells').textContent, act: $('endAct').textContent, rule: $('upSub').textContent, inside: pick.bottom <= document.querySelector('#upList .up').getBoundingClientRect().top + 0.5 };
  });
  if (paid.bells < 32 || !paid.shown || !/\+\d+ BELLS/.test(paid.text) || !/CLEAR \+2/.test(paid.text)) note(vp, `a cleared level's pay: ${JSON.stringify(paid)}`);
  if (paid.act !== 'NEXT: SHOP' || !/^KEEPER RULE: /.test(paid.rule) || !paid.inside) note(vp, `the pick before a keeper: ${JSON.stringify(paid)}`);
  await sheetAway(); // this level's cards were still turning when the threshold was set to fall
  await page.click('#upList .up');
  await page.waitForSelector('#shop:not([hidden])');
  const fits = () => page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const r = document.querySelector('.shop-panel').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.ware')].map((g) => g.getBoundingClientRect());
    const leave = $('shopLeave').getBoundingClientRect();
    return { rows: rows.length, bottom: Math.max(r.bottom, leave.bottom), overlap: rows.some((g, k) => k && g.top < rows[k - 1].bottom - 0.5) || leave.top < rows[rows.length - 1].bottom - 0.5, boss: $('shopBoss').textContent, stock: window.__diceSnake.state().shop.stock.length };
  });
  const shop = await fits();
  if (shop.rows !== 3 || shop.bottom > vp.h + 0.5 || shop.overlap || !/NEXT/.test(shop.boss)) note(vp, `the shop at ${vp.w}x${vp.h}: ${JSON.stringify(shop)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-13-shop.png` });
  await page.reload();
  await page.waitForSelector('#board .cell');
  await unsplash(page);
  await page.waitForTimeout(300);
  if (!(await page.$eval('#shop', (e) => !e.hidden))) note(vp, 'a reload lost the shop');
  await page.click('.ware:nth-child(2)');
  await page.click('.ware:nth-child(2) .price');
  const bought = await page.evaluate(() => { const st = window.__diceSnake.state(); return { sold: st.shop.stock[1].sold, sum: Object.values(st.ups).reduce((a, b) => a + b, 0), up: !document.querySelector('#upList .up') || true }; });
  if (!bought.sold) note(vp, `the +1 did not sell: ${JSON.stringify(bought)}`);
  await page.click('.ware:nth-child(1)'); // a full bank: the card asks what it replaces
  if (!/REPLACE A BANK CARD/.test(await page.$eval('#shopHint', (e) => e.textContent))) note(vp, 'a full bank did not ask what to replace');
  await page.click('[data-bank="1"]');
  await page.click('.ware:nth-child(1) .price');
  const swapped = await page.evaluate(() => { const st = window.__diceSnake.state(); return { bank: st.bank, kind: st.shop.stock[0].id, sold: st.shop.stock[0].sold }; });
  if (swapped.bank.length !== 3 || swapped.bank[1] !== swapped.kind || !swapped.sold) note(vp, `the replaced card: ${JSON.stringify(swapped)}`);
  await page.click('#shopLeave');
  await page.waitForTimeout(250);
  // the keeper's notification (MODE3-PLAN §48) holds nothing: on the phone it stands at the top clear of the board, on the
  // desktop on the panel tile's header row, and the board under it takes taps
  const boss = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const st = window.__diceSnake.state();
    const card = $('bossCard').getBoundingClientRect();
    const board = Math.min(...[...document.querySelectorAll('#board .cell')].map((c) => c.getBoundingClientRect().top));
    const hud = document.querySelector('.hud').getBoundingClientRect();
    const clear = document.body.classList.contains('wide') ? Math.abs(card.bottom - hud.bottom) <= 1 : card.bottom <= board + 0.5;
    // the full bank's heroes rise to the window's top: they fade while it stands, or they would show over its top edge
    const bank = Number(getComputedStyle($('bank')).opacity);
    return { level: st.game.level.levelIndex, id: st.game.level.boss, card: !$('bossCard').hidden, words: $('bossCard').textContent, shop: !$('shop').hidden, clear, bank, free: document.elementFromPoint(innerWidth / 2, innerHeight - 8)?.closest('#bossCard') == null };
  });
  if (boss.level !== 5 || !boss.id || !boss.card || boss.shop || !boss.clear || !boss.free || boss.bank > 0.05 || /THRESHOLD/.test(boss.words)) note(vp, `the boss's level: ${JSON.stringify(boss)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-14-boss.png` });
  // under it a key holds a die as on any board, and a finger held on it keeps it in full view past its two seconds
  const dice = () => page.evaluate(() => JSON.stringify(window.__diceSnake.state().game.held));
  const heldBefore = await dice();
  await page.focus('#board .cell.die');
  await page.keyboard.press('Enter');
  if ((await dice()) === heldBefore) note(vp, 'a key did not hold a die under the keeper\'s notification');
  await page.keyboard.press('Enter');
  const [px, py] = await page.$eval('#bossCard', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.waitForTimeout(2200);
  const pressed = await page.$eval('#bossCard', (e) => ({ up: !e.hidden, opacity: Number(getComputedStyle(e).opacity) }));
  if (!pressed.up || pressed.opacity < 1) note(vp, `the boss card under a finger: ${JSON.stringify(pressed)}`);
  await page.mouse.up();
  await page.waitForFunction(() => document.getElementById('bossCard').hidden, null, { timeout: 3000 }).catch(() => note(vp, 'the boss card did not go'));
  await sheetAway();
  if ((await extras(page)).length) note(vp, `more than the base on a boss's level: ${await extras(page)}`);
  // the cards dealt after his notification turn over 2 s apart and a new kind's sheet comes a second later: How opens on a
  // board whose deal has ended (a sheet would come over How's pages)
  await page.waitForFunction(() => ![...document.querySelectorAll('#board .cell')].some((c) => c.waiting), null, { timeout: 10000 }).catch(() => note(vp, 'the deal after the keeper did not end'));
  for (let n = 0; n < 3; n++) { await page.waitForTimeout(1100); await sheetAway(); }
  // what left the play screen is one tap away: How opens on it, and no page scrolls
  await idle(page);
  await page.click('#helpBtn');
  await page.waitForTimeout(250);
  const facts = await page.evaluate(() => {
    const g = document.getElementById('guide');
    const list = document.getElementById('runFacts');
    return { text: list.textContent, over: g.scrollHeight - g.clientHeight, shown: !document.querySelector('.guide-page[data-page="4"]').hidden, next: document.getElementById('guideNext').textContent, dots: [...document.querySelectorAll('#guideDots i')].filter((d) => d.classList.contains('on')).length, room: document.querySelector('.guide-actions').getBoundingClientRect().top - list.lastElementChild.getBoundingClientRect().bottom };
  });
  if (!facts.shown || facts.over > 0 || facts.room < 0 || facts.next !== 'NEXT' || facts.dots !== 1 || !/BELLS/.test(facts.text) || !/SHOP IN|SHOP NEXT/.test(facts.text) || !/LUCKY COIN/i.test(facts.text)) note(vp, `How's first page: ${JSON.stringify(facts)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-15-how.png` });
  for (let n = 0; n < 3; n++) await page.click('#guideNext');
  await page.waitForTimeout(150);
  if ((await text('#guideNext')) !== 'GOT IT') note(vp, `How's last button: ${await text('#guideNext')}`);
  await page.click('#guideNext');
  await page.reload();
  await page.waitForSelector('#board .cell');
  await unsplash(page);
  await page.waitForTimeout(200);
  if (!(await page.$eval('#bossCard', (e) => !e.hidden))) note(vp, 'a reload on a boss\'s level did not show his card');
  await ctx.close();
}

// Every window, both orientations (Playgama 1.6): the rules, the level's end, the shop and the run's end fit with nothing
// cut and nothing under a button, on a phone held sideways, a square, a tablet and a low desktop window.
const KINDS = ['x2_any', 'x3_straight', 'x3_pairs', 'x3_trips', 'joker', 'refund', 'x3_kinds', 'x3_small', 'x4_any', 'x3_sixes'];
const meet = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
const outside = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.checkVisibility()).map((e) => {
  const r = e.getBoundingClientRect();
  return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 ? '' : `${e.id || e.className || e.tagName} [${[r.left, r.top, r.right, r.bottom].map(Math.round)}]`;
}).filter(Boolean), sel);
for (const vp of [{ w: 844, h: 390 }, { w: 667, h: 375 }, { w: 600, h: 600 }, { w: 768, h: 1024 }, { w: 960, h: 540 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => note(vp, `pageerror ${e.message}`));
  await page.goto(url);
  await page.waitForSelector('#board .cell');
  await page.evaluate(() => { window.__diceSnake.state().tips['seen:x2_any'] = true; }); // no card's sheet over the rules
  await unsplash(page);
  await page.click('#helpBtn'); // the first visit has no guide: the rules are How's pages
  await page.waitForTimeout(250);
  for (let n = 1; n <= 3; n++) {
    const cut = await outside(page, '#guide :is(h1, h2, p, li, button)');
    const under = await page.evaluate((meetSrc) => {
      const meet = new Function(`return ${meetSrc}`)();
      const boxes = [...document.querySelectorAll('.guide-actions button, .guide-bar button')].filter((e) => e.checkVisibility()).map((e) => e.getBoundingClientRect());
      return [...document.querySelectorAll('.guide-page:not([hidden]) :is(h1, h2, p, li)')].filter((e) => boxes.some((b) => meet(e.getBoundingClientRect(), b))).map((e) => e.textContent.trim().slice(0, 20));
    }, meet.toString());
    if (cut.length || under.length) note(vp, `rules page ${n}: ${cut.join(' ')} ${under.length ? `under a button: ${under.join(', ')}` : ''}`);
    await page.click('#guideNext');
    await page.waitForTimeout(150);
  }
  const setState = (o) => page.evaluate(({ o, KINDS }) => {
    const d = window.__diceSnake; const st = d.state();
    st.onboarded = true; st.coached = true; st.coach.active = false;
    for (const id of ['guide', 'levelEnd', 'shop', 'bonusSheet', 'help', 'runsSheet']) document.getElementById(id).hidden = true;
    st.tips = { bankReroll: true, switchOn: true };
    for (const k of KINDS) { st.tips[`seen:${k}`] = true; st.tips[`sheet:${k}`] = true; }
    Object.assign(st, { levelIndex: o.level, runSeed: 'smoke-fit', bells: 23, charms: ['crooked_pip'], bank: ['x2_any', 'joker', 'refund'], best: { level: 8, score: 900 }, ups: {}, game: null, shop: null, runs: [{ level: 8, score: 900 }] });
    d.switchMode('auto', { silent: true });
  }, { o, KINDS });
  await setState({ level: 4 });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const st = window.__diceSnake.state(); st.game = { ...st.game, level: { ...st.game.level, target: 1 } }; document.getElementById('playBtn').click(); });
  await page.waitForFunction(() => document.querySelector('#upList .up') && !document.getElementById('levelEnd').hidden && !window.__diceSnake.app.endPlaying, null, { timeout: 12000 });
  await page.waitForTimeout(400);
  let cut = await outside(page, '#levelEnd :is(h2, p, button, li)');
  if (cut.length) note(vp, `level cleared cut: ${cut.join(' ')}`);
  await page.evaluate(() => document.querySelector('#upList .up').click());
  await page.waitForSelector('#shop:not([hidden])');
  await page.waitForTimeout(300);
  cut = await outside(page, '#shop :is(h2, p, button, li, span)');
  if (cut.length) note(vp, `shop cut: ${cut.join(' ')}`);
  await page.screenshot({ path: `${shots}/fit-${vp.w}x${vp.h}-shop.png` });
  await setState({ level: 3 });
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__diceSnake.state().game.level.target = 99999; });
  for (let k = 0; k < 3; k++) { await idle(page); await page.waitForTimeout(150); await page.evaluate(() => document.getElementById('playBtn').click()); await page.waitForTimeout(400); }
  await page.waitForFunction(() => document.getElementById('endTitle').textContent === 'Run over' && !window.__diceSnake.app.endPlaying, null, { timeout: 12000 });
  await page.waitForTimeout(500);
  cut = await outside(page, '#levelEnd :is(h2, p, button, li)');
  if (cut.length) note(vp, `run over cut: ${cut.join(' ')}`);
  await page.screenshot({ path: `${shots}/fit-${vp.w}x${vp.h}-run-over.png` });
  await ctx.close();
}

// The Playgama build against a stand-in Bridge (its required steps): it starts after initialize(), reads every save in one
// get, writes only at a level's start and end, never touches localStorage, sends game_ready, asks for an ad between
// levels and goes silent when the platform pauses or mutes it.
{
  const vp = { w: 402, h: 874 };
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  await ctx.route('https://bridge.playgama.com/**', (r) => r.abort());
  await ctx.addInitScript(() => {
    const calls = [];
    const on = {};
    window.__pg = calls;
    window.bridge = {
      EVENT_NAME: { AUDIO_STATE_CHANGED: 'audio', PAUSE_STATE_CHANGED: 'pause', INTERSTITIAL_STATE_CHANGED: 'inter' },
      initialize: () => new Promise((r) => setTimeout(() => { calls.push('initialize'); r(); }, 200)),
      storage: { get: (keys) => { calls.push(`get ${keys.length}`); return Promise.resolve(keys.map(() => null)); }, set: (keys) => { calls.push(`set ${keys.join('+')}`); return Promise.resolve(); }, delete: () => Promise.resolve() },
      platform: { language: 'en', isAudioEnabled: true, on: (ev, fn) => { (on[ev] ||= []).push(fn); }, sendMessage: (m) => calls.push(`msg ${m}`) },
      advertisement: { isInterstitialSupported: true, interstitialState: 'closed', showInterstitial: () => calls.push('ad') },
      leaderboards: { type: 'not_available' },
      player: { id: 'p' },
    };
    window.__fire = (ev, v) => (on[ev] || []).forEach((f) => f(v));
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { calls.push(`localStorage ${k}`); return set.call(this, k, v); };
    const AC = window.AudioContext || window.webkitAudioContext;
    const sus = AC.prototype.suspend;
    AC.prototype.suspend = function () { calls.push('audio off'); return sus.call(this); };
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => note(vp, `playgama pageerror ${e.message}`));
  await page.goto(pathToFileURL(resolve('dist/playgama/index.html')).href);
  await page.waitForFunction(() => window.__diceSnake, null, { timeout: 10000 });
  await unsplash(page);
  const calls = () => page.evaluate(() => window.__pg.splice(0));
  const start = await calls();
  if (start[0] !== 'initialize' || start[1] !== 'get 4' || !start.includes('msg game_ready') || start.indexOf('msg game_ready') < start.indexOf('get 4')) note(vp, `playgama start: ${start.join(', ')}`);
  await page.waitForFunction(() => !document.getElementById('bonusSheet').hidden, null, { timeout: 6000 });
  await gotIt(page);
  await calls();
  await page.click('#rerollBtn'); // the tutorial blocks nothing (no SKIP since 12.11.2026)
  await idle(page);
  const play = await calls();
  if (play.some((c) => c.startsWith('set') || c.startsWith('localStorage'))) note(vp, `playgama wrote during a hand: ${play.join(', ')}`);
  await page.evaluate(() => { const st = window.__diceSnake.state(); st.game = { ...st.game, level: { ...st.game.level, target: 1 } }; document.getElementById('playBtn').click(); });
  await page.waitForFunction(() => document.querySelector('#upList .up') && !window.__diceSnake.app.endPlaying, null, { timeout: 12000 });
  await page.evaluate(() => document.querySelector('#upList .up').click());
  await page.waitForFunction(() => document.getElementById('levelEnd').hidden, null, { timeout: 3000 }); // after the pick's burst
  await page.waitForTimeout(400);
  const next = await calls();
  if (!next.includes('ad') || next.filter((c) => c.startsWith('set')).length !== 2 || !next.includes('msg level_completed') || !next.includes('msg level_started')) note(vp, `playgama level change: ${next.join(', ')}`);
  await page.evaluate(() => window.__fire('pause', true));
  const paused = await calls();
  if (!paused.includes('audio off')) note(vp, `playgama kept its sound through a pause: ${paused.join(', ')}`);
  await page.evaluate(() => { window.__fire('pause', false); window.__fire('audio', false); });
  if (!(await calls()).includes('audio off')) note(vp, 'playgama kept its sound when the platform muted it');
  if (next.concat(play, start).some((c) => c.startsWith('localStorage'))) note(vp, 'playgama wrote to localStorage');
  await ctx.close();
}

// The heroes are still pictures (portals redesign, 10.11.2026): a card shows its portrait inside the card, the longest tag
// (TWO SIXES) fits it, and every card the winning hand used stays as it lies in its acting state; the moment still ends in the pick.
for (const vp of [{ w: 390, h: 844 }, { w: 1280, h: 800 }, { w: 844, h: 390 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => note(vp, `pageerror ${e.message}`));
  await page.goto(url);
  await page.waitForSelector('#board .cell');
  await page.evaluate(() => { window.__diceSnake.state().tips['seen:x2_any'] = true; }); // the first visit's card brings no sheet
  await unsplash(page);
  await page.evaluate(({ KINDS }) => {
    const d = window.__diceSnake; const st = d.state();
    st.onboarded = true; st.coached = true; st.coach.active = false;
    for (const id of ['guide', 'levelEnd', 'shop', 'bonusSheet', 'help', 'runsSheet']) document.getElementById(id).hidden = true;
    st.tips = { bankReroll: true, switchOn: true };
    for (const k of KINDS) { st.tips[`seen:${k}`] = true; st.tips[`sheet:${k}`] = true; }
    Object.assign(st, { levelIndex: 1, runSeed: 'smoke-heroes', bells: 0, charms: [], bank: [], ups: {}, game: null, shop: null });
    d.switchMode('auto', { silent: true });
  }, { KINDS });
  await idle(page);
  await page.evaluate(() => { // two pairs, sixes and threes: the Knight's ×2 and Bigfoot's ×3 both join the hand
    const d = window.__diceSnake; const g = d.state().game;
    const faces = [6, 6, 3, 3, 1, 2, 5];
    let n = 0;
    g.cells = g.cells.map((c, i) => (i === 6 ? { type: 'bonus', kind: 'x2_any' } : i === 7 ? { type: 'bonus', kind: 'x3_sixes' } : { type: 'die' }));
    g.faces = g.cells.map((c, i) => (i === 6 || i === 7 ? null : faces[n++]));
    g.off = g.cells.map((c) => c.type === 'bonus');
    g.held = new Array(9).fill(false);
    g.level.target = 1;
    d.switchMode('auto', { silent: true });
  });
  await page.waitForTimeout(4500); // the two cards are dealt face down and turn themselves
  const faces = await page.evaluate(() => [6, 7].map((i) => {
    const card = document.querySelectorAll('#board .cell')[i];
    const art = card.querySelector('.art');
    const tag = card.querySelector('.tag');
    const c = card.getBoundingClientRect();
    const a = art.getBoundingClientRect();
    const t = tag.getBoundingClientRect();
    // the card mockup (Figma 1339:2155): the portrait inside the card's sides, on the arch's bottom, rising over the top
    // by 15 px of 110 (16 at most: the card's 1 px border does not scale with it)
    return { kind: card.className.match(/kind-(\S+)/)?.[1], picture: getComputedStyle(art).backgroundImage !== 'none', inside: a.left >= c.left - 0.5 && a.right <= c.right + 0.5 && a.bottom <= c.bottom && a.top >= c.top - (16 / 110) * c.height, tag: tag.textContent, tagFits: tag.scrollWidth <= tag.clientWidth + 1 && t.left >= c.left - 0.5 && t.right <= c.right + 0.5, size: Math.round(a.width) };
  }));
  for (const f of faces) if (!f.picture || !f.inside || !f.tagFits || f.size < 40) note(vp, `a hero's card: ${JSON.stringify(f)}`);
  if (faces[1].tag !== 'TWO SIXES') note(vp, `Bigfoot's tag: ${faces[1].tag}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-16-heroes.png` });
  await page.click('#board .cell:nth-child(7)');
  await page.waitForTimeout(600);
  await page.click('#board .cell:nth-child(8)');
  await page.waitForTimeout(1200);
  // a played card stays as it lies and takes its acting state, the hero over the whole card (owner, 11.11.2026: «Смещать
  // карту не нужно, она остается статикой, меняется только анимация в ней при розыгрыше»; «Персонаж на всю карту, а для
  // этого есть ее отдельное состояние»): no lift, no tilt, no name, the portrait's square 152 of the card's 108
  const still = await page.evaluate(() => new Promise((resolve) => {
    const cells = document.querySelectorAll('#board .cell');
    const rect = (i) => { const r = cells[i].getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => v.toFixed(1)).join(); };
    const look = (i) => { const c = cells[i]; const art = c.querySelector('.art'); return c.classList.contains('acting') && getComputedStyle(c).transform === 'none' && getComputedStyle(c.querySelector('.tag')).visibility === 'hidden' && Math.abs(art.offsetHeight / c.clientHeight - 152 / 108) < 0.02; };
    const before = [rect(6), rect(7)];
    document.getElementById('playBtn').click();
    setTimeout(() => resolve({ moved: [rect(6), rect(7)].filter((r, k) => r !== before[k]), look: [look(6), look(7)], hand: window.__diceSnake.state().game.hands.at(-1)?.bonuses }), 420);
  }));
  if (still.moved.length || !still.look.every(Boolean) || String(still.hand) !== 'x2_any,x3_sixes') note(vp, `the winning cards: ${JSON.stringify(still)}`);
  await page.waitForFunction(() => document.querySelector('#upList .up') && !window.__diceSnake.app.endPlaying, null, { timeout: 12000 });
  if (await page.$('#board .cell.acting')) note(vp, 'a card kept its acting look after the moment');
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error('SMOKE PROBLEMS:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('smoke OK');
