#!/usr/bin/env node
// Builds two self-contained files from the ES module sources without a bundler dependency:
//   dist/index.html    – standalone page (open from disk or any static host)
//   dist/artifact.html – the same page as a claude.ai artifact fragment (title/meta/style/body)
//   dist/poki/         – the page for Poki: its SDK script first in <head> (the only thing loaded from outside the folder, and
//                        Poki's own host serves it), three.js and the pictures kept as files beside the page.
//   dist/crazygames/   – the page for CrazyGames: its SDK v3 script first in <head> (platform.js sees window.CrazyGames),
//                        three.js and the pictures kept as files beside it. No Bridge.
//   dist/playgama/     – the page for Playgama: the Bridge script first in <head> and its config next to it. Only this
//                        build waits for the Bridge CDN; the others never load it. Nothing else comes from outside:
//                        three.js ships in vendor/ next to the page (Playgama 1.2.5).
// Each module becomes its own scope; `import { a } from './x.js'` turns into destructuring
// from that module's export object, so modules may reuse local names freely.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { basename, dirname, extname } from 'node:path';

const MODULES = [
  'src/engine/rng.js',
  'src/engine/scoring.js',
  'src/engine/scoring5.js',
  'src/engine/geometry.js',
  'src/engine/solver.js',
  'src/engine/game.js',
  'src/engine/poker.js',
  'src/engine/hands.js',
  'src/engine/bosses3.js',
  'src/engine/uplift3.js',
  'src/engine/upgrades3.js',
  'src/engine/things3.js',
  'src/engine/auto.js',
  'src/engine/levels.js',
  'src/engine/levels5.js',
  'src/engine/levels3.js',
  'src/engine/recipes3.js',
  'src/engine/run3.js',
  'src/engine/shop3.js',
  'src/ui/dice-faces.js',
  'src/ui/dice3d-math.js',
  'src/ui/dice3d.js',
  'src/ui/fire.js',
  'src/ui/sound.js',
  'src/ui/shards.js',
  'src/ui/acts.js',
  'src/ui/platform.js',
  'src/ui/board.js',
  'src/ui/hero-acts.js',
  // pixelfx (MIT), vendored by scripts/pixelfx.py, and the game's pixel effects on it
  'vendor/pixelfx/pfx-math.js',
  'vendor/pixelfx/pfx-color.js',
  'vendor/pixelfx/pfx-font.js',
  'vendor/pixelfx/pfx-painter.js',
  'vendor/pixelfx/pfx-actor.js',
  'vendor/pixelfx/pfx-fx.js',
  'vendor/pixelfx/pfx-sim.js',
  'vendor/pixelfx/pfx-pickups-lib.js',
  'vendor/pixelfx/pfx-collect-burst.js',
  'vendor/pixelfx/pfx-firework-burst.js',
  'src/ui/pixel-fx.js',
  'src/ui/app.js',
];

const modId = (file) => `__mod_${basename(file, '.js').replace(/[^\w]/g, '_')}`;
const known = new Set(MODULES.map((f) => basename(f)));
const exportsByModule = new Map(); // basename -> Set of exported names (filled in bundle order)

function transform(file) {
  let src = readFileSync(file, 'utf8');
  const exportsList = new Set();
  // import { a, b } from './x.js'  ->  const { a, b } = __mod_x;
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];[ \t]*$/gm, (m, names, from) => {
    const target = basename(from);
    if (!known.has(target)) throw new Error(`${file} imports ${from}, which is not in the bundle list`);
    if (MODULES.findIndex((f) => basename(f) === target) >= MODULES.indexOf(file)) {
      throw new Error(`${file} imports ${from}, which is bundled after it; fix the MODULES order`);
    }
    const exported = exportsByModule.get(target) || new Set();
    const list = names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const alias = s.match(/^(\w+)\s+as\s+(\w+)$/);
      const name = alias ? alias[1] : s;
      if (!exported.has(name)) throw new Error(`${file} imports ${name} from ${from}, which does not export it`);
      return alias ? `${alias[1]}: ${alias[2]}` : s;
    });
    return `const { ${list.join(', ')} } = ${modId(target)};`;
  });
  if (/^import\b/m.test(src)) throw new Error(`unhandled import statement in ${file}`);
  // export const/let/function/class name  ->  declaration + remember name
  src = src.replace(/^export\s+(const|let|var|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/gm, (m, kind, name) => {
    exportsList.add(name);
    return `${kind} ${name}`;
  });
  // export { a, b };  ->  remember names
  src = src.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (m, names) => {
    for (const n of names.split(',').map((s) => s.trim()).filter(Boolean)) {
      const alias = n.match(/^(\w+)\s+as\s+(\w+)$/);
      exportsList.add(alias ? `${alias[2]}: ${alias[1]}` : n);
    }
    return '';
  });
  if (/^export\b/m.test(src)) throw new Error(`unhandled export statement in ${file}`);
  if (src.includes('</script')) throw new Error(`"</script" inside ${file} would break inlining`);
  exportsByModule.set(basename(file), new Set([...exportsList].map((n) => (n.includes(':') ? n.split(':')[0].trim() : n))));
  return `// ---- ${file} ----\nconst ${modId(file)} = (() => {\n${src}\nreturn { ${[...exportsList].join(', ')} };\n})();`;
}

