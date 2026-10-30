#!/usr/bin/env node
// Builds two self-contained files from the ES module sources without a bundler dependency:
//   dist/index.html    – standalone page (open from disk or any static host)
//   dist/artifact.html – the same page as a claude.ai artifact fragment (title/meta/style/body)
// Each module becomes its own scope; `import { a } from './x.js'` turns into destructuring
// from that module's export object, so modules may reuse local names freely.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const MODULES = [
  'src/engine/rng.js',
  'src/engine/scoring.js',
  'src/engine/scoring5.js',
  'src/engine/geometry.js',
  'src/engine/solver.js',
  'src/engine/game.js',
  'src/engine/poker.js',
  'src/engine/levels.js',
  'src/engine/levels5.js',
  'src/ui/app.js',
];

const modId = (file) => `__mod_${basename(file, '.js').replace(/[^\w]/g, '_')}`;
const known = new Set(MODULES.map((f) => basename(f)));

function transform(file) {
  let src = readFileSync(file, 'utf8');
  const exportsList = new Set();
  // import { a, b } from './x.js'  ->  const { a, b } = __mod_x;
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];[ \t]*$/gm, (m, names, from) => {
    const target = basename(from);
    if (!known.has(target)) throw new Error(`${file} imports ${from}, which is not in the bundle list`);
    const list = names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const alias = s.match(/^(\w+)\s+as\s+(\w+)$/);
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
  return `// ---- ${file} ----\nconst ${modId(file)} = (() => {\n${src}\nreturn { ${[...exportsList].join(', ')} };\n})();`;
}

const bundle = `(() => {\n'use strict';\n${MODULES.map(transform).join('\n')}\n})();`;

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
