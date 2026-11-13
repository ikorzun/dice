# The cards' holographic twirl (owner, 13.11.2026: a Balatro polychrome video, «сделай такой эффект на картах»): the
# video's shader twirls the card's UV around its centre and shifts the hue by it; here the twirl is drawn once, a rainbow
# whose hue runs round the centre and turns further with the distance from it. The cards lay it over their own colour
# (styles.css .holo) and turn it on their moments.
#   python3 scripts/holo.py   ->  assets/ui/holo-twirl.webp
import colorsys
import math
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'ui', 'holo-twirl.webp')
SIDE = 384
TWIST = 1.35  # turns of the hue from the centre to the edge: the spiral's arms
SAT = 0.85

im = Image.new('RGB', (SIDE, SIDE))
px = im.load()
for y in range(SIDE):
    for x in range(SIDE):
        dx, dy = (x + 0.5) / SIDE - 0.5, (y + 0.5) / SIDE - 0.5
        r = math.hypot(dx, dy) / 0.7071
        hue = (math.atan2(dy, dx) / (2 * math.pi) + TWIST * r) % 1
        px[x, y] = tuple(round(255 * c) for c in colorsys.hsv_to_rgb(hue, SAT, 1))
im.save(OUT, 'WEBP', quality=80, method=6)
print(f'{os.path.getsize(OUT) // 1024} KB')
