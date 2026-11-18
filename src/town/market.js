import * as T from 'three'
import { Kit, random } from '../cabin/kit.js'

const chartStall = { x: 12.4, z: 11.1, width: 4.2, dye: '#347d7c', trim: '#e6ca83', shop: 'chart', turn: 0 }
const stalls = [
  chartStall,
  { x: -13.9, z: 4.8, width: 4.1, dye: '#aa4e37', trim: '#e5bc78', shop: 'fruit', turn: Math.PI },
  { x: 14.1, z: -4.8, width: 3.6, dye: '#99753d', trim: '#e7cf94', shop: 'books', turn: 0 },
  { x: -14.9, z: -10.8, width: 3.7, dye: '#526e5e', trim: '#d7c08d', shop: 'fruit', turn: Math.PI },
]
const TAU = Math.PI * 2
const clothSides = { side: T.DoubleSide }
const orchardFruit = new T.SphereGeometry(1, 12, 8)

function standard(colour, roughness = .76, metalness = 0, options = {}) {
  return new T.MeshStandardMaterial({ color: colour, roughness, metalness, ...options })
}

function painted(w, h, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d'), w, h)
  const map = new T.CanvasTexture(canvas)
  map.colorSpace = T.SRGBColorSpace
  map.anisotropy = 8
  return map
}

function timber() {
  const loader = new T.TextureLoader()
  const map = loader.load(new URL('../cabin/assets/waxed-oak.webp', import.meta.url).href)
  const roughnessMap = loader.load(new URL('../cabin/assets/waxed-oak-rough.webp', import.meta.url).href)
  map.colorSpace = T.SRGBColorSpace
  for (const texture of [map, roughnessMap]) {
    texture.wrapS = texture.wrapT = T.RepeatWrapping
    texture.anisotropy = 8
  }
  return {map, roughnessMap}
}

function materials() {
  const oakSurface = timber()
  const wood = (tint) => {
    const m = standard(tint, .94, 0, oakSurface)
    m.color.lerp(new T.Color(0xffedd2), .45).multiplyScalar(1.7)
    m.userData.milledTimber = true
    return m
  }
  return {
    oak: wood(0xbca288), wood: wood(0x997b63), dark: wood(0x74523e), honey: wood(0xe5c18b),
    iron: standard(0x49443c, .65, .44), copper: standard(0xbe9054, .38, .55),
    canvas: standard(0xd6be91), cord: standard(0xba9d71, 1),
    parchment: standard(0xdcc399), leather: standard(0x74513c), red: standard(0xa9503b, .63),
    green: standard(0x839159), gold: standard(0xe5b35e), olive: standard(0x55735d),
    darkBlue: standard(0x485b61), plum: standard(0x725164), ink: standard(0x324545, .38),
    ceramic: standard(0xa46b4b, .75), glazed: standard(0x527c73, .32),
  }
}

function place(group, spec) {
  group.position.set(spec.x, 0, spec.z)
  group.rotation.y = spec.turn
  return group
}

function canopyMaterial(spec) {
  const map = painted(1024, 384, (c, w, h) => {
    const n = 9, band = w / n, rng = random(710)
    c.fillStyle = spec.dye
    c.fillRect(0, 0, w, h)
    for (let i = 0; i < n; i++) {
      const x = i * band
      if (i % 2) {
        c.fillStyle = '#ddc79a'
        c.fillRect(x, 0, band, h)
        c.fillStyle = spec.dye
        c.fillRect(x + 6, 0, 2, h)
        c.fillRect(x + band - 8, 0, 2, h)
      }
      c.fillStyle = 'rgba(250,224,173,.35)'
      c.fillRect(x + 1, 0, 1.5, h)
      c.fillStyle = 'rgba(45,33,27,.21)'
      c.fillRect(x - 2, 0, 2, h)
    }
    for (let x = 0; x < w; x += 2) {
      c.fillStyle = 'rgba(255,244,201,' + (.02 + rng()*.07) + ')'
      c.fillRect(x, 0, 1, h)
    }
    for (let y = 1; y < h; y += 2) {
      c.fillStyle = 'rgba(63,46,33,' + (.015 + rng()*.07) + ')'
      c.fillRect(0, y, w, 1)
    }
  })
  return standard(0xffffff, .94, 0, { map, ...clothSides })
}