const bundle = `(() => {\n'use strict';\n${MODULES.map(transform).join('\n')}\n})();`;

const html = readFileSync('index.html', 'utf8');
// The files the stylesheet points at (font, bonus art, icons) become data URIs, so the built pages
// stand alone wherever they are opened.
const MIME = { '.mp3': 'audio/mpeg', '.otf': 'font/otf', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
// The heroes' and keepers' acts (hero-acts.js, 26 MB) and the portal's pictures (playPortal, 2.4 MB) are too heavy to
// inline: they stay files, loaded when needed. So do the pictures past the first screen, the things, the cards and the
// portraits (1.5 MB; owner, 18.11.2026, «Да, после слияния»): the page is about 1 MB gzipped instead of 2.5, and on a
// slow phone network the game is ready in about 5 s instead of 12 (warmArt in app.js fetches them in the background). The
// first screen stays inside the page: the splash, the dice, the matcaps, the small icons, the fonts and the sounds.
// dist/index.html takes the files from the repository's assets (GitHub Pages serves both), each portal's archive carries
// its own copy (besideFiles, copyFiles), and the claude.ai fragment inlines the pictures and has no acts (its portraits
// stand still, its portal shows the thing alone).
const FILE_URL = /url\("\.\.\/\.\.\/assets\/ui\/((acts|portal|things|cards|portraits)\/[^"]+\.(?:avif|webp|svg))"\)/g;
const cssSource = readFileSync('src/ui/styles.css', 'utf8');
const FILES = [...new Set([...cssSource.matchAll(FILE_URL)].map((m) => m[1]))];
const inline = (source) => source.replace(/url\("\.\.\/\.\.\/(assets\/[^"]+)"\)/g, (_, file) => `url("data:${MIME[extname(file)]};base64,${readFileSync(file).toString('base64')}")`);
const css = inline(cssSource.replace(FILE_URL, (_, file) => `url("../assets/ui/${file}")`));
const fragmentCss = inline(cssSource.replace(FILE_URL, (m, file, dir) => (dir === 'acts' || dir === 'portal' ? 'none' : m)));
if (css.includes('url("../../') || fragmentCss.includes('url("../../')) throw new Error('styles.css points at a file the build does not inline');
// A portal's page in its own folder: the files sit beside it, at the same paths as under assets/ui/.
const besideFiles = (page) => page.split('url("../assets/ui/').join('url("');
const copyFiles = (dir) => FILES.forEach((file) => { mkdirSync(`${dir}/${dirname(file)}`, { recursive: true }); copyFileSync(`assets/ui/${file}`, `${dir}/${file}`); });
const cssTag = '<link rel="stylesheet" href="src/ui/styles.css">';
const jsTag = '<script type="module" src="src/ui/app.js"></script>';
if (!html.includes(cssTag) || !html.includes(jsTag)) throw new Error('index.html is missing the stylesheet/script tags the build expects');
if (css.includes('</style')) throw new Error('"</style" inside styles.css would break inlining');
// Replacer functions keep "$&", "$1" and friends inside the CSS/JS literal.
const standalone = html.replace(cssTag, () => `<style>\n${css}</style>`).replace(jsTag, () => `<script>\n${bundle}\n</script>`);

