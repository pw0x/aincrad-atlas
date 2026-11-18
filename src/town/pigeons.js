import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const TAU = Math.PI * 2

// Each moving part becomes one shared vertex-coloured geometry. Its instances
// can peck, step and bank independently without separate meshes for feathers.
function partBuilder() {
  const parts=[]
  function add(geometry,color) {
    const g=geometry.index?geometry.toNonIndexed():geometry
    g.deleteAttribute('uv');g.clearGroups()
    if(color!==null){
      const c=new T.Color(color), colours=new Float32Array(g.attributes.position.count*3)
      for(let i=0;i<colours.length;i+=3){colours[i]=c.r;colours[i+1]=c.g;colours[i+2]=c.b}
      g.setAttribute('color',new T.BufferAttribute(colours,3))
    }
    parts.push(g)
  }
  function ell(x,y,z,rx,ry,rz,color){
    const g=new T.SphereGeometry(1,10,7)
    g.scale(rx,ry,rz);g.translate(x,y,z);add(g,color)
  }
  function limb(start,end,rStart,rEnd,color){
    const a=new T.Vector3(...start),b=new T.Vector3(...end),v=b.clone().sub(a)
    const g=new T.CylinderGeometry(rEnd,rStart,v.length(),6)
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()))
    const mid=a.lerp(b,.5);g.translate(mid.x,mid.y,mid.z);add(g,color)
  }
  function skin(rows,segment,paint){
    const p=[],rgb=[],indices=[]
    for(let i=0;i<rows.length;i++){
      for(let j=0;j<20;j++){
        const a=j*TAU/20
        p.push(...segment(rows[i],a))
        const c=paint(i,a);rgb.push(c.r,c.g,c.b)
        if(i+1<rows.length){
          const l=i*20+j,n=i*20+(j+1)%20
          indices.push(l,n,n+20,l,n+20,l+20)
        }
      }
    }
    const g=new T.BufferGeometry()
    g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(rgb,3))
    g.setIndex(indices);g.computeVertexNormals();add(g,null)
  }
  // Model the rachis and the two vanes. The shaft projects slightly from the surface.
  function feather(start,end,width,across,normal,colour,shaft) {
    const a=new T.Vector3(...start),b=new T.Vector3(...end),v=b.clone().sub(a)
    const edge=new T.Vector3(...across).normalize(),lift=new T.Vector3(...normal).normalize()
    const p=[],col=[],indices=[], dark=new T.Color(colour),light=new T.Color(shaft)
    for(const [t,w] of [[0,.09],[.23,.82],[.52,1],[.78,.77],[.94,.37],[1,.018]]){
      const c=a.clone().addScaledVector(v,t)
      for(let j=-1;j<=1;j++){
        const point=c.clone().addScaledVector(edge,w*width*j)
        if(!j)point.addScaledVector(lift,.0018*w)
        p.push(...point.toArray())
        const hue=j===0?light:dark;col.push(hue.r,hue.g,hue.b)
      }
    }
    for(let row=0;row<5;row++)for(let j=0;j<2;j++){const k=row*3+j;indices.push(k,k+3,k+1,k+1,k+3,k+4)}
    const g=new T.BufferGeometry()
    g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3))
    g.setIndex(indices);g.computeVertexNormals();add(g,null)
  }
  return {skin,ell,limb,feather,finish(){
    const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());return g
  }}
}

function bodyMesh() {
  const model=partBuilder(), mantle=new T.Color(0x929ba6),breast=new T.Color(0xb2aaa8)
  // Sections follow the sternum, flank and raised rump along the bill-to-tail axis.
  const rows=[[-.148,.129,.002,.002],[-.123,.129,.027,.023],[-.09,.128,.047,.036],[-.045,.126,.058,.054],
    [0,.126,.063,.065],[.037,.128,.058,.068],[.075,.138,.044,.057],[.093,.144,.025,.04],[.105,.15,.002,.002]]
  model.skin(rows,([z,y,rx,ry],a)=>[Math.cos(a)*rx,y+Math.sin(a)*ry,z],
    (i,a)=>mantle.clone().lerp(breast,Math.max(0,(-Math.sin(a)+.18)*.64+(i/rows.length)*.18)))
  for(let i=-5;i<=5;i++){
    const u=i/5
    model.feather([u*.015,.135,-.064],[u*.050,.11+Math.abs(u)*.006,-.194+u*u*.026],.010,
      [1,0,0],[0,1,0],i%2?0x515d6d:0x596676,0x78818b)
    model.feather([u*.038,.119,-.144+u*u*.014],[u*.049,.112+Math.abs(u)*.006,-.185+u*u*.025],
      .009,[1,0,0],[0,1,0],0x444e5b,0x536070)
  }
  return model.finish()
}

