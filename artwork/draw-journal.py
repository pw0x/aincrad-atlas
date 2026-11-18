"""Paint the two original plates of the floor 22 field journal."""
from pathlib import Path
import math
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "src/cabin/assets"
FONTS = Path("C:/Windows/Fonts")
W, H = 1000, 1320
rng = random.Random(22)
ink = (65, 58, 44)
clay = (130, 75, 50)
green = (70, 86, 64)
muted = (107, 102, 77)


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def label(d, xy, words, size=24, fill=ink, face="georgia.ttf", anchor="mm"):
    d.text(xy, words, font=font(face, size), fill=fill, anchor=anchor)


def paper(number):
    g = np.random.default_rng(594 + number)
    low = Image.fromarray(g.integers(80, 180, size=(52, 40), dtype=np.uint8)).resize((W,H), Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(8))
    yy, xx = np.mgrid[0:H,0:W]
    edge = np.minimum.reduce([xx, W-xx, yy, H-yy])
    v = (np.asarray(low).astype(float)-128)*.095 + g.normal(0,1.5,(H,W)) - 13*np.exp(-edge/16)
    image = Image.fromarray(np.uint8(np.clip(np.asarray([220,203,161])+v[:,:,None],0,255)))
    d = ImageDraw.Draw(image)
    d.rounded_rectangle((44,46,W-44,H-46),radius=8,outline=(144,125,91),width=2)
    d.line((69,105,W-69,105),fill=muted,width=1)
    label(d,(500,77),"A I N C R A D     /     F I E L D   N O T E S",21,muted)
    label(d,(500,H-70),str(number),22,clay)
    return image,d


def shore(a):
    r = 1 + .112*math.sin(3*a+.5) + .075*math.sin(5*a) + .048*math.cos(7*a+.3) + .021*math.sin(13*a)
    return (r*math.cos(a),r*math.sin(a))


plate,d = paper(22)
label(d,(500,178),"The lakeshore",81,ink,"BASKVILL.TTF")
label(d,(500,243),"A footpath through the western pines",28,muted,"georgiai.ttf")
cx,cy = 488,715
def contour(k):
    points=[]
    for i in range(481):
        a=i*2*math.pi/480
        x,y=shore(a)
        points.append((cx+x*251*k+math.cos(5*a+k)*7*(k-1),cy+y*167*k+math.sin(9*a-k)*8*(k-1)))
    return points
for i in range(11):
    k=1+i*.051
    d.line(contour(k),fill=(144+i*2,132+i*2,97+i*3),width=2 if i%4==0 else 1)
d.polygon(contour(1),fill=(136,160,143),outline=ink,width=3)
for k in [.96,.92,.87]:
    d.line(contour(k),fill=(106,138,125),width=2)
mask = Image.new("1",(W,H))
ImageDraw.Draw(mask).polygon(contour(.88),fill=1)
for i in range(500):
    x,y=rng.randint(200,780),rng.randint(520,900)
    if mask.getpixel((x,y)): d.line([(x,y),(x+8,y-1),(x+13,y)],fill=(120,147,133),width=1)
for i in range(290):
    a=rng.random()*math.tau
    r=rng.uniform(1.2,1.85)
    sx,sy=shore(a)
    x,y=cx+sx*252*r,cy+sy*167*r
    if x<104 or x>895 or y<337 or y>1065: continue
    h=rng.uniform(8,25)
    d.line([(x,y-h),(x-3,y-2*h/3),(x-1,y-2*h/3),(x-5,y-h/3),(x-2,y-h/3),(x-6,y),(x+6,y),(x+2,y-h/3),(x+4,y-h/3),(x+1,y-2*h/3),(x+3,y-2*h/3),(x,y-h)],fill=green,width=2)
    d.line((x,y,x,y+4),fill=green,width=2)
