# The portals redesign's faces: the owner's portraits (New img/Characters, 2048 px, transparent) as the game's
# card and keeper pictures. Each bust is trimmed to what it draws, set on a square canvas resting on the bottom edge
# and centred (like the old characters peeking over the card's edge), and written at 384 px as WebP.
#   python3 scripts/portraits.py ["/path/to/New img/Characters"]   ->  assets/ui/portraits/<name>.webp
# Pepe is left out (the owner, 10.11.2026). Needs Pillow, so run it without -I.
import os, sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Desktop/Claude/DICE/New img/Characters')
OUT = 'assets/ui/portraits'
SIZE = 384
os.makedirs(OUT, exist_ok=True)
done = []
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png') or 'Pepe' in f:
        continue
    name = f.replace('Degoatse_Portraits_', '').replace('.png', '').lower()
    im = Image.open(os.path.join(SRC, f)).convert('RGBA')
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    bust = im.crop(box)
    side = max(bust.width, bust.height)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(bust, ((side - bust.width) // 2, side - bust.height))
    canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    canvas.save(f'{OUT}/{name}.webp', 'WEBP', quality=82, method=6)
    done.append((name, os.path.getsize(f'{OUT}/{name}.webp')))
print(len(done), 'portraits', sum(s for _, s in done) // 1024, 'KB:', ', '.join(n for n, _ in done))
