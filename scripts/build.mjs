#!/usr/bin/env node
// Builds two self-contained files from the module sources (no bundler dependency):
//   dist/index.html    – standalone page (open from disk or any static host)
//   dist/artifact.html – the same page as a claude.ai artifact fragment (title/meta/style/body)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const MODULES = [
  'src/engine/rng.js',
  'src/engine/scoring.js',
  'src/engine/geometry.js',
  'src/engine/solver.js',
  'src/engine/game.js',
  'src/engine/levels.js',
  'src/ui/app.js',
];

const declared = new Map();
const parts = MODULES.map((file) => {
  let src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (declared.has(m[1])) throw new Error(`top-level name "${m[1]}" is declared in both ${declared.get(m[1])} and ${file}`);
    declared.set(m[1], file);
  }
  src = src.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];[ \t]*$/gm, '');
  src = src.replace(/^export\s+(?=(?:const|let|var|function|class|async)\b)/gm, '');
  if (/^export\b/m.test(src)) throw new Error(`unhandled export statement in ${file}`);
  if (src.includes('</script')) throw new Error(`"</script" inside ${file} would break inlining`);
  return `// ---- ${file} ----\n${src}`;
});
const bundle = `(() => {\n'use strict';\n${parts.join('\n')}\n})();`;

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/ui/styles.css', 'utf8');
const cssTag = '<link rel="stylesheet" href="src/ui/styles.css">';
const jsTag = '<script type="module" src="src/ui/app.js"></script>';
if (!html.includes(cssTag) || !html.includes(jsTag)) throw new Error('index.html is missing the stylesheet/script tags the build expects');
const standalone = html.replace(cssTag, `<style>\n${css}</style>`).replace(jsTag, `<script>\n${bundle}\n</script>`);

const title = html.match(/<title>[^<]*<\/title>/)[0];
const fontLink = html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/)?.[0] ?? '';
const bodyInner = standalone.match(/<body>([\s\S]*)<\/body>/)[1].trim();
const fragment = `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${fontLink}\n<style>\n${css}</style>\n${bodyInner}\n`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', standalone);
writeFileSync('dist/artifact.html', fragment);
console.log(`built dist/index.html (${(standalone.length / 1024).toFixed(1)} KB) and dist/artifact.html (${(fragment.length / 1024).toFixed(1)} KB)`);
