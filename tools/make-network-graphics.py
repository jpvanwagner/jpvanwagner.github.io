"""
MAKE-NETWORK-GRAPHICS.PY - Draws the pixel-art graphics for "The Network" webring
(images/network/*.png): the 88x31 badge, four 31x31 buttons (prev, list, random, next) and a
32x32 icon. Everything is drawn pixel by pixel (no fonts needed), so it stays crisp.
Run:  python tools/make-network-graphics.py   (needs Pillow)
"""
from PIL import Image
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'images', 'network')
os.makedirs(OUT, exist_ok=True)

# Win95-ish palette, with the site's magenta / cyan / yellow accents
BLACK, WHITE, GREY, DARK, LIGHT = (0, 0, 0), (255, 255, 255), (192, 192, 192), (128, 128, 128), (223, 223, 223)
NAVY, BLUE, CYAN, MAGENTA, YELLOW, TEAL = (0, 0, 128), (16, 132, 208), (0, 255, 255), (255, 102, 255), (255, 204, 0), (0, 128, 128)

# 3x5 pixel font (small labels)
F3 = {
    'A': ['010', '101', '111', '101', '101'], 'B': ['110', '101', '110', '101', '110'], 'D': ['110', '101', '101', '101', '110'],
    'E': ['111', '100', '110', '100', '111'], 'G': ['011', '100', '101', '101', '011'], 'H': ['101', '101', '111', '101', '101'],
    'I': ['111', '010', '010', '010', '111'], 'J': ['001', '001', '001', '101', '010'], 'K': ['101', '101', '110', '101', '101'],
    'L': ['100', '100', '100', '100', '111'], 'M': ['101', '111', '111', '101', '101'], 'N': ['110', '101', '101', '101', '101'],
    'O': ['010', '101', '101', '101', '010'], 'P': ['110', '101', '110', '100', '100'], 'R': ['110', '101', '110', '101', '101'],
    'S': ['011', '100', '010', '001', '110'], 'T': ['111', '010', '010', '010', '010'], 'V': ['101', '101', '101', '101', '010'],
    'W': ['101', '101', '111', '111', '101'], 'X': ['101', '101', '010', '101', '101'], ' ': ['000'] * 5,
}
# 5x7 pixel font (the big NETWORK on the badge)
F5 = {
    'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    'E': ['11111', '10000', '11110', '10000', '10000', '10000', '11111'],
    'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
}

def text(im, x, y, s, color, font=F3, bold=False, shadow=None):
    w = len(next(iter(font.values()))[0])
    for ch in s:
        g = font[ch]
        for r, row in enumerate(g):
            for c, bit in enumerate(row):
                if bit == '1':
                    for dx in ((0, 1) if bold else (0,)):
                        if shadow: im.putpixel((x + c + dx + 1, y + r + 1), shadow)
                        im.putpixel((x + c + dx, y + r), color)
        x += w + (2 if bold else 1)
    return x

def text_width(s, font=F3, bold=False):
    w = len(next(iter(font.values()))[0])
    return len(s) * (w + (2 if bold else 1)) - 1

def rect(im, x0, y0, x1, y1, color):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            im.putpixel((x, y), color)

def bevel(im, w, h, face=GREY):
    """A raised Win95 button: white/light top-left, dark/black bottom-right."""
    rect(im, 0, 0, w - 1, h - 1, face)
    rect(im, 0, 0, w - 1, 0, WHITE); rect(im, 0, 0, 0, h - 1, WHITE)
    rect(im, 1, 1, w - 2, 1, LIGHT); rect(im, 1, 1, 1, h - 2, LIGHT)
    rect(im, 0, h - 1, w - 1, h - 1, BLACK); rect(im, w - 1, 0, w - 1, h - 1, BLACK)
    rect(im, 1, h - 2, w - 2, h - 2, DARK); rect(im, w - 2, 1, w - 2, h - 2, DARK)

def monitor(im, x, y, screen):
    """A 7x6 computer: black frame, colored screen, little stand."""
    rect(im, x, y, x + 6, y + 4, BLACK); rect(im, x + 1, y + 1, x + 5, y + 3, screen)
    im.putpixel((x + 2, y + 1), WHITE)
    rect(im, x + 2, y + 5, x + 4, y + 5, DARK)

