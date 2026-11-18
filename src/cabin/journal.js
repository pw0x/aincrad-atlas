import * as T from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const anchor = [3.70,1.435,-.21]
const leftPlate = new URL('./assets/journal-lakeshore.webp',import.meta.url).href
const rightPlate = new URL('./assets/journal-botany.webp',import.meta.url).href
const width = .218, height = .294
const material = (color, roughness = .85, metalness = 0) => new T.MeshStandardMaterial({color,roughness,metalness})
function atDesk() {
  const group = new T.Group()
  group.position.fromArray(anchor)
  group.rotation.y = -Math.PI/2+.09
  return group
}
function piece(group, geometry, mat, x, y, z) {
  const mesh = new T.Mesh(geometry,mat)
  mesh.position.set(x,y,z)
  mesh.castShadow = mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}
function surface(side) {
  const pos=[],coords=[],indices=[]
  const columns=36,rows=16
  for (let j=0;j<=rows;j++) for (let i=0;i<=columns;i++) {
    const u=i/columns, v=j/rows, s=side===1?u:1-u
    const curl=.011*Math.sin(Math.PI*s)+.002*Math.sin(v*Math.PI*2+.9)*s*s
    const y=.028+curl-.012*Math.exp(-s*19)+.003*s*s*Math.cos(v*Math.PI)
    pos.push(side*(.002+s*width),y,(v-.5)*height)
    coords.push(u,1-v)
    if(i<columns && j<rows) {
      const n=j*(columns+1)+i
      indices.push(n,n+columns+1,n+1,n+1,n+columns+1,n+columns+2)
    }
  }
  const geometry=new T.BufferGeometry()
  geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3))
  geometry.setAttribute('uv',new T.Float32BufferAttribute(coords,2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
function cord(group,points,radius,mat) {
  const path = new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)))
  return piece(group,new T.TubeGeometry(path,Math.max(8,points.length*4),radius,6,false),mat,0,0,0)
}
export const journalView = {
  id:'field-notes',label:'湖岸手记',
  position:[3.31,1.94,.058],target:[3.70,1.46,-.21],fov:42
}

export function addJournal(ctx) {
  const base=atDesk()
  base.name='手缝皮革旅行簿'
  const leather=material(0x49302c), leaves=material(0xb7a982), brass=material(0x997743,.56,.62)
  const cover=new RoundedBoxGeometry(width+.012,.011,height+.017,3,.004)
  const stack=new RoundedBoxGeometry(width-.001,.017,height-.001,3,.004)
  const paperRim=material(0x877d62)
  const lip=new T.BoxGeometry(.0012,.00037,height-.006)
  for (const side of [-1,1]) {
    piece(base,cover,leather,side*(width/2+.003),.007,0)
    piece(base,stack,leaves,side*(width/2+.002),.0145,0)
    for (let k=0;k<6;k++) piece(base,lip,paperRim,side*(width+.002),.012+k*.0021,0)
    for (const end of [-1,1]) {
      const guard=new T.BoxGeometry(.024,.0018,.009)
      piece(base,guard,brass,side*(width-.002),.013,end*height*.511)
    }
  }
  piece(base,new T.CylinderGeometry(.008,.008,height+.012,10),leather,0,.012,0).rotation.x=Math.PI/2
  const ribbon=material(0x355e59,.92)
  const path=[[.035,.018,.133],[.034,.016,.155],[.041,.006,.176],[.047,.002,.183]]
  cord(base,path,.002,ribbon)
  cord(base,path.map(([x,y,z])=>[x+.003,y,z]),.0015,ribbon)
  ctx.scene.add(base)

  ctx.registerDetail({anchor,enter:3.0,exit:4.5,build:async()=>{
    const loader=new T.TextureLoader()
    const textures=await Promise.all([leftPlate,rightPlate].map(u=>loader.loadAsync(u)))
    const pages=atDesk()
    pages.name='手记内页 · 自绘湖岸地形与蕨类标本'
    for (const [i,map] of textures.entries()) {
      map.colorSpace=T.SRGBColorSpace
      map.anisotropy=ctx.renderer.capabilities.getMaxAnisotropy()
      const m=new T.MeshStandardMaterial({map,roughness:.94})
      piece(pages,surface(i?1:-1),m,0,0,0)
    }
    return pages
  }})
}