// u runs along the eave. v runs from the street-facing low rail to the high rail.
function drapedPanel(width, valance) {
  const columns = 90, rows = valance ? 4 : 16
  const vertices = [], uv = [], indices = []
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= columns; i++) {
      const u = i / columns, v = j / rows
      const scallop = Math.abs(Math.sin(u * Math.PI * 9))
      const ripple = .021 * Math.cos(u * TAU * 9) + .017*Math.sin(u*TAU*4.5)
      const edge = 2.64 - .084 * Math.sin(Math.PI * u)
      const x = valance ? -1.37 - .04*v + .023*Math.sin(u*TAU*9)*v : -1.37 + 2.75*v
      const y = valance ? edge - v*(.11 + .19*scallop) + ripple
        : edge + v*.62 - .29*Math.sin(v*Math.PI) + ripple * (1 - .3*v)
      vertices.push(x, y, (u-.5) * width)
      uv.push(u, valance ? v * .13 : v)
      if (i < columns && j < rows) {
        const k = i + (columns+1)*j
        indices.push(k, k+1, k+columns+1, k+1, k+columns+2, k+columns+1)
      }
    }
  }
  const geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function symbol(c, x, y, radius, shop) {
  c.save()
  c.translate(x, y)
  c.strokeStyle = c.fillStyle = '#f0d796'
  c.lineWidth = radius*.034
  if (shop === 'chart') {
    for (const r of [.82, .92]) {
      c.beginPath(); c.arc(0,0,r*radius,0,TAU); c.stroke()
    }
    for (let j=0;j<8;j++) {
      const length=(j%2?.55:1)*radius
      c.save(); c.rotate(j*Math.PI/4)
      c.beginPath(); c.moveTo(0,-length); c.lineTo(radius*.13,0); c.lineTo(0,radius*.16); c.closePath(); c.fill()
      c.stroke(); c.beginPath(); c.moveTo(0,-length); c.lineTo(-radius*.13,0); c.lineTo(0,radius*.16); c.stroke()
      c.restore()
    }
  } else if (shop === 'fruit') {
    c.beginPath();c.ellipse(-radius*.2,0,radius*.36,radius*.51,-.34,0,TAU);c.fill()
    c.beginPath();c.ellipse(radius*.18,0,radius*.36,radius*.5,.24,0,TAU);c.fill()
    c.beginPath();c.ellipse(radius*.19,-radius*.57,radius*.28,radius*.11,-.4,0,TAU);c.fill()
  } else {
    for (const side of [-1,1]) {
      c.beginPath();c.moveTo(0,-radius*.35);c.quadraticCurveTo(side*radius*.32,-radius*.53,side*radius*.78,-radius*.45)
      c.lineTo(side*radius*.78,radius*.43);c.quadraticCurveTo(side*radius*.31,radius*.36,0,radius*.55);c.closePath();c.stroke()
    }
  }
  c.restore()
}

function plaque(spec) {
  const map = painted(384, 448, (c,w,h) => {
    c.fillStyle = spec.dye; c.fillRect(0,0,w,h)
    c.strokeStyle = spec.trim
    for(const margin of [15,23]) c.strokeRect(margin,margin,w-2*margin,h-2*margin)
    symbol(c, w/2, h*.43, w*.27, spec.shop)
    c.font = '27px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#f0d796'
    c.fillText(({chart:'CHARTS', fruit:'ORCHARD', books:'FOLIOS'})[spec.shop],w/2,h*.82)
    c.fillRect(w*.3,h*.86,w*.4,2)
  })
  return standard(0xffffff, .85, 0, { map, ...clothSides })
}

