import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {polar,TAU,seeded} from './geometry.js';
import {tierLayout} from './tiers.js';

// A small set of authored large forms gives different bearings a different
// skyline. Width is angular half-span. Projection is measured beyond the rim.
const LAND=[
  [0,-.76,.32,470,'fort'],[1,1.71,.38,610,'town'],[1,3.54,.50,490,'woods'],
  [3,-.16,.39,430,'woods'],[3,2.83,.31,440,'fort'],[4,-1.29,.35,640,'town'],
  [5,.87,.43,710,'town'],[5,3.75,.32,530,'woods'],[6,1.95,.32,510,'fort'],
  [7,-.53,.43,630,'woods'],[7,2.83,.38,560,'town'],[9,1.32,.39,480,'woods'],
  [10,-.74,.31,410,'fort'],[10,3.72,.32,310,'town'],[12,.48,.29,260,'woods']
];
const canopy=[0x3e5847,0x516445,0x5e764f,0x6d7951,0x4f6650,0x607450,0x6a825c];
const shingles=[0x72615b,0x76534a,0x65575c,0x4c686e,0x56727b,0x805953];
const walls=[0xb1aa91,0xc2b49c,0xc0b299,0xbeb6a4,0xaab0a1];
const select=(v,r)=>v[Math.floor(r()*v.length)];

