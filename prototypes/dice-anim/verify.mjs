// Headless check of the prototypes: node prototypes/dice-anim/verify.mjs
// For every variant: the landing equals the engine's values (normal, reduced motion, hand + refill),
// frame-time proxy at normal speed and under 4x CPU throttling, and a slowed filmstrip in shots/.
// Headless Chromium uses SwiftShader for WebGL: frame times are a proxy, not phone numbers.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { serveRepo, ROOT, ORIGIN } from './serve.mjs';

const { chromium } = createRequire(path.join(ROOT, 'package.json'))('playwright');
const shots = path.join(ROOT, 'prototypes/dice-anim/shots');
fs.mkdirSync(shots, { recursive: true });
const only = process.argv[2];
const VARIANTS = (only ? [only] : ['flip', 'cube', 'sprite', 'gl']);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const results = {};
// Frames are kept in memory and saved as one strip per variant (half size, JPEG) to keep the folder small.
async function strip(name, bufs, cols = 6) {
  const page = await browser.newPage();
  const url = await page.evaluate(async ({ imgs, cols }) => {
    const ims = await Promise.all(imgs.map((b64) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${b64}`; })));
    const w = ims[0].width / 2; const h = ims[0].height / 2;
    const c = document.createElement('canvas');
    c.width = w * Math.min(cols, ims.length); c.height = h * Math.ceil(ims.length / cols);
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    ims.forEach((im, k) => x.drawImage(im, (k % cols) * w, Math.floor(k / cols) * h, w, h));
    return c.toDataURL('image/jpeg', 0.82);
  }, { imgs: bufs.map((b) => b.toString('base64')), cols });
  fs.writeFileSync(path.join(shots, name), Buffer.from(url.split(',')[1], 'base64'));
  await page.close();
}
for (const v of VARIANTS) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await serveRepo(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${ORIGIN}/prototypes/dice-anim/index.html?variant=${v}`);
  await page.waitForFunction(() => window.__proto);
  await page.evaluate(() => window.__proto.ready());
  await page.waitForTimeout(400);
  const board = page.locator('.tray').first();
  const idle = () => page.waitForFunction(() => !window.__proto.state.busy, null, { timeout: 20000 });
  const lastOk = () => page.evaluate(() => window.__last.checks.every((c) => c.results.every((r) => r.shown === r.target)));
  const r = { errors, runs: [] };
  const frames = [];

  // 1) slowed filmstrip (x4): frames at fixed times after the click
  await page.evaluate(() => { document.getElementById('slow').click(); });
  frames.push(await board.screenshot());
  const times = [250, 600, 950, 1300, 1700, 2200, 3000];
  const t0 = Date.now();
  await page.click('#rerollBtn');
  for (let k = 0; k < times.length; k++) {
    const dt = times[k] - (Date.now() - t0);
    if (dt > 0) await page.waitForTimeout(dt);
    frames.push(await board.screenshot());
  }
  await idle();
  frames.push(await board.screenshot());
  r.slowOk = await lastOk();
  await page.evaluate(() => { document.getElementById('slow').click(); });

  // 2) normal speed, 4 rerolls
  for (let k = 0; k < 4; k++) {
    await page.click('#rerollBtn');
    await idle();
    r.runs.push(await page.evaluate(() => ({ ...window.__last, checks: undefined })));
    r.runs[r.runs.length - 1].ok = await lastOk();
  }

  // 2b) skip: a tap on the board mid-throw must still land on the engine's values
  await page.click('#rerollBtn');
  await page.waitForTimeout(200);
  await page.dispatchEvent('#stage', 'pointerdown');
  await idle();
  r.skip = await page.evaluate(() => window.__last.ms);
  r.skipOk = await lastOk();

  // 3) 4x CPU throttling (low-end proxy)
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.click('#rerollBtn');
  await idle();
  r.throttled = await page.evaluate(() => ({ ...window.__last, checks: undefined }));
  r.throttled.ok = await lastOk();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  // 4) play a hand: count, burn, hole, refill
  await page.click('#playBtn');
  await page.waitForTimeout(450);
  frames.push(await board.screenshot());
  await idle();
  r.handOk = await lastOk();
  frames.push(await board.screenshot());
  await strip(`strip-${v}.jpg`, frames);

  // 5) reduced motion
  await page.evaluate(() => { document.getElementById('rm').click(); });
  await page.click('#rerollBtn');
  await idle();
  r.reducedOk = await lastOk();
  r.reducedMs = await page.evaluate(() => window.__last.ms);
  results[v] = r;
  console.log(v, JSON.stringify({ slowOk: r.slowOk, skipOk: r.skipOk, skipMs: r.skip, runsOk: r.runs.every((x) => x.ok), handOk: r.handOk, reducedOk: r.reducedOk, reducedMs: r.reducedMs, ms: r.runs.map((x) => x.ms), avgFrame: r.runs.map((x) => x.avgFrame), long: r.runs.map((x) => x.longFrames), throttled: { ms: r.throttled.ms, avg: r.throttled.avgFrame, long: r.throttled.longFrames, max: r.throttled.maxFrame, ok: r.throttled.ok }, errors }));
  await ctx.close();
}
// Whole page: phone (one variant) and desktop (all four side by side)
for (const [w, h, v] of [[390, 844, 'cube'], [1440, 900, 'all']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await serveRepo(page);
  await page.goto(`${ORIGIN}/prototypes/dice-anim/index.html?variant=${v}`);
  await page.waitForFunction(() => window.__proto);
  await page.evaluate(() => window.__proto.ready());
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shots, `page-${w}.png`), fullPage: true });
  await ctx.close();
}
fs.writeFileSync(path.join(shots, 'verify.json'), JSON.stringify(results, null, 2));
await browser.close();
