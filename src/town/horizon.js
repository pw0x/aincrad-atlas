import * as T from 'three'
import { Instances, seeded } from '../castle/geometry.js'
import { addRidges, noise } from '../environment/common.js'

const tau=Math.PI*2
const smooth=T.MathUtils.smoothstep

function groundHeight(x,z) {
  const r=Math.hypot(x,z)
  const hills=smooth(r,148,450)
  return -.50+hills*(3+noise(x*.009,z*.009)*15+noise(x*.026,z*.026)*3.5)
}

function coloredSurfaces() {
  const positions=[],colors=[],indices=[]
  return {
    quad(a,b,c,d, color) {
      const i=positions.length/3
      positions.push(...a,...b,...c,...d)
      for(let n=0;n<4;n++) colors.push(color.r,color.g,color.b)
      indices.push(i,i+1,i+2,i,i+2,i+3)
    },
    finish(name) {
      const g=new T.BufferGeometry()
      g.setAttribute('position',new T.Float32BufferAttribute(positions,3))
      g.setAttribute('color',new T.Float32BufferAttribute(colors,3))
      g.setIndex(indices);g.computeBoundingSphere()
      const mesh=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}))
      mesh.name=name
      return mesh
    }
  }
}

function meadows() {
  const radii=[72,112,140,...Array.from({length:33},(_,i)=>155+i*16),780,940,1220,1600]
  const n=192,positions=[],colors=[],indices=[]
  const green=new T.Color('#788668'),straw=new T.Color('#b7ac80'),haze=new T.Color('#9aa8a0'),c=new T.Color()
  for(let row=0;row<radii.length;row++) {
    const r=radii[row]
    for(let i=0;i<=n;i++){
      const a=(i%n)/n*tau,x=Math.sin(a)*r,z=Math.cos(a)*r
      positions.push(x,groundHeight(x,z),z)
      c.copy(green).lerp(straw,noise(x*.017,z*.014)*.84).lerp(haze,smooth(r,300,850)*.7)
      colors.push(c.r,c.g,c.b)
      if(i<n && row+1<radii.length) {
        const j=row*(n+1)+i
        indices.push(j,j+1,j+n+1,j+1,j+n+2,j+n+1)
      }
    }
  }
  const g=new T.BufferGeometry()
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3))
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeBoundingSphere()
  const mesh=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}))
  mesh.name='Pasture extending from the city apron into the foothills'
  return mesh
}

function fieldsAndRoads() {
  const pieces=coloredSurfaces(),random=seeded(4900)
  const palette=['#a39e75','#b0a477','#929874','#a3a077','#969774','#aea57a']
  const terrainPoint=(x,z,h=.10)=>[x,groundHeight(x,z)+h,z]
  // Contiguous irregular strips of farmland follow the gentle ground outside the wall.
  for(let i=-9;i<10;i++) for(let j=-8;j<9;j++) {
    const cx=i*34+j*7, cz=j*35-i*5
    const radius=Math.hypot(cx,cz)
    if(radius<159 || radius>352 || noise(cx*.012,cz*.014)>.77)continue
    const halfW=13+random()*2.5, halfD=12+random()*3, shift=(random()-.5)*4
    const field=(u,v,h)=>terrainPoint(cx+u+v*.19,cz+v-u*.13,h)
    const col=new T.Color(palette[Math.floor(random()*palette.length)])
    // Patches are tessellated so a low hill cannot swallow the middle of a field.
    for(let row=0;row<5;row++) for(let strip=0;strip<4;strip++) {
      const l=-halfW+halfW*strip*.5,r=l+halfW*.5
      const b=-halfD+halfD*row*.4,t=b+halfD*.4
      pieces.quad(field(l+b/halfD*shift,b,.14),field(r+b/halfD*shift,b,.14),field(r+t/halfD*shift,t,.14),field(l+t/halfD*shift,t,.14),col)
    }
    if (random()<.45) continue
    const furrow=col.clone().multiplyScalar(.90)
    for(let stripe=-halfW+2;stripe<halfW-1;stripe+=2.7) for(let s=0;s<4;s++) {
      const a=-halfD+halfD*.5*s,b=a+halfD*.5
      pieces.quad(field(stripe+a/halfD*shift,a,.22),field(stripe+.42+a/halfD*shift,a,.22),
        field(stripe+.42+b/halfD*shift,b,.22),field(stripe+b/halfD*shift,b,.22),furrow)
    }
  }
  for(const angle of [0,tau*.25,tau*.50,tau*.75]) {
    const road=new T.Color('#ad9d80')
    function point(distance,offset) {
      const curve=(Math.sin((distance-102)*.011)+.45*Math.sin((distance-102)*.023))
        * Math.min(17,(distance-102)*.13)
      const w=offset+curve
      return terrainPoint(Math.sin(angle)*distance+Math.cos(angle)*w,Math.cos(angle)*distance-Math.sin(angle)*w,.34)
    }
    for(let d=104;d<490;d+=6) pieces.quad(point(d,-2.0),point(d,2),point(d+6,2),point(d+6,-2),road)
  }
  return pieces.finish('Field parcels, planted rows and roads beyond the city gates')
}