function shopFrame(k, m, spec) {
  const half = spec.width / 2
  const roof = canopyMaterial(spec)
  k.put(drapedPanel(spec.width+.42, false), roof, [0,0,0])
  k.put(drapedPanel(spec.width+.42, true), roof, [0,0,0])
  for (const z of [-half, half]) {
    for (const [x,h] of [[-1.27,2.64],[1.29,3.26]]) {
      k.box(m.dark,x,h/2,z,.105,h,.107)
      k.stick(m.copper,[x,h-.04,z],[x,h+.04,z],.071,.076,10)
      k.ell(m.honey,x,h+.104,z,.069,.10,.069)
      k.stick(m.cord,[x,.24,z],[x,.3,z],.078,.07,10)
      k.stick(m.wood,[x,2.06,z],[x+(x<0?.48:-.48),x<0?2.61:3.02,z],.055,.055,6)
    }
    k.stick(m.oak,[-1.3,2.60,z],[1.31,3.22,z],.052,.052,8)
  }
  for(const [x,y] of [[-1.30,2.58],[1.30,3.19]])
    k.stick(m.honey,[x,y,-half-.13],[x,y,half+.13],.053,.053,12)

  // The shopkeeper has tied the scallops, pennant and hanging sign to real rails.
  for(let i=0;i<9;i++){
    const u=(i+.5)/9, z=(u-.5)*(spec.width+.42)
    const y=2.34-.084*Math.sin(Math.PI*u)
    k.stick(m.cord,[-1.41,y,z],[-1.41,y-.105,z],.009,.017,6)
    k.ell(m.copper,-1.41,y-.093,z,.019,.018,.019)
  }
  const signZ = half+.20
  k.stick(m.iron,[.32,2.96,half],[-.91,2.96,signZ],.033,.032,8)
  k.stick(m.iron,[.16,2.65,half],[-.65,2.96,signZ],.02,.02,8)
  k.stick(m.iron,[-.91,2.96,signZ-.19],[-.91,2.96,signZ+.19],.017,.017,8)
  for (const dz of [-.16,.16])
    k.stick(m.copper,[-.91,2.95,signZ+dz],[-.91,2.71,signZ+dz],.012,.012,8)
  k.box(m.honey,-.91,2.39,signZ,.062,.69,.59,undefined,true)
  k.put(new T.PlaneGeometry(.53,.62),plaque(spec),[-.944,2.39,signZ],[1,1,1],[0,-Math.PI/2,0])

  for (const z of [-half+.30,half-.30]) {
    for(const x of [-.76,.34]) k.box(m.dark,x,.45,z,.13,.88,.13)
    k.box(m.oak,-.2,.28,z,1.2,.095,.11)
  }
  for(const x of [-.74,.35]) {
    k.box(m.wood,x,.77,0,.089,.23,spec.width-.37)
    k.box(m.oak,x,.24,0,.074,.075,spec.width-.4)
  }
  for(let j=0;j<6;j++) k.box(j%3?m.oak:m.honey,-.80+.239*j,.89,0,.236,.115,spec.width-.24,undefined,true)

  if(spec.shop==='chart'){
    for (const z of [-.98,0,.98]) {
      k.box(m.wood,-.78,.726,z,.103,.23,.94,undefined,true)
      k.box(m.copper,-.84,.734,z,.021,.068,.13,undefined,true)
      k.ring(m.iron,-.862,.705,z,.042,.007,[0,Math.PI/2,0])
    }
    // Open shelves give the counter a readable silhouette behind the parchment.
    for(const z of [-half+.20,half-.20]) k.box(m.wood,1.11,1.06,z,.12,2.12,.11)
    for(const y of [.36,1.23,1.79]) k.box(m.oak,.93,y,0,.47,.067,spec.width-.29)
  }
}

