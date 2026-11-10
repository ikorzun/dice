// Bakes the resting die faces (1-6 and the blank bonus face, white; a held die is the same in a frame) as the 3D renderer draws
// them with the dice matcaps, into assets/dice/face-*.webp. The page shows these from the first frame, so
// the dice wear their matcap before three.js arrives from the CDN (owner, 02.11.2026), and offline too.
// Run after any change to the die model, its matcaps or colours: node scripts/bake-faces.mjs
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve('.');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.otf': 'font/otf' };
const server = createServer(async (req, res) => {
  let path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path.endsWith('/')) path = join(path, 'index.html');
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => server.listen(0, ok));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => document.getElementById('board')?.style.getPropertyValue('--face-1').includes('data:'), null, { timeout: 30000 });
const faces = await page.evaluate(async () => {
  const style = document.getElementById('board').style;
  const out = {};
  for (const v of [0, 1, 2, 3, 4, 5, 6]) {
    const src = /url\("?(.*?)"?\)$/.exec(style.getPropertyValue(`--face-${v}`))[1];
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    out[`face-${v}`] = c.toDataURL('image/webp', 0.9);
  }
  return out;
});
await browser.close();
server.close();

await mkdir('assets/dice', { recursive: true });
let total = 0;
for (const [name, url] of Object.entries(faces)) {
  const bytes = Buffer.from(url.split(',')[1], 'base64');
  total += bytes.length;
  await writeFile(`assets/dice/${name}.webp`, bytes);
}
console.log(`baked ${Object.keys(faces).length} faces into assets/dice (${Math.round(total / 1024)} KB)`);
