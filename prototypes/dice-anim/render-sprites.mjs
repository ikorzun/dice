// Bakes variant C's sprites from the owner's model: node prototypes/dice-anim/render-sprites.mjs [--frame=144 --frames=20 --sub=8 --still=256 --q=0.82]
// Writes sprites/rolls.webp (6 rows = landing values, N tumble frames each), sprites/faces.webp
// (6 resting stills) and sprites/meta.json. Uses the Playwright already in the repo's node_modules.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { serveRepo, ROOT, ORIGIN } from './serve.mjs';

const { chromium } = createRequire(path.join(ROOT, 'package.json'))('playwright');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const qs = new URLSearchParams(args).toString();
const out = path.join(ROOT, 'prototypes/dice-anim/sprites');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await serveRepo(page);
page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${ORIGIN}/prototypes/dice-anim/render-sprites.html?${qs}`);
await page.waitForFunction(() => window.result, null, { timeout: 300000 });
const r = await page.evaluate(() => window.result);
const save = (name, url) => {
  const buf = Buffer.from(url.split(',')[1], 'base64');
  fs.writeFileSync(path.join(out, name), buf);
  return buf.length;
};
const sheetBytes = save('rolls.webp', r.sheet);
const stillBytes = save('faces.webp', r.stills);
const meta = { ...r.meta, bytes: { rolls: sheetBytes, faces: stillBytes } };
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta));
await browser.close();
