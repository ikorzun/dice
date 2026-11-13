# The things' and the bells' pictures from the owner's library `New img/Things` (portals plan, step 2: the things
# replace the charms, owner, 12.11.2026: «Объекты я давал с героями»; step 3b: the gallery shows all 59, the ones not
# built yet as a dark shape). Each object is cut to what it draws and centred in a square with a hair of margin, so it
# fills its box edge to edge. The list is CATALOGUE in src/engine/things3.js (['id', 'NNNN_name', kind]): one source,
# read here. Step 4: a card-thing's face on a card, 512 px as a hero's portrait. The files in New img are not touched.
#   python3 scripts/things.py   ->  assets/ui/things/<id>.webp, assets/ui/bell.webp, assets/ui/cards/thing-<card>.webp
import os
import re

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.expanduser('~/Desktop/Claude/DICE/New img/Things')
UI = os.path.join(HERE, '..', 'assets', 'ui')
SOURCE = os.path.join(HERE, '..', 'src', 'engine', 'things3.js')


def things(kind='(?:pocket|card)'):
    text = open(SOURCE, encoding='utf-8').read()
    return dict(re.findall(r"^\s+\['(\w+)', '(\d{4}_\w+)', '" + kind + r"'\],", text, re.M))


def pack(src, dst, side, margin=0.02):
    im = Image.open(os.path.join(LIB, f'Degoatse_Obj_{src}.png')).convert('RGBA')
    im = im.crop(im.getchannel('A').getbbox())
    edge = round(max(im.size) * (1 + 2 * margin))
    square = Image.new('RGBA', (edge, edge), (0, 0, 0, 0))
    square.paste(im, ((edge - im.width) // 2, (edge - im.height) // 2), im)
    square.resize((side, side), Image.LANCZOS).save(dst, 'WEBP', quality=86, method=6)
    return os.path.getsize(dst)


def main():
    out = os.path.join(UI, 'things')
    os.makedirs(out, exist_ok=True)
    found = things()
    total = 0
    for thing, obj in found.items():
        total += pack(obj, os.path.join(out, f'{thing}.webp'), 192)  # 64 px in a row at a phone's 3x
    total += pack('0004_bell', os.path.join(UI, 'bell.webp'), 128)  # at most 24 px beside a number
    cards = things('card')
    for card, obj in cards.items():
        total += pack(obj, os.path.join(UI, 'cards', f'thing-{card}.webp'), 512)  # a card's face, as a hero's portrait
    print(f'{len(found)} things, the bell and {len(cards)} card faces, {total // 1024} KB')


if __name__ == '__main__':
    main()
