"""Bake seamless colour and relief for the Town of Beginnings' hand-laid setts."""
from pathlib import Path
from random import Random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
DEST = Path(__file__).resolve().parents[1] / "src/town/assets"
DEST.mkdir(parents=True, exist_ok=True)
artist = Random(7261)
grain = np.random.default_rng(7261)
colour = Image.new("RGB", (SIZE, SIZE), (95, 94, 81))
height = Image.new("L", (SIZE, SIZE), 43)
paint = ImageDraw.Draw(colour)
relief = ImageDraw.Draw(height)

for row in range(18):
    y = round(row * SIZE / 18)
    bottom = round((row + 1) * SIZE / 18)
    count = artist.randint(9, 13)
    start = artist.uniform(-70, 0)
    lengths = [artist.uniform(.65, 1.4) for _ in range(count)]
    x = start
    for part in lengths:
        right = x + SIZE * part / sum(lengths)
        x0, x1 = round(x + 1.2), round(right - 1.2)
        y0, y1 = y + 1, bottom - 2
        t = artist.uniform(-19, 19)
        warm = artist.uniform(-9, 9)
        stone = tuple(round(c) for c in (157+t+warm, 150+t+warm*.35, 135+t-warm*.45))
        outline = [(x0+5,y0+artist.randint(0,2)),(x1-7,y0),(x1,y0+4),
                   (x1-1,y1-5),(x1-5,y1),(x0+6,y1-artist.randint(0,2)),
                   (x0,y1-5),(x0+1,y0+6)]
        level = artist.randint(150, 185)
        for shift in (-SIZE, 0, SIZE):
            points = [(px+shift,py) for px,py in outline]
            paint.polygon(points, fill=stone)
            relief.polygon(points, fill=level)
        x = right

def smooth_periodic(field, radius):
    pad = int(radius * 4 + 1)
    wrapped = Image.fromarray(np.pad(field, pad, mode="wrap"))
    filtered = np.asarray(wrapped.filter(ImageFilter.GaussianBlur(radius)))
    return filtered[pad:-pad, pad:-pad].astype(np.float32)

def cloud(scale):
    field = grain.normal(127, 41, (scale, scale)).clip(0,255).astype('uint8')
    tiled = Image.fromarray(np.tile(field,(3,3))).resize((3*SIZE,3*SIZE), Image.Resampling.BICUBIC)
    return np.asarray(tiled,dtype=np.float32)[SIZE:2*SIZE,SIZE:2*SIZE] - 127

specks = grain.normal(0,3.2,(SIZE,SIZE))
patina = .26*cloud(48) + .17*cloud(136) + .08*cloud(360) + specks
albedo = np.asarray(colour).astype(float) + patina[:,:,None]
Image.fromarray(np.uint8(np.clip(albedo,0,255))).save(DEST/"paving-colour.webp", quality=88)
surface = smooth_periodic(np.asarray(height),1.75) + patina*.82
dx = (np.roll(surface,-1,axis=1)-np.roll(surface,1,axis=1))*.025
dy = (np.roll(surface,-1,axis=0)-np.roll(surface,1,axis=0))*.025
normals = np.stack((-dx,dy,np.ones_like(dx)),axis=-1)
normals /= np.linalg.norm(normals,axis=-1,keepdims=True)
Image.fromarray(np.uint8((normals*.5+.5)*255)).save(DEST/"paving-normal.webp", quality=88)