function foldedWing(side) {
  const m=partBuilder(),s=side
  const outline=new T.Vector3(s,0,0),across=[0,1,0],out=outline.toArray()
  // Long flight feathers overlap towards the tail. Black wing bars cut across the
  // pale grey coverts, a diagnostic rock-dove marking that survives at street scale.
  for(let i=0;i<7;i++){
    const t=i/6
    m.feather([s*.048,.150+t*.020,.042-t*.036],[s*(.027+t*.018),.099+t*.049,-.141+t*.052],
      .0125,across,out,0x46505d,0x78818e)
  }
  for(let i=0;i<10;i++){
    const t=i/9
    const start=[s*(.052+.012*Math.sin(t*Math.PI)),.171-.047*t,.044+.014*t]
    const end=[s*(.039+.018*Math.sin(t*Math.PI)),.157-.052*t,-.116+.035*t]
    m.feather(start,end,.014,across,out,i%3?0x8994a0:0x9ca4aa,0xa8adb2)
    for(const k of [.52,.76]){
      const at=f=>[s*(Math.abs(start[0])*(1-f)+Math.abs(end[0])*f+.002),start[1]*(1-f)+end[1]*f,start[2]*(1-f)+end[2]*f]
      m.feather(at(k-.082),at(k+.066),.010,across,out,0x424b56,0x495462)
    }
  }
  for(let i=0;i<8;i++){
    const t=i/7
    m.feather([s*(.044+.019*t),.173-.034*t,.054],[s*(.056+.008*t),.163-.038*t,-.012+t*.012],
      .012,across,out,i%2?0x9ca7ab:0x8c999e,0xa5adb0)
  }
  return m.finish()
}

function headMesh() {
  const model=partBuilder(), base=new T.Color(0x637381),silver=new T.Color(0x939ba1)
  const emerald=new T.Color(0x547b73),wine=new T.Color(0x796773)
  const rows=[[-.030,-.004,.031,.036],[-.014,.000,.039,.044],[.002,.006,.038,.041],
    [.022,.018,.031,.035],[.041,.029,.031,.033],[.059,.036,.029,.030],
    [.071,.036,.024,.023],[.078,.034,.014,.014],[.081,.032,.002,.002]]
  model.skin(rows,([y,z,rx,rz],a)=>[Math.cos(a)*rx,y,z-Math.sin(a)*rz],(i,a)=>{
    const c=base.clone().lerp(silver,Math.max(0,i-4)*.16)
    if(i<4)c.lerp(Math.cos(a+.6)>0?emerald:wine,.54+.12*Math.cos(2*a))
    return c
  })
  // The cere sits above a narrow, slightly hooked mandible.
  model.limb([0,.046,.056],[0,.039,.086],.009,.0044,0x514c49)
  model.limb([0,.039,.083],[0,.035,.093],.0048,.0009,0x404247)
  model.ell(0,.050,.064,.009,.006,.012,0xbbbab0)
  for(const s of [-1,1]){
    model.ell(s*.028,.055,.048,.0033,.0063,.0061,0xa5a0a1)
    model.ell(s*.030,.055,.048,.0030,.0046,.0047,0xc28249)
    model.ell(s*.0324,.055,.049,.0017,.0032,.0031,0x24252a)
    model.ell(s*.0336,.0564,.0496,.0009,.0012,.0009,0xdfd7bf)
    model.ell(s*.006,.049,.071,.002,.0018,.003,0x736a64)
  }
  return model.finish()
}

