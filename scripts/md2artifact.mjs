#!/usr/bin/env node
// Renders a docs/*.md file as a claude.ai artifact fragment (title/meta/style/body), with
// copy buttons on code blocks. Usage: node scripts/md2artifact.mjs docs/FILE.md out.html "Title"
import { readFileSync, writeFileSync } from 'node:fs';

const [src, out, title] = process.argv.slice(2);
const md = readFileSync(src, 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

const lines = md.split('\n');
const html = [];
let i = 0;
let codeIndex = 0;
while (i < lines.length) {
  const line = lines[i];
  if (line.startsWith('```')) {
    const buf = [];
    i++;
    while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
    i++;
    codeIndex++;
    html.push(`<div class="code"><button class="copy" data-copy="code-${codeIndex}" type="button">Копировать</button><pre id="code-${codeIndex}">${esc(buf.join('\n'))}</pre></div>`);
    continue;
  }
  const h = line.match(/^(#{1,3})\s+(.*)$/);
  if (h) { const level = h[1].length; html.push(`<h${level}>${inline(h[2])}</h${level}>`); i++; continue; }
  if (line.startsWith('|')) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
    const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const head = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    html.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    continue;
  }
  if (/^- /.test(line)) {
    const items = [];
    while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
    html.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
    continue;
  }
  if (/^\d+\. /.test(line)) {
    const items = [];
    while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ''));
    html.push(`<ol>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`);
    continue;
  }
  if (line.trim() === '') { i++; continue; }
  const para = [];
  while (i < lines.length && lines[i].trim() !== '' && !/^(#|\||- |\d+\. |```)/.test(lines[i])) para.push(lines[i++]);
  html.push(`<p>${inline(para.join(' '))}</p>`);
}

const page = `<title>${esc(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&display=swap">
<style>
/* Layout: a single reading column with wide tables scrolling inside their own frame. */
:root { --bg: #f6f1e6; --fg: #2a2219; --muted: #6f6253; --line: #d9cfbb; --accent: #a83a1f; --code-bg: #efe6d2; --th-bg: #e9dfc8; --font-display: "Cinzel", Georgia, serif; --font-body: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --font-mono: ui-monospace, Menlo, Consolas, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #16130f; --fg: #ece4d4; --muted: #a79a86; --line: #3a3228; --accent: #e07b55; --code-bg: #221d16; --th-bg: #2a241c; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #16130f; --fg: #ece4d4; --muted: #a79a86; --line: #3a3228; --accent: #e07b55; --code-bg: #221d16; --th-bg: #2a241c; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font: 16px/1.55 var(--font-body); margin: 0; }
.wrap { max-width: 760px; margin: 0 auto; padding-block: 24px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1 { font: 700 26px/1.2 var(--font-display); letter-spacing: .02em; margin: 0 0 8px; text-wrap: balance; }
h2 { font: 700 20px/1.25 var(--font-display); margin: 36px 0 10px; padding-top: 14px; border-top: 1px solid var(--line); text-wrap: balance; }
h3 { font: 600 16px/1.3 var(--font-body); margin: 22px 0 8px; color: var(--accent); }
p { margin: 0 0 12px; max-width: 68ch; }
ul, ol { margin: 0 0 14px; padding-left: 22px; } li { margin: 4px 0; }
strong { font-weight: 650; }
code { font: 13px/1.4 var(--font-mono); background: var(--code-bg); padding: 1px 5px; border-radius: 4px; }
.table-wrap { overflow-x: auto; margin: 0 0 16px; border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; min-width: 520px; font-size: 14px; }
th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--line); }
th { background: var(--th-bg); font-weight: 650; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
tr:last-child td { border-bottom: 0; }
.code { position: relative; margin: 0 0 14px; }
pre { margin: 0; padding: 14px 14px 14px; background: var(--code-bg); border: 1px solid var(--line); border-radius: 8px; font: 13px/1.5 var(--font-mono); white-space: pre-wrap; word-break: break-word; user-select: text; }
.copy { position: absolute; top: 8px; right: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--muted); font: 12px/1 var(--font-body); padding: 6px 9px; border-radius: 6px; cursor: pointer; }
.copy:focus-visible { outline: 2px solid var(--accent); }
.copy.done { color: var(--accent); border-color: var(--accent); }
.meta { color: var(--muted); font-size: 14px; margin-bottom: 20px; }
a { color: var(--accent); }
</style>
<main class="wrap">
${html.join('\n')}
</main>
<script>
document.querySelectorAll('.copy').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const pre = document.getElementById(btn.dataset.copy);
    const text = pre.textContent;
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Скопировано'; btn.classList.add('done'); }
    catch { const range = document.createRange(); range.selectNodeContents(pre); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); btn.textContent = 'Выделено — скопируйте'; }
    setTimeout(() => { btn.textContent = 'Копировать'; btn.classList.remove('done'); }, 1800);
  });
});
</script>
`;
writeFileSync(out, page);
console.log(`wrote ${out} (${(page.length / 1024).toFixed(1)} KB)`);
