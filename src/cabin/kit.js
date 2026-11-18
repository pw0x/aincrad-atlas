import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function random(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function canvasMap(width,height,draw) {
  const canvas=document.createElement('canvas'); canvas.width=width;canvas.height=height;
  draw(canvas.getContext('2d'),width,height);
  const tx=new T.CanvasTexture(canvas);
  tx.colorSpace=T.SRGBColorSpace; tx.wrapS=tx.wrapT=T.RepeatWrapping; tx.anisotropy=8;
  return tx;
}

function endMap() {
  return canvasMap(256,256,(c,w,h)=>{
    const r=random(128);
    c.fillStyle='#c2a27c';c.fillRect(0,0,w,h);
    for(let n=4;n<190;n+=2+r()*2){
      c.strokeStyle='rgba(80,50,28,'+(.1+r()*.32)+')'; c.lineWidth=.7+r()*.95;c.beginPath();
      for(let a=0;a<=6.34;a+=.055){const rr=n*(1+.017*Math.sin(a*5)+.025*Math.sin(a*3+.5))+.8*Math.cos(a*9+n*.04);const x=127+Math.cos(a)*rr,y=120+Math.sin(a)*rr; if(a===0)c.moveTo(x,y);else c.lineTo(x,y);}
      c.stroke();
    }
    for(let n=0;n<5;n++){const a=r()*6.28;c.strokeStyle='#70563d';c.lineWidth=1.3;c.beginPath();c.moveTo(127+Math.cos(a)*123,120+Math.sin(a)*123);c.lineTo(127+Math.cos(a+.018)*82,120+Math.sin(a+.018)*82);c.lineTo(127+Math.cos(a+.023)*66,120+Math.sin(a+.023)*66);c.stroke();}
  });
}

function textileMap() {
  return canvasMap(640,640,(c,w,h)=>{
    const r=random(76);
    c.fillStyle='#496b67';c.fillRect(0,0,w,h);
    function stripe(y,color,height=2){c.fillStyle=color;c.fillRect(0,y,w,height);}
    for(const margin of [0,1]){
      const ys=margin?522:22;stripe(ys,'#d4b57b',3);stripe(ys+8,'#bfa66d');stripe(ys+19,'#314b4a',65);stripe(ys+86,'#bfa66d');stripe(ys+94,'#d4b57b',3);
      for(let x=-20;x<w+20;x+=40){
        c.strokeStyle='#daca9a';c.lineWidth=3;c.beginPath();c.moveTo(x,ys+50);c.lineTo(x+20,ys+29);c.lineTo(x+40,ys+50);c.lineTo(x+20,ys+71);c.closePath();c.stroke();
        c.fillStyle='#a96c50';c.fillRect(x+17,ys+47,6,6);
      }
    }
    for(let y=155;y<520;y+=66)for(let x=-32;x<640;x+=64){const xx=x+((y-155)%132?32:0);
      c.strokeStyle='rgba(211,192,133,.62)';c.lineWidth=1.5;c.beginPath();c.moveTo(xx-3,y);c.lineTo(xx,y-4);c.lineTo(xx+3,y);c.lineTo(xx,y+4);c.closePath();c.stroke();}
    for(let i=0;i<h;i++){c.strokeStyle='rgba(28,22,17,'+(r()*.13)+')';c.beginPath();c.moveTo(0,i+.5);c.lineTo(w,i+.5);c.stroke();}
    for(let i=0;i<w;i++){c.strokeStyle='rgba(249,237,202,'+(r()*.12)+')';c.beginPath();c.moveTo(i+.5,0);c.lineTo(i+.5,h);c.stroke();}
  });
}

export async function palette(anisotropy=8) {
  const mat=(color,roughness=.78, metalness=0,other={})=>new T.MeshStandardMaterial({color,roughness,metalness,...other});
  const end=endMap(),textile=textileMap();
  const loader=new T.TextureLoader();
  const loadWood=async(key,channels=['color','normal','roughness'])=>{
    const maps=await Promise.all(['color','normal','roughness'].map(async channel=>{
      if(!channels.includes(channel))return null;
      const tx=await loader.loadAsync(import.meta.env.BASE_URL+'assets/materials/'+key+'/'+channel+'.webp').catch(()=>null);
      if(tx){tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.anisotropy=anisotropy;if(channel==='color')tx.colorSpace=T.SRGBColorSpace;}
      return tx;
    }));
    return {map:maps[0],normalMap:maps[1],roughnessMap:maps[2],normalScale:new T.Vector2(.45,.45)};
  };
  const localAssets=import.meta.glob('./assets/*.webp',{query:'?url',import:'default',eager:true});
  const local=async(name,color=false)=>{
    const t=await loader.loadAsync(localAssets['./assets/'+name+'.webp']);
    t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=anisotropy;
    if(color)t.colorSpace=T.SRGBColorSpace; return t;
  };
  const [floor,baseTable,woodColor,woodRough,hewn,hewnNormal,hewnRough,rock,rockNormal,crust,crustNormal,freshWood]=await Promise.all([
    loadWood('wood_planks'),loadWood('wood_table_001',['normal']),local('waxed-oak',true),local('waxed-oak-rough'),
    local('hewn-color',true),local('hewn-normal'),local('hewn-rough'),local('fieldstone',true),local('fieldstone-normal'),local('bread-crust',true),local('bread-normal'),local('unfinished-pine',true)
  ]);
  const table={...baseTable,map:woodColor,roughnessMap:woodRough,normalScale:new T.Vector2(.28,.28)};
  const bark={map:hewn,normalMap:hewnNormal,roughnessMap:hewnRough,normalScale:new T.Vector2(.64,.64)};
  const stone={map:rock,normalMap:rockNormal,normalScale:new T.Vector2(.90,.90)};
  const linenMap=canvasMap(512,512,(c,w,h)=>{
    c.fillStyle='#bfad8b';c.fillRect(0,0,w,h);const rnd=random(751148);
    for(let y=0;y<h;y+=2){c.fillStyle='rgba(73,56,43,'+(.025+rnd()*.12)+')';c.fillRect(0,y,w,1);}
    for(let x=0;x<w;x+=2){c.fillStyle='rgba(249,236,201,'+(.02+rnd()*.17)+')';c.fillRect(x,0,1,h);}
    for(const y of [445,451,477]){c.fillStyle='#8b8065';c.fillRect(0,y,w,2);}
    for(let x=0;x<w;x+=18){c.strokeStyle='#997d56';c.lineWidth=2;c.beginPath();c.moveTo(x,465);c.lineTo(x+4,460);c.lineTo(x+8,465);c.lineTo(x+4,470);c.closePath();c.stroke();}
  });
  const glazeMap=canvasMap(384,384,(c,w,h)=>{
    c.fillStyle='#e5e5df';c.fillRect(0,0,w,h);const rng=random(2497);
    for(let i=0;i<4700;i++){
      let x=rng()*w,y=rng()*h,rr=.15+rng()**3*1.0;
      c.fillStyle='rgba(49,54,44,'+(.04+rng()*.39)+')';
      c.beginPath();c.arc(x,y,rr,0,6.3);c.fill();
    }
    for(let i=0;i<35;i++){let x=rng()*w,y=rng()*h;c.strokeStyle='rgba(97,91,67,.10)';c.lineWidth=.65;c.beginPath();c.moveTo(x,y);
      for(let j=0;j<4;j++){x+=(rng()-.45)*10;y+=rng()*8;c.lineTo(x,y);}c.stroke();}
  });
  const ceramic=(color)=>mat(color,.34,.028,{map:glazeMap});
  const materials={
    log:Array.from({length:5},(_,i)=>mat([0xe0c4a0,0xc5a98b,0xe7d4b6,0xc8af97,0xd7b99a][i],1,0,bark)),
    end:mat(0xf6ddba,.86,0,{map:end}), pine:mat(0xc4a281,.95,0,table), oak:mat(0x856a50,1,0,table),
    floor:mat(0xe3c6a8,.8,0,floor), table:mat(0xe8c498,.95,0,table), edge:mat(0x604938,.73,0,table), case:mat(0xb99973,.95,0,table),lining:mat(0xe4d7c0,1,0,{...table,map:freshWood}),
    cream:mat(0xddd2b0), curtain:mat(0xe8dec7,1,0,{map:linenMap,side:T.DoubleSide}), iron:mat(0x373a34,.46,.7), black:mat(0x211f1c,.91), brass:mat(0x97794f,.55,.48), copper:mat(0x90644f,.60,.42),
    glass:mat(0xa7cac0,.22,.05,{transparent:true,opacity:.065,side:T.DoubleSide,depthWrite:false}), cloth:mat(0xffffff,.92,0,{map:textile,side:T.DoubleSide}),
    roof:[0x3f4541,0x50534a,0x464b44,0x5e6153,0x4c514d].map(c=>mat(c,.9)),
    stone:[0xb6aaa0,0xc5beaf,0xd3c5b9,0xb5bab5,0xa69e92,0xc4b8a4].map(c=>mat(c,1,0,stone)),soot:mat(0x635548,1,0,stone),kettle:mat(0x41413d,.66,.51,{map:rock,normalMap:rockNormal,normalScale:new T.Vector2(.06,.06)}),rug:mat(0x81735d,1,0,{map:textile}),
    pale:ceramic(0xd6cdb0), teal:ceramic(0x527b70), brown:ceramic(0x8e5841), cobalt:ceramic(0x435e6a), glaze:ceramic(0xd4b577),
    wax:mat(0xe9cf94,.81), bread:mat(0xffffff,1,0,{map:crust,normalMap:crustNormal,normalScale:new T.Vector2(.65,.65),vertexColors:true}), flour:mat(0xd3ad74),leaf:mat(0x718345,.86,0,{side:T.DoubleSide}),leaf2:mat(0x455e43,.9,0,{side:T.DoubleSide}),
    flower:mat(0xd2b5b4), herb:mat(0x8d9661), violet:mat(0x8f80a7), rust:mat(0xa65c42), linen:mat(0xd7bf9c),cloak:mat(0x985d47,1,0,{map:linenMap,side:T.DoubleSide}), fruit:mat(0xab6036,.48), red:mat(0x914b40),gold:mat(0xb7a074,.83),
    coal:mat(0x4b4139,.97,0,stone), emissive:new T.MeshStandardMaterial({color:0xffbf66,emissive:0xff8a32,emissiveIntensity:2.3,roughness:1,side:T.DoubleSide}),
  };
  for(const name of ['pine','oak','edge','case','table','lining'])materials[name].userData.milledTimber=true;
  return materials;
}

const unitBox=new T.BoxGeometry(1,1,1);
const roundBox=new RoundedBoxGeometry(1,1,1,1,.035);
const sphere=new T.SphereGeometry(1,20,14);
const cylCache=new Map(), circle=new T.CircleGeometry(1,48);
const vector=new T.Vector3(), axis=new T.Vector3(0,1,0);
const rot=new T.Euler(),q=new T.Quaternion(),p=new T.Vector3(),s=new T.Vector3();
const iMatrix=new T.Matrix4();
const timberUVCache=new Map();
function milledBox(w,h,d,rounded,seed) {
  const dim=[w,h,d], key=[w.toFixed(3),h.toFixed(3),d.toFixed(3),rounded,seed].join(',');
  if(timberUVCache.has(key))return timberUVCache.get(key);
  const geo=(rounded?roundBox:unitBox).clone(),p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
  const lengthAxis=dim.indexOf(Math.max(w,h,d));
  for(let i=0;i<p.count;i++){
    const c=[p.getX(i)*w,p.getY(i)*h,p.getZ(i)*d],normal=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
    const face=normal.indexOf(Math.max(...normal));
    const v=face===lengthAxis?(lengthAxis+1)%3:lengthAxis;
    const u=3-v-face;
    uv.setXY(i,c[u]*.63+seed*.22,c[v]*.58+seed*.37);
  }
  timberUVCache.set(key,geo);return geo;
}

export class Kit {
  constructor(name){this.name=name;this.materials=new Map();}
  put(geo,mat,position,scale=[1,1,1],rotation=[0,0,0]) {
    p.fromArray(position);s.fromArray(scale);
    if(rotation.isQuaternion)q.copy(rotation);else q.setFromEuler(rot.fromArray(rotation));
    iMatrix.compose(p,q,s);
    let geometries=this.materials.get(mat);
    if(!geometries){geometries=new Map();this.materials.set(mat,geometries);}
    let transforms=geometries.get(geo);
    if(!transforms){transforms=[];geometries.set(geo,transforms);}
    transforms.push(iMatrix.clone());
  }
  box(mat,x,y,z,w,h,d,rotation=[0,0,0],rounded=false){const geo=mat.userData.milledTimber?milledBox(w,h,d,rounded,Math.abs(Math.round(x*12+y*7+z*17))%5):(rounded?roundBox:unitBox);this.put(geo,mat,[x,y,z],[w,h,d],rotation);}
  ell(mat,x,y,z,rx,ry,rz,rotation=[0,0,0]){this.put(sphere,mat,[x,y,z],[rx,ry,rz],rotation);}
  cylinder(top,bottom,n=32,open=false){
    const key=[top,bottom,n,open].join(',');
    if(!cylCache.has(key))cylCache.set(key,new T.CylinderGeometry(top,bottom,1,n,1,open));
    return cylCache.get(key);
  }
  stick(mat,a,b,r,rb=r,n=16){
    const delta=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const len=delta.length();if(len<.000001)return;
    const direction=new T.Quaternion().setFromUnitVectors(axis,delta.divideScalar(len));
    this.put(this.cylinder(1,rb/r,n),mat,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[r,len,r],direction);
  }
  disc(mat,at,to,r){const direction=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),vector.fromArray(to).normalize());this.put(circle,mat,at,[r,r,r],direction);}
  lathe(mat,profile,x,y,z,scale=[1,1,1],n=48){const cacheKey='l'+n+profile.flat().join(',');if(!cylCache.has(cacheKey))cylCache.set(cacheKey,new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),n));this.put(cylCache.get(cacheKey),mat,[x,y,z],scale);}
  ring(mat,x,y,z,major,minor,rotation=[Math.PI/2,0,0],arc=2*Math.PI){
    const key=['r',major,minor,arc].join(',');
    if(!cylCache.has(key))cylCache.set(key,new T.TorusGeometry(major,minor,8,48,arc));
    this.put(cylCache.get(key),mat,[x,y,z],[1,1,1],rotation);
  }
  tube(mat,points,r,segments=16){const curve=new T.CatmullRomCurve3(points.map(a=>new T.Vector3(...a)));this.put(new T.TubeGeometry(curve,segments,r,7,false),mat,[0,0,0]);}
  finish(){
    const group=new T.Group();group.name=this.name;
    for(const [mat,geometries] of this.materials){
      const singles=[];
      for(const [geo,transforms] of geometries){
        if(transforms.length>=4){
          const mesh=new T.InstancedMesh(geo,mat,transforms.length);transforms.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();
          mesh.castShadow=!mat.transparent;mesh.receiveShadow=true;group.add(mesh);continue;
        }
        for(const m of transforms){
          const baked=geo.index?geo.toNonIndexed():geo.clone();
          baked.applyMatrix4(m);baked.clearGroups();
          for(const k of Object.keys(baked.attributes))if(!['position','normal','uv'].includes(k)&&!(k==='color'&&mat.vertexColors))baked.deleteAttribute(k);
          singles.push(baked);
        }
      }
      if(singles.length){const geometry=singles.length===1?singles[0]:mergeGeometries(singles,false);const mesh=new T.Mesh(geometry,mat); mesh.castShadow=!mat.transparent;mesh.receiveShadow=true; group.add(mesh);if(singles.length>1)singles.forEach(g=>g.dispose());}
    }
    return group;
  }
}
