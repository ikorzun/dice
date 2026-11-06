// Serves the repo root to a Playwright page without a server process: requests to
// http://dice.local/<path> are answered from disk; CDN requests pass through.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ORIGIN = 'http://dice.local';

export async function serveRepo(page) {
  await page.route(`${ORIGIN}/**`, (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname);
    let file = path.join(ROOT, rel);
    if (file.endsWith('/')) file += 'index.html';
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ path: file });
  });
}
