import * as THREE from 'three';
import {Instances,polar,TAU} from './geometry.js';

const BASE=6400;
const rotation=0.46;
function pos(x,z,y){
  return new THREE.Vector3(x*Math.cos(rotation)+z*Math.sin(rotation),BASE+y,z*Math.cos(rotation)-x*Math.sin(rotation));
}

export function buildPalace(architecture,pieces) {
  architecture.add('facade',[[0,BASE-5],[850,BASE-5],[868,BASE+10],[846,BASE+35],[826,BASE+51],[738,BASE+76],[0,BASE+76]],160,64);
  architecture.add('bronze',[[850,BASE+10],[860,BASE+13],[857,BASE+22],[850,BASE+24]],160);
  architecture.add('trim',[[782,BASE+49],[804,BASE+52],[804,BASE+64],[779,BASE+69]],160);
  architecture.add('turf',[[746,BASE+73],[732,BASE+78],[410,BASE+78]],160);
  architecture.add('ruby',[[0,BASE+63],[482,BASE+63],[490,BASE+88],[461,BASE+112],[424,BASE+151],[0,BASE+151]],96);
  architecture.add('paving',[[424,BASE+150.9],[424,BASE+151.6],[0,BASE+151.6]],120);
  architecture.add('trim',[[472,BASE+93],[479,BASE+98],[476,BASE+103],[463,BASE+104]],96);
  const place=(form,mat,x,z,y,w,h,d,col,yaw=0)=>{
    const p=pos(x,z,y);
    pieces.add(form,mat,p.x,p.y,p.z,w,h,d,yaw+rotation,col);
  };
  // A high octagonal keep, with deep red stepped roofs and paired lancet bays.
  function tower(x,z,base,diam,height,roofHeight,colour=0xb79487) {
    const d=diam,h=height,b=base;
    place('drum','stone',x,z,b+h*0.48,d,h*0.96,d,colour);
    place('drum','trim',x,z,b+h*0.07,d*1.11,h*0.035,d*1.11);
    place('drum','garnet',x,z,b+h*0.18,d*1.015,h*.034,d*1.015);
    place('drum','trim',x,z,b+h*0.59,d*1.06,h*.032,d*1.06);
    place('drum','garnet',x,z,b+h*.88,d*1.05,h*.035,d*1.05);
    place('drum','trim',x,z,b+h*.956,d*1.11,h*.048,d*1.11);
    place('cone','garnet',x,z,b+h*.975,d*1.25,roofHeight*.29,d*1.25);
    place('cone','ruby',x,z,b+h*.99+roofHeight*.118,d*.99,roofHeight*.89,d*.99);
    place('cone','gild',x,z,b+h*.99+roofHeight*.88,d*.14,roofHeight*.28,d*.14);
    for(let i=0;i<8;i++){
      const a=(i+0.5)*TAU/8;
      const rr=d*0.5*Math.cos(Math.PI/8);
      const bx=x+Math.sin(a)*rr,bz=z+Math.cos(a)*rr;
      for(const j of [-1,1]){
        const dx=j*d*.052*Math.cos(a),dz=-j*d*.052*Math.sin(a);
        place('window','glass',bx+dx+Math.sin(a),bz+dz+Math.cos(a),b+h*.64,d*.074,h*.21,1,0xffffff,a);
      }
      place('window',i%3===0?'light':'glass',bx+Math.sin(a)*1.3,bz+Math.cos(a)*1.3,b+h*.26,d*.061,h*.17,1,0xffffff,a);
      const f=i*TAU/8,px=x+Math.sin(f)*d*.5,pz=z+Math.cos(f)*d*.5;
      place('drum','trim',px,pz,b+h*.49,d*.048,h*.91,d*.048);
      if(d>109){
        place('pinnacle','gild',px,pz,b+h*.966,d*.085,roofHeight*.19,d*.085);
      }
    }
  }
  // The core is visible above the great hall roofs from every direction.
  tower(0,-21,149,262,415,420,0xb89a8d);
  tower(0,-85,355,116,297,302,0xb48d85);
  // Cross-axial great halls have individually projecting gables and a great nave.
  place('box','garnet',0,64,222,245,151,390);
  place('box','stone',0,64,256,201,153,402,0xbd9c8a);
  place('roof','ruby',0,64,329,231,159,416);
  place('box','garnet',0,10,207,455,112,150);
  place('roof','ruby',0,10,260,188,117,469,0xffffff,Math.PI/2);
  for(const side of [-1,1]){
    place('box','stone',side*112,64,199,61,98,354,0xb09682);
    place('roof','garnet',side*112,64,247,74,38,361);
    for(let n=0;n<7;n++){
      const z=-89+n*49;
      const ends=[pos(side*158,z,154),pos(side*110,z,284)];
      pieces.beam(ends[0],ends[1],13,15,'trim');
      place('pinnacle','gild',side*158,z,180,14,26,14);
    }
    tower(side*133,229,151,72,200,154,0xaa8d81);
    tower(side*199,-65,150,94,228,193,0xb79a8c);
  }
  // Main portal and stained-glass tracery in the southern gable.
  place('arch','stone',0,270,151,87,127,20,0xbbaa95);
  place('window','glass',0,268,151,64,111,2);
  place('window','gild',0,264,291,57,100,1);
  place('window','glass',0,265,295,49,89,1);
  for(const i of [-1,0,1])place('box','gild',i*12,266.2,331,2.8,62,2);
  for(let k=0;k<11;k++){
    place('box','trim',0,287+k*7,144-k*5.9,101+k*7,10,8.5);
  }
  // Ring fortifications, free-standing gate turrets and axial gardens.
  for(let n=0;n<8;n++){
    const a=(n+0.5)*TAU/8;
    const rr=n%2===0?419:464, p=polar(rr,a);
    tower(p.x,p.z,78,n%2===0?91:65,n%2===0?199:156,n%2===0?142:123,0xb49d8b);
    const nr=(n+1)%2===0?419:464, next=polar(nr,a+TAU/8);
    const l=new THREE.Vector3(next.x-p.x,0,next.z-p.z);
    if(n!==7){
      place('box','garnet',(p.x+next.x)/2,(p.z+next.z)/2,109,17,61,l.length(),0xffffff,Math.atan2(l.x,l.z));
      place('box','trim',(p.x+next.x)/2,(p.z+next.z)/2,140,22,7,l.length(),0xffffff,Math.atan2(l.x,l.z));
    }
  }
  for(let n=0;n<76;n++){
    const a=n*TAU/76,wide=n%4===0;
    pieces.at('drum','stone',751,a,BASE+89,wide?20:12,31,wide?20:12,0xb5b09c);
    if(wide)pieces.at('pinnacle','gild',751,a,BASE+107,14,28,14);
    if(n%4!==0){
      pieces.at('spruce','spruce',677,a,BASE+78,37,57,37,0xcddec8);
      pieces.at('spruce','spruce',626,a,BASE+78,29,39,29,0xc1d7ba);
    }
  }
}

