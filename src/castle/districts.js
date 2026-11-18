import * as THREE from 'three';
import {Instances, polar, seeded, TAU} from './geometry.js';
import {TERRACES, tierLayout} from './tiers.js';

const plaster=[0xc1bca7,0xcfc2a5,0xacad99,0xb9b2a5,0xb6b19e];
const roofs=[0x675553,0x76544a,0x775e50,0x686d70,0x637075,0x4f626c,0x556579,0x775549];
const pick=(a,r)=>a[Math.floor(r()*a.length)];
const SECTORS=24;

function local(r,a,y) {
  const cx=Math.sin(a)*r, cz=Math.cos(a)*r, sn=Math.sin(a),cs=Math.cos(a);
  return (x,z,h=0)=>new THREE.Vector3(cx+cs*x+sn*z,y+h,cz-sn*x+cs*z);
}
function shape(batch,origin,form,material,x,z,y,w,h,d,yaw,col){
  const p=origin(x,z,y);
  batch.add(form,material,p.x,p.y,p.z,w,h,d,yaw,col);
}

function tree(batch,r,a,y,h,random) {
  const x=Math.sin(a)*r,z=Math.cos(a)*r;
  batch.add('spruce','spruce',x,y,z,h*.67,h*1.16,h*.67,a,random()>.3?0xd8e0c5:0xc3d8ba);
}

function house(batch,r,a,y,w,d,h,yaw,color,roof) {
  const x=Math.sin(a)*r,z=Math.cos(a)*r;
  batch.add('box','stone',x,y+h*0.5,z,w,h,d,yaw,color);
  batch.add('roof','roofing',x,y+h-0.20,z,w+2.5,w*(0.49+(h/w)*0.05),d+2.8,yaw,roof);
}

// Chapels, watch-forts and a cross-gabled guildhall break up the eaves of
// the small towns. Dimensions here are in metres, including the real door bays.
function civic(batch,radius,angle,y,kind) {
  const p=local(radius,angle,y);
  const place=(form,mat,x,z,base,w,h,d,col)=>shape(batch,p,form,mat,x,z,base,w,h,d,angle,col);
  if(kind===1){
    place('drum','stone',0,0,27,60,54,60,0xa8af9f);
    place('drum','trim',0,0,53,66,7,66);
    place('drum','stone',0,0,65,43,21,43,0xa4aa9b);
    place('cone','roofing',0,0,76,56,71,56,0x637c80);
    for(let i=0;i<4;i++){
      const x=i%2?24:-24,z=i<2?24:-24;
      place('drum','stone',x,z,23,14,47,14,0xb1b4a6);
      place('cone','roofing',x,z,46,18,25,18,0x63737a);
    }
    return;
  }
  place('box','stone',0,0,18,kind?60:36,36,68,0xc0bfac);
  place('roof','roofing',0,0,35,kind?65:41,30,74,kind?0x644c4b:0x556e79);
  if(kind===2){
    const cross=p(0,-3,35);
    batch.add('roof','roofing',cross.x,cross.y,cross.z,34,27,85,angle+Math.PI/2,0x705451);
  }
  const sides=kind===2?[-23,23]:[-14,14];
  for(const side of sides){
    place('box','stone',side,31,30,14,60,15,0xadad99);
    place('box','trim',side,31,57,19,4,19);
    place('drum','stone',side,31,65,12,15,12,0x87918b);
    place('pinnacle','roofing',side,31,72,19,38,19,kind?0x744d4e:0x476473);
  }
}