function crate(k, m, x, y, z, sx=.63, sz=.81, height=.32) {
  for(const a of [-1,1]) for(const b of [-1,1])
    k.box(m.dark,x+a*(sx/2-.028),y+height/2,z+b*(sz/2-.027),.055,height,.055)
  for(let i=0;i<3;i++){
    const h=y+.042+i*height/3
    for(const side of [-1,1]){
      k.box(m.oak,x+side*sx/2,h,z,.038,height*.28,sz)
      k.box(m.wood,x,h,z+side*sz/2,sx,height*.28,.037)
    }
  }
  k.box(m.dark,x,y+.035,z,sx-.04,.042,sz-.04)
}

function jar(k, mat, x, y, z, h, r) {
  k.lathe(mat,[[.57,0],[.75,.05],[.95,.28],[1,.55],[.83,.77],[.49,.85],[.43,.97],[.54,.97],[.53,1],[.33,1],[.31,.92]],x,y,z,[r,h,r],20)
}

function volumes(k,m,x,y,z,height,width,cover) {
  k.box(m.parchment,x,y+height/2,z,.28,height,width)
  for(const dy of [0,height]) k.box(cover,x,y+dy,z,.301,.014,width+.018)
  k.box(cover,x-.143,y+height/2,z,.024,height,width+.012,undefined,true)
  for(const dz of [-.3,.29]) k.box(m.copper,x-.158,y+height*.55,z+dz*width,.008,.013,width*.12)
}

function furnish(k,m,spec) {
  const rng=random(spec.shop==='chart'?114:spec.shop==='books'?57:128)
  if(spec.shop==='chart') {
    // The folded survey remains visible beyond the instrument streaming radius.
    const sketch=painted(192,120,(c,w,h)=>{
      c.fillStyle='#d6c493';c.fillRect(0,0,w,h)
      c.strokeStyle='#776749';c.lineWidth=1.4;c.strokeRect(5,5,w-10,h-10)
      c.fillStyle='#9ba991';c.fillRect(10,10,122,100)
      for(let band=0;band<5;band++){
        c.beginPath()
        for(let j=0;j<=70;j++){
          const a=j/70*TAU,r=1+.11*Math.sin(5*a)+.055*Math.cos(9*a),t=1-band*.13
          const x=71+Math.cos(a)*r*t*55,y=61+Math.sin(a)*r*t*44
          if(j)c.lineTo(x,y);else c.moveTo(x,y)
        }
        if(!band){c.fillStyle='#c5bd87';c.fill()}
        c.strokeStyle=band?'#a39b72':'#6f7b63';c.stroke()
      }
      c.strokeStyle='#795644';c.lineWidth=2;c.beginPath();c.moveTo(46,80);c.lineTo(66,70);c.lineTo(77,72);c.lineTo(92,50);c.stroke()
      c.fillStyle='#776749';c.fillRect(140,14,35,3);c.fillRect(146,21,22,1)
      c.strokeStyle='#97774e';c.beginPath();c.arc(157,72,17,0,TAU);c.stroke()
      c.beginPath();c.moveTo(157,50);c.lineTo(160,70);c.lineTo(157,92);c.lineTo(154,70);c.closePath();c.stroke()
    })
    k.put(new T.PlaneGeometry(1.43,.88),standard(0xffffff,.97,0,{map:sketch}),[-.23,.954,-.12],[1,1,1],[-Math.PI/2,0,-Math.PI/2])
    volumes(k,m,.24,.952,-1.66,.057,.30,m.olive)
    for (const z of [-1.5,-1.19,1.17,1.54]) {
      jar(k,z>0?m.glazed:m.ceramic,.99,1.265,z,.34+rng()*.17,.15)
      if(z<0) jar(k,m.glazed,.91,1.83,z,.23,.105)
    }
    for(let j=0;j<5;j++) volumes(k,m,.95,1.268+j*.093,-.43+rng()*.05,.071,.56,[m.leather,m.darkBlue,m.red][j%3])
    for(let j=0;j<3;j++) {
      k.stick(m.parchment,[.83,1.86+j*.074,.50],[1.11,1.86+j*.074,.53],.041,.041,12)
      k.stick(m.leather,[.94,1.86+j*.074,.51],[.97,1.86+j*.074,.515],.043,.044,12)
    }
    crate(k,m,.42,0,-1.57,.68,.72,.61)
    crate(k,m,.53,0,1.55,.66,.65,.40)
  } else if(spec.shop==='fruit'){
    const types=[m.red,m.green,m.gold,m.red]
    for(let i=0;i<4;i++) {
      const z=(i-1.5)*.83;crate(k,m,-.29,.947,z,.92,.79,.22)
      for(let j=0;j<23;j++){
        const row=Math.floor(j/5),column=j%5
        const x=-.62+row*.152+(rng()-.5)*.038, zz=z-.29+column*.139+(rng()-.5)*.046
        const h=1.135+.072*Math.sin(row/4*Math.PI)*Math.sin(column/4*Math.PI)
        k.put(orchardFruit,types[i],[x,h,zz],[.088,.077+rng()*.028,.085])
        if(j%4===0) k.stick(m.dark,[x,h+.066,zz],[x+.008,h+.11,zz+.009],.007,.004,6)
      }
    }
    for (const z of [-1.57,.51,1.42]) jar(k,z>0?m.ceramic:m.glazed,.86,.03,z,.65,.31)
  } else {
    const covers=[m.darkBlue,m.olive,m.red,m.plum]
    for(let i=0;i<5;i++){
      let y=.951
      for(let j=0;j<3+(i%3);j++){
        const h=.06+rng()*.057
        volumes(k,m,-.35+rng()*.09,y,(i-2)*.57+rng()*.1,h,.39+rng()*.11,covers[(i+j)%4]); y+=h+.009
      }
    }
    crate(k,m,.65,.01,-1.08,.68,.71,.52)
  }
}