def ring_icon(im, ox, oy):
    """22x22: three computers wired in a ring (the webring), yellow cable."""
    pts = [(10, 1), (1, 15), (19, 15)]
    # cable ring (a rounded triangle) between the three monitors
    for (ax, ay), (bx, by) in ((pts[0], pts[1]), (pts[1], pts[2]), (pts[2], pts[0])):
        n = max(abs(bx - ax), abs(by - ay))
        for i in range(n + 1):
            x = round(ax + (bx - ax) * i / n); y = round(ay + (by - ay) * i / n)
            im.putpixel((ox + x, oy + y), YELLOW)
            if 0 <= ox + x + 1 < im.width: im.putpixel((ox + x + 1, oy + y), YELLOW)
    monitor(im, ox + 8, oy + 0, NAVY)
    monitor(im, ox + 0, oy + 14, TEAL)
    monitor(im, ox + 15, oy + 14, (128, 0, 128))

def desktop_icon(im, ox, oy):
    """The desktop's Network icon (images/icons/os/network.svg: plain pixel rectangles), drawn
    at 1:1 so the badge, the 32x32 icon and the desktop all show the same picture."""
    import re
    svg = open(os.path.join(os.path.dirname(__file__), '..', 'images', 'icons', 'os', 'network.svg')).read()
    for x, y, w, h, fill in re.findall(r'<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(#[0-9a-fA-F]{3,6})"', svg):
        f = fill.lstrip('#')
        if len(f) == 3: f = ''.join(c * 2 for c in f)
        col = tuple(int(f[i:i + 2], 16) for i in (0, 2, 4)) + ((255,) if im.mode == 'RGBA' else ())
        for yy in range(int(y), int(y) + int(h)):
            for xx in range(int(x), int(x) + int(w)):
                if 0 <= ox + xx < im.width and 0 <= oy + yy < im.height:
                    im.putpixel((ox + xx, oy + yy), col)

# ---- 88x31 badge: navy-to-blue title-bar gradient, ring icon, THE NETWORK
badge = Image.new('RGB', (88, 31), BLACK)
for x in range(1, 87):
    t = x / 86
    col = tuple(round(NAVY[i] + (BLUE[i] - NAVY[i]) * t) for i in range(3))
    rect(badge, x, 1, x, 29, col)
rect(badge, 1, 1, 86, 1, (90, 140, 230)); rect(badge, 1, 29, 86, 29, (0, 0, 70))   # a little bevel
desktop_icon(badge, 2, -1)
text(badge, 38, 8, 'THE', MAGENTA)
text(badge, 38, 15, 'NETWORK', WHITE, F5, bold=False, shadow=BLACK)
badge.save(os.path.join(OUT, 'the-network-badge.png'))

# ---- 31x31 buttons
def button(name, label, draw_icon):
    im = Image.new('RGB', (31, 31), GREY)
    bevel(im, 31, 31)
    draw_icon(im)
    w = text_width(label)
    text(im, (31 - w) // 2, 22, label, NAVY)
    im.save(os.path.join(OUT, 'the-network-' + name + '.png'))

def tri(im, left):
    # a solid arrow, 9 tall, centered in the top area
    for i in range(5):
        h = i if left else 4 - i
        x = 11 + i
        for y in range(10 - h, 11 + h):
            im.putpixel((x if left else x + 4, y), NAVY)
    # tail
    if left: rect(im, 16, 9, 19, 11, NAVY)
    else: rect(im, 11, 9, 14, 11, NAVY)

def prev_icon(im):
    im2 = im
    for i in range(5):                        # point on the left
        for y in range(10 - i, 11 + i):
            im2.putpixel((10 + i, y), NAVY)
    rect(im2, 15, 8, 20, 12, NAVY)

def next_icon(im):
    for i in range(5):                        # point on the right
        for y in range(10 - i, 11 + i):
            im.putpixel((20 - i, y), NAVY)
    rect(im, 10, 8, 15, 12, NAVY)

def list_icon(im):
    for k, y in enumerate((5, 9, 13)):
        rect(im, 8, y, 9, y + 1, MAGENTA if k == 1 else NAVY)
        rect(im, 11, y, 22, y + 1, BLACK)

def random_icon(im):
    # a die with five pips
    rect(im, 9, 4, 21, 16, BLACK); rect(im, 10, 5, 20, 15, WHITE)
    for (x, y) in ((11, 6), (18, 6), (11, 13), (18, 13)):
        rect(im, x, y, x + 1, y + 1, BLACK)
    rect(im, 14, 9, 16, 11, MAGENTA)

button('prev', 'PREV', prev_icon)
button('list', 'LIST', list_icon)
button('random', 'RANDOM', random_icon)
button('next', 'NEXT', next_icon)

# ---- 32x32 icon: the ring on a transparent background
icon = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
desktop_icon(icon, 0, 0)
icon.save(os.path.join(OUT, 'the-network-logo.png'))
print('Wrote images/network/the-network-{badge,logo,prev,list,random,next}.png')