function housesForSector(t,s,act,trees) {
  const {edge,nextR,top}=tierLayout(t);
  const random=seeded(12947+t*7459+s*287);
  const y=top+17, span=(edge-nextR)-70;
  const mid=(s+0.5)*TAU/SECTORS;
  const crowded=Math.cos(mid*3+t*1.93)+Math.sin(mid*7+t*0.47)>-0.1;
  const city={r:nextR+34+span*0.38,a:(s+0.47)*TAU/SECTORS,y,crowded};
  const iconic=(t===LANDMARK_TIER&&s===LANDMARK_SECTOR)||(crowded&&(s+2*t)%3===0);
  const rows=span>145?3:span>72?2:1;
  for(let row=0;row<rows;row++){
    const r=nextR+34+(row+0.5)*Math.max(0,span)/rows;
    const length=TAU*r/SECTORS;
    const n=Math.floor(length/(crowded?32:52));
    for(let k=0;k<n;k++){
      const a=(s+(k+0.5+(random()-0.5)*0.42)/n)*TAU/SECTORS;
      const radius=r+(random()-0.5)*Math.min(18,span/rows*0.35);
      if(iconic && Math.abs(a-city.a)*radius<54 && Math.abs(radius-city.r)<60)continue;
      const treeChance=crowded?0.16:0.62;
      if(random()<treeChance){
        const h=10+random()*17;
        const treeRandom=seeded(Math.floor(random()*3000000));
        if(trees)trees(radius,a,y,h,treeRandom);
        continue;
      }
      const w=10+random()*12,d=8+random()*11,h=7+random()*12;
      const yaw=a+(random()-0.5)*0.53+(random()>0.83?Math.PI/2:0);
      act(radius,a,y,w,d,h,yaw,pick(plaster,random),pick(roofs,random));
    }
  }
  return city;
}

// A landmark vista on the 23rd floor has a forecourt and bell tower. Other
// districts follow the same rules without needing this special viewpoint.
export const LANDMARK_TIER=2,LANDMARK_SECTOR=2;
export function galleryView() {
  const {nextR,edge,top}=tierLayout(LANDMARK_TIER);
  const a=(LANDMARK_SECTOR+0.47)*TAU/SECTORS,r=nextR+34+(edge-nextR-70)*0.38;
  const pt=local(r,a,top+17);
  return {id:'gallery', label:'外环廊城镇',position:pt(-427,188,182).toArray(),target:pt(64,4,42).toArray(),fov:46};
}