export function registerRoyalCourt(ctx,kit,materials) {
  ctx.registerDetail({anchor:[0,BASE+250,0],enter:3400,exit:4000,build:()=>{
    const g=new THREE.Group();g.name='Ruby Palace · royal court and vaults';
    const batch=new Instances(kit,materials);
    const place=(form,mat,x,z,y,w,h,d,col,yaw=0)=>{
      const p=pos(x,z,y);batch.add(form,mat,p.x,p.y,p.z,w,h,d,yaw+rotation,col);
    };
    const line=(a,b,w,d,mat,col)=>batch.beam(pos(...a),pos(...b),w,d,mat,col);
    place('roof','stone',0,273,329,222,151,2.2,0xb39b89);
    place('oculus','stained',0,274.8,373,71,71,1);
    place('bead','trim',0,275.6,373,75,75,25);
    place('bead','gild',0,277.8,373,64,64,14);
    for(const s of [-1,1]){
      line([0,275,474],[s*109,275,329],4.3,4.6,'trim');
      for(let i=0;i<4;i++){
        place('drum','trim',s*(34+i*2.8),283,206-2*i,3.6,107-4*i,3.6);
        if(s===1)place('arch','trim',0,281+i*1.1,151,73+i*6,121+i*3,2.5);
      }
      for(let j=0;j<5;j++){
        const z=-69+j*64,at=pos(s*143,z,194);
        batch.add('window','glass',at.x,at.y,at.z,19,40,1,rotation+s*Math.PI/2);
        const win=pos(s*143.6,z,191);
        batch.add('arch','trim',win.x,win.y,win.z,27,52,3.0,rotation+s*Math.PI/2);
      }
      for(let j=0;j<5;j++){
        const x=s*(24+j*10);
        place('window','glass',x,266,282,5.3,24,1);
      }
      place('pinnacle','garnet',s*104,266,330,16,50,16);
      place('cone','gild',s*104,266,379,3.2,16,3.2);
    }
    const towerSpecs=[[0,-21,149,262,415,420],[0,-85,355,116,297,302]];
    for(const s of [-1,1])towerSpecs.push([s*133,229,151,72,200,154],[s*199,-65,150,94,228,193]);
    for(let n=0;n<8;n++){
      const a=(n+.5)*TAU/8,rr=n%2===0?419:464,p=polar(rr,a);
      towerSpecs.push([p.x,p.z,78,n%2===0?91:65,n%2===0?199:156,n%2===0?142:123]);
    }
    for(const [x,z,base,d,h,cap] of towerSpecs){
      for(let i=0;i<8;i++){
        const a=(i+.5)*TAU/8,rt=d*.5*Math.cos(Math.PI/8),sx=Math.sin(a),cz=Math.cos(a);
        for(const sign of [-1,1]){
          const side=sign*d*.052,xx=x+sx*(rt+1.7)+cz*side,zz=z+cz*(rt+1.7)-sx*side;
          place('arch','trim',xx,zz,base+h*.62,d*.095,h*.25,1.8,0xa9a59c,a);
          place('box','gild',xx,zz,base+h*.72,d*.009,h*.19,2.4,0xffffff,a);
          place('box','gild',xx,zz,base+h*.73,d*.062,h*.008,2.4,0xffffff,a);
        }
        const px=x+Math.sin(i*TAU/8)*d*.5,pz=z+Math.cos(i*TAU/8)*d*.5;
        place('drum','stone',px,pz,base+h*.82,d*.067,h*.24,d*.067,0xbca995);
        place('cone','garnet',px,pz,base+h*.935,d*.123,cap*.18,d*.123);
        place('cone','gild',px,pz,base+h*.935+cap*.17,d*.019,cap*.067,d*.019);
        line([x+sx*d*.48,z+cz*d*.48,base+h+cap*.14],[x+sx*d*.05,z+cz*d*.05,base+h+cap*.925],d*.011,d*.014,'garnet');
        // A miniature stepped belt under every lacework belfry.
        place('box','trim',x+sx*(rt+1.7),z+cz*(rt+1.7),base+h*.58,d*.37,h*.020,4,0xffffff,a);
      }
    }
    // Built stone causeway, stair flights and a gate flanked by channelled towers.
    place('box','paving',0,545,79,62,2,319);
    for(const s of [-1,1]){
      place('box','trim',s*32,545,81,3,6,318);
      const gx=s*49;
      place('drum','stone',gx,423,128,36,98,36,0xb6a48f);
      place('drum','trim',gx,423,173,43,6,43);
      place('cone','ruby',gx,423,177,48,57,48);
      place('cone','gild',gx,423,230,5,14,5);
      for(let k=0;k<5;k++){
        place('drum','trim',s*34,473+k*44,89,4,21,4);
        place('pinnacle','gild',s*34,473+k*44,100,6,9,6);
      }
    }
    place('arch','stone',0,423,79,81,79,32,0xb9ac97);
    place('roof','ruby',0,423,157,83,33,35);
    for(let i=0;i<14;i++){
      place('box','paving',0,384+i*4.2,148-i*4.85,70,8,5);
    }
    for(let n=0;n<8;n++){
      const a=(n+.22)*TAU/8;
      for(let k=0;k<9;k++){
        const rr=518+k*15,x=Math.sin(a)*rr,z=Math.cos(a)*rr;
        place('box','paving',x,z,78.9,7,1.4,16,0xffffff,a);
        if(k%3===0){
          place('spruce','spruce',x+Math.cos(a)*15,z-Math.sin(a)*15,78,18,31,18,0xb8c9b2);
          place('spruce','spruce',x-Math.cos(a)*15,z+Math.sin(a)*15,78,18,31,18,0xc1d1b9);
        }
      }
    }
    batch.finish(g,'Court detail');return g;
  }});
}

export function palaceView(){
  return {id:'palace',label:'百层红玉宫',position:pos(825,1970,760).toArray(),target:pos(0,0,379).toArray(),fov:44};
}
