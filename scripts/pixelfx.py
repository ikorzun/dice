# Vendors the pixelfx effects the game plays (github.com/patch-gg/pixelfx, MIT; owner, 12.11.2026: «Прекрасные эффекты…
# Добавь подходящие в игру») from a checkout of it into vendor/pixelfx/: the core they need and three effects, each file
# as it is upstream but for its import lines, which the game's build (scripts/build.mjs) wants as named imports from
# files with names of their own: core/index.js is split into the core files, the categories' _lib.js get their
# category in the name, and every file takes a pfx- prefix. The license and notice go with them.
#   python3 scripts/pixelfx.py <pixelfx checkout> <commit>
import os
import re
import shutil
import sys

SRC, COMMIT = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'vendor', 'pixelfx')
FILES = {  # upstream path -> vendored name
    'src/core/math.js': 'pfx-math.js',
    'src/core/color.js': 'pfx-color.js',
    'src/core/font.js': 'pfx-font.js',
    'src/core/painter.js': 'pfx-painter.js',
    'src/core/actor.js': 'pfx-actor.js',
    'src/core/fx.js': 'pfx-fx.js',
    'src/core/sim.js': 'pfx-sim.js',
    'src/fx/pickups/_lib.js': 'pfx-pickups-lib.js',
    'src/fx/shadow/_lib.js': 'pfx-shadow-lib.js',
    'src/fx/pickups/collect-burst.js': 'pfx-collect-burst.js',
    'src/fx/explosions/firework-burst.js': 'pfx-firework-burst.js',
    'src/fx/shadow/hex-sigil.js': 'pfx-hex-sigil.js',
}
CORE = ['math', 'color', 'font', 'painter', 'actor', 'fx', 'sim']


def exports(text):
    names = set(re.findall(r'^export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', text, re.M))
    for group in re.findall(r'^export\s*\{([^}]*)\};?\s*$', text, re.M):
        names.update(n.strip() for n in group.split(',') if n.strip())
    return names


OWNER = {}  # an exported name -> the core file it lives in (the first one, as core/index.js reads them)
for name in CORE:
    for n in exports(open(os.path.join(SRC, 'src/core', name + '.js')).read()):
        OWNER.setdefault(n, name)
OWNER['Particles'] = 'sim'  # core/index.js names sim.js's Particles over particles.js's


def rewrite(path, text):
    folder = os.path.dirname(path)

    def one(m):
        names, frm = [n.strip() for n in m.group(1).split(',') if n.strip()], m.group(2)
        if frm == '../../core/index.js':
            by = {}
            for n in names:
                if n not in OWNER:
                    raise SystemExit(f'{path}: {n} is in no vendored core file')
                by.setdefault(OWNER[n], []).append(n)
            return '\n'.join(f'import {{ {", ".join(v)} }} from "./pfx-{k}.js";' for k, v in by.items())
        if frm == './_lib.js':
            return f'import {{ {", ".join(names)} }} from "./pfx-{os.path.basename(folder)}-lib.js";'
        target = os.path.normpath(os.path.join(folder, frm))
        if target not in FILES:
            raise SystemExit(f'{path} imports {frm}, which is not vendored')
        return f'import {{ {", ".join(names)} }} from "./{FILES[target]}";'

    out = re.sub(r'^import\s*\{([^}]*)\}\s*from\s*"([^"]+)";[ \t]*$', one, text, flags=re.M)
    if re.search(r'^import\b(?![^\n]*from "\./pfx-)', out, re.M):
        raise SystemExit(f'{path}: an import the game build cannot read')
    return out


os.makedirs(OUT, exist_ok=True)
for path, name in FILES.items():
    text = open(os.path.join(SRC, path)).read()
    head = (f'// pixelfx {path} (https://github.com/patch-gg/pixelfx at {COMMIT[:7]}). MIT License, Copyright (c) 2026 Patch;\n'
            '// parts adapted from Hugo Duprez\'s MIT effects (Copyright (c) 2026 Hugo Duprez): LICENSE and NOTICE.md here.\n'
            '// Vendored by scripts/pixelfx.py: only the import lines differ from upstream.\n')
    open(os.path.join(OUT, name), 'w').write(head + rewrite(path, text))
for doc in ('LICENSE', 'NOTICE.md'):
    shutil.copyfile(os.path.join(SRC, doc), os.path.join(OUT, doc))
print(f'{len(FILES)} files into vendor/pixelfx at {COMMIT[:7]}')
