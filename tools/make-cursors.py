"""Draws the retro mouse cursors (images/cursors/*.png) from the pixel maps below.
B = black, W = white, anything else = see-through.
Each map is drawn with chunky 2x2 pixels (32x32 file, used on normal screens) and 4x4 pixels
(64x64 "@2x" file, used on high-resolution screens), so the pointers look obviously retro.
Hotspots (the exact clicking point) are set in desktop/css/retro-cursor.css and
pages/css/classic.css. Run: python tools/make-cursors.py"""
from PIL import Image
import os

ARROW = """
B
BB
BWB
BWWB
BWWWB
BWWWWB
BWWWWWB
BWWWWWWB
BWWWWWWWB
BWWWWWWWWB
BWWWWWBBBBB
BWWBWWB
BWB BWWB
BB  BWWB
     BWWB
     BBB
"""
HAND = """
     BB
    BWWB
    BWWB
    BWWBBB
    BWWBWWBB
    BWWBWWBWBB
 BB BWWWWWWWWB
BWWBBWWWWWWWWB
BWWWBWWWWWWWWB
 BWWWWWWWWWWWB
  BWWWWWWWWWWB
  BWWWWWWWWWB
   BWWWWWWWWB
   BWWWWWWWB
    BWWWWWWB
    BBBBBBBB
"""
IBEAM = """
WWW WWW
WBBWBBW
 WWBWW
  WBW
  WBW
  WBW
  WBW
  WBW
  WBW
  WBW
  WBW
  WBW
  WBW
 WWBWW
WBBWBBW
WWW WWW
"""
COLORS = {'B': (0, 0, 0, 255), 'W': (255, 255, 255, 255)}
OUT = os.path.join(os.path.dirname(__file__), '..', 'images', 'cursors')

def draw(name, art, scale, size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for y, row in enumerate(art.strip('\n').split('\n')):
        for x, ch in enumerate(row):
            if ch in COLORS:
                for dy in range(scale):
                    for dx in range(scale):
                        img.putpixel((x * scale + dx, y * scale + dy), COLORS[ch])
    img.save(os.path.join(OUT, name))
    print('wrote', name)

for base, art in (('arrow', ARROW), ('hand', HAND), ('text', IBEAM)):
    draw(base + '.png', art, 2, 32)
    draw(base + '@2x.png', art, 4, 64)
