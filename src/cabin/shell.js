import * as T from 'three';
import { Kit,random } from './kit.js';

const floorY=.60, frontZ=-3.55, rightX=4.49, eaves=3.76, ridge=5.76;
const rand=random(419611);
function beam(k,m,a,b,width,height) {
  const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start),length=dir.length();
  const mid=start.add(end).multiplyScalar(.5);
  const qt=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),dir.normalize());
  k.box(m,...mid.toArray(),width,height,length,qt);
}
function logs(k,m,y,axis,fixed,lo,hi,index) {
  if(hi-lo<.11)return;
  const a=axis==='x'?[lo,y,fixed]:[fixed,y,lo], b=axis==='x'?[hi,y,fixed]:[fixed,y,hi];
  const radius=.169+(index%3)*.005;
  const logGeometry=new T.CylinderGeometry(1,.99,1,32,1,true);
  const uv=logGeometry.attributes.uv, off=rand()*.64,offY=rand();
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.57+off,uv.getY(i)*(hi-lo)/1.96+offY);
  const along=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(b[0]-a[0],0,b[2]-a[2]).normalize());
  k.put(logGeometry,m.log[(rand()*5)|0],[(a[0]+b[0])/2,y,(a[2]+b[2])/2],[radius,hi-lo,radius],along);

  const e=axis==='x'?[1,0,0]:[0,0,1];
  k.disc(m.end,b.map((v,i)=>v+.003*e[i]),e,radius*.99);
  k.disc(m.end,a.map((v,i)=>v-.003*e[i]),e.map(v=>-v),radius);
}
function windowFrame(k,m,x1,x2,y1,y2,z,curtains=true){
  const cx=(x1+x2)/2,w=x2-x1;
  for(const x of [x1,x2])k.box(m.oak,x,(y1+y2)/2,z,.13,y2-y1+.22,.39);
  k.box(m.pine,cx,y1-.015,z,w+.33,.135,.47,undefined,true);
  k.box(m.oak,cx,y2+.025,z,w+.27,.15,.41);
  for(const v of [-1,1]){
    const zz=z+.11*v;
    k.box(m.pine,cx,y2-.052,zz,w-.13,.048,.08);
    k.box(m.pine,cx,y1+.045,zz,w-.13,.045,.08);
    k.box(m.pine,cx,y1+(y2-y1)*.685,zz,w-.10,.037,.055);
    for(let i=1;i<Math.round(w/.83);i++)k.box(m.pine,x1+w*i/Math.round(w/.83),(y1+y2)/2,zz,.045,y2-y1-.1,.055);
  }
  k.box(m.glass,cx,(y1+y2)/2,z,w-.14,y2-y1-.1,.015);
  if(!curtains)return;
  k.stick(m.iron,[x1-.22,y2+.12,z+.22],[x2+.22,y2+.12,z+.22],.024,.024);
  for(const x of [x1-.22,x2+.22])k.ell(m.brass,x,y2+.12,z+.22,.044,.045,.044);
  for(const side of [-1,1]){
    const edges=36,rows=30,points=[],uv=[],index=[];
    const at=side<0?x1-.025:x2+.025;
    for(let j=0;j<=rows;j++){const v=j/rows, pinch=v<=.64?.23+.77*(.5+.5*Math.cos(Math.PI*v/.64)):.23+.54*(.5-.5*Math.cos(Math.PI*(v-.64)/.36)),width=Math.min(w*.26,.65)*pinch;
      for(let i=0;i<=edges;i++){
        const u=i/edges;const h=(y2-y1+.10)*v;
        points.push(at+(-side)*(width*u+.056*Math.sin(v*Math.PI)), y2+.057-h+.027*Math.cos(8*Math.PI*u)*v*v,
          z+.37+.048*Math.sin(u*10*Math.PI+.3)*(.45+.55*pinch)+.035*Math.sin(v*Math.PI));
        uv.push(u,1-v);if(i<edges&&j<rows){const a=j*(edges+1)+i;index.push(a,a+edges+1,a+1,a+1,a+edges+1,a+edges+2);}
      }
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(index);geo.computeVertexNormals();k.put(geo,m.curtain,[0,0,0]);
    const bx=at-side*.075,by=y2+.057-(y2-y1+.1)*.64;
    k.tube(m.gold,[[bx-.065,by+.025,z+.372],[bx,by,z+.439],[bx+.065,by+.016,z+.382]],.013);
    k.stick(m.gold,[bx,by,z+.438],[bx-side*.04,by-.12,z+.438],.009);
    for(let i=0;i<5;i++)k.ring(m.brass,at-side*(i+.25)*Math.min(w*.26,.65)/5,y2+.109,z+.22,.039,.007,[0,Math.PI/2,0]);
  }
}
function door(k,m,x,z){
  const w=1.50,h=2.25,cy=floorY+h/2;
  k.box(m.black,x,cy,z,w+.13,h+.1,.19);
  for(let i=0;i<7;i++)k.box(m.case,x-w/2+(i+.5)*w/7,cy,z,w/7-.009,h,.25,undefined,true);
  for(const zz of [z-.162,z+.162]){
    for(const xx of [x-.67,x+.67])k.box(m.pine,xx,cy,zz,.09,h,.064);
    for(const yy of [.74,1.55,2.73])k.box(m.pine,x,yy,zz,w-.07,.093,.071);
    // Carved wheat emblem, bent like a pair of reeds above the latch.
    for(const side of [-1,1]){
      k.tube(m.brass,[[x,1.72,zz],[x+side*.105,1.92,zz],[x+side*.23,2.14,zz],[x+side*.25,2.43,zz]],.009);
      for(let i=0;i<5;i++){
        const t=i/5, bx=x+side*(.055+.215*Math.sin(t*1.4)),by=1.82+t*.65;
        k.ell(m.gold,bx+side*.036,by+.026,zz,.016,.047,.009,[0,0,-side*.48]);
        k.ell(m.gold,bx-side*.031,by+.047,zz,.014,.043,.009,[0,0,side*.53]);
      }
    }
    for(const yy of [1.07,2.4]){
      k.box(m.iron,x-.44,yy,zz,.48,.055,.036);
      k.ell(m.iron,x-.19,yy,zz,.088,.053,.023);
      for(const dx of [-.6,-.43,-.23])k.ell(m.brass,x+dx,yy,zz+(zz-z)*.12,.015,.015,.014);
    }
    k.box(m.iron,x+.47,1.57,zz,.11,.23,.03,undefined,true);
    k.ring(m.brass,x+.47,1.54,zz+(zz-z)*.23,.068,.012,[0,0,0]);
    k.ell(m.brass,x+.47,1.61,zz+(zz-z)*.26,.028,.03,.021);
  }
  for(const xx of [x-w/2-.08,x+w/2+.08])k.box(m.oak,xx,cy,z,.17,h+.15,.4);
  k.box(m.oak,x,floorY+h+.07,z,w+.47,.17,.45);
}
function attachRoof(k,m){
  const slope=(ridge-eaves)/3.85,angle=Math.atan(slope),eaveZ=4.22,xmax=5.06;
  for(const side of [-1,1]){
    const strike=Math.sqrt(1+slope*slope);
    k.box(m.oak,0,ridge-slope*eaveZ/2,eaveZ*side/2,10.15,.15,eaveZ*strike,[angle*side,0,0]);
    // Overlap each shingle course downslope. Split lengths and broken bonds keep the eave silhouette irregular.
    const rows=16;
    for(let row=0;row<rows;row++){
      const dist=eaveZ*(row+.5)/rows;
      for(let x=-xmax-(row%2)*.22;x<xmax;){
        const w=.37+rand()*.16;const a=Math.max(-xmax,x),b=Math.min(xmax,x+w-.008);x+=w;
        if(b<=a+.02)continue;
        const z=side*(dist+(rand()-.5)*.017);
        k.box(m.roof[(rand()*m.roof.length)|0],(a+b)/2,ridge-slope*Math.abs(z)+.123+(rows-row)*.002,z,b-a,.063,(eaveZ/rows+.098)*strike,[angle*side,0,0]);
      }
    }
    k.box(m.edge,0,eaves-.28,side*4.18,10.18,.18,.15);
  }
  k.stick(m.edge,[-5.13,ridge+.11,0],[5.13,ridge+.11,0],.12,.12,14);
  for(const x of [-4.52,-2.24,0,2.24,4.52]){
    k.box(m.oak,x,3.68,0,.20,.20,7.48);
    for(const side of [-1,1]){
      beam(k,m.pine,[x,3.66,side*3.75],[x,ridge-.12,0],.18,.17);
      beam(k,m.oak,[x,3.72,side*2.8],[x,4.58,side*1.08],.12,.14);
      k.ell(m.iron,x+.108,3.70,side*3.34,.017,.036,.036);
    }
    beam(k,m.oak,[x,3.72,0],[x,ridge-.13,0],.14,.14);
  }
  for(const x of [-4.49,4.49]){
    for(let row=0;row<7;row++){const y=eaves+.12+row*.26,delta=(ridge-y)/slope;if(delta>0)logs(k,m,y,'z',x,-delta,delta,row);}
    for(const side of [-1,1])beam(k,m.pine,[x,eaves-.14,side*4.21],[x,ridge+.04,0],.20,.16);
  }
  // Lower roof over the entrance porch.
  for(let i=0;i<18;i++){const x=.12+i*.282;
    k.box(m.roof[i%5],x,3.29,-4.65,.293,.092,2.57,[-.24,0,0]);}
  for(const z of [-3.81,-4.38,-4.98,-5.56])k.box(m.oak,-2.41,3.58+(z+3.45)*.243,z,4.77,.085,.11);
  for(const x of [-4.62,-3.48,-2.3,-1.13,0,2.30,4.62]){
    beam(k,m.oak,[x,3.55,-3.45],[x,2.96,-5.88],.15,.16);
  }
  for(const x of [-4.58,0,4.58]){
    k.box(m.pine,x,1.81,-5.48,.19,2.50,.19);
    k.box(m.iron,x,.79,-5.48,.202,.12,.202);
    for(const side of [-1,1])if(Math.abs(x+side*.55)<4.75)beam(k,m.oak,[x,2.5,-5.48],[x+side*.53,3,-5.48],.09,.13);
  }
  k.box(m.oak,0,2.997,-5.5,9.55,.18,.20);
}
function stoneBase(k,m){
  k.box(m.stone[0],0,.175,0,9.20,.68,7.25);
  for(const side of [-1,1])for(let j=0;j<2;j++){
    for(let x=-4.57-j*.20;x<4.58;){const w=.48+rand()*.37;const lo=Math.max(-4.56,x),hi=Math.min(4.56,x+w-.018);x+=w;if(hi-lo>.07)k.box(m.stone[(rand()*6)|0],(lo+hi)/2,.04+j*.245,side*3.60,hi-lo,.23,.16,[0,0,(rand()-.5)*.055],true);}
    for(let z=-3.6-j*.2;z<3.61;){const w=.49+rand()*.31;const lo=Math.max(-3.6,z),hi=Math.min(3.6,z+w-.015);z+=w;if(hi-lo>.07)k.box(m.stone[(rand()*6)|0],side*4.56,.04+j*.245,(lo+hi)/2,.16,.22,hi-lo,[0,0,(rand()-.5)*.04],true);}
  }
  k.box(m.edge,0,.45,0,9.24,.23,7.25);
  const geom=new T.PlaneGeometry(9.13,7.15);const uv=geom.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*3.55,uv.getY(i)*3.05);
  k.put(geom,m.floor,[0,floorY,0],[1,1,1],[-Math.PI/2,0,0]);
}
function porch(k,m){
  for(let i=0;i<13;i++)k.box(m.pine,0,.495,-3.52-i*.171,9.52,.15,.164);
  for(let i=0;i<3;i++)k.box(m.oak,3.02,.14+i*.155,-6.20+i*.27,1.82,.16,.31);
  for(const [lo,hi] of [[-4.56,-.08],[.10,1.91],[4.04,4.55]]){
    for(const y of [.85,1.33])k.box(m.pine,(lo+hi)/2,y,-5.48,hi-lo,.1,.105);
    for(let x=lo+.25;x<hi;x+=.36)k.box(m.oak,x,1.07,-5.49,.041,.40,.055);
  }
  for(const x of [-4.57,4.57]){
    for(const y of [.85,1.33])k.box(m.oak,x,y,-4.55,.09,.09,1.79);
  }
}
function unfinishedInterior(k,m){
  // The Day Before describes a wide living room finished in pale unfinished boards. Its log structure stays visible outside.
  for(let row=0;row<16;row++){
    const h=.178,y=.69+row*.184;
    const front=(lo,hi)=>k.box(m.lining,(lo+hi)/2,y,-3.357,hi-lo,h,.049);
    const side=(x,lo,hi)=>k.box(m.lining,x,y,(lo+hi)/2,.055,h,hi-lo);
    for(const [a,b] of [[-4.32,-1.04],[-1.036,2.16],[2.164,4.32]])k.box(m.lining,(a+b)/2,y,3.348,b-a,h,.055);
    const seam=row%3===0?-.77:row%3===1?.74:1.62;
    side(-4.289,-3.34,seam);side(-4.289,seam+.005,3.34);
    if(y>1.44&&y<3.15){side(4.289,-3.34,-1.29);side(4.289,1.02,3.34);}
    else{side(4.289,-3.34,seam);side(4.289,seam+.005,3.34);}
    if(y<1.365){front(-4.32,-1.11);front(-1.105,2.181);front(3.963,4.32);}
    else if(y>3.23){front(-4.32,-1.11);front(-1.105,2.12);front(2.125,4.32);}
    else{front(-4.32,-3.975);front(-.635,-.264);front(1.968,2.17);front(3.963,4.32);}
  }
}
export function architecture(m){
  const k=new Kit('22F • timber shell, porch, roof and joinery');
  stoneBase(k,m);
  for(let i=0;i<12;i++){
    const y=.72+i*.272,over=i%2===0?.22:.06;
    const holes=[];
    if(y>1.47&&y<3.18)holes.push([-3.93,-.69],[-.20,1.90]);
    if(y<2.88)holes.push([2.27,3.88]);
    let start=-rightX-over;for(const [a,b] of holes){logs(k,m,y,'x',frontZ,start,a,i);start=b;}
    logs(k,m,y,'x',frontZ,start,rightX+over,i);logs(k,m,y,'x',-frontZ,-rightX-over,rightX+over,i);
    for(const side of [-1,1]){
      const ext=i%2===1?.22:.06,win=side>0&&y>1.52&&y<3.04;
      if(win){logs(k,m,y,'z',side*rightX,frontZ-ext,-1.23,i);logs(k,m,y,'z',side*rightX,.96,-frontZ+ext,i);}
      else logs(k,m,y,'z',side*rightX,frontZ-ext,-frontZ+ext,i);
    }
  }
  windowFrame(k,m,-3.93,-.69,1.405,3.22,frontZ);
  windowFrame(k,m,-.20,1.90,1.405,3.22,frontZ);
  door(k,m,3.075,frontZ);
  for(const z of [-1.23,.96])k.box(m.case,4.49,2.28,z,.37,1.69,.12);
  for(const y of [1.47,2.51,3.12])k.box(m.pine,4.49,y,-.135,.38,y===2.51?.05:.12,2.38);
  k.box(m.pine,4.49,2.27,-.13,.14,1.59,.055);
  unfinishedInterior(k,m);attachRoof(k,m);porch(k,m);
  return k.finish();
}
export {beam, floorY};