const title = html.match(/<title>[^<]*<\/title>/)[0];
// The Google Fonts of the old looks: every glyph the game shows is in Basteleur, which is inlined, so no page loads them.
const noFonts = (page) => page.replace(/\s*<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '');
const bodyInner = standalone.match(/<body>([\s\S]*)<\/body>/)[1].trim();
const fragment = `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n${fragmentCss}</style>\n${bodyInner}\n`;

const BRIDGE = '<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>';
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const THREE_LOCAL = './vendor/three.module.min.js'; // vendor/three: three@0.160.0 from npm, MIT
const page = noFonts(standalone);
if (!page.includes(THREE_CDN)) throw new Error('dice3d.js no longer loads three@0.160.0: update the vendored copy');
const playgama = besideFiles(page.replace('<meta charset="utf-8">', () => `<meta charset="utf-8">\n${BRIDGE}`).split(THREE_CDN).join(THREE_LOCAL));
if (!playgama.includes(BRIDGE)) throw new Error('index.html has no charset line to put the Bridge script after');
if (/https:\/\/(?!bridge\.playgama\.com)[^"'\s)]*\.(?:js|css|woff2?|otf|ttf|png|webp|mp3|json)\b/.test(playgama.replace(/<!--[\s\S]*?-->/g, ''))) throw new Error('the Playgama page still loads something from outside its archive');

const POKI_SDK = '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>';
// Poki: "Remove splash screens" (requirements-quality): without its element runSplash does nothing, the board opens at once.
const SPLASH_EL = /<div class="splash" id="splash"[\s\S]*?<\/div>\s*<\/div>\n/;
if (!SPLASH_EL.test(page)) throw new Error('index.html has no splash element for the Poki build to drop');
const poki = besideFiles(page.replace(SPLASH_EL, '').replace('<meta charset="utf-8">', () => `<meta charset="utf-8">\n${POKI_SDK}`).split(THREE_CDN).join(THREE_LOCAL));
if (!poki.includes(POKI_SDK)) throw new Error('index.html has no charset line to put the Poki SDK after');
// Poki blocks every external request but its own SDK: nothing else may point outside the folder.
if (/https:\/\/(?!game-cdn\.poki\.com|www\.w3\.org)[^"'\s)]*\.(?:js|css|woff2?|otf|ttf|png|webp|mp3|json)\b/.test(poki.replace(/<!--[\s\S]*?-->/g, ''))) throw new Error('the Poki page still loads something from outside its folder');

mkdirSync('dist/poki/vendor', { recursive: true });
copyFiles('dist/poki');
writeFileSync('dist/poki/index.html', poki);
copyFileSync('vendor/three/three.module.min.js', 'dist/poki/vendor/three.module.min.js');

const SDK = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>';
const crazygames = besideFiles(page.replace('<meta charset="utf-8">', () => `<meta charset="utf-8">\n${SDK}`).split(THREE_CDN).join(THREE_LOCAL));
if (!crazygames.includes(SDK)) throw new Error('index.html has no charset line to put the CrazyGames SDK after');
if (/https:\/\/(?!sdk\.crazygames\.com)[^"'\s)]*\.(?:js|css|woff2?|otf|ttf|png|webp|mp3|json)\b/.test(crazygames.replace(/<!--[\s\S]*?-->/g, ''))) throw new Error('the CrazyGames page still loads something from outside its folder');

mkdirSync('dist/crazygames/vendor', { recursive: true });
copyFiles('dist/crazygames');
writeFileSync('dist/crazygames/index.html', crazygames);
copyFileSync('vendor/three/three.module.min.js', 'dist/crazygames/vendor/three.module.min.js');

mkdirSync('dist/playgama/vendor', { recursive: true });
copyFiles('dist/playgama');
writeFileSync('dist/index.html', page);
writeFileSync('dist/artifact.html', fragment);
writeFileSync('dist/playgama/index.html', playgama);
copyFileSync('playgama-bridge-config.json', 'dist/playgama/playgama-bridge-config.json');
copyFileSync('vendor/three/three.module.min.js', 'dist/playgama/vendor/three.module.min.js');
console.log(`built dist/index.html (${(page.length / 1024).toFixed(1)} KB) and dist/artifact.html (${(fragment.length / 1024).toFixed(1)} KB)`);