export function makeMarketBase() {
  const root=new T.Group()
  root.name='Merchants of the teleport square'
  const m=materials()
  for(const spec of stalls) {
    const kit=new Kit(spec.shop+' stall')
    shopFrame(kit,m,spec)
    furnish(kit,m,spec)
    root.add(place(kit.finish(),spec))
  }
  return root
}

function parchmentGeometry() {
  const cols=48, rows=32
  const vertices=[], uv=[], indices=[]
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=i/cols,v=j/rows
    const side=(Math.max(0, .073-u)+Math.max(0,u-.933))/.073
    const back=Math.max(0,v-.93)/.07
    const ripple=.0027*Math.sin(u*TAU*3.3+v*2)+.0018*Math.cos(v*TAU*1.7-u*5)
    vertices.push((v-.5)*.93,.006+.028*side**2+.006*back**2+ripple,(u-.5)*1.49)
    uv.push(u,v)
    if(i<cols&&j<rows){
      const a=j*(cols+1)+i
      indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1)
    }
  }
  const geometry=new T.BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3))
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2))
  geometry.computeVertexNormals()
  return geometry
}

function horizontalDial(radius) {
  // Local +U points down the market aisle (+Z), +V points away from the viewer (+X).
  const g=new T.CircleGeometry(radius,80)
  g.rotateX(-Math.PI/2)
  g.rotateY(-Math.PI/2)
  return g
}