export function buildDistricts(ctx,group,kit,materials){
  for(let q=0;q<4;q++){
    const batch=new Instances(kit,materials);
    for(let t=0;t<TERRACES.length-1;t++){
      for(let s=q*6;s<q*6+6;s++){
        const focus=t===LANDMARK_TIER&&s===LANDMARK_SECTOR;
        const city=housesForSector(t,s,(...args)=>house(batch,...args),(...args)=>tree(batch,...args));
        const kind=focus?2:(s+t)%3;
        const iconic=focus||(city.crowded&&(s+2*t)%3===0);
        if(iconic)civic(batch,city.r,city.a,city.y,kind);
        const {edge,top}=tierLayout(t);
        const anchor=polar(edge,city.a,top+28);
        // The sparse manifest is resident. Sills, chimney caps, lanterns and
        // timber frames are generated once the range scheduler opens this cell.
        ctx.registerDetail({
          anchor:anchor.toArray(),enter:740,exit:1060,
          build:()=>{
            const g=new THREE.Group();g.name='Exterior district · '+(t+1)+' / '+s;
            const fine=new Instances(kit,materials);
            const streetR=edge-40,segments=36,arc=TAU/SECTORS;
            for(let j=0;j<segments;j++){
              const a=(s+(j+.5)/segments)*arc;
              fine.at('box','paving',streetR,a,top+17.27,streetR*arc/segments+.3,.62,8.2);
              if(j%5!==0)continue;
              fine.at('box','trim',streetR-5.9,a,top+17.82,4.1,.66,1.5);
              fine.at('drum','metal',streetR+5.4,a,top+19.5,.42,4.7,.42);
              fine.at('box','light',streetR+5.4,a,top+22.08,1.10,1.18,1.10);
              fine.at('pinnacle','metal',streetR+5.4,a,top+22.67,1.51,.7,1.51);
            }
            if([0,2,5,8].includes(t)){
              const num=t===0?96:62;
              for(let j=0;j<num;j++){
                const a=(j+.42)*TAU/num;
                if(a<s*arc-.015||a>(s+1)*arc+.015)continue;
                const radius=edge-12,at=local(radius,a,top);
                fine.at('drum','trim',radius,a,top+59,46,4.2,46);
                for(let q=0;q<8;q++){
                  const theta=q*TAU/8,pt=at(Math.sin(theta)*20.1,Math.cos(theta)*20.1,36);
                  fine.add('window','glass',pt.x,pt.y,pt.z,3.3,14,1,a+theta);
                }
                fine.at('cone','gild',radius,a,top+111,3.3,12,3.3);
              }
            }
            housesForSector(t,s,(r,a,y,w,d,h,yaw)=>{
              const p=local(r,a,y);
              const cx=p(0,0);const cs=Math.cos(yaw),sn=Math.sin(yaw);
              const facade=(dx,dz,yy)=>new THREE.Vector3(cx.x+cs*dx+sn*dz,y+yy,cx.z-sn*dx+cs*dz);
              const part=(form,mat,x,z,yy,ww,hh,dd,color)=>{
                const v=facade(x,z,yy);fine.add(form,mat,v.x,v.y,v.z,ww,hh,dd,yaw,color);
              };
              part('box','stone',w*0.23,-d*0.25,h+w*0.28,1.5,5,1.8,0xa5917f);
              part('box','stone',w*0.23,-d*0.25,h+w*0.28+2.5,1.95,0.6,2.1,0x77675b);
              const face=d*0.5+0.05;
              part('window','glass',0,face,0,2.1,3.5,1);
              for(const side of [-1,1]){
                part('window',(Math.floor(w)%4===0?'light':'glass'),side*w*0.29,face,2.5,1.9,3.2,1);
                part('box','bark',side*w*0.47,face-0.04,h*0.5,0.32,h,0.30);
              }
              part('box','bark',0,face,h-0.30,w,0.4,0.35);
              if(h>11){
                part('box','bark',0,face,6.0,w,0.33,0.30);
                part('window','glass',0,face,7.1,2.5,2.8,1);
              }
            },()=>{});
            if(iconic){
              const p=local(city.r,city.a,city.y);
              if(kind!==1){
                const place=(form,mat,x,z,base,w,h,d)=>shape(fine,p,form,mat,x,z,base,w,h,d,city.a);
                place('box','paving',0,51,.24,34,.49,46);
                place('box','paving',0,57,.20,122,.42,6);
                place('window','glass',0,34.25,3,7,18,1);
                place('arch','trim',0,35.25,.3,15,24,2.3);
                place('oculus','stained',0,34.80,28,11,11,1);
                place('bead','trim',0,35.2,28,12,12,9);
                for(const side of [-1,1]){
                  place('window','glass',side*9,34.25,23,3.4,9,1);
                  place('window','light',side*(kind===2?23:14),38.65,41,4,13,1);
                  const sx=side*(kind===2?30:18);
                  for(let j=0;j<5;j++){
                    const zz=-25+j*11,at=p(sx,zz,9);
                    fine.add('window','glass',at.x,at.y,at.z,5.1,17,1,city.a+side*Math.PI/2);
                    const jamb=p(sx+side*.22,zz,8);
                    fine.add('arch','trim',jamb.x,jamb.y,jamb.z,6.4,19,.9,city.a+side*Math.PI/2);
                    const foot=p(sx+side*2.7,zz-4,0),head=p(sx+side*.4,zz-4,26);
                    fine.beam(foot,head,2.0,1.8,'trim');
                  }
                  for(const j of [-1,1]){
                    const tower=side*(kind===2?23:14);
                    place('box','trim',tower+j*6.9,38.8,29,1.1,54,1.3);
                  }
                }
                for(let i=0;i<4;i++)for(const side of [-1,1])
                  place('spruce','spruce',side*(23+i*1.6),44+i*9,.2,9,15+i,9);
                for(let k=0;k<3;k++)place('box','trim',0,37+k,0.75+1.4*(2-k),13+k*2,1.5,4.0);
              }
              for(const side of [-1,1])for(let i=0;i<3;i++){
                const v=p(side*17,41+i*10,2.7);
                fine.add('drum','metal',v.x,v.y,v.z,.39,5.4,.39);
                fine.add('box','light',v.x,v.y+3.3,v.z,1.2,1.3,1.2);
                fine.add('pinnacle','metal',v.x,v.y+4,v.z,1.9,1,1.9);
              }
            }
            fine.finish(g,'Near district');return g;
          }
        });
      }
    }
    const quadrant=new THREE.Group();quadrant.name='Exterior settlements · quadrant '+q;
    batch.finish(quadrant,'Townscape');group.add(quadrant);
  }
}
