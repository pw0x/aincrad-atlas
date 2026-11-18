import * as THREE from 'three';
import { rng, noise, placeInstances } from './common.js';

import { loadGeometries } from './geometry-loader.js';

const forestURL=new URL('./assets/fir-stand.webp',import.meta.url).href;
const twigURL=new URL('./assets/fir-spray.webp',import.meta.url).href;

function cardMaterial(ctx,url,alpha=.41) {
  const tex=new THREE.TextureLoader().load(url);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=Math.min(8,ctx.renderer.capabilities.getMaxAnisotropy());
  const mat=new THREE.MeshLambertMaterial({map:tex,alphaTest:alpha,side:THREE.DoubleSide});
  mat.shadowSide=THREE.DoubleSide;
  return mat;
}

// Each card rotates to the actual rendering camera. The lake mirror gets the
// matching silhouette, and edge-on triangles never split a distant crown in two.
function billboard(ctx,url,alpha=.34) {
  const texture=new THREE.TextureLoader().load(url);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(8,ctx.renderer.capabilities.getMaxAnisotropy());
  const material=new THREE.MeshBasicMaterial({map:texture,alphaTest:alpha,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec3 center=(modelMatrix*instanceMatrix[3]).xyz;
      vec3 delta=cameraPosition-center;
      vec3 across=normalize(vec3(delta.z+.00001,0.,-delta.x));
      vec3 groundUp=vec3(0.,1.,0.);
      vec3 point=center+across*position.x*length(instanceMatrix[0].xyz)
                       +groundUp*position.y*length(instanceMatrix[1].xyz);
      vec4 mvPosition=viewMatrix*vec4(point,1.);
      gl_Position=projectionMatrix*mvPosition;
    `);
  };
  return material;
}

function treeCards(variant) {
  const geo=new THREE.PlaneGeometry(.68,1);
  geo.translate(0,.5,0);
  const uv=geo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setX(i,(uv.getX(i)+variant)*.5);
  return geo;
}

function boughs(seed) {
  const random=rng(seed),pos=[], uv=[], normal=[], indices=[], colors=[];
  // Each branch bears several photographic needle sprays. Their bases converge
  // at the woody stem and their tips curve up toward the light.
  function sprig(x,y,z,direction,width,length,tilt,shade) {
    const cs=Math.cos(direction),sn=Math.sin(direction),k=pos.length/3;
    for(const [along,tall,spread,u,v] of [
      [0,0,-.12,0,0],[0,0,.12,1,0],[.52,.28,-.52,0,.52],[.52,.28,.52,1,.52],
      [1,1,-.33,0,1],[1,1,.33,1,1]
    ]){
      pos.push(x+cs*along*length-sn*spread*width,y+tall*tilt,z+sn*along*length+cs*spread*width);
      normal.push(cs*.20,.96,sn*.20);
      uv.push(u,v);
      colors.push(shade*.87,shade,shade*.82);
    }
    indices.push(k,k+1,k+2,k+2,k+1,k+3,k+2,k+3,k+4,k+4,k+3,k+5);
  }
  for(let j=0;j<17;j++){
    const t=(j+.35)/17;
    const h=.13+t*.815;
    const branches=Math.floor(8+(1-t)*4);
    for(let i=0;i<branches;i++){
      const a=i/branches*Math.PI*2+j*1.47+random()*.22;
      const length=(.017+.254*(1-t)**.72)*(.78+.3*random());
      const cs=Math.cos(a),sn=Math.sin(a),base=(.86+random()*.27);
      for(let b=0;b<4;b++){
        const f=(b+.12)/4, s=length*(1-f*.66);
        const x=cs*length*f,z=sn*length*f,y=h-length*.16*(1+Math.sin(f*2.4));
        sprig(x,y,z,a-.42,s*.83,s*.57,s*(.40-.18*f),base*(.8+.2*f));
        sprig(x,y,z,a+.42,s*.83,s*.57,s*(.40-.18*f),base*(.85+.2*f));
      }
    }
  }
  sprig(0,.91,0,0,.06,.014,.1,1.03);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(indices);
  return g;
}

export function plantForest(ctx,parent,height,shore) {
  const random=rng(163129);
  const clusters=new Map(),near=[],trunks=[];
  // Chunk-level bounds keep distant off-camera groves out of both primary and planar passes.
  for(let k=0;k<16200;k++){
    const x=(random()-.5)*385,z=(random()-.5)*350-24, r=Math.hypot(x,z);
    if (Math.hypot(x/197,(z+25)/182)>1 || shore(x,z)<2.6) continue;
    if (r<13 || (x>-7 && x<19 && z>-19 && z<13)) continue;
    if (r<22 && (z<6 || random()<.78)) continue;
    const copse=noise(x*.042+6,z*.042);
    if (random()>.10+.57*copse) continue;
    const y=height(x,z);
    const h=(6+random()**.65*14)*(1-.17*noise(x*.09,z*.09));
    const tint=new THREE.Color().setRGB(.74+random()*.22,.75+random()*.23,.67+random()*.19);
    const tr=[x,y-.13,z,h*(.62+.53*random()),h,h*(.72+.43*random()),random()*Math.PI,0,(random()-.5)*.065,tint];
    if(r<29 && near.length<27) {
      near.push(tr);
      trunks.push([x,y+h*.46,z,h*.016,h*.92,h*.016,tr[6]]);
    } else {
      const key=Math.floor(x/65)+','+Math.floor(z/65);
      if(!clusters.has(key)) clusters.set(key,[[],[]]);
      clusters.get(key)[random()<.5?0:1].push(tr);
    }
  }
  const card=billboard(ctx,forestURL,.21);
  const snag=billboard(ctx,new URL('./assets/fir-snag.webp',import.meta.url).href,.20);
  const variants=[treeCards(0),treeCards(1)];
  for (const patch of clusters.values()) {
    for(let i=0;i<2;i++)placeInstances(parent,variants[i],i===1?snag:card,patch[i],'冷杉群落·分区远景');
  }
  const branches=cardMaterial(ctx,twigURL,.32);
  branches.vertexColors=true;
  branches.emissiveMap=branches.map;
  branches.emissive.setRGB(.51,.55,.41);
  branches.emissiveIntensity=.91;
  placeInstances(parent,boughs(343),branches,near,'近林·针叶枝轮',true);
  const bark=new THREE.MeshStandardMaterial({color:0x625342,roughness:1});
  placeInstances(parent,new THREE.CylinderGeometry(.57,1,1,8),bark,trunks,'近林·针叶树干',true);

  // Deciduous pioneer trees interrupt the dark fir line around the water.
  const branchTrunks=[],leaves=[],leafColor=new THREE.Color();
  const birchBark=new THREE.MeshStandardMaterial({color:0x827b63,roughness:1});
  for(let i=0;i<450;i++){
    const a=random()*Math.PI*2,r=1.04+random()*.42;
    const x=Math.cos(a)*105*r,z=-60+Math.sin(a)*51*r;
    if(shore(x,z)<2 || Math.hypot(x,z)<16 || (x>-7&&x<18&&z>-18&&z<9)) continue;
    const y=height(x,z),h=3+random()*8;
    branchTrunks.push([x,y+h*.36,z,h*.015,h*.74,h*.015,0,0,(random()-.5)*.09]);
    for(let c=0;c<12;c++){
      const angle=c*2.4+i, f=c/12, rad=(1-f)*h*(.095+.079*random());
      const dx=Math.cos(angle)*rad,dz=Math.sin(angle)*rad;
      const size=h*(.23+.09*random())*(1-f*.35);
      const py=y+h*(.49+f*.45);
      leafColor.setRGB(.84+random()*.32,1.0+random()*.22,.77+random()*.13);
      leaves.push([x+dx,py,z+dz,size,size*(.92+random()*.30),size,0,0,0,leafColor.clone()]);
      if(c<5){
        const rise=h*.25;
        branchTrunks.push([x+dx*.48,py-rise*.5,z+dz*.48,h*.005,Math.hypot(rad,rise),h*.005,0,Math.atan2(dz,rise),-Math.atan2(dx,rise)]);
      }
    }
  }
  const crowns=billboard(ctx,new URL('./assets/leaf-cluster.webp',import.meta.url).href,.33);
  crowns.color.setRGB(.72,.63,.47);
  placeInstances(parent,new THREE.PlaneGeometry(1,1),crowns,leaves,'湖畔阔叶树·实拍叶簇与透光外缘');
  placeInstances(parent,new THREE.CylinderGeometry(.48,1,1,7),birchBark,branchTrunks,'湖畔阔叶树·分叉树干');

}

function makeFlower(lilac) {
  const p=[],colors=[],idx=[];
  function quad(a,b,c,d,tint){
    const k=p.length/3;
    for(const v of [a,b,c,d]) {p.push(...v);colors.push(tint.r,tint.g,tint.b);}
    idx.push(k,k+1,k+2,k+2,k+1,k+3);
  }
  const stem=new THREE.Color(0x66834c),stemEdge=new THREE.Color(0x9fb676);
  const petals=new THREE.Color(lilac?0xa89ed7:0xfff4ce),pollen=new THREE.Color(0xe5b952);
  const heads=lilac?6:1;
  for(let i=0;i<heads;i++){
    const f=i/heads,angle=i*2.54;
    const x=Math.cos(angle)*.039*f,z=Math.sin(angle)*.039*f,y=lilac?.14+.21*f:.25;
    quad([0,0,0],[.008,0,0],[x-.002,y,z],[x+.003,y,z],stem);
    const count=lilac?5:9;
    for(let j=0;j<count;j++){
      const a=j/count*Math.PI*2+.3,r=lilac?.022:.037;
      const cs=Math.cos(a),sn=Math.sin(a);
      quad([x,y,z],[x+cs*.004,y+.002,z+sn*.004],
        [x+cs*r-sn*r*.37,y+.009,z+sn*r+cs*r*.37],[x+cs*r+sn*r*.37,y+.009,z+sn*r-cs*r*.37],petals);
    }
    quad([x-.008,y+.006,z-.007],[x+.008,y+.006,z-.007],[x-.008,y+.006,z+.007],[x+.008,y+.006,z+.007],pollen);
  }
  for(let i=0;i<4;i++){
    const a=i*2.42,r=.047,cs=Math.cos(a),sn=Math.sin(a),y=i*.024;
    quad([0,y,0],[.004,y,0],[cs*r-sn*.015,y+.032,sn*r+cs*.015],[cs*r+sn*.015,y+.032,sn*r-cs*.015],stemEdge);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();
  return g;
}

export async function plantMeadow(ctx,height,shore) {
  const group=new THREE.Group(),random=rng(446927);
  group.name='近岸·微尺度草叶、苇丛与草花';
  const grass=[[],[],[]],reeds=[],tuftCards=[],flowers=[[],[]],c=new THREE.Color();
  const sample=(x,z,scale,tint)=>[x,height(x,z)-.034,z,scale,scale*(.82+random()*.35),scale,random()*6.28,0,0,tint];
  for(let i=0;i<24900;i++){
    const x=(random()-.5)*78,z=(random()-.5)*66-5;
    const d=shore(x,z);
    if(d<-.5 || (Math.abs(x)<5.15&&z>-6.65&&z<4.05)) continue;
    const path=THREE.MathUtils.smoothstep(Math.abs(x-1.0-.35*Math.max(0,-z-5)),.45,1.45);
    if (z<-3 && z>-11 && random()>path) continue;
    const patch=noise(x*.25+1,z*.25);
    if(random()>.25+.81*patch)continue;
    const size=1.25+random()*1.74;
    c.setRGB(.84+random()*.22,.88+random()*.20,.72+random()*.21);
    if(d>.5) {
      grass[i%3].push(sample(x,z,size,c.clone()));
      const th=.07+.11*random(), tw=th*(1.3+random()*.83);
      tuftCards.push([x,height(x,z)-.016,z,tw,th,tw,0,0,0,c.clone()]);
    }
    if(d<1.16 && patch>.44 && random()<.76){
      c.setRGB(.89+random()*.18,.84+random()*.17,.64+random()*.14);
      reeds.push(sample(x,z,.8+random()*1.7,c.clone()));
    }
    if(d>1.1 && patch>.52 && random()<.28) {
      const kind=noise(x*.49,z*.46)>.55?1:0;
      for(let j=0;j<3;j++) flowers[kind].push(sample(x+random()*.27,z+random()*.28,.51+random()*.77,null));
    }
  }
  const tufts=await loadGeometries(new URL('./assets/grass-tufts.glb',import.meta.url),ctx.signal);
  const bladeTex=new THREE.TextureLoader().load(new URL('./assets/grass-blades.webp',import.meta.url).href);
  bladeTex.flipY=false;bladeTex.colorSpace=THREE.SRGBColorSpace;
  bladeTex.anisotropy=Math.min(8,ctx.renderer.capabilities.getMaxAnisotropy());
  const bladeMat=new THREE.MeshLambertMaterial({map:bladeTex,alphaTest:.31,side:THREE.DoubleSide});
  for(let i=0;i<3;i++)placeInstances(group,tufts[i],bladeMat,grass[i],'实拍草叶·混生草甸');
  placeInstances(group,tufts[3],bladeMat,reeds,'水岸·高草与草穗');
  const tuftCard=new THREE.PlaneGeometry(1,1);
  tuftCard.translate(0,.5,0);
  const leafGrass=billboard(ctx,new URL('./assets/meadow-tuft.webp',import.meta.url).href,.27);
  leafGrass.color.setRGB(1.04,1.06,.83);
  placeInstances(group,tuftCard,leafGrass,tuftCards,'Grassland photographic tufts');
  const green=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  for(let i=0;i<2;i++)placeInstances(group,makeFlower(i===1),green,flowers[i],i?'婆婆纳色花穗':'湖滨雏菊');
  return group;
}