function compass(k,m) {
  const x=-.48,z=.96
  k.lathe(m.copper,[[.095,0],[.115,.011],[.119,.037],[.111,.05],[.1,.048]],x,.955,z)
  const map=painted(512,512,(c,w) => {
    const r=w/2
    c.fillStyle='#e8d6a8';c.fillRect(0,0,w,w);c.translate(r,r)
    for(const rad of [.96,.88,.76,.67,.31]) {
      c.beginPath();c.arc(0,0,rad*r,0,TAU);c.strokeStyle='#75674b';c.lineWidth=rad===.96?4:2;c.stroke()
    }
    for(let i=0;i<72;i++){
      c.save();c.rotate(i*TAU/72)
      c.fillStyle=i%6?'#6b644f':'#954e3e'
      c.fillRect(-1.5,-.86*r,3,(i%6?.07:.14)*r);c.restore()
    }
    symbol(c,0,0,r*.62,'chart')
    c.textAlign='center';c.textBaseline='middle';c.fillStyle='#514636';c.font='bold 26px Georgia, serif'
    for(const [dx,dy,t] of [[0,-.53,'N'],[.54,0,'E'],[0,.54,'S'],[-.53,0,'W']]) c.fillText(t,r*dx,r*dy)
    c.rotate(.36)
    for(const [tip,col] of [[-1,'#964530'],[1,'#39585a']]){
      c.beginPath();c.moveTo(0,tip*.72*r);c.lineTo(r*.065,0);c.lineTo(0,-tip*r*.08);c.lineTo(-r*.065,0);c.closePath();c.fillStyle=col;c.fill()
    }
  })
  k.put(horizontalDial(.105),standard(0xffffff,.62,0,{map}),[x,1.004,z])
  k.ring(m.copper,x,1.006,z,.108,.006)
  k.ell(m.copper,x,1.011,z,.009,.008,.009)
  k.ring(m.copper,x,.974,z+.133,.029,.005)
}

function armillary(k,m,x,z) {
  const y=1.35
  k.lathe(m.dark,[[.14,0],[.155,.02],[.142,.037],[.10,.052],[.086,.068],[.054,.078],[.041,.13],[.06,.15]],x,.951,z)
  k.stick(m.copper,[x,1.09,z],[x,1.18,z],.034,.023)
  k.ell(m.glazed,x,y,z,.087,.087,.087)
  for(const [r,rx,rz] of [[.163,0,0],[.178,Math.PI/2-.23,0],[.154,-.48,.55],[.155,1.12,-.32]]) {
    k.ring(m.copper,x,y,z,r,.006,[rx,0,rz])
  }
  k.ring(m.darkBlue,x,y,z,.16,.009,[.94,.06,.43])
  for(let i=0;i<4;i++) k.ell(m.copper,x+.173*Math.cos(i*Math.PI/2),y,z+.173*Math.sin(i*Math.PI/2),.012,.012,.012)
  k.stick(m.copper,[x-.048,y-.18,z],[x+.048,y+.18,z],.006)
  k.ell(m.copper,x+.052,y+.191,z,.014,.014,.014)
}

function quill(k,m,x,z) {
  k.lathe(m.ink,[[.059,0],[.074,.018],[.072,.092],[.046,.121],[.038,.144],[.045,.152],[.044,.16],[.027,.16],[.027,.148]],x,.953,z)
  k.ring(m.copper,x,1.102,z,.04,.005)
  const tip=[x+.175,1.51,z+.091]
  k.stick(m.honey,[x,1.097,z],tip,.006,.002,8)
  const vertices=[],indices=[]
  for(let i=0;i<=28;i++){
    const t=i/28,center=[x+.05+.126*t,1.21+.30*t,z+.026+.065*t]
    const wide=.039*Math.sin(t*Math.PI)**.72
    const nick= i===10||i===16||i===22 ? .45:1
    vertices.push(center[0]-.018,center[1]-.018,center[2]-wide*nick,...center,center[0]+.019,center[1]-.015,center[2]+wide)
    if(i<28){const j=i*3;indices.push(j,j+1,j+3,j+1,j+4,j+3,j+1,j+2,j+4,j+2,j+5,j+4)}
  }
  const geo=new T.BufferGeometry()
  geo.setIndex(indices);geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));geo.computeVertexNormals()
  k.put(geo,standard(0xe4d7b4,.89,0,clothSides),[0,0,0])
}