function surface(rows,cols,pickPoint){
  const positions=[],colors=[],uv=[],index=[],color=new THREE.Color();
  for(let v=0;v<=rows;v++)for(let u=0;u<=cols;u++){
    const [p,c]=pickPoint(u/cols,v/rows);
    positions.push(p.x,p.y,p.z);color.set(c);colors.push(color.r,color.g,color.b);
    uv.push(u/cols*22,v/rows*2.4);
    if(u<cols&&v<rows){
      const i=v*(cols+1)+u,n=i+cols+1;index.push(i,n,i+1,i+1,n,n+1);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(index);g.computeVertexNormals();return g;
}

export function buildLandforms(group,batch,materials) {
  const roofs=[],rocks=[],random=seeded(346723);
  LAND.forEach(([t,angle,span,width,kind],n)=>{
    const {top,edge}=tierLayout(t),origin=edge-62,phase=n*2.41;
    const spread=u=>Math.pow(Math.max(0.0001,Math.sin(Math.PI*u)),0.68);
    const rim=u=>width*(.09+.91*spread(u))*(1+.085*Math.sin(9*u+phase)+.048*Math.sin(31*u+phase)+.018*Math.sin(67*u));
    const height=(u,v)=>top+18+spread(u)*(18+18*Math.sin(u*13+phase)*Math.sin(v*4+1)+13*Math.cos(v*7+phase+u*12)+24*Math.sin(v*Math.PI));
    const point=(u,v,extra=0)=>polar(origin+rim(u)*v,angle+(u*2-1)*span,height(u,v)+extra);
    const topGeo=surface(11,77,(u,v)=>{
      const p=point(u,v),wave=Math.sin(v*11+u*25+phase)*0.49+.5*Math.cos(v*9-u*21+phase);
      return [p,wave>.53?0x83905b:wave<-.45?0x667749:wave>0.04?0x76844d:0x707d4d];
    });
    roofs.push(topGeo);
    const side=surface(5,77,(u,v)=>{
      const x=spread(u),off=rim(u)*(1.-v*.34);
      const r=origin+off+Math.sin(v*Math.PI)*width*.11+Math.sin(v*9+u*54)*x*width*.027;
      const depth=(80+width*.30)*x*(.90+.19*Math.sin(u*15+phase)+.09*Math.sin(u*38));
      const p=polar(r,angle+(u*2-1)*span,height(u,1)-v*depth);
      const shade=0.56+0.20*Math.sin(67*u+4*v+phase)+.15*Math.cos(u*41+v)+.11*(1-v);
      return [p,new THREE.Color(shade*.91,shade*.96,shade*.85)];
    });
    rocks.push(side);
    const turret=kind==='fort';
    const settlement=kind!=='woods';
    const monumental=n===4||n===5||n===6?1.68:1.08;
    if(settlement){
      const p=point(.55,.60),a=angle+.10*span;
      const local=(dx,dz,h)=>new THREE.Vector3(p.x+(Math.cos(a)*dx+Math.sin(a)*dz)*monumental,p.y+h*monumental,p.z+(-Math.sin(a)*dx+Math.cos(a)*dz)*monumental);
      const obj=(shape,mat,x,z,y,w,h,d,col)=>{
        const at=local(x,z,y);
        batch.add(shape,mat,at.x,at.y,at.z,w*monumental,h*monumental,d*monumental,a,col);
      };
      const dark=turret?0x526772:0x5a6e74;
      obj('box','stone',0,0,33,118,75,109,0xaaa994);
      obj('roof','roofing',0,0,70,133,turret?35:59,120,dark);
      for(const dx of [-1,1])for(const dz of [-1,1]){
        const hh=turret?120:91;
        obj('drum','stone',dx*61,dz*51,hh*.48,32,hh,32,0xb4b39c);
        obj('drum','trim',dx*61,dz*51,hh-1,39,8,39);
        obj('cone','roofing',dx*61,dz*51,hh+3,46,51,46,dark);
      }
      for(const x of [-19,0,19])obj('window','glass',x,55,34,7,21,1);
      obj('drum','stone',-11,-29,100,45,76,45,0xb9b7a1);
      obj('cone','roofing',-11,-29,136,58,turret?85:106,58,dark);
      obj('cone','gild',-11,-29,turret?217:238,4,21,4);
      if(monumental>1.5){
        obj('arch','trim',0,56,0,32,44,5);
        obj('roof','roofing',0,47,73,47,54,48,dark);
        obj('oculus','stained',0,72,87,15,15,1);
        obj('bead','trim',0,72.4,87,17,17,6);
        for(const side of [-1,1]){
          obj('drum','stone',side*21,61,44,12,92,12,0xb0ad9a);
          obj('cone','roofing',side*21,61,90,21,41,21,dark);
        }
      }
    }
    const count=Math.floor(width*2.5);
    for(let i=0;i<count;i++){
      const u=0.024+random()*.952,v=.045+random()*.924,p=point(u,v);
      const a=angle+(u*2-1)*span;
      const focus=Math.hypot((u-.55)*2*span*edge,(v-.60)*width);
      if(settlement&&focus<87*monumental)continue;
      const lane=.46+.16*Math.sin(8*u+phase);
      const populated=settlement&&Math.abs(v-lane)<.27&&Math.abs(u-.51)<.34;
      if(populated&&random()>.47){
        const w=12+random()*20,d=14+random()*20,h=9+random()*18,yaw=a+(random()-.5)*.57;
        batch.add('box','stone',p.x,p.y+h*.45,p.z,w,h,d,yaw,select(walls,random));
        batch.add('roof','roofing',p.x,p.y+h*.95,p.z,w+3,w*.56,d+4,yaw,select(shingles,random));
      }else{
        // Groves are clustered along contours; open meadow between them is visible at range.
        const grove=Math.sin(u*43+v*10+phase)*.65+.42*Math.cos(u*18-v*24);
        if(grove<-.16||(settlement&&grove<.12))continue;
        const h=(kind==='woods'?25:16)+random()*(kind==='woods'?62:42),col=select(canopy,random);
        if(random()>.41){
          batch.add('cone','foliage',p.x,p.y,p.z,h*.57,h,h*.57,a,col);
          batch.add('cone','foliage',p.x,p.y+h*.30,p.z,h*.46,h*.75,h*.46,a,col);
        }else{
          batch.add('leaf','foliage',p.x,p.y+h*.47,p.z,h*.70,h*1.06,h*.71,a,col);
        }
      }
    }
    // The steel understructure underpins the inhabited overhang; the ragged
    // outcrop projects beyond its outer piers.
    for(let k=1;k<11;k++){
      const u=k/11,outer=point(u,.89,-23),inner=point(u,.01,-(96+width*.31)*spread(u));
      batch.beam(inner,outer,16+width*.031,22+width*.042,'metal',0x8f9c97);
    }
  });
  for(const [list,mat,label] of [[roofs,'meadow','High meadows and garden cities'],[rocks,'escarpment','Rock shelves']]){
    const mesh=new THREE.Mesh(mergeGeometries(list),materials[mat]);list.forEach(g=>g.dispose());
    mesh.castShadow=mesh.receiveShadow=true;mesh.name=label;group.add(mesh);
  }
}
