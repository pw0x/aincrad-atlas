"""Bake four sunlight-integrated cloud impostors for the kilometer-scale particle layer."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import zoom, gaussian_filter

out=Path(__file__).parent/'assets'
for variant in range(4):
    r=np.random.default_rng(3476+variant*1931)
    w,h,d=306,162,83
    zz,yy,xx=np.ogrid[-.79:.79:d*1j,-.86:.86:h*1j,-1.58:1.58:w*1j]
    field=np.full((d,h,w),-.75,np.float32)
    def sphere(x,y,z,rad,shape):
        global field
        candidate=rad-np.sqrt(((xx-x)/shape[0])**2+((yy-y)/shape[1])**2+((zz-z)/shape[2])**2)
        np.maximum(field,candidate,out=field)
    root=[]
    for i in range(10):
        t=i/9; x=(t-.5)*2.48
        rad=r.uniform(.27,.47)*(.65+.5*np.sin(t*np.pi))
        y=-.20+.12*np.sin(t*5+variant)
        z=r.uniform(-.13,.13)
        root.append((x,y,z,rad))
    for j in range(3):
        x=(j-1)*.43+r.uniform(-.20,.19)+.12*np.cos(variant)
        root.append((x,-.02+r.uniform(0,.19),r.uniform(-.14,.16),r.uniform(.25,.42)))
    for x,y,z,rad in root:
        sphere(x,y,z,rad,(1.11,1.0,.97))
        for k in range(9):
            unit=r.normal(size=3);unit/=np.linalg.norm(unit)
            cx,cy,cz=np.array([x,y,z])+unit*rad*.70
            rr=rad*r.uniform(.33,.62)
            sphere(cx,cy,cz,rr,(1.1,1,1.03))
    fbm=np.zeros_like(field)
    for scale,amplitude in [(4,.13),(9,.093),(19,.060),(41,.032),(83,.016)]:
        n=r.random((max(3,scale//2),max(3,scale*2//3),scale),dtype=np.float32)*2-1
        fbm+=zoom(n,np.array(field.shape)/np.array(n.shape),order=1,mode='reflect')*amplitude
    den=np.clip((field+fbm-.013)*10.1,0,1)
    shadow=np.zeros_like(den)
    for k in range(1,23):
        # Positive y, negative x, toward the observer along positive z.
        shadow+=np.roll(den,(round(k*.85),-round(k*1.15),round(k*2.25)),axis=(0,1,2))
    lit=np.exp(-shadow*.18)
    vertical=np.clip((yy+.57)/1.08,0,1)
    brightness=np.clip(.10+.77*lit+.14*vertical,0,1)
    base=np.array([.105,.18,.32])
    sun=np.array([1.22,1.13,1.0])
    result=np.zeros((h,w,3),np.float32); trans=np.ones((h,w),np.float32)
    for k in reversed(range(d)):
        a=-np.expm1(-den[k]*.21)
        illumination=base[None,None,:]+(sun-base)[None,None,:]*brightness[k,:,:,None]
        result+=trans[:,:,None]*a[:,:,None]*illumination
        trans*=1-a
    alpha=1-trans
    values=np.clip(result/np.maximum(.001,alpha[:,:,None]),0,1)
    srgb=np.where(values<=.0031308,values*12.92,1.055*values**(1/2.4)-.055)
    pixels=np.uint8(np.dstack((srgb,alpha)).clip(0,1)*255)[::-1]
    img=Image.fromarray(pixels).resize((612,324),Image.Resampling.LANCZOS)
    img.save(out/('cumulus-'+str(variant)+'.webp'),quality=91,method=6)
    print(variant,flush=True)
