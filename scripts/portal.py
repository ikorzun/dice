# The portal's pictures from the owner's library `New img/Things` (portals plan, step 3; owner, 10.11.2026: «после каждого
# 5 уровня открывается рандомный портал с рандомными руками и внутри вещь»). Every ring, pair of hands and thing is a
# 1000 px square drawn in register with the others, so the stage lays a ring, a thing and a pair of hands one on another
# with no offsets. They keep their 1000 px, unscaled: the stage is 402 px wide on an iPhone 17, 1206 of its pixels, so a
# smaller file would be blown up and soften the owner's lines (the spec said 720). The things are the pocket's, listed by
# THINGS in src/engine/things3.js, as scripts/things.py reads them. Pepe's hands are not used (owner, 10.11.2026). The
# files stay beside the page, as the acts do (scripts/build.mjs): a portal loads one ring, one pair and one thing.
#   python3 scripts/portal.py   ->  assets/ui/portal/{ring,hands,thing}-<id>.webp
import os
import re

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.expanduser('~/Desktop/Claude/DICE/New img/Things')
OUT = os.path.join(HERE, '..', 'assets', 'ui', 'portal')
SOURCE = os.path.join(HERE, '..', 'src', 'engine', 'things3.js')


def ident(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def save(src, dst):
    im = Image.open(os.path.join(LIB, src)).convert('RGBA')
    assert im.size == (1000, 1000), src
    im.save(os.path.join(OUT, dst), 'WEBP', quality=90, method=6)
    return os.path.getsize(os.path.join(OUT, dst))


def main():
    os.makedirs(OUT, exist_ok=True)
    count = {'ring': 0, 'hands': 0, 'thing': 0}
    total = 0
    for f in sorted(os.listdir(LIB)):
        m = re.match(r'Degoatse_Portal_\d{4}_(.+)\.png$', f) or re.match(r'Degoatse_Hands_(.+)\.png$', f)
        if not m or 'pepe' in f.lower():
            continue
        kind = 'ring' if '_Portal_' in f else 'hands'
        total += save(f, f'{kind}-{ident(m.group(1))}.webp')
        count[kind] += 1
    text = open(SOURCE, encoding='utf-8').read()
    for thing, obj in re.findall(r"^\s+(\w+): thing\('(\d{4}_\w+)'", text, re.M):
        total += save(f'Degoatse_Obj_{obj}.png', f'thing-{thing}.webp')
        count['thing'] += 1
    print(f"{count['ring']} rings, {count['hands']} pairs of hands, {count['thing']} things, {total // 1024} KB")


if __name__ == '__main__':
    main()