function footMesh(s) {
  const m=partBuilder(),leg=0x9e726f,toe=0x976c68
  m.limb([0,.088,.002],[s*.005,.042,-.009],.006,.0046,leg)
  m.limb([s*.005,.042,-.009],[0,.008,.006],.0046,.0037,leg)
  for(let i=-1;i<=1;i++){
    const end=[i*.017,.004,.037-Math.abs(i)*.008]
    m.limb([0,.008,.006],[i*.008,.005,.018],.0035,.0027,toe)
    m.limb([i*.008,.005,.018],end,.0027,.0015,toe)
    m.limb(end,[end[0]+i*.002,0,end[2]+.006],.0016,.00055,0x595052)
  }
  m.limb([0,.008,.006],[0,.003,-.021],.0032,.0013,toe)
  return m.finish()
}

function flightWing(s) {
  const m=partBuilder()
  for(let i=0;i<10;i++){
    const t=i/9
    m.feather([s*(.025+t*.071),.004,.037-t*.025],
      [s*(.104+t*.17),-.003+t*.022,-.117+.135*t],.014,[0,0,1],[0,1,0],
      i>4?0x52616e:0x74828c,i>4?0x667785:0x91a0a8)
  }
  for(let i=0;i<11;i++){
    const t=i/10
    m.feather([s*.013,.008,.041-t*.030],[s*(.06+.142*t),.022,-.063+.099*t],.016,
      [0,0,1],[0,1,0],i%3?0x8b98a0:0x95a2aa,0xa6b2b6)
  }
  return m.finish()
}

const feetOnStone=[
  // x, sole height, z, heading, individual phase, size
  [-7.02,-.018,8.04,.48,2,.99],[-7.43,-.018,7.88,2.36,13,.96],[-6.76,-.042,7.46,-1.32,5.7,1.02],
  [-8.20,-.042,8.88,.18,18,.93],[6.22,-.018,-6.05,-.21,9.2,.99],[6.59,-.042,-6.31,-2.44,19.8,.91],
  [3.48,.901,3.28,-.66,12.3,1.01],[-3.83,.901,2.89,1.19,4.1,.96],
]
const flightPaths=[
  [-4.9,13.5,-10.2,17.4,6.6,.23,.2],
  [-5.8,14.1,-11.5,18.2,6.9,.23,.28],
  [7.9,17.3,-17,11.4,4.7,.33,3.7],
]
const ease=n=>{const x=Math.max(0,Math.min(1,n));return x*x*(3-2*x)}

function contactShadows(count) {
  const size=32,data=new Uint8Array(size*size*4)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const r=((x+.5)/size*2-1)**2+((y+.5)/size*2-1)**2, k=(y*size+x)*4
    data[k]=data[k+1]=data[k+2]=255;data[k+3]=Math.round(255*Math.max(0,1-r)**2)
  }
  const shadow=new T.DataTexture(data,size,size)
  shadow.magFilter=shadow.minFilter=T.LinearFilter;shadow.needsUpdate=true
  const mat=new T.MeshBasicMaterial({name:'Soft contact under the doves',map:shadow,color:0x302e34,opacity:.29,
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1})
  const mesh=new T.InstancedMesh(new T.PlaneGeometry(.22,.36).rotateX(-Math.PI/2),mat,count)
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage)
  mesh.name='Foot contacts'
  return mesh
}