function wallsAndGroves() {
  const random=seeded(21152), geom={box:new T.BoxGeometry(),drum:new T.CylinderGeometry(.5,.56,1,10),
    roof:new T.ConeGeometry(.5,1,8),leaf:new T.IcosahedronGeometry(.5,1),farLeaf:new T.IcosahedronGeometry(.5,0)}
  const mat={
    stone:new T.MeshStandardMaterial({roughness:.96}),
    slate:new T.MeshStandardMaterial({roughness:.84}),
    grove:new T.MeshBasicMaterial()
  }
  const batch=new Instances(geom,mat),result=new T.Group(),count=48
  function site(i) {
    const a=i/count*tau
    const r=101+3.1*Math.sin(3*a)+1.8*Math.sin(7*a)
    return [Math.sin(a)*r,Math.cos(a)*r*.96]
  }
  for(let i=0;i<count;i++) {
    const [x,z]=site(i),[x2,z2]=site((i+1)%count)
    const dx=x2-x,dz=z2-z,len=Math.hypot(dx,dz),yaw=Math.atan2(-dz,dx)
    const isGate=i%12===0, margin=isGate?.25:0
    const color=i%3?'#afaa97':'#b6af9d'
    function stretch(t0,t1) {
      const mx=x+(t0+t1)*.5*dx,mz=z+(t0+t1)*.5*dz,w=len*(t1-t0)
      batch.add('box','stone',mx,2.38,mz,w+.04,5.35,1.56,yaw,color)
      batch.add('box','stone',mx,4.95,mz,w+.22,.36,1.86,yaw,'#c0b9a5')
      const teeth=Math.ceil(w/2.20)
      for(let n=0;n<teeth;n++){
        const t=t0+(n+.5)*(t1-t0)/teeth
        batch.add('box','stone',x+dx*t,5.55,z+dz*t,.89,.97,1.53,yaw,color)
      }
    }
    if(isGate) {stretch(0,margin);stretch(1-margin,1)}
    else stretch(0,1)
    const towers=isGate?[margin,1-margin]:(i%4===2?[0]:[])
    for(const t of towers) {
      const tx=x+dx*t,tz=z+dz*t,r=isGate?2.82:3.40,h=isGate?7.6:6.7
      batch.add('drum','stone',tx,h*.48,tz,r,h,r,yaw,color)
      batch.add('drum','stone',tx,h-.4,tz,r*1.10,.50,r*1.10,yaw,'#c2bca8')
      batch.add('roof','slate',tx,h+1.5,tz,r*1.25,3.4,r*1.25,yaw,'#697d7d')
    }
  }
  for(let copse=0;copse<106;copse++) {
    const a=random()*tau,r=128+random()*310, x=r*Math.sin(a),z=r*Math.cos(a)
    const crown=r<200?'leaf':'farLeaf'
    for(let tree=0;tree<9;tree++) {
      const tx=x+(random()-.5)*23,tz=z+(random()-.5)*19
      const h=4+random()*6.4,y=groundHeight(tx,tz),w=2.2+random()*4.6
      const tint=new T.Color(copse%3?'#5a7160':'#6e795f').lerp(new T.Color('#94a19a'),smooth(r,145,450)*.58)
      batch.add('drum','grove',tx,y+h*.18,tz,w*.22,h*.44,w*.22,0,'#6e6c58')
      batch.add(crown,'grove',tx,y+h*.64,tz,w,h*.75,w*.83,random()*tau,tint)
      batch.add(crown,'grove',tx+.19*w,y+h*.81,tz,w*.67,h*.43,w*.62,random()*tau,tint.clone().multiplyScalar(1.11))
    }
  }
  batch.finish(result,'Curtain walls, gatehouses and distant poplar groves')
  result.traverse(child=>{child.castShadow=false})
  return result
}

