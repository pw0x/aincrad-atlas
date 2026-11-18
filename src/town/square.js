import * as T from 'three'
import { noise, rng } from '../environment/common.js'

const tau = 2 * Math.PI
const colourURL = new URL('./assets/paving-colour.webp', import.meta.url).href
const normalURL = new URL('./assets/paving-normal.webp', import.meta.url).href

export function makeSquareGround(renderer) {
  const group = new T.Group()
  const loader = new T.TextureLoader()
  const albedo = loader.load(colourURL), normal = loader.load(normalURL)
  albedo.colorSpace = T.SRGBColorSpace
  for (const texture of [albedo, normal]) {
    texture.wrapS = texture.wrapT = T.RepeatWrapping
    texture.repeat.set(46, 46)
    texture.anisotropy = Math.min(12, renderer.capabilities.getMaxAnisotropy())
  }
  const street = new T.PlaneGeometry(236, 236, 80, 80).rotateX(-Math.PI/2)
  const coords = street.getAttribute('position'), colours = []
  for (let i = 0; i < coords.count; i++) {
    const x = coords.getX(i), z = coords.getZ(i)
    const tint = .76 + .25 * noise(x*.14, z*.14)
    colours.push(tint, tint*.97, tint*.91)
  }
  street.setAttribute('color', new T.Float32BufferAttribute(colours, 3))
  const pavement = new T.Mesh(street, new T.MeshStandardMaterial({
    map: albedo, normalMap: normal, normalScale: new T.Vector2(.72,.72), roughness: .84, vertexColors: true
  }))
  pavement.name = '市街石匠 · 错缝铺石'
  pavement.position.y = -.042
  pavement.receiveShadow = true
  group.add(pavement)

  // The four longitudinal seams and the gaps in the circular border share the compass bearings.
  const positions = [], tones = [], normalUV = [], random = rng(9282)
  function triangle(p, q, r, tint) {
    const color = new T.Color(tint).multiplyScalar(.88 + random()*.17)
    for (const point of [p,q,r]) {
      positions.push(point[0],-.018,point[1])
      tones.push(color.r,color.g,color.b)
      normalUV.push(point[0]/5.13,-point[1]/5.13)
    }
  }
  const polar = (radius, angle) => [Math.sin(angle)*radius, Math.cos(angle)*radius]
  function band(inner, outer, segments, tint, offset=0) {
    for (let i=0; i<segments; i++) {
      const a = tau*(i+offset)/segments + .001, b = tau*(i+1+offset)/segments - .001
      const p=polar(inner,a), q=polar(outer,a), r=polar(outer,b), s=polar(inner,b)
      const col = Array.isArray(tint) ? tint[i % tint.length] : tint
      triangle(p,q,r,col); triangle(p,r,s,col)
    }
  }
  band(6.05,6.20,128,'#776f63')
  band(6.22,6.32,128,'#c2ab78')
  band(6.34,6.72,112,['#a49e87','#aba18c','#92968a','#aca491'],.5)
  band(6.75,6.83,128,'#8e805e')
  band(10.18,10.36,176,'#777f7a')
  band(10.38,10.47,176,'#c3aa75')
  band(10.49,11.02,144,['#96948c','#c0b6a0','#b2a897','#b3a58f'])
  band(11.04,11.18,144,'#81817d')
  for (let i=0;i<16;i++) {
    const a = i*tau/16, tip=polar(i%2?8.48:9.88,a), heel=polar(6.87,a)
    const left=polar(7.19,a+.047), right=polar(7.19,a-.047)
    triangle(tip,left,heel,'#858780'); triangle(tip,heel,right,'#c1b290')
  }
  const inlayGeometry = new T.BufferGeometry()
  inlayGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3))
  inlayGeometry.setAttribute('color',new T.Float32BufferAttribute(tones,3))
  inlayGeometry.setAttribute('uv',new T.Float32BufferAttribute(normalUV,2))
  inlayGeometry.computeVertexNormals()
  const insetNormal=normal.clone()
  insetNormal.repeat.set(1,1)
  const inlay = new T.Mesh(inlayGeometry, new T.MeshStandardMaterial({
    side:T.DoubleSide,vertexColors:true,normalMap:insetNormal,normalScale:new T.Vector2(.33,.33),roughness:.75
  }))
  inlay.receiveShadow=true
  inlay.name='广场石匠 · 十六方位镶石'
  group.add(inlay)

  // Broad contact under deep arcades and wheels survives at distances where
  // the screen-space pass can only resolve the outlines against the paving.
  const shadowCanvas=document.createElement('canvas')
  shadowCanvas.width=shadowCanvas.height=96
  const painter=shadowCanvas.getContext('2d')
  const penumbra=painter.createRadialGradient(48,48,0,48,48,48)
  penumbra.addColorStop(0,'rgba(39,33,28,.58)')
  penumbra.addColorStop(.44,'rgba(47,40,34,.39)')
  penumbra.addColorStop(1,'rgba(58,49,43,0)')
  painter.fillStyle=penumbra;painter.fillRect(0,0,96,96)
  const contacts=[[0,0,11.8,11.8],[12.4,11.1,3.9,6.1],[-13.9,4.8,4,5.8],
    [14.1,-4.8,3.8,5.3],[-14.9,-10.8,4,5],[-10.6,12,3.1,3.3],[0,-29,24,12]]
  for(const side of [-1,1]){
    for(let z=-26;z<26;z+=8) contacts.push([side*20,z,6.4,14])
    for(const z of [-16.7,27.2]) contacts.push([side*14.1,z,.96,2.8])
  }
  const texture=new T.CanvasTexture(shadowCanvas)
  texture.colorSpace=T.SRGBColorSpace
  const shadows=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),
    new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),contacts.length)
  const patch=new T.Object3D()
  contacts.forEach(([x,z,w,h],i)=>{
    patch.position.set(x,-.012,z);patch.scale.set(w,1,h);patch.updateMatrix();shadows.setMatrixAt(i,patch.matrix)
  })
  shadows.computeBoundingSphere();shadows.name='廊下与货车的地面接触阴影'
  group.add(shadows)
  return group
}
