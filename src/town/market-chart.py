"""Draw the map seller's fictional district survey. Run with Pillow and NumPy."""
from math import cos, hypot, pi, sin
from pathlib import Path
from random import Random

import numpy as np
from PIL import Image, ImageDraw, ImageFont


here = Path(__file__).resolve().parent
rng = Random(2201)
W, H = 1920, 1200
Y, X = np.mgrid[0:H, 0:W]
ink, rust, green = '#4a4136', '#915239', '#65755d'
grain = np.random.default_rng(2201).normal(0, 1.7, (H, W))
paper = np.array((233, 215, 172)) + (grain + 3 * np.sin(X / 102 + Y / 113) - 1.2 * np.cos(Y / 27))[..., None]
edge = np.minimum(np.minimum(X, W - X), np.minimum(Y, H - Y))
paper -= (15 * np.exp(-edge / 28))[..., None]
im = Image.fromarray(np.uint8(np.clip(paper, 0, 255)))
d = ImageDraw.Draw(im)


def font(size, italic=False):
    for name in (('GARAIT.TTF', 'DejaVuSerif-Italic.ttf') if italic else ('GARA.TTF', 'DejaVuSerif.ttf')):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def label(x, y, text, size, colour=ink, anchor='mm', italic=False):
    d.text((x, y), text, font=font(size, italic), fill=colour, anchor=anchor)


def line(points, colour=ink, width=2):
    d.line(points, fill=colour, width=width, joint='curve')


for inset, width in [(30, 3), (39, 1), (48, 3), (61, 1)]:
    d.rectangle((inset, inset, W - inset, H - inset), outline=ink, width=width)
for side in (41, H - 45):
    for x in range(49, W - 53, 44):
        d.rectangle((x, side, x + 18, side + 3), fill=rust)
for side in (41, W - 45):
    for y in range(53, H - 53, 44):
        d.rectangle((side, y, side + 3, y + 18), fill=rust)

# Winding shoreline, mountain belt and etched relief lines. This is an invented
# survey around one town, so its title and key explicitly identify the study.
u = (X - 670) / 550
v = (Y - 578) / 416
shapes = (np.sin(5 * u + 2 * v) + .62 * np.sin(10 * u - 5 * v + .4)
          + .35 * np.cos(17 * v + 6 * u) + .21 * np.cos(21 * u - 8 * v))
elevation = (1 - ((u + .14 * v) ** 2 + (v - .11 * u) ** 2) ** .61) + .087 * shapes
elevation += .12 * np.cos((u - v) * 4.7) * np.exp(-1.5 * (u * u + v * v))
frame = (X >= 76) & (X <= 1348) & (Y >= 94) & (Y <= 1069)
land = elevation > 0
sea = (np.array((154, 175, 153)) + (grain * .7 + np.sin(Y / 31 + X / 61) * 2)[..., None])
terra = (.4 * paper + .6 * np.array((221, 209, 158))
         + np.clip(elevation, 0, 1)[..., None] * np.array((-31, -20, -34)))
base = np.where(land[..., None], terra, sea)
for level in np.arange(-.15, 1.06, .046):
    crossed = (elevation < level) != (np.roll(elevation, 1, axis=0) < level)
    crossed |= (elevation < level) != (np.roll(elevation, 1, axis=1) < level)
    base[crossed] = .66 * base[crossed] + .34 * np.array((77, 85, 65))
coast = (land != np.roll(land, 2, axis=0)) | (land != np.roll(land, 2, axis=1))
base[coast] = np.array((76, 90, 73))
plate = np.asarray(im).copy()
plate[frame] = np.uint8(np.clip(base[frame], 0, 255))
im = Image.fromarray(plate)
d = ImageDraw.Draw(im)
for i in range(2600):
    x, y = rng.randrange(85, 1333), rng.randrange(103, 1061)
    if not land[y, x]:
        length = rng.randrange(3, 17)
        line([(x, y), (x + length, y + rng.choice([0, 0, 1]))], '#899b88', 1)
for x in range(140, 1335, 110):
    line([(x, 94), (x, 1069)], '#a6a68a', 1)
for y in range(150, 1059, 110):
    line([(76, y), (1348, y)], '#a6a68a', 1)

# Stippled tree masses and ink peaks, sized as symbols on an engraved plate.
woods = [(430, 513, 75), (577, 414, 47), (747, 330, 49), (877, 687, 74), (694, 881, 55)]
for cx, cy, radius in woods:
    trees = []
    for _ in range(radius * 3):
        dx, dy = rng.gauss(0, radius * .5), rng.gauss(0, radius * .25)
        x, y = int(cx + dx), int(cy + dy)
        if hypot(dx, dy * 1.5) < radius and land[y, x]:
            trees.append((y, x, rng.randrange(5, 12)))
    for y, x, h in sorted(trees):
        d.polygon([(x, y - h), (x - h / 3, y), (x + h / 3, y + 1)], fill='#798669')
        line([(x, y - h + 1), (x + 2, y), (x + 1, y + 3)], '#616e53', 1)

for band in [((430, 346), (800, 254), 45), ((805, 421), (1090, 532), 40)]:
    (ax, ay), (bx, by), n = band
    peaks = []
    for _ in range(n):
        t = rng.random()
        x, y = ax * (1 - t) + bx * t + rng.gauss(0, 28), ay * (1 - t) + by * t + rng.gauss(0, 21)
        if land[int(y), int(x)]:
            peaks.append((y, x, rng.randint(10, 32)))
    for y, x, h in sorted(peaks):
        d.polygon([(x - h * .72, y), (x, y - h), (x + h * .92, y + 2)], fill='#bdb98d')
        line([(x - h * .72, y), (x, y - h), (x + h * .92, y + 2)], '#726d52', 2)
        for j in range(3, int(h), 4):
            line([(x + j * .7, y - h + j), (x + j * .12, y - h + j * 1.13)], '#8c886a', 1)

