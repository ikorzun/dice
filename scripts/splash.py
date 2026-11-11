# The splash's pictures (Figma 1333:1876, 11.11.2026), packed from the owner's library `New img/Things`: the portal of
# the mockup, a few pairs of hands and a few things, each in its own 1000 px frame as drawn (the hands a band across the
# lower half, a thing centred), at twice the size the phone shows them. The logo is the mockup's own.
#   python3 scripts/splash.py   ->  assets/ui/splash/*.webp
# The owner's choice: «Портал текущий из библиотеки, руки любые, вещи 3 штуки по 1 секунде на вещь». The pools are
# mine: hands and things that read at a glance, none of the pictures he took out of the game (Pepe, a soda can, pills,
# glasses, the hammer and sickle, a lighter, a cigar, weed).
import os

from PIL import Image

LIB = os.path.expanduser('~/Desktop/Claude/DICE/New img/Things')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'ui', 'splash')
PORTAL = 'Portal_0004_man'
HANDS = ['Skeleton', 'Robot_gold', 'Wizard_purple', 'Monkey']
THINGS = ['0120_diamond', '0014_crown_gold', '0001_goldcoin', '0002_magicball', '0121_ring_golden', '0021_heart',
          '0069_disco_ball', '0066_rose', '0004_bell']


def pack(src, dst, side):
    im = Image.open(os.path.join(LIB, f'Degoatse_{src}.png')).convert('RGBA')
    im.resize((side, side), Image.LANCZOS).save(os.path.join(OUT, dst), 'WEBP', quality=84, method=6)
    return os.path.getsize(os.path.join(OUT, dst))


def main():
    os.makedirs(OUT, exist_ok=True)
    total = pack(PORTAL, 'portal.webp', 756)  # 378 px on the 393 px phone of the mockup
    for h in HANDS:
        total += pack(f'Hands_{h}', f'hands-{h.lower().replace("_", "-")}.webp', 784)  # 392 px
    for t in THINGS:
        total += pack(f'Obj_{t}', f'thing-{t.split("_", 1)[1].replace("_", "-")}.webp', 756)
    print(f'{1 + len(HANDS) + len(THINGS)} pictures, {total // 1024} KB')


if __name__ == '__main__':
    main()
