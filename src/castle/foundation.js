import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {polar,seeded,TAU} from './geometry.js';

function noise(a,b) {
  return Math.sin(a*3+b)+0.52*Math.sin(a*7.0+b*1.8)+0.34*Math.cos(a*16-b)+0.19*Math.sin(a*31+b);
}

// Bladed bedrock grows up to the inhabited shell. The geology is independent of
// the mathematically circular shell, so its hanging skyline is never symmetrical.
function strata(radius, height, segments, seed) {
  const random=seeded(seed), phase=random()*TAU;
  const x=[],uv=[],colors=[],indices=[];
  const rings=[[0.025,-1],[0.15,-0.77],[0.31,-0.69],[0.44,-0.5],[0.64,-0.44],
    [0.71,-0.31],[0.85,-0.24],[0.90,-0.15],[1,0],[0.84,0.055],[0.02,0.075]];
  const tint=new THREE.Color();
  for(let j=0;j<rings.length;j++){
    const [r,y]=rings[j];
    for(let k=0;k<=segments;k++){
      const a=TAU*(k%segments)/segments;
      const wiggle=noise(a,phase)*0.055+0.02*noise(a*2,phase+j*0.38);
      const rr=(r+wiggle*Math.min(1,r*5))*radius;
      const lift=noise(a,phase+1.31)*0.096+Math.cos(a*13+phase+j*0.28)*0.041;
      const yy=(y+lift*Math.sin(Math.PI*(j+1)/rings.length))*height;
      x.push(Math.sin(a)*rr+radius*(y*y)*0.19,yy,Math.cos(a)*rr+radius*y*y*0.09);
      uv.push((k/segments)*Math.max(1,Math.round(TAU*radius/136)),(y+1)*height/105);
      const value=0.7+0.12*noise(a*2.0,phase+j*0.39)+0.08*Math.sin(j*3.4)+0.09*j/rings.length;
      tint.setRGB(value*0.84,value*0.89,value*0.92);
      colors.push(tint.r,tint.g,tint.b);
      if(k<segments&&j<rings.length-1){
        const n=j*(segments+1)+k, step=segments+1;
        indices.push(n,n+1,n+step,n+1,n+step+1,n+step);
      }
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(x,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(indices);
  const faceted=g.toNonIndexed();g.dispose();faceted.computeVertexNormals();
  return faceted;
}

export function buildFoundation(group, architecture, pieces, materials) {
  const random=seeded(7421);
  const rocks=[];
  function island(x,y,z,r,h,n,seed){
    const g=strata(r,h,n,seed);g.translate(x,y,z);rocks.push(g);
  }
  island(0,-315,0,4440,1900,170,722);
  for(let n=0;n<42;n++){
    const a=n*TAU/42+random()*0.03,radius=2350+random()*1260,rr=230+random()*660;
    island(Math.sin(a)*radius,-395-random()*180,Math.cos(a)*radius,rr,430+random()*1160,12+Math.floor(random()*6),122+n*7);
  }
  for(let n=0;n<26;n++){
    const a=random()*TAU,radius=700+random()*2250;
    island(Math.sin(a)*radius,-700-random()*250,Math.cos(a)*radius,160+random()*540,450+random()*1150,9+Math.floor(random()*8),822+n*9);
  }
  // Small broken fragments drift close to their original parent outcrop.
  for(let n=0;n<30;n++){
    const a=random()*TAU,r=3840+random()*1350;
    island(Math.sin(a)*r,-640-random()*940,Math.cos(a)*r,24+random()*96,35+random()*180,8,690+n);
  }
  const outliers=[
    [-8300,2470,2300,349,390],[6560,3290,-7240,281,359],
    [7190,2690,-6810,109,166],[-3940,1805,-9570,208,230]
  ];
  outliers.forEach(([x,y,z,r,h],i)=>{
    island(x,y,z,r,h,35,8021+i);
    pieces.add('drum','turf',x,y+h*.042,z,r*1.65,h*.061,r*1.65,i*.8);
    for(let n=0;n<32;n++){
      const theta=random()*TAU,rr=Math.sqrt(random())*r*.65;
      const px=x+Math.sin(theta)*rr,pz=z+Math.cos(theta)*rr,hh=10+random()*42;
      pieces.add('cone','foliage',px,y+h*.08,pz,hh*.55,hh,hh*.55,theta,0x668568);
    }
    if(i===0){
      for(let n=0;n<5;n++){
        const a=n*TAU/6,px=x+Math.sin(a)*41,pz=z+Math.cos(a)*41;
        pieces.add('drum','stone',px,y+h*.08+26,pz,10,52,10,0,0xb6b5a3);
        pieces.add('drum','trim',px,y+h*.08+52,pz,13,4,13);
      }
    }
  });
  const foundation=new THREE.Mesh(mergeGeometries(rocks),materials.foundation);
  rocks.forEach(g=>g.dispose());
  foundation.name='The severed mountain · fractured hanging basalt';
  foundation.castShadow=foundation.receiveShadow=true;group.add(foundation);
  architecture.add('dark',[[1660,-1090],[2810,-875],[4040,-590],[4440,-490],[4700,-340],[4940,-176],[4830,-79]],220,58);
  architecture.add('lip',[[4170,-522],[4440,-535],[4630,-419],[4642,-396],[4490,-397]],220);
  architecture.add('bronze',[[4620,-399],[4710,-365],[4714,-349],[4700,-342]],220);
  architecture.add('lip',[[4700,-350],[4890,-250],[5060,-80],[5060,-35],[4880,-29]],240);
  architecture.add('facade',[[4630,-371],[4790,-328],[4930,-156]],240,98);
  for(let i=0;i<110;i++){
    const a=(i+0.35)*TAU/110;
    const wide=i%5===0?76:34;
    pieces.beam(polar(3020,a,-826),polar(4350,a,-578),wide,wide*0.60,'metal',0x8a9a9e);
    pieces.beam(polar(4350,a,-578),polar(4970,a,-115),wide,wide*0.60,'metal',0xc3c1b1);
    pieces.at('box','bronze',4706,a,-355,wide*1.14,32,38);
    if(i%5===0){
      pieces.at('drum','dark',4470,a,-556,142,124,142);
      pieces.at('cone','bronze',4470,a,-626,109,38,109);
    }
  }
}

// Long exterior arms carry a castellated gate, counterweight and metal scabbard.
export function buildSpokes(pieces,architecture) {
  const lengths=[7460,6480,6850,7560,6580,7150,7580,6640,7020];
  lengths.forEach((r,i)=>{
    const a=i*TAU/lengths.length-0.29, y=142+(i%3)*34, end=r-170;
    const main=i%3===0, scale=main?1:0.77;
    const point=(rr,side,h)=>{
      const p=polar(rr,a,h);p.x+=Math.cos(a)*side;p.z-=Math.sin(a)*side;return p;
    };
    const shoulder=main?1.18:i%3===1?.91:1.03;
    const stations=[[4230,320,213,-345],[4730,440,265,-415],[5090,351,150,-292],
      [5520,230,80,-165],[end-345,89,42,-47],[end,56,53,-8]];
    const perim=[[-.79,.87],[-.38,.965],[0,1],[.38,.965],[.79,.87],[1,.62],[.60,.15],[0,0],[-.60,.15],[-1,.62]];
    const hullPoint=(k,j)=>{
      const [rr,ww,high,low]=stations[k],[l,v]=perim[(j+perim.length)%perim.length];
      return point(rr,l*ww*shoulder,y+low+(high-low)*v);
    };
    for(let k=0;k<stations.length-1;k++){
      for(let j=0;j<perim.length;j++){
        const v=[hullPoint(k,j),hullPoint(k+1,j),hullPoint(k+1,j+1),hullPoint(k,j+1)];
        const g=new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.Float32BufferAttribute(v.flatMap(p=>[p.x,p.y,p.z]),3));
        const length=v[0].distanceTo(v[1]),width=v[1].distanceTo(v[2]);
        g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,length/82,0,length/82,width/82,0,width/82],2));
        const normal=new THREE.Vector3().subVectors(v[1],v[0]).cross(new THREE.Vector3().subVectors(v[2],v[0]));
        const centroid=v.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(.25);
        const radial=point((stations[k][0]+stations[k+1][0])*.5,0,y+(stations[k][2]+stations[k][3]+stations[k+1][2]+stations[k+1][3])*.25);
        const out=normal.dot(centroid.sub(radial))>=0;
        g.setIndex(out?[0,1,2,0,2,3]:[2,1,0,3,2,0]);g.computeVertexNormals();
        architecture.append(j<4?(k%3===0?'armorCold':'armor'):j===4||j===9?'bronze':'dark',g);
        if([0,2,4,6,8].includes(j))pieces.beam(v[0],v[1],k<3?21:11,k<3?24:13,'metal');
        if(k===1||k===3)pieces.beam(v[0],v[3],12,16,'metal');
      }
    }
    for(const side of [-1,1]){
      pieces.beam(point(4670,side*185,y+68),point(end,side*42,y+39),30,38,'trim');
      pieces.beam(point(4690,side*135,y-290),point(end-30,side*31,y+8),54,63,'metal');
      pieces.beam(point(4800,side*90,y-480),point(5420,side*70,y-110),35,52,'dark');
      const points=16;
      for(let n=0;n<points;n++){
        const t=n/points,nt=(n+1)/points;
        const rr=4720+(end-4720)*t,nr=4720+(end-4720)*nt,offset=side*(168-120*t);
        pieces.beam(point(rr,offset,y+38),point(nr,offset,y-155*(1-nt)),14,16,'metal');
      }
    }
    pieces.at('box','lip',(4800+end)/2,a,y+34,90,47,end-4800);
    for(let n=1;n<=17;n++){
      const d=4750+(end-4750)*n/18;
      pieces.at('box','bronze',d,a,y+38,165-70*n/18,31,14);
    }
    const station=end-60;
    pieces.at('drum','metal',station,a,y+40,236*scale,180*scale,236*scale);
    pieces.at('drum','trim',station,a,y+132*scale,268*scale,32*scale,268*scale);
    pieces.at('drum','dark',station,a,y+208*scale,124*scale,165*scale,124*scale);
    pieces.at('cone','metal',station,a,y+287*scale,163*scale,615*scale,163*scale);
    pieces.at('cone','gild',station,a,y+858*scale,18*scale,165*scale,18*scale);
    pieces.add('cone','metal',Math.sin(a)*station,y-55*scale,Math.cos(a)*station,199*scale,820*scale,199*scale,a,0xc1caca,Math.PI);
    pieces.add('cone','bronze',Math.sin(a)*station,y-800*scale,Math.cos(a)*station,26*scale,175*scale,26*scale,a,0xbcb29c,Math.PI);
    // Narrow radial lance beyond the watchtower.
    pieces.beam(point(station,0,y+2),point(r+235,0,y+12),22*scale,27*scale,'bronze');
    if(main||i%3===1){
      // A hanging suspension chain is made of alternating open links and a terminal bob.
      const chainY=y-780*scale,chainLength=main?382:239;
      const chainX=point(station,0,chainY);
      for(let k=0;k<11;k++){
        const cy=chainY-k*chainLength/11;
        for(const sign of [-1,1]) {
          const pp=point(station+(k%2?9*sign:0),k%2?0:9*sign,cy-9);
          pieces.add('box','bronze',pp.x,pp.y,pp.z,4,25,4);
        }
        pieces.at('drum','metal',station,a,cy-22,20,5,20);
      }
      pieces.add('drum','metal',chainX.x,chainY-chainLength,chainX.z,47,46,47);
      pieces.add('cone','gild',chainX.x,chainY-chainLength-20,chainX.z,40,88,40,a,0xffffff,Math.PI);
    }
    for(const side of [-1,1]) {
      const off=side*68*scale;
      pieces.beam(point(station,off,y+390*scale),point(station-450*scale,side*78,y+72*scale),9,10,'metal');
      pieces.beam(point(station,off,y-335*scale),point(station-480*scale,side*81,y+8*scale),13,14,'metal');
    }
    // A gatehouse at the mainland anchorage gives every arm a clear origin.
    for(const side of [-1,1]){
      const g=point(4800,side*135,y+65);
      pieces.add('drum','stone',g.x,g.y,g.z,105,255,105,0,0x838e90);
      pieces.add('cone','roofing',g.x,g.y+125,g.z,126,154,126,0,0x495b64);
    }
  });
}