export function makeTownBirds() {
  const root=new T.Group()
  root.name='Rock doves in the market square'
  const material=new T.MeshStandardMaterial({name:'Blue-bar rock dove plumage',vertexColors:true,roughness:.78,metalness:.055,side:T.DoubleSide})
  const walkers=feetOnStone.length,flock=walkers+flightPaths.length
  const colours=[0xffffff,0xffece4,0xe8eef6,0xf2f0df,0xe5e4e7]
  function batch(name,geo,n){
    const mesh=new T.InstancedMesh(geo,material,n)
    mesh.name=name;mesh.receiveShadow=true
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage)
    for(let i=0;i<n;i++)mesh.setColorAt(i,new T.Color(colours[i%colours.length]))
    root.add(mesh);return mesh
  }
  const bodies=batch('Bodies and barred tail fans',bodyMesh(),flock)
  const heads=batch('Nodding heads, ceres and neck plumage',headMesh(),flock)
  const folded=[-1,1].map(s=>batch('Folded wing and two bars',foldedWing(s),walkers))
  const feet=[-1,1].map(s=>batch('Scaled feet and claws',footMesh(s),walkers))
  const wings=[-1,1].map(s=>batch('Tapered flight feathers',flightWing(s),flightPaths.length))
  // The district caches its sun shadow. Contact follows a stepping bird even
  // between shadow-map refreshes, including on the narrow raised fountain lip.
  const shadows=contactShadows(walkers)
  root.add(shadows)
  // Moving instances stay in this plaza. A stable bound avoids per-frame CPU
  // culling rebuilds and still culls the whole bird batch from other districts.
  for(const mesh of root.children)mesh.boundingSphere=new T.Sphere(new T.Vector3(0,8,-5),36)
  const base=new T.Object3D(),joint=new T.Object3D(),matrix=new T.Matrix4()
  function basePose(x,y,z,yaw,pitch,roll,scale){
    base.position.set(x,y,z);base.rotation.set(pitch,yaw,roll,'YXZ');base.scale.setScalar(scale);base.updateMatrix()
  }
  function part(mesh,i,x,y,z,pitch=0,yaw=0,roll=0){
    joint.position.set(x,y,z);joint.rotation.set(pitch,yaw,roll,'YXZ');joint.updateMatrix()
    matrix.multiplyMatrices(base.matrix,joint.matrix);mesh.setMatrixAt(i,matrix)
  }
  const motion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null
  let previous=-1
  function update(elapsed){
    const t=motion?.matches?0:elapsed
    if(t===previous)return
    previous=t
    for(let i=0;i<walkers;i++){
      const [x,y,z,angle,offset,scale]=feetOnStone[i], perched=y>.5, cycle=(t+offset)%30
      const out=ease(cycle/3.3),back=ease((cycle-15)/3.3)
      const stepMask=perched?0:cycle<3.3?Math.sin(Math.PI*cycle/3.3):cycle>=15&&cycle<18.3?Math.sin(Math.PI*(cycle-15)/3.3):0
      const dist=perched?0:.20*(out-back), turn=perched?0:Math.PI*(ease((cycle-12.8)/1.45)-ease((cycle-27.8)/1.45))
      const stride=Math.sin((t+offset)*12.6)*stepMask
      const peckPhase=(t+offset)%7.4
      const peck=(peckPhase<.66?Math.sin(Math.PI*peckPhase/.66)**2:
        peckPhase>1.02&&peckPhase<1.59?Math.sin(Math.PI*(peckPhase-1.02)/.57)**2:0)*(1-stepMask)*(perched?.35:1)
      basePose(x+Math.sin(angle)*dist,y,z+Math.cos(angle)*dist,angle+turn,0,0,scale)
      part(shadows,i,.016,.003,-.016)
      part(bodies,i,0,-peck*.02,0,peck*.20)
      part(heads,i,0,.151-peck*.100,.046+peck*.042+stride*.007,peck*1.18,.16*Math.sin(t*.86+offset))
      for(let j=0;j<2;j++){
        const sign=j*2-1,footStep=sign*stride
        part(folded[j],i,0,-peck*.02,0,peck*.20)
        part(feet[j],i,sign*.022,Math.max(0,footStep)*.016,footStep*.019,-footStep*.10)
      }
    }
    for(let j=0;j<flightPaths.length;j++){
      const [cx,cy,cz,rx,rz,speed,offset]=flightPaths[j],a=t*speed+offset
      const i=walkers+j,wingbeat=Math.sin(t*14+offset)*Math.pow(Math.max(0,Math.sin(t*1.16+offset)),3)
      basePose(cx+rx*Math.sin(a),cy+.64*Math.sin(a*2+.3),cz+rz*Math.cos(a),Math.atan2(rx*Math.cos(a),-rz*Math.sin(a)),-.12,-.15*Math.cos(a),1)
      part(bodies,i,0,0,0,-.17)
      part(heads,i,0,.148,.065,-.14)
      for(let k=0;k<2;k++)part(wings[k],j,(k*2-1)*.035,.163,.012,0,0,(k*2-1)*(.12+.72*wingbeat))
    }
    for(const mesh of root.children)mesh.instanceMatrix.needsUpdate=true
  }
  update(0)
  root.userData.update=update
  return root
}