trail=[(147,960),(219,925),(285,886),(278,860),(252,819),(228,778),(230,719),(208,692),(184,679)]
for a,b in zip(trail,trail[1:]):
    n=max(1,round(math.dist(a,b)/12))
    for j in range(n):
        t=j/n; u=(j+.6)/n
        d.line((a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,a[0]*(1-u)+b[0]*u,a[1]*(1-u)+b[1]*u),fill=clay,width=3)
d.rectangle((167,671,192,689),fill=(184,145,102),outline=ink,width=2)
d.polygon([(163,673),(177,658),(197,670),(192,675)],fill=clay,outline=ink)
label(d,(488,712),"L A K E",28,(55,88,85),"georgiai.ttf")
label(d,(216,641),"Cabin",24,clay,"georgiai.ttf")
for j in range(8):
    a=j*math.pi/4; length=38 if j%2==0 else 19
    o=(818,355); tip=(o[0]+math.sin(a)*length,o[1]-math.cos(a)*length)
    d.polygon([o,(o[0]+math.sin(a+.37)*11,o[1]-math.cos(a+.37)*11),tip],fill=ink)
    d.line([o,(o[0]+math.sin(a-.37)*11,o[1]-math.cos(a-.37)*11),tip],fill=ink,width=1)
label(d,(818,302),"N",20,ink)
d.line((235,1122,765,1122),fill=muted,width=2)
label(d,(500,1178),"From the water to the pinewood",29,ink,"georgiai.ttf")
plate.save(OUT/"journal-lakeshore.webp",quality=93,method=6)

plate,d=paper(23)
label(d,(500,177),"Forest studies",75,ink,"BASKVILL.TTF")
label(d,(500,240),"Specimens gathered beside the house",27,muted,"georgiai.ttf")
for stem,base in enumerate([(400,963),(447,952),(458,956)]):
    bx,by=base; angle=[-1.93,-1.30,-.90][stem]; length=[480,605,412][stem]
    curve=[]
    for j in range(121):
        t=j/120; x=bx+length*t*math.cos(angle)+math.sin(t*3+stem)*24*t
        y=by+length*t*math.sin(angle)
        curve.append((x,y))
    d.line(curve,fill=green,width=5)
    for j in range(19,116,6):
        for side in [-1,1]:
            x,y=curve[j]; length2=(59+42*math.sin(j*.022))*rng.uniform(.67,1.)
            aa=angle+side*rng.uniform(.54,.96); bend=(x+length2*math.cos(aa),y+length2*math.sin(aa))
            points=[]
            for k in range(23):
                t=k/22; wid=8*math.sin(t*math.pi)**.8
                points.append((x+(bend[0]-x)*t+math.cos(aa+math.pi/2)*wid,y+(bend[1]-y)*t+math.sin(aa+math.pi/2)*wid))
            other=[(2*(x+(bend[0]-x)*k/22)-px,2*(y+(bend[1]-y)*k/22)-py) for k,(px,py) in enumerate(points)]
            d.polygon(points+other[::-1],fill=(128+rng.randrange(15),137+rng.randrange(12),90+rng.randrange(15)),outline=green,width=2)
            d.line([curve[j],bend],fill=green,width=2)
            for k in [6,9,12,15,18]:
                t=(k-2)/22
                mid=(x+(bend[0]-x)*t,y+(bend[1]-y)*t)
                d.line([mid,points[k]],fill=green,width=1)
                d.line([mid,other[k]],fill=green,width=1)
d.line([(690,457),(751,418),(859,418)],fill=muted,width=2)
label(d,(803,394),"leaflet",26,muted,"georgiai.ttf")
label(d,(501,1032),"Fig. II    ·    Woodland fern",37,ink,"georgiai.ttf")
d.line((254,1103,746,1103),fill=muted,width=2)
label(d,(501,1155),"On the shaded side of the path.",27,green,"georgiai.ttf")
plate.save(OUT/"journal-botany.webp",quality=93,method=6)
