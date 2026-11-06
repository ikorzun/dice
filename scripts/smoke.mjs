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
  if (name !== 'DICEFOOL') note(vp, `title: ${name}`);
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
  // the ×2 card is dealt face down and turns over by itself (owner, 02.11.2026); a kind never seen brings
  // its sheet a second later, and the bonus stays off
  await page.waitForTimeout(80);
  if (!(await page.$eval('#board .cell[data-index="8"]', (e) => e.classList.contains('face-down')))) note(vp, 'the ×2 card is not dealt face down');
  await page.waitForTimeout(300);
  const turning = await page.$eval('#board .cell[data-index="8"]', (e) => ({ cls: e.className, anim: getComputedStyle(e).animationName }));
  if (/face-down/.test(turning.cls) || turning.anim !== 'cardFlip') note(vp, `the ×2 card did not turn over by itself: ${JSON.stringify(turning)}`);
  await page.waitForFunction(() => !document.getElementById('bonusSheet').hidden, null, { timeout: 3000 }).catch(() => {});
  const sheet = await page.evaluate(() => ({ open: !document.getElementById('bonusSheet').hidden, name: document.getElementById('bonusSheetName').textContent, off: window.__diceSnake.state().game.off[8] }));
  if (!sheet.open || !/ANY HAND/.test(sheet.name) || !sheet.off) note(vp, `bonus sheet: ${JSON.stringify(sheet)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-0-bonus-sheet.png` });
  await page.click('#bonusSheetOk');
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
  if ((await text('#levelText')) !== '1') note(vp, `level text: ${await text('#levelText')}`);
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
  // the whole screen scales with the window: k fits the mockup's 393 × 597 px of rows (Figma 1285:1244: a 360 px
  // board on the phone; Figma 1287:1641: a 546 px board on the desktop)
  const k = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('app')).getPropertyValue('--k')));
  if (!(k > 0.4) || Math.abs(layout.board - (layout.wide ? 546 : 360) * k) > 1) note(vp, `board ${layout.board.toFixed(1)}px does not follow k=${k}`);
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
  // bonus cards start off: the tutorial asks to switch the ×2 on, then to play
  if (!a.off[8]) note(vp, 'the ×2 does not start switched off');
  if (!/SWITCH IT ON/.test(await text('#coachText'))) note(vp, `tutorial does not ask to switch the ×2 on: "${await text('#coachText')}"`);
  await tap(page, 8);
  if ((await auto()).off[8]) note(vp, 'tapping the turned card did not switch it on');
  const on = await page.evaluate(() => ({ cell: document.querySelector('#board .cell[data-index="8"]').className, sticker: document.getElementById('multSticker').textContent, whole: `×${window.__diceSnake.hint().hand.mult * window.__diceSnake.hint().hand.bonusMult}`, shown: getComputedStyle(document.getElementById('multSticker')).display, stat: document.getElementById('handStat').className }));
  // the whole multiplier: on the lime sticker on the phone, in the hand's row on the desktop
  const multiplier = layout.wide ? (await text('#handMult')).replace('MULTI ', '') : on.sticker;
  if (!/\bon\b/.test(on.cell) || multiplier !== on.whole || (!layout.wide && on.shown === 'none') || !/\bon\b/.test(on.stat)) note(vp, `bonus on: ${JSON.stringify({ ...on, multiplier })}`);
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
  const pick = async () => {
    await page.click('#upList .up');
    await page.waitForTimeout(80);
    if (await page.$eval('#shop', (e) => !e.hidden)) { await page.click('#shopLeave'); await page.waitForTimeout(150); }
  };
  if (firstWon) { // a won level offers three combinations to upgrade; the pick goes on (owner, 02.11.2026)
    const offer = await page.$$eval('#upList .up', (els) => els.map((e) => e.dataset.cat));
    if (offer.length !== 3 || !(await page.$eval('#nextBtn', (e) => e.hidden)) || !(await page.$eval('#retryBtn', (e) => e.hidden))) note(vp, `upgrade offer: ${offer}`);
    await page.click('#upList .up');
    const ups = await page.evaluate(() => window.__diceSnake.state().ups);
    if (!ups || ups[offer[0]] !== 1) note(vp, `the pick did not upgrade ${offer[0]}: ${JSON.stringify(ups)}`);
  } else { // level 1 is almost never lost; when it is, the run is over and a new one starts at level 1
    console.log(`${vp.w}x${vp.h}: level 1 missed, the run starts again`);
    await page.click('#nextBtn');
  }
  await page.waitForTimeout(200);
  a = await auto();
  if ((await text('#levelText')) !== (firstWon ? '2' : '1')) note(vp, `level text after level 1: ${await text('#levelText')}`);
  // the act strip (owner's pick В13 A, 05.11.2026): by LEVEL, four nodes and the seal, on screen, adding no height
  const act = await page.evaluate(() => { const s = document.getElementById('actStrip'); const r = s.getBoundingClientRect(); return { nodes: [...s.querySelectorAll('.act-node')].map((n) => n.classList[1]).join(), seal: s.querySelector('.act-seal').className, number: s.querySelector('.act-seal b').textContent, right: r.right, bottom: r.bottom, label: s.getAttribute('aria-label') }; });
  if (act.nodes !== (firstWon ? 'done,current,upcoming,upcoming' : 'current,upcoming,upcoming,upcoming') || act.seal !== 'act-seal upcoming' || act.number !== '5' || act.right > vp.w || act.bottom > vp.h || !/^Levels 1 to 5\./.test(act.label)) note(vp, `act strip: ${JSON.stringify(act)}`);
  if (a.cells.filter((t) => t === 'die').length < 6) note(vp, `level 2 has ${a.cells.filter((t) => t === 'die').length} dice`);
  // level 2: its cards are dealt face down and turn over one by one, 2 s apart; each new kind's sheet follows
  const dealt = await page.$$eval('#board .cell.bonus', (els) => els.map((e) => e.classList.contains('face-down')));
  if (firstWon && (!dealt.length || dealt.some((d) => !d))) note(vp, `level 2 cards not dealt face down: ${dealt}`);
  for (let n = 0; n < 2 && dealt.length; n++) {
    const got = await page.waitForFunction(() => !document.getElementById('bonusSheet').hidden, null, { timeout: 4500 }).then(() => true, () => false);
    if (!got) break;
    await page.click('#bonusSheetOk');
  }
  await page.waitForTimeout(400);
  const turned = await page.$$eval('#board .cell.bonus', (els) => els.filter((e) => e.classList.contains('face-down')).length);
  if (turned) note(vp, `${turned} level 2 card(s) still face down after the deal`);
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

  // a missed target ends the run (owner, 03.11.2026), forced here by putting the target out of reach; its moment
  // (owner's pick В12 A «Честный чек», 04.11.2026): NEW RUN tappable within 1.5 s of PLAY, the receipt on pure black
  // with the board as its last hand was played, the last hand outlined red, NEW RUN white, nothing of the moment left
  await idle(page);
  const reachedLevel = after.level;
  const sheetAway = async () => { if (!(await page.$eval('#bonusSheet', (el) => el.hidden))) await page.click('#bonusSheetOk'); };
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
      act: document.querySelectorAll('#runAct .act-node').length, actOpacity: getComputedStyle($('runAct')).opacity,
    };
  });
  const receiptOk = (o) => o.act === 4 && o.actOpacity === '1' && o.shown && /\brun-over\b/.test(o.cls) && !/playing|waiting/.test(o.cls) && o.title === 'RUN OVER' && /^SHORT BY \d+$/.test(o.short || '')
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
  if (fresh.level !== 1 || fresh.phase !== 'playing' || fresh.runScore !== 0 || Object.keys(fresh.ups).length || fresh.bank.length || (await text('#levelText')) !== '1') note(vp, `new run: ${JSON.stringify(fresh)}`);
  await page.reload();
  await page.waitForSelector('#board .cell');
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
      hand: !$('endHand').hidden, ups, left: document.querySelectorAll('.win-black, .win-chip, .win-over, .shards-layer').length, busy: window.__diceSnake.app.busy,
      act: $('endAct').hidden ? null : { done: $('endAct').querySelectorAll('.act-node.done').length, opacity: getComputedStyle($('endAct')).opacity, bottom: $('endAct').getBoundingClientRect().bottom },
    };
  });
  if (!cleared.act || cleared.act.opacity !== '1' || cleared.act.bottom > vp.h + 0.5 || !cleared.act.done) note(vp, `the cleared screen's act strip: ${JSON.stringify(cleared.act)}`);
  if (!/\bwon\b/.test(cleared.cls) || /playing|waiting/.test(cleared.cls) || cleared.title !== 'LEVEL CLEARED' || cleared.color !== 'rgb(255, 255, 255)' || !/^\+\d+ OVER$/.test(cleared.over || '') || !cleared.hand || cleared.busy) note(vp, `cleared screen: ${JSON.stringify(cleared)}`);
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
  const saved = await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('dice-snake.v2')).modes.auto; return { phase: m.game.phase, counted: !!m.lastEnd && m.lastEnd.seed === m.game.level.seed, board: !!(m.lastEnd && m.lastEnd.board) }; });
  if (saved.phase !== 'lost' || !saved.counted || !saved.board) note(vp, `the run was not counted with its board at PLAY: ${JSON.stringify(saved)}`);
  await page.reload();
  await page.waitForSelector('#board .cell');
  await page.waitForTimeout(300);
  const again = await receipt();
  if (!receiptOk(again)) note(vp, `reload in the loss moment: ${JSON.stringify(again)}`);
  // the best runs from the receipt
  await page.click('#runsBtn');
  await page.waitForTimeout(150);
  const runs = await page.evaluate(() => ({ shown: !document.getElementById('runsSheet').hidden, rows: document.querySelectorAll('#runsList li:not(.none)').length, title: document.getElementById('runsTitle').textContent }));
  if (!runs.shown || runs.rows < 1 || runs.title !== 'YOUR BEST RUNS') note(vp, `best runs: ${JSON.stringify(runs)}`);
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
  await page.click('#playBtn');
  await page.waitForFunction(() => document.querySelector('#upList .up') && !document.getElementById('levelEnd').hidden && !document.getElementById('levelEnd').classList.contains('waiting'), null, { timeout: 6000 });
  await page.waitForTimeout(2200);
  const paid = await page.evaluate(() => { const st = window.__diceSnake.state(); return { bells: st.bells, shown: !document.getElementById('endBells').hidden, text: document.getElementById('endBells').textContent }; });
  if (paid.bells < 32 || !paid.shown || !/CLEAR 2/.test(paid.text)) note(vp, `a cleared level's pay: ${JSON.stringify(paid)}`);
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
  const boss = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const st = window.__diceSnake.state();
    return { level: st.game.level.levelIndex, id: st.game.level.boss, line: $('runLine').textContent, face: !$('bossFace').hidden, ticks: $('boardWrap').classList.contains('boss'), card: !$('bossCard').hidden, shop: !$('shop').hidden, cls: $('runLine').className };
  });
  if (boss.level !== 5 || !boss.id || !/BOSS/.test(boss.line) || !boss.face || !boss.ticks || !boss.card || boss.shop) note(vp, `the boss's level: ${JSON.stringify(boss)}`);
  await page.screenshot({ path: `${shots}/${vp.w}x${vp.h}-14-boss.png` });
  await ctx.close();
}
await browser.close();
if (problems.length) {
  console.error('SMOKE PROBLEMS:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('smoke OK');
