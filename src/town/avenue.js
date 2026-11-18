import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { rng } from '../environment/common.js'

const leafURL = new URL('../environment/assets/leaf-cluster.webp', import.meta.url).href
const up = new T.Vector3(0,1,0)
const vec = (x,y,z) => new T.Vector3(x,y,z)

export function makeAvenue(ctx) {
  const root = new T.Group()
  const random = rng(32219)
  const batches = new Map()
  const identity = new T.Quaternion()
  const scale = vec(1,1,1)
  const colour = new T.Color()
  function add(geometry, material, position, tint, rotation=identity) {
    geometry.applyMatrix4(new T.Matrix4().compose(position,rotation,scale))
    const solid = geometry.index ? geometry.toNonIndexed() : geometry
    if (solid !== geometry) geometry.dispose()
    solid.deleteAttribute('uv')
    const count=solid.getAttribute('position').count
    const colors=new Float32Array(count*3)
    colour.set(tint)
    for (let i=0;i<count;i++) colour.toArray(colors,i*3)
    solid.setAttribute('color',new T.BufferAttribute(colors,3))
    if (!batches.has(material)) batches.set(material,[])
    batches.get(material).push(solid)
  }
  function branch(a,b,bottom,top,tint,mat=wood,segments=8) {
    const axis=b.clone().sub(a)
    const length=axis.length()
    const q=new T.Quaternion().setFromUnitVectors(up,axis.normalize())
    add(new T.CylinderGeometry(top,bottom,length,segments),mat,a.clone().lerp(b,.5),tint,q)
  }
  const wood = new T.MeshStandardMaterial({vertexColors:true,roughness:.94})
  const iron = new T.MeshStandardMaterial({vertexColors:true,metalness:.46,roughness:.51})
  const stone = new T.MeshStandardMaterial({vertexColors:true,roughness:.86})
  const glass = new T.MeshStandardMaterial({vertexColors:true,emissive:0xffbb60,emissiveIntensity:.4,roughness:.28})
  const crowns = []
  const trees=[[-14,-11,7.4],[-14.5,17.8,7.8],[16,-9,7.6],[15,23.5,6.6],[-16,-24,6.3],[16,-26,6.4],[-13,34,7.1],[13.5,37,6.9]]
  for (const [x,z,h] of trees) {
    add(new T.CylinderGeometry(1.40,1.52,.23,12), stone, vec(x,.10,z),'#aaa18b')
    add(new T.CylinderGeometry(1.24,1.34,.08,12), wood, vec(x,.24,z),'#544c3d')
    const fork=vec(x+.16,h*.44,z-.19)
    branch(vec(x,.17,z),fork,h*.040,h*.026,'#695747')
    for (let limb=0;limb<9;limb++) {
      const a=(limb*2.4+random()*.6), radius=h*(.14+.23*random())
      const shoulder=vec(x+Math.sin(a)*radius*.43,h*(.47+random()*.13),z+Math.cos(a)*radius*.43)
      const outer=vec(x+Math.sin(a)*radius,h*(.65+random()*.19),z+Math.cos(a)*radius)
      branch(fork,shoulder,h*.019,h*.012,'#705e49')
      branch(shoulder,outer,h*.012,h*.004,'#76674f')
      for(let tip=0;tip<4;tip++){
        const turn=a+(tip-1.5)*.93, reach=h*(.06+random()*.13)
        const end=outer.clone().add(vec(Math.sin(turn)*reach,h*(.055+random()*.13),Math.cos(turn)*reach))
        branch(outer,end,h*.005,.009,'#796a52',wood,5)
        const s=h*(.24+random()*.12)
        crowns.push([end,s,random()*Math.PI,random()])
      }
    }
  }
  const leaves=new T.TextureLoader().load(leafURL,()=>{
    if(!ctx.signal.aborted) ctx.renderer.shadowMap.needsUpdate=true
  })
  leaves.colorSpace=T.SRGBColorSpace
  const leafy = new T.MeshLambertMaterial({map:leaves,alphaTest:.34,side:T.DoubleSide})
  leafy.shadowSide=T.DoubleSide
  const cards=new T.InstancedMesh(new T.PlaneGeometry(1,1),leafy,crowns.length*3)
  const sprig=new T.Object3D()
  let at=0
  for(const [pos,s,turn,tone] of crowns){
    sprig.position.copy(pos)
    colour.setHSL(.185+tone*.036,.21+tone*.13,.52+tone*.14)
    for (let i=0;i<3;i++) {
      sprig.rotation.set(i===2?-1.04:.03,turn+i*1.54,(tone-.5)*.48)
      sprig.scale.set(s,s*(i===2?.83:1.04),1)
      sprig.updateMatrix()
      cards.setMatrixAt(at,sprig.matrix); cards.setColorAt(at++,colour)
    }
  }
  cards.name='广场菩提树 · 分枝与透光叶簇'
  cards.castShadow=true; cards.receiveShadow=true; cards.computeBoundingSphere()
  root.add(cards)

  function lanternPost(x,z,height,side) {
    const dark='#384745', bronze='#917448'
    const shaft=(y0,y1,r0,r1,tint,mat=iron,n=10)=>
      branch(vec(x,y0,z),vec(x,y1,z),r0,r1,tint,mat,n)
    shaft(0,.20,.42,.37,'#b7ad94',stone)
    shaft(.20,.39,.29,.22,dark); shaft(.39,.49,.24,.24,bronze)
    shaft(.49,.98,.19,.15,dark); shaft(.98,1.08,.18,.17,bronze)
    shaft(1.08,height,.11,.067,dark); shaft(height-.32,height-.22,.13,.13,bronze)
    shaft(height,height+.26,.135,.01,bronze)
    for (const d of [side, -side]) {
      const sz=d===side?1:.63
      const reach=.80*sz
      const top=height-(1-sz)*.85
      const points=[vec(x,top-.37,z),vec(x+d*.31*sz,top-.28,z),vec(x+d*.52*sz,top+.14*sz,z),vec(x+d*.76*sz,top+.16*sz,z),vec(x+d*reach,top-.04,z)]
      for(let i=1;i<points.length;i++) branch(points[i-1],points[i],.031,.030,dark,iron)
      const lx=x+d*reach, y=top-.43*sz
      branch(vec(lx,y+.26*sz,z),points[4],.028,.026,bronze,iron)
      add(new T.ConeGeometry(.221*sz,.18*sz,6),iron,vec(lx,y+.20*sz,z),dark)
      add(new T.CylinderGeometry(.176*sz,.110*sz,.34*sz,6),glass,vec(lx,y-.045*sz,z),'#ffe7a7')
      add(new T.CylinderGeometry(.136*sz,.048*sz,.11*sz,6),iron,vec(lx,y-.26*sz,z),bronze)
      for(let k=0;k<6;k++){
        const a=k*Math.PI/3
        branch(vec(lx+Math.sin(a)*.111*sz,y-.213*sz,z+Math.cos(a)*.111*sz),
               vec(lx+Math.sin(a)*.177*sz,y+.123*sz,z+Math.cos(a)*.177*sz),.014*sz,.014*sz,dark,iron,5)
      }
    }
  }
  for (const side of [-1,1]) {
    lanternPost(side*9.7,17.3,4.2,-side)
    lanternPost(side*9.8,-11.9,4.1,-side)
    lanternPost(side*14.2,-22.2,4.4,-side)
    for (const z of [-16.7,27.2]) {
      const x=side*14.1, length=2.2
      for(let n=0;n<4;n++){
        add(new T.BoxGeometry(.105,.064,length),wood,vec(x+side*(n-1.5)*.13,.47,z),
          n%2?'#977950':'#886e4a')
      }
      for(let n=0;n<3;n++){
        add(new T.BoxGeometry(.063,.105,length),wood,vec(x+side*(.25+n*.027),.65+n*.13,z),'#937752')
      }
      for(const offset of [-.81,.81]){
        const at=z+offset
        branch(vec(x-side*.22,.03,at),vec(x-side*.14,.44,at),.036,.029,'#404843',iron)
        branch(vec(x+side*.24,.03,at),vec(x+side*.32,.97,at),.038,.029,'#404843',iron)
        branch(vec(x-side*.18,.42,at),vec(x+side*.26,.42,at),.033,.033,'#565748',iron)
        branch(vec(x-side*.17,.26,at),vec(x+side*.25,.42,at),.018,.022,'#52584b',iron)
        add(new T.SphereGeometry(.036,8,6),iron,vec(x+side*.32,.97,at),'#a78b5c')
      }
    }
    // Cut stone drainage channels run inside the shop row, interrupted at the alley mouths.
    for(let z=-35;z<41;z+=1.55){
      if (Math.abs(z+2)<2.7 || Math.abs(z-29)<2) continue
      const x=side*16.83
      add(new T.BoxGeometry(.28,.042,1.53),stone,vec(x,-.008,z),'#827e6c')
      for(const edge of [-1,1]){
        add(new T.BoxGeometry(.057,.058,1.525),stone,vec(x+edge*.13,.004,z),'#b1a590')
      }
      if (Math.round((z+35)/1.55)%5===0) {
        add(new T.BoxGeometry(.211,.024,.52),iron,vec(x,.024,z),'#51574d')
        for(let bar=0;bar<7;bar++){
          add(new T.BoxGeometry(.221,.014,.023),iron,vec(x,.043,z+(bar-3)*.070),'#8a8472')
        }
      }
    }
  }
  for(const [mat,parts] of batches){
    const combined=mergeGeometries(parts)
    const mesh=new T.Mesh(combined,mat)
    mesh.castShadow=true; mesh.receiveShadow=true
    root.add(mesh)
    parts.forEach(g=>g.dispose())
  }
  return root
}