// The town is close to the open side of this floor. Only the nearest rim and an
// oblique view into its soffit appear over the northern hills. The arc continues
// laterally into atmospheric haze, leaving the open southern sky visible.
function upperFloor() {
  const surfaces=coloredSurfaces(),random=seeded(53221)
  const radius=1450,centerZ=-1880
  function p(a,setback,y) {
    const r=radius-setback*.69
    return [Math.sin(a)*r,y,centerZ+Math.cos(a)*r]
  }
  const strips=[
    [-8,138,-8,140,'#84969a'],[-8,140,10,141,'#a4a89c'],
    [-5,136,-8,138,'#596e75'],[-5,134,-5,136,'#797f75'],
    [-8,133,-5,134,'#9a9d8e'],[-7,132,-8,133,'#697b7c'],
    [0,126,-7,132,'#76878a'],[1,124,0,126,'#929b94'],
    [15,120,1,124,'#5f757d'],[34,123,15,120,'#778a90'],
    [89,128,34,123,'#6b808b'],[170,131,89,128,'#788b91'],
    [276,135,170,131,'#71868e'],[394,146,276,135,'#819198']
  ]
  const n=104,step=2.50/n,edges=Array.from({length:n+1},(_,i)=>-1.25+(i+(i>0&&i<n?(random()-.5)*.29:0))*step)
  for(let i=0;i<n;i++) {
    const a=edges[i],b=edges[i+1],shade=.94+.09*random()
    for(const [r,y,r2,y2,color] of strips) {
      surfaces.quad(p(a,r,y),p(b,r,y),p(b,r2,y2),p(a,r2,y2),new T.Color(color).multiplyScalar(shade))
    }
    // Exposed rock is caught between the beams. Trace each seam through the
    // fascia and leave a few bays recessed so the rim has mass at street distance.
    const panels=5+Math.floor(random()*8)
    const depth=3+6*noise(i*.37,12)
    for(let j=0;j<panels;j++){
      const u=a+(b-a)*j/panels, v=a+(b-a)*(j+1)/panels
      const ledge=t=>125.3-6*noise(t*37,2)-2.2*noise(t*181,7)
      const under=t=>ledge(t)-depth*(.28+noise(t*77,35))
      const jut=t=>-7-2.5*noise(t*81,11)
      const q=p(u,jut(u),ledge(u)),s=p(v,jut(v),ledge(v))
      const lo=p(u,jut(u)+1.7,under(u)),hi=p(v,jut(v)+1.7,under(v))
      const seam=new T.Color(i%3===0?'#596572':'#566877').multiplyScalar(.81+random()*.26)
      surfaces.quad(p(u,-5.5,130.8),p(v,-5.5,130.8),s,q,new T.Color('#687985').multiplyScalar(.84+random()*.21))
      surfaces.quad(q,s,hi,lo,seam)
      surfaces.quad(lo,hi,p(v,11,125),p(u,11,125),new T.Color('#465768'))
    }
    // Doubler plates sit over individual vertical expansion joints in the outer band.
    const strap=i%4===1?.00173:.00094
    surfaces.quad(p(a-strap,-8.1,132.8),p(a+strap,-8.1,132.8),p(a+strap,-8.1,137.3),p(a-strap,-8.1,137.3),new T.Color(i%3?'#5d7076':'#797969'))
    for(const y of [133.6,136.5]) for(const bolt of [-1,1]) {
      const az=a+strap*.52*bolt,rr=.30
      surfaces.quad(p(az-rr/radius,-9.2,y),p(az,-9.2,y-rr),p(az+rr/radius,-9.2,y),p(az,-9.2,y+rr),new T.Color('#a6a58f'))
    }
    // Structural bays alternate slender single and paired ribs, with a deeper
    // transverse frame at each fifth bay. All are individually visible in silhouette.
    const heavy=i%5===0, drop=heavy?3:0
    for(const az of (i%5===2?[a-.0018,a+.0018]:[a])) {
      const width=heavy?.00170:i%5===2?.00056:.00089
      for(const [r,y,r2,y2] of [[-5,132,6,122],[6,122,26,116-drop],[26,116-drop,76,123],[76,123,157,128],[157,128,262,132]]) {
        surfaces.quad(p(az-width,r,y),p(az+width,r,y),p(az+width,r2,y2),p(az-width,r2,y2),new T.Color(heavy?'#7d8d8f':'#889896'))
        surfaces.quad(p(az-width,r,y),p(az-width,r,y+4),p(az-width,r2,y2+4),p(az-width,r2,y2),new T.Color('#607580'))
      }
    }
  }
  return surfaces.finish('Curved lip and ribbed soffit of the floor above')
}

export function makeTownHorizon() {
  const group=new T.Group();group.name='The First Floor beyond the town walls'
  group.add(meadows(),fieldsAndRoads(),wallsAndGroves())
  addRidges(group,{radii:[522,791,1140],bases:[-6,-9,-12],amplitudes:[67,103,136],
    colors:['#82948d','#94a4a5','#a8b6bc'],seed:22,roughness:.61})
  group.add(upperFloor())
  return group
}