function toolsOfTrade(k,m) {
  const chartHeight=.971
  // Ebony dividers, backed by an actual pin and two polished measuring points.
  const hinge=[.057,1.001,-.60]
  for(const [dx,dz] of [[-.233,.037],[-.14,.192]]) {
    const bend=[hinge[0]+dx*.72,.994,hinge[2]+dz*.72]
    const point=[hinge[0]+dx,chartHeight+.004,hinge[2]+dz]
    k.stick(m.dark,hinge,bend,.011,.008,10)
    k.stick(m.copper,bend,point,.008,.001,10)
  }
  k.ring(m.copper,hinge[0],hinge[1],hinge[2],.021,.006)
  k.ell(m.copper,hinge[0],hinge[1]+.004,hinge[2],.009,.008,.009)
  // Tallied rule, with brass caps at either end.
  k.box(m.honey,.35,.974,-.06,.049,.018,1.44)
  for(let i=0;i<61;i++) {
    const major=i%5===0, tick=major?.028:.014
    k.box(m.ink,.34-tick/3,.985,-.72+i*.022,tick,.0018,.003)
  }
  for(const z of [-.78,.66]) k.box(m.copper,.35,.975,z,.052,.023,.026)
  // A letter shut with a broken sunburst seal sits beside the chart.
  k.box(m.parchment,-.52,.963,-1.27,.31,.017,.38,[0,-.19,0],true)
  for(const to of [[-.61,.975,-1.45],[-.70,.975,-1.11]])
    k.stick(m.leather,[-.49,.977,-1.25],to,.0025,.0025,5)
  k.ell(m.red,-.48,.979,-1.25,.046,.012,.042)
  k.ring(m.leather,-.48,.988,-1.25,.028,.002)
  for(let i=0;i<8;i++){
    const a=i*TAU/8
    k.stick(m.leather,[-.48+.009*Math.cos(a),.99,-1.25+.009*Math.sin(a)],[-.48+.022*Math.cos(a),.989,-1.25+.022*Math.sin(a)],.001,.001,4)
  }
  for(let i=0;i<3;i++){
    const z=.85+i*.25,x=.08+(i%2)*.05,r=.046+i*.005
    k.stick(m.parchment,[x-.29,.955+r,z],[x+.22,.955+r,z+.035],r,r*.97,24)
    k.stick(m.leather,[x-.055,.956+r,z+.018],[x-.032,.956+r,z+.018],r+.002,r+.002,24)
    k.disc(m.leather,[x-.291,.955+r,z],[-1,0,-.06],r*.52)
    k.disc(m.parchment,[x-.292,.955+r,z],[-1,0,-.06],r*.34)
  }
  armillary(k,m,.12,-1.33)
  quill(k,m,.39,.92)
}

// Kit already bakes singleton geometry. Its instanced batches keep pooled sources
// that another stall or detail region can still be drawing when this tree is evicted.
export function ownDetailInstanceGeometry(root) {
  const copies=new Map()
  root.traverse(mesh=>{
    if(!mesh.isInstancedMesh)return
    const source=mesh.geometry
    if(!copies.has(source))copies.set(source,source.clone())
    mesh.geometry=copies.get(source)
  })
  return root
}

export async function makeMarketDetails(signal) {
  const map=await new T.TextureLoader().loadAsync(new URL('./market-chart.webp',import.meta.url).href)
  if(signal?.aborted){
    map.dispose()
    throw new DOMException('The chart region was closed','AbortError')
  }
  const k=new Kit('Surveyor’s chart and brass instruments')
  const m=materials()
  map.colorSpace=T.SRGBColorSpace
  map.anisotropy=12
  const parchment=standard(0xffffff,.94,0,{map,emissive:0x30291a,emissiveIntensity:.20,side:T.DoubleSide})
  k.box(m.leather,-.23,.955,-.12,.978,.012,1.56,undefined,true)
  k.put(parchmentGeometry(),parchment,[-.23,.962,-.12])
  for(const z of [-.864,.625]) {
    const x=.12
    k.ell(m.copper,x,.992,z,.042,.017,.039)
    k.ring(m.iron,x,1.002,z,.018,.003)
  }
  compass(k,m)
  toolsOfTrade(k,m)
  return place(ownDetailInstanceGeometry(k.finish()),chartStall)
}
