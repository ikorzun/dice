# The charms' and the bells' pictures from the owner's library `New img/Things` (owner, 12.11.2026: «Объекты я давал с
# героями»; his pick: the pictures only, every rule and price stays). Each object is cut to what it draws and centred in
# a square with a hair of margin, so it fills its box edge to edge in the shop's rows. Each charm takes the thing of the
# portals plan (art/ai/2026-11-10-portals/spec.json) whose rule is its own or the nearest, and that thing's name
# (CHARMS in src/engine/shop3.js). The files in New img are not touched.
#   python3 scripts/charms.py   ->  assets/ui/charms/<id>.webp, assets/ui/bell.webp
import os

from PIL import Image

LIB = os.path.expanduser('~/Desktop/Claude/DICE/New img/Things')
UI = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'ui')
CHARMS = {  # charm id: the owner's object (the plan's thing)
    'stone_ribbon': '0073_watermelon',  # FIVE SLICES: a five-die hand, sum +5
    'bellwether': '0001_goldcoin',  # LUCKY COIN: every cleared level pays 2 more bells
    'quick_pocket': '0045_butterfly',  # FIRST FLIGHT: the first bank card starts on the board
    'spare_knuckle': '0118_type_audio',  # REWIND: a reroll more each level
    'final_bow': '0066_rose',  # LATE BLOOM: the last hand
    'crooked_pip': '0078_tanos',  # SIX GRIP: a one counts as a six
    'velvet_grip': '0025_hold',  # SOLID HOLD: the held dice
    'echo_thimble': '0089_nokia3310',  # CALLBACK: the refund calls back two rerolls
}


def pack(src, dst, side, margin=0.02):
    im = Image.open(os.path.join(LIB, f'Degoatse_Obj_{src}.png')).convert('RGBA')
    im = im.crop(im.getchannel('A').getbbox())
    edge = round(max(im.size) * (1 + 2 * margin))
    square = Image.new('RGBA', (edge, edge), (0, 0, 0, 0))
    square.paste(im, ((edge - im.width) // 2, (edge - im.height) // 2), im)
    square.resize((side, side), Image.LANCZOS).save(dst, 'WEBP', quality=86, method=6)
    return os.path.getsize(dst)


def main():
    total = 0
    for charm, obj in CHARMS.items():
        total += pack(obj, os.path.join(UI, 'charms', f'{charm}.webp'), 192)  # 64 px in a row at a phone's 3x
    total += pack('0004_bell', os.path.join(UI, 'bell.webp'), 128)  # at most 24 px beside a number
    print(f'{len(CHARMS) + 1} pictures, {total // 1024} KB')


if __name__ == '__main__':
    main()