river = [(620, 354), (643, 384), (627, 416), (650, 451), (633, 477), (650, 514),
         (675, 534), (671, 569), (700, 606), (704, 628), (736, 664), (729, 697),
         (747, 715), (736, 746), (765, 785), (767, 812), (810, 847), (816, 886), (859, 924)]
line(river, '#728e86', 6)
line(river, '#b9c1a1', 2)
roads = [[(475, 812), (500, 775), (574, 739), (591, 699), (669, 670), (706, 628), (764, 597), (837, 586), (872, 555), (913, 545)],
         [(401, 603), (441, 621), (490, 611), (547, 639), (601, 638), (669, 670)],
         [(669, 670), (652, 631), (620, 612), (605, 577), (557, 552), (553, 509)]]
for road in roads:
    line(road, '#ede0bb', 9)
    line(road, rust, 3)
for x, y, name in [(475, 812, 'South Gate'), (401, 603, 'West Fields'), (553, 509, 'The Orchard'), (913, 545, 'Watch Hill')]:
    d.ellipse((x-4,y-4,x+4,y+4),fill=ink)
    label(x, y+20, name, 21, anchor='mm', italic=True)

# Bird's-eye walled town, with towers, roofblocks and a central square.
cx, cy = 659, 675
for r in (56, 50):
    d.ellipse((cx-r, cy-r*.65, cx+r, cy+r*.65), outline=ink, width=3)
for i in range(15):
    a = i * 2*pi/15
    x, y = cx + 54*cos(a), cy + 35*sin(a)
    d.rectangle((x-3,y-6,x+3,y+2),fill='#d7c799',outline=ink)
    d.polygon([(x-5,y-5),(x,y-12),(x+5,y-5)],fill=rust)
for _ in range(100):
    x, y = rng.randrange(-44, 45), rng.randrange(-26, 27)
    if (x/44)**2 + (y/26)**2 < 1 and hypot(x, y) > 9:
        d.rectangle((cx+x,cy+y,cx+x+3,cy+y+2),fill='#806e50')
label(652, 743, 'Town of Beginnings', 34, rust, italic=True)
label(729, 170, 'NORTHERN  HEIGHTS', 24)
label(190, 920, 'Cloud Sea', 33, '#546d66', anchor='lm', italic=True)
for p in [(76, 94, 1348, 1069), (71, 89, 1353, 1074), (1380, 89, 1847, 1074)]:
    d.rectangle(p, outline=ink, width=2)

label(1613, 142, 'A I N C R A D', 48)
line([(1428, 180), (1794, 180)], rust, 2)
label(1613, 206, 'A survey of the first floor', 31, italic=True)
label(1613, 245, 'THE  SOUTHERN  DISTRICT', 20, rust)
# An inset, side-on elevation of the floating castle, crosshatched by hand.
for j in range(55):
    t = j/54
    w = 20 + 122*(t**.72)
    y = 327 + t*173
    left, right = 1613-w,1613+w
    line([(left, y), (1613, y+5+t*9), (right, y)], ink if j%5==0 else '#9b8867', 2 if j%5==0 else 1)
    if j%5==0:
        line([(left+4, y+3), (left-2, y+8), (left+14, y+7)], ink, 1)
for j in range(30):
    x = 1489 + j*8
    span = max(.08, 1-abs(x-1613)/134)
    line([(x, 503+6*span), (x+5, 507+16*span+rng.randrange(4,24)), (x+9, 503+8*span)], '#786e55', 2)
for dx, ht in [(-16,13),(-7,20),(0,35),(10,17),(17,13)]:
    line([(1613+dx,328),(1613+dx,326-ht)], ink, 3)
    d.polygon([(1609+dx,326-ht),(1613+dx,318-ht),(1617+dx,326-ht)],fill=rust)
label(1613, 574, 'Fig. I.   Outer elevation', 23, italic=True)
line([(1435, 611),(1790, 611)], rust)
cx, cy = 1613, 787
for r in [111, 104, 93, 64, 15]:
    d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=ink,width=2)
for j in range(64):
    a=j*pi/32
    line([(cx+cos(a)*102,cy+sin(a)*102),(cx+cos(a)*(91 if j%4==0 else 97),cy+sin(a)*(91 if j%4==0 else 97))],ink,2)
for j in range(16):
    a=j*pi/8
    length = 90 if j%4==0 else 62 if j%2==0 else 39
    peak=(cx+sin(a)*length,cy-cos(a)*length)
    for s, colour in [(-1, rust if j%4==0 else green), (1, '#d3bf8e')]:
        edge=(cx+sin(a+s*.20)*20,cy-cos(a+s*.20)*20)
        d.polygon([peak,edge,(cx,cy)],fill=colour,outline=ink)
for x,y,t in [(0,-130,'N'),(132,0,'E'),(0,131,'S'),(-132,0,'W')]:
    label(cx+x,cy+y,t,26)
label(cx, 971, 'Plate  01   ·   Field copy', 23, italic=True)
for i in range(8):
    d.rectangle((1463+i*37, 1012, 1500+i*37, 1022), outline=ink, fill=ink if i%2 else None)
label(80, 1112, 'PLATE  I', 27, rust, anchor='lm')
label(959, 1112, 'A T L A S    O F    T H E    F L O A T I N G    W O R L D', 25)
label(1844, 1112, 'Cartographer’s study', 26, anchor='rm', italic=True)
im.save(here / 'market-chart.webp', quality=90, method=6)
