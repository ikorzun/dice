#!/usr/bin/env node
// Builds two self-contained files from the ES module sources without a bundler dependency:
//   dist/index.html    – standalone page (open from disk or any static host)
//   dist/artifact.html – the same page as a claude.ai artifact fragment (title/meta/style/body)
//   dist/playgama/     – the page for Playgama: the Bridge script first in <head> and its config next to it. Only this
//                        build waits for the Bridge CDN; the others never load it. Nothing else comes from outside:
//                        three.js ships in vendor/ next to the page (Playgama 1.2.5).
// Each module becomes its own scope; `import { a } from './x.js'` turns into destructuring
// from that module's export object, so modules may reuse local names freely.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { basename, extname } from 'node:path';

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
  'src/engine/auto.js',
  'src/engine/levels.js',
  'src/engine/levels5.js',
  'src/engine/levels3.js',
  'src/engine/recipes3.js',
  'src/engine/uplift3.js',
  'src/engine/upgrades3.js',
  'src/engine/run3.js',
  'src/engine/shop3.js',
  'src/ui/dice-model.js',
  'src/ui/dice3d-math.js',
  'src/ui/dice3d.js',
  'src/ui/fire.js',
  'src/ui/sound.js',
  'src/ui/shards.js',
  'src/ui/acts.js',
  'src/ui/platform.js',
  'src/ui/board.js',
  'src/ui/hero-acts.js',
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
// The heroes' and keepers' acts (hero-acts.js) are too heavy to inline (14 MB): they stay files, loaded when needed.
// dist/index.html takes them from the repository's assets (GitHub Pages serves both), the Playgama archive carries its
// own copy, and the claude.ai fragment has none (its portraits stand still).
const ACT_URL = /url\("\.\.\/\.\.\/assets\/ui\/acts\/([^"]+\.avif)"\)/g;
const cssSource = readFileSync('src/ui/styles.css', 'utf8');
const ACTS = [...cssSource.matchAll(ACT_URL)].map((m) => m[1]);
const css = cssSource
  .replace(ACT_URL, (_, file) => `url("../assets/ui/acts/${file}")`)
  .replace(/url\("\.\.\/\.\.\/(assets\/[^"]+)"\)/g, (_, file) => `url("data:${MIME[extname(file)]};base64,${readFileSync(file).toString('base64')}")`);
if (css.includes('url("../../')) throw new Error('styles.css points at a file the build does not inline');
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
const fragment = `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n${css.replace(/url\("\.\.\/assets\/ui\/acts\/[^"]+"\)/g, 'none')}</style>\n${bodyInner}\n`;

const BRIDGE = '<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>';
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const THREE_LOCAL = './vendor/three.module.min.js'; // vendor/three: three@0.160.0 from npm, MIT
const page = noFonts(standalone);
if (!page.includes(THREE_CDN)) throw new Error('dice3d.js no longer loads three@0.160.0: update the vendored copy');
const playgama = page.replace('<meta charset="utf-8">', () => `<meta charset="utf-8">\n${BRIDGE}`).split(THREE_CDN).join(THREE_LOCAL)
  .split('url("../assets/ui/acts/').join('url("acts/');
if (!playgama.includes(BRIDGE)) throw new Error('index.html has no charset line to put the Bridge script after');
if (/https:\/\/(?!bridge\.playgama\.com)[^"'\s)]*\.(?:js|css|woff2?|otf|ttf|png|webp|mp3|json)\b/.test(playgama.replace(/<!--[\s\S]*?-->/g, ''))) throw new Error('the Playgama page still loads something from outside its archive');

mkdirSync('dist/playgama/vendor', { recursive: true });
mkdirSync('dist/playgama/acts', { recursive: true });
for (const file of ACTS) copyFileSync(`assets/ui/acts/${file}`, `dist/playgama/acts/${file}`);
writeFileSync('dist/index.html', page);
writeFileSync('dist/artifact.html', fragment);
writeFileSync('dist/playgama/index.html', playgama);
copyFileSync('playgama-bridge-config.json', 'dist/playgama/playgama-bridge-config.json');
copyFileSync('vendor/three/three.module.min.js', 'dist/playgama/vendor/three.module.min.js');
console.log(`built dist/index.html (${(page.length / 1024).toFixed(1)} KB) and dist/artifact.html (${(fragment.length / 1024).toFixed(1)} KB)`);
