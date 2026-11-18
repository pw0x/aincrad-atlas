import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Instances, arcade, gabledRoof, seeded } from '../castle/geometry.js'

const halfTurn = Math.PI
const quarterTurn = Math.PI / 2
const walls = ['#ded1aa', '#e2bd8f', '#d0c29f', '#ead5b3', '#cba88d', '#c8bfa4']
const roofs = ['#97513f', '#536e70', '#a46748', '#52687b', '#795c61', '#a36049']
const shutters = ['#58716a', '#765049', '#54717c', '#64744d', '#9a7755']
const timber = '#5c4233', lightOak = '#8b6647', limestone = '#c5b69e', bronze = '#a47743'
const stonework = ['#b1a393', '#bcab95', '#c3b6a0', '#a99887']

// Each repeat covers twelve tile courses. The shingle grain, water streaks and
// recessed overlap are shared by all roofs. Vertex tint identifies each kiln batch.
function surfaceMap(size, pixel) {
  const rgba = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = Math.min(255, Math.max(0, pixel(x, y)))
      const i = (y * size + x) * 4
      rgba[i] = value; rgba[i + 1] = value; rgba[i + 2] = value; rgba[i + 3] = 255
    }
  }
  const map = new T.DataTexture(rgba, size, size)
  map.colorSpace = T.SRGBColorSpace
  map.wrapS = map.wrapT = T.RepeatWrapping
  map.magFilter = T.LinearFilter; map.minFilter = T.LinearMipmapLinearFilter
  map.generateMipmaps = true; map.anisotropy = 8; map.needsUpdate = true
  return map
}

function materials() {
  const random = seeded(1908)
  const tile = surfaceMap(384, (x, y) => {
    const row = Math.floor(y / 32), u = (x + (row % 2) * 24) % 48, v = y % 32
    const column = Math.floor((x + (row % 2) * 24) / 48) % 8
    const variation = 9 * Math.sin((row * 13 + column * 35) * 21.7)
    const edge = Math.min(u, 48-u)
    const bottom = 3.3 * (1 - Math.pow((u - 24) / 24, 2))
    if (v < bottom || edge < 1.1) return 112 + variation
    return 215 + variation + 10 * Math.sin(u / 48 * 3.14) - 25 * Math.exp(-(32-v)/4)
      + (v < bottom + 1.8 ? 20 : 0) + 3.5 * Math.sin(u * 2) + random() * 10
  })
  const plaster = surfaceMap(256, (x,y) => {
    const grit=random()
    const wash=4*Math.sin(x*.14+y*.07)+4*Math.sin(x*.043-y*.09)
    const scar=14+6*Math.sin(x*.075)+5*Math.sin(x*.19)+3*Math.cos(x*.47)
    const damp=31*Math.exp(-y/(scar+4))
    const chipped=y<scar && Math.sin(x*.69-y*.54)+grit>.47
    return 231+wash+grit*16-damp-(chipped?19:0)
  })
  const wood = surfaceMap(128, (x,y) => {
    const phase = x*.83 + Math.sin(y*.049)*.85 + Math.sin(y*.098+x*.098)*.5
    return 236 + Math.sin(phase)*5 - 11*Math.max(0,Math.sin(phase*1.35))**7 + random()*8
  })
  const panes = surfaceMap(128, (x,y) => {
    const seam = Math.min((x+y)%32,(x-y+128)%32,32-(x+y)%32,32-(x-y+128)%32)
    if (seam < 1.5) return 106
    const pane = (Math.floor((x+y)/32)*19 + Math.floor((x-y+128)/32)*37) % 11
    return 206 + pane + Math.sin((x+y*.19)*.1)*8 + y*.1 + random()*7
  })
  const standard = (options={}) => new T.MeshStandardMaterial({color:0xffffff,roughness:.84,...options})
  return {
    wood: standard({map:wood}), plaster: standard({map:plaster}), trim: standard({roughness:.74}),
    roof: standard({map:tile, vertexColors:true, roughness:.83}),
    glass: standard({map:panes,roughness:.31,metalness:.19}),
    glow: standard({map:panes,roughness:.48,emissive:0x69390d,emissiveIntensity:.54}),
    iron: standard({metalness:.42,roughness:.51}), foliage: standard()
  }
}

function archSurround() {
  const s = new T.Shape()
  s.moveTo(-.5,0); s.lineTo(-.5,.51)
  s.absarc(0,.51,.5,halfTurn,0,true)
  s.lineTo(.5,0); s.lineTo(.375,0); s.lineTo(.375,.51)
  s.absarc(0,.51,.375,0,halfTurn,false)
  s.lineTo(-.375,0); s.closePath()
  const geo = new T.ExtrudeGeometry(s,{depth:1,bevelEnabled:false,curveSegments:12})
  geo.translate(0,0,-.5)
  return geo
}

function kit() {
  return {
    box:new T.BoxGeometry(), gable:gabledRoof(), arch:archSurround(),
    pane:new T.PlaneGeometry(1,1), drum:new T.CylinderGeometry(.5,.5,1,10),
    cone:new T.ConeGeometry(.5,1,8), ball:new T.IcosahedronGeometry(.5,1),
    circle:new T.CylinderGeometry(.5,.5,1,16)
  }
}

function roofBatch() {
  const positions=[], colors=[], uv=[], indices=[]
  return {
    quad(points, tint, u, v) {
      const start=positions.length/3, color=new T.Color(tint)
      for (const p of points) { positions.push(...p); colors.push(color.r,color.g,color.b) }
      uv.push(0,0, 0,v, u,v, u,0)
      indices.push(start,start+1,start+2,start,start+2,start+3)
    },
    mesh(material) {
      const geometry=new T.BufferGeometry()
      geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3))
      geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3))
      geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2))
      geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere()
      const mesh=new T.Mesh(geometry,material)
      mesh.name='Overlapping fired and glazed roof tiles';mesh.castShadow=mesh.receiveShadow=true
      return mesh
    }
  }
}

// All facade dimensions below live in metres, with +Z toward the square.
// One transform maps a west/east street or an angled rear terrace into town space.
function facade(batch, roofing, x0, z0, yaw) {
  const cs=Math.cos(yaw), sn=Math.sin(yaw)
  const point=(x,y,z)=>[x0+x*cs+z*sn,y,z0-x*sn+z*cs]
  function put(form,mat,color,x,y,z,w,h,d,roll=0,pitch=0) {
    batch.add(form,mat,...point(x,y,z),w,h,d,yaw,color,roll,pitch)
  }
  function box(mat,color,x,y,z,w,h,d,roll=0,pitch=0) {
    put('box',mat,color,x,y,z,w,h,d,roll,pitch)
  }
  function beam(color,x1,y1,x2,y2,z,width=.14,depth=.13) {
    const dx=x2-x1,dy=y2-y1
    box('wood',color,(x1+x2)/2,(y1+y2)/2,z,width,Math.hypot(dx,dy),depth,-Math.atan2(dx,dy))
  }
  function gable(x,y,z,w,d,rise,roof,wall,rich) {
    put('gable','plaster',wall,x,y,z,w,rise,d)
    const span=w/2+.32, end=d/2+.37, eave=y-.12, peak=y+rise+.14
    const uvWidth=end*2/3.2, uvHeight=Math.hypot(span,peak-eave)/3
    for (const side of [-1,1]) {
      const edge=x+side*span, near=z-side*end, far=z+side*end
      roofing.quad([point(edge,eave,near),point(x,peak,near),point(x,peak,far),point(edge,eave,far)],roof,uvWidth,uvHeight)
      box('wood',rich?lightOak:timber,edge,eave-.09,z,.18,.23,end*2)
      if (rich) {
        beam(timber,edge,eave,x,peak,z+end,.19,.19)
        beam('#ab875b',edge,eave+.08,x,peak+.08,z+end+.04,.068,.22)
        box('wood',timber,x+side*.23*w,y+rise*.22,z+d/2+.04,.13,rise*.44,.12)
      }
    }
    box('trim',roof,x,peak+.015,z,.21,.15,end*2+.12)
    if (rich) box('wood',timber,x,y+rise*.49,z+d/2+.045,.16,rise,.13)
  }
  return {put,box,beam,gable}
}

function window(f,x,y,z,w,h,shade,lit,rich,flowers) {
  const {put,box}=f
  box('wood',timber,x,y,z,w+.22,h+.19,.13)
  put('pane',lit?'glow':'glass',lit?'#ecc28c':'#829f9f',x,y,z+.073,w,h,1)
  box('wood','#765f46',x,y-.02,z+.088,.065,h,.055)
  box('wood','#725b45',x,y+h*.14,z+.096,w,.08,.06)
  box('trim',limestone,x,y-h/2-.13,z+.045,w+.47,.15,.32)
  if (!rich) return
  box('wood',lightOak,x,y+h/2+.11,z+.035,w+.38,.13,.22)
  for (const sign of [-1,1]) {
    const sx=x+sign*(w*.68+.08), sw=w*.31
    box('wood',shade,sx,y,z-.01,sw,h,.14)
    for (let j=-2;j<=2;j++) box('trim',shade,sx,y+j*h*.16,z+.073,sw-.055,.048,.043,0,.22)
    for (const k of [-1,1]) box('iron','#4f4f45',sx+sign*.02,y+k*h*.31,z+.09,sw*.80,.045,.035)
  }
  if (!flowers) return
  box('wood','#705139',x,y-h/2-.06,z+.25,w+.14,.23,.35)
  box('trim','#967147',x,y-h/2+.045,z+.26,w+.22,.07,.40)
  for (let k=0;k<7;k++) {
    const dx=x+(k/6-.5)*w, yy=y-h/2+.11+Math.sin(k*7)*.05
    put('ball','foliage',k%2?'#637447':'#4e6245',dx,yy,z+.25,.23,.22,.32)
    put('ball','foliage',k%3?'#b98978':'#dab37c',dx+.04,yy+.095,z+.28,.10,.11,.10)
  }
}

function bayWindow(f,x,y,z,shade) {
  f.box('plaster','#d0b08a',x,y,z+.30,2.26,2.26,.75)
  for (const dx of [-.7,0,.7]) window(f,x+dx,y+.04,z+.69,.49,1.27,shade,dx===0,false,false)
  for (const side of [-1,1]) {
    f.box('wood',timber,x+side*1.06,y,z+.71,.12,2.2,.16)
    f.box('wood',lightOak,x+side*.77,y-1.32,z+.28,.16,.75,.24,0,-.64)
  }
  f.box('wood',timber,x,y-1.08,z+.27,2.43,.20,1)
  f.box('trim',shade,x,y+1.16,z+.26,2.66,.24,1.17,0,.16)
}

function hangingSign(f,x,z,shade,style) {
  f.box('iron','#574e42',x,3.28,z+.58,.095,.095,1.25)
  f.box('iron',bronze,x,3.10,z+.39,.07,.72,.07,0,.87)
  for (const depth of [.84,1.06]) f.box('iron',bronze,x,3.01,z+depth,.045,.52,.045)
  f.box('wood','#815e3d',x,2.66,z+.95,.19,.83,.86)
  for (const side of [-1,1]) {
    const sx=x+side*.105
    f.box('trim',shade,sx,2.66,z+.95,.025,.70,.75)
    for (const y of [2.37,2.95]) f.box('trim','#d4aa68',sx+side*.015,y,z+.95,.022,.037,.64)
    f.put('ball','iron','#dfbd75',sx+side*.023,2.69,z+.96,.036,.29,style%2?.35:.20)
    f.box('trim','#e1c08c',sx+side*.031,2.57,z+.95,.025,.052,.43)
  }
}

function clockGable(f,y,z) {
  f.put('circle','iron',bronze,0,y,z,1.73,.13,1.73,0,quarterTurn)
  f.put('circle','trim','#d6c39a',0,y,z+.08,1.53,.07,1.53,0,quarterTurn)
  for (let i=0;i<12;i++) {
    const angle=i*halfTurn/6
    f.box('iron','#5d5448',Math.sin(angle)*.62,y+Math.cos(angle)*.62,z+.14,.04,i%3===0?.18:.11,.032,-angle)
  }
  f.beam('#503f34',0,y,-.24,y+.25,z+.155,.065,.06)
  f.beam('#503f34',0,y,.44,y+.16,z+.17,.045,.05)
  f.put('ball','iron',bronze,0,y,z+.21,.12,.12,.08)
}

function cornerTurret(f,x,y,z,roof) {
  f.put('cone','wood',timber,x,y-1.10,z,1.77,1.05,1.77,0,halfTurn)
  f.put('drum','plaster','#e1c79d',x,y+.43,z,1.66,2.14,1.66)
  for(const h of [-.58,.72,1.42]) f.put('drum','wood',timber,x,y+h,z,1.80,.12,1.80)
  for(const dx of [-.57,0,.57]) {
    f.box('wood',lightOak,x+dx,y+.45,z+.69,.09,1.89,.10)
    f.put('pane','glass','#81999b',x+dx*.62,y+.56,z+.795,.26,.61,1)
  }
  f.put('cone','trim',roof,x,y+2.62,z,2.20,2.46,2.20)
  f.put('ball','iron','#bb9a60',x,y+3.87,z,.18,.20,.18)
  f.box('iron',bronze,x,y+4.14,z,.04,.51,.04)
}

function groundFloor(f,w,z,shade,index,rich) {
  const bays=w>=8?3:2, spacing=w/bays
  for (let i=0;i<bays;i++) {
    const x=(i-(bays-1)/2)*spacing, door=i===index%bays, width=Math.min(spacing-.42,2.46)
    f.box('wood','#443a30',x,1.37,z+.012,width,2.64,.12)
    if (door) {
      for (let j=0;j<5;j++) f.box('wood',j%2?'#71543c':'#806144',x+(j-2)*width*.15,1.10,z+.10,width*.14,2.06,.10)
      for (const y of [.63,1.69]) f.box('iron','#524b42',x,y,z+.17,width*.79,.073,.045)
      f.put('ball','iron','#caad72',x+width*.26,1.16,z+.2,.12,.12,.065)
      f.box('trim',limestone,x,.11,z+.19,width+.23,.20,.60)
    } else window(f,x,1.52,z+.13,width*.79,1.45,shade,i%2===0,false,false)
    f.put('arch','trim',stonework[(index+i)%4],x,.12,z+.20,width+.21,2.86,.22)
    if (rich) {
      for (const side of [-1,1]) {
        f.box('trim','#d8c5a8',x+side*width*.475,1.57,z+.21,.32,.15,.34)
        f.box('trim',limestone,x+side*width*.475,.27,z+.23,.36,.35,.36)
      }
      f.box('trim','#d8c5a8',x,2.85,z+.24,.25,.31,.29)
    }
  }
}

function house(f,w,d,eaves,rise,index,rich) {
  const z=d/2, wall=walls[index%walls.length], roof=roofs[index%roofs.length], shade=shutters[index%shutters.length]
  f.box('plaster',wall,0,eaves*.50,0,w,eaves,d)
  f.box('trim',stonework[index%4],0,.31,0,w+.06,.62,d+.07)
  const base=3.23, floors=Math.max(1,Math.round((eaves-base)/2.95)), floor=(eaves-base)/floors
  const bays=w>=7.8?3:2, bay=w/bays
  if (rich) groundFloor(f,w,z,shade,index,true)
  else {
    for (let b=0;b<bays;b++) window(f,(b+.5)*bay-w/2,1.52,z+.09,1.22,1.64,shade,b%3===0,false,false)
  }
  for (let level=0;level<floors;level++) {
    const bottom=base+floor*level, y=bottom+floor*.49
    f.box('wood',timber,0,bottom,0,w+.28,.22,d+.28)
    if (rich) f.box('wood',lightOak,0,bottom+.17,0,w+.35,.076,d+.35)
    for (let b=0;b<=bays;b++) {
      const x=b*bay-w/2
      f.box('wood',timber,x,y,z+.05,.16,floor,.17)
      if (rich && b<bays) {
        const dir=(b+index)%2?1:-1, from=x+bay*(dir>0?.12:.88), to=x+bay*(dir>0?.34:.66)
        f.beam(lightOak,from,bottom+.14,to,bottom+.88,z+.092,.12,.086)
      }
    }
    for (let b=0;b<bays;b++) {
      const x=(b+.5)*bay-w/2
      if (rich && index%3===0 && level===0 && b===1) bayWindow(f,x,y,z,shade)
      else window(f,x,y,z+.08,Math.min(1.18,bay*.47),Math.min(1.55,floor*.57),shade,(b+index+level)%4===0,rich,rich&&(index+b+level)%3===0)
    }
    if (rich) for (const side of [-1,1]) {
      for (let k=0;k<3;k++) f.box('wood',timber,side*w/2,y,(k-1)*d*.44,.14,floor,.16)
    }
  }
  f.box('wood',timber,0,eaves-.06,0,w+.27,.24,d+.25)
  f.gable(0,eaves,0,w,d,rise,roof,wall,rich)
  if (rich) {
    if (index===1) clockGable(f,eaves+rise*.40,z+.20)
    else window(f,0,eaves+rise*.39,z+.12,.77,.95,shade,index%3===0,false,false)
    if (index===7) cornerTurret(f,w*.45,eaves-.68,z+.24,roof)
    for (const side of [-1,1]) f.beam(timber,side*w*.44,eaves+.03,side*w*.20,eaves+rise*.49,z+.09,.15,.13)
    hangingSign(f,-w*.42,z,shade,index)
    if (index%3===1) {
      // A linen sunshade sits over two shop bays. Its scallops alternate dyed and undyed cloth.
      const aw=w*.64, ax=w*.115
      for (let n=0;n<11;n++) {
        const color=n%2?'#d6bc92':shade, x=ax+aw*((n+.5)/11-.5)
        f.box('trim',color,x,2.99,z+.67,aw/11+.004,.095,1.32,0,.22)
        f.box('trim',color,x,2.78,z+1.29,aw/11+.004,.24,.06)
        f.put('ball','trim',color,x,2.66,z+1.29,aw/11,.21,.073)
      }
    }
  }
  const chimneyX=w*(index%2?.26:-.29), chimneyY=eaves+rise*.64+.48, chimneyZ=-d*.27
  f.box('trim',stonework[(index+1)%4],chimneyX,chimneyY,chimneyZ,.76,2.55,.8)
  f.box('trim',roof,chimneyX,chimneyY+1.22,chimneyZ,.96,.24,1)
  if (rich) for(const dx of [-.17,.17]) f.put('drum','trim','#9c6f53',chimneyX+dx,chimneyY+1.48,chimneyZ,.26,.48,.31)
}

function spire(f,y,r,height,color) {
  f.put('drum','plaster','#cbb99a',0,y*.5,0,r*2,y,r*2)
  for (const height of [.18*y,.80*y,.96*y]) f.put('drum','trim',limestone,0,height,0,r*2.15,.27,r*2.15)
  f.put('cone','trim',color,0,y+height*.5,0,r*2.61,height,r*2.61)
  f.put('ball','iron','#b5995d',0,y+height,0,.31,.36,.31)
  f.box('iron',bronze,0,y+height+.51,0,.052,1.03,.052)
  f.box('trim',color,.19,y+height+.82,0,.50,.20,.04,-.11)
}

function endWall(batch,roofing,x,z,yaw,w,d,h,side,index) {
  const cx=x+Math.cos(yaw)*w*.5*side, cz=z-Math.sin(yaw)*w*.5*side
  const face=facade(batch,roofing,cx,cz,yaw+side*quarterTurn)
  const shade=shutters[index%shutters.length],bays=d>8?3:2
  for(let b=0;b<bays;b++) {
    const u=d*((b+.5)/bays-.5)
    window(face,u,h-1.46,.11,1.09,1.41,shade,(index+b)%4===0,true,b===0)
    if (b===0 || b===bays-1) window(face,u,1.77,.13,.73,.95,shade,false,false,false)
  }
  face.box('wood',timber,0,3.23,.09,d-.38,.18,.19)
}

function dormer(f,x,z,eave,shade,roof) {
  f.box('plaster','#cfb99b',x,eave+.83,z,1.87,1.74,2.14)
  f.gable(x,eave+1.68,z,2.09,2.30,1.02,roof,'#dbc7a4',false)
  window(f,x,eave+1.04,z+1.095,.84,1.03,shade,false,false,false)
  for(const dx of [-.84,.84]) f.box('wood',timber,x+dx,eave+.94,z+1.105,.13,1.42,.15)
  f.box('wood',lightOak,x,eave+1.71,z+1.15,2.01,.15,.18)
  f.box('trim',roof,x,eave+.36,z+1.12,2.12,.12,.48)
}

// Long eaves face down the back streets. Their dormers cross the primary ridge,
// giving an orbit above the square a different rhythm from the front-gabled shops.
function eavesHouse(batch,roofing,x,z,yaw,w,d,h,rise,index,rich) {
  const f=facade(batch,roofing,x,z,yaw), roof=roofs[index%roofs.length]
  const shade=shutters[index%shutters.length],wall=walls[index%walls.length]
  f.box('plaster',wall,0,h*.5,0,w,h,d)
  f.box('trim',stonework[index%4],0,.44,0,w+.075,.88,d+.10)
  if(rich) groundFloor(f,w,d/2,shade,index,true)
  const rows=h>8?2:1, bayCount=w>10?4:3
  for(let row=0;row<rows;row++) {
    const bottom=3.22+(h-3.22)*row/rows, height=(h-3.22)/rows
    f.box('wood',timber,0,bottom,0,w+.18,.21,d+.19)
    for(let i=0;i<bayCount;i++) {
      const u=((i+.5)/bayCount-.5)*w
      window(f,u,bottom+height*.52,d/2+.105,1.0,Math.min(1.52,height*.55),shade,(i+index+row)%4===0,rich,rich&&i===1&&row===0)
      f.box('wood',timber,u-w/(2*bayCount),bottom+height*.50,d/2+.07,.14,height,.16)
    }
  }
  f.box('wood',lightOak,0,h-.07,0,w+.25,.22,d+.22)
  facade(batch,roofing,x,z,yaw+quarterTurn).gable(0,h,0,d,w,rise,roof,wall,rich)
  const count=w>11?3:2
  for(let i=0;i<count;i++) dormer(f,w*((i+.5)/count-.5),d*.5-1.60,h,shade,roof)
  const chimneyH=h+rise+1
  f.box('trim',stonework[index%4],w*.38,chimneyH-.87,-d*.16,.63,2.5,.81)
  f.box('trim',roof,w*.38,chimneyH+.33,-d*.16,.85,.23,.98)
}

function passageMasonry(width,deck,depth) {
  const group=new T.Group(),blocks=[],random=seeded(8972)
  group.name='North gallery · load-bearing barrel vault and dressed abutments'
  function project(geometry,metres) {
    const pos=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i)
      const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i))
      uv.setXY(i,(nx>nz && nx>ny?z:x)/metres,(ny>nx && ny>nz?z:y)/metres)
    }
  }
  const grain=surfaceMap(256,(x,y)=>{
    const grit=random(), vein=Math.sin(x*.073+Math.sin(y*.049)*2.8+y*.025)
    return 223+13*grit+5*vein+3*Math.sin(x*.71+y*.85)-(grit>.983?31:0)
  })
  const wallMap=surfaceMap(384,(x,y)=>{
    const row=Math.floor(y/64),v=y%64, u=(x+(row%2)*64)%128,block=Math.floor((x+(row%2)*64)/128)%3
    const grit=random(),cut=Math.sin(x*.26+row*11)*.63+Math.sin(x*.070+y*.031)*.78
    const gap=Math.min(v+cut,64-v-cut,u+.76*Math.cos(y*.16),128-u)
    if(gap<1.45)return 124+grit*21
    const tone=197+13*Math.sin((row*3+block)*4.71)+8*grit+4*Math.cos(x*.062+Math.sin(y*.097))
    return tone+(gap<2.8?19:0)-(grit>.977?22:0)
  })
  const core=arcade()
  core.scale(width,deck,depth);project(core,2.04)
  const spandrels=new T.Mesh(core,new T.MeshStandardMaterial({color:'#d3c6ae',map:wallMap,bumpMap:wallMap,bumpScale:.021,roughness:.94}))
  spandrels.name='Coursed limestone spandrels and recessed mortar'
  spandrels.castShadow=spandrels.receiveShadow=true;group.add(spandrels)
  const dressed=['#c8b69a','#c2af95','#cfbda2','#c0b09a','#d2bfa1','#b9aa93','#c5b69e']
  const tint=new T.Color()
  function block(geo,colour){
    project(geo,.68)
    tint.set(colour)
    const c=[],count=geo.attributes.position.count
    for(let i=0;i<count;i++)c.push(tint.r,tint.g,tint.b)
    geo.setAttribute('color',new T.Float32BufferAttribute(c,3));geo.clearGroups()
    blocks.push(geo)
  }
  function ashlar(shape,z0,z1,col) {
    const outline=new T.Shape(shape.map(([x,y])=>new T.Vector2(x,y)))
    const stone=new T.ExtrudeGeometry(outline,{depth:z1-z0,bevelEnabled:true,bevelThickness:.006,bevelSize:.007,bevelSegments:1})
    stone.translate(0,0,z0)
    block(stone,col)
  }
  const spring=.38*deck,opening=.405*width
  // arcade() samples each quadratic six times. Sample the same polyline so
  // every voussoir beds into the arch, including the three faces of the apex.
  function curve(u,offset) {
    const t=1-Math.abs(u),idx=Math.min(5,Math.floor(t*6)),frac=t*6-idx
    function quadratic(t){
      const s=1-t
      return [width*(.405*s*s+2*.402*s*t),deck*(.38*s*s+2*.64*s*t+.91*t*t)]
    }
    const lo=quadratic(idx/6),hi=quadratic((idx+1)/6)
    const x=lo[0]+(hi[0]-lo[0])*frac,y=lo[1]+(hi[1]-lo[1])*frac
    const len=Math.hypot(x,y-spring)
    return [Math.sign(u)*(x+offset*x/len),y+offset*(y-spring)/len]
  }
  const bays=23
  for(let row=0;row<5;row++) {
    const outer=row===0||row===4, dz=depth/5
    const z0=-depth/2+row*dz+.014-(row===0?.065:0)
    const z1=-depth/2+(row+1)*dz-.014+(row===4?.065:0)
    for(let i=0;i<bays;i++){
      const a=-1+(i+.021)*2/bays,b=-1+(i+.979)*2/bays,centre=a<0&&b>0
      const addr=[a]
      if(centre)addr.push(0)
      addr.push(b)
      const ring=centre&&outer?.395:outer?.338:.270
      const poly=[...addr.map(u=>curve(u,-.033)),...addr.slice().reverse().map(u=>curve(u,ring))]
      ashlar(poly,z0,z1,centre&&outer?'#d8c6a5':dressed[Math.floor(random()*dressed.length)])
    }
  }
  // The piers bear on a broad footing. Stagger their real bed joints down the
  // sides of the tunnel as well as around both outward-facing returns.
  for(const s of [-1,1]){
    const levels=6,courses=spring/levels
    for(let j=0;j<levels;j++){
      const y0=j*courses+.010,y1=(j+1)*courses-.011
      const toe=j===0?.095:j===5?.061:.024
      const l=s*(opening-toe),r=s*(width*.5+(j===0?.065:.015))
      const outside=depth*.5+(j===0?.112:.067)
      let z=-outside, n=0
      while(z<outside-.01) {
        const next=z+(n===0 && j%2?.37:.68+random()*.16)
        const end=outside-next<.18?outside:next
        const chip=.013+random()*.020
        ashlar([[l,y0],[r-s*chip,y0],[r,y0+chip],[r,y1],[l+s*chip,y1],[l,y1-chip]],
          z+.013,end-.013,dressed[Math.floor(random()*dressed.length)])
        z=end;n++
      }
    }
  }
  const geometry=mergeGeometries(blocks,false)
  for(const piece of blocks)piece.dispose()
  const stones=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,map:grain,bumpMap:grain,bumpScale:.016,roughness:.92}))
  stones.name='Interlocking voussoirs, keystones and staggered pier courses'
  stones.castShadow=stones.receiveShadow=true;group.add(stones)
  return group
}

function coveredPassage(batch,roofing) {
  const cx=-19.35,cz=-51.3
  const f=facade(batch,roofing,cx,cz,0), width=8.6, depth=3.5, deck=4.98
  const masonry=passageMasonry(width,deck,depth)
  masonry.position.set(cx,0,cz)
  f.box('wood',timber,0,deck+.06,0,width+.5,.28,depth+.48)
  for(const dz of [-1,1]) {
    const edge=dz*(depth*.5+.03)
    for(let i=0;i<7;i++) {
      const x=(i/6-.5)*width
      f.box('wood',lightOak,x,deck+1.26,edge,.17,2.4,.19)
      if(i<6) {
        f.beam(timber,x+.05,deck+.19,x+width/6-.05,deck+.94,edge,.085,.09)
        f.beam(timber,x+.05,deck+.94,x+width/6-.05,deck+.19,edge,.085,.09)
      }
    }
    f.box('wood',lightOak,0,deck+1.02,edge,width+.17,.13,.16)
    f.box('wood',timber,0,deck+2.38,edge,width+.4,.22,.22)
  }
  facade(batch,roofing,cx,cz,quarterTurn).gable(0,deck+2.47,0,depth+.34,width+.35,1.62,'#667978','#d4bca0',true)
  return masonry
}

function northernQuarter(geometry,palette) {
  const batch=new Instances(geometry,palette),roofing=roofBatch(),g=new T.Group()
  g.name='Clock lane, covered gallery and the northern rooftops'
  const fronts=[
    [-28.4,-52.5,9.65,8.1,8.55,4.0,15,true],[-11.15,-50.8,7.6,6.9,6.4,3.5,19,false],
    [-3.36,-51.8,7.55,7.7,8.2,3.8,14,false],[4.95,-54.9,8.0,7.2,6.5,3.4,22,true],
    [13.0,-51.1,8.1,7.2,9.2,3.7,20,false],[23.55,-53.7,11.3,8.4,7.7,4.1,18,true]
  ]
  for(const [x,z,w,d,h,rise,i,longEave] of fronts) {
    const yaw=Math.sin(i)*.065, f=facade(batch,roofing,x,z,yaw)
    if(longEave) eavesHouse(batch,roofing,x,z,yaw,w,d,h,rise,i,true)
    else house(f,w,d,h,rise,i,true)
    if(i===19 || i===14 || i===20) endWall(batch,roofing,x,z,yaw,w,d,h,i===14?1:-1,i)
  }
  g.add(coveredPassage(batch,roofing))
  const random=seeded(7531)
  for(let row=0;row<2;row++) {
    let edge=-31+row*1.3,i=0
    while(edge<28) {
      const w=7.3+random()*3.4,d=6.5+random()*2,z=-66.1-row*12.5+(random()-.5)*3
      const x=edge+w*.5,h=7.2+row*2.5+random()*4.4,rise=3.3+random()*2.3,yaw=(random()-.5)*.16,id=27+row*9+i
      if((i+row)%3===0) eavesHouse(batch,roofing,x,z,yaw,w,d,h,rise,id,false)
      else house(facade(batch,roofing,x,z,yaw),w,d,h,rise,id,false)
      edge+=w+1.3+random();i++
    }
  }
  batch.finish(g,g.name);g.add(roofing.mesh(palette.roof))
  return g
}

function southernApproach(geometry,palette) {
  const g=new T.Group(),batch=new Instances(geometry,palette),roofing=roofBatch(),random=seeded(1881)
  g.name='Southern gate road, inn yards and two greeting houses'
  for(const side of [-1,1]) {
    // Wall-to-wall clearance down this winding approach is 10–11 m. Upper oriels
    // and shop signs overhang the pavements on either side of the carriageway.
    const yaw=-side*quarterTurn
    for(let i=0;i<4;i++) {
      const z=43.8+i*10.2+(side>0?1.4:0),w=7.3+random()*1.8,d=6.8+random()*1.4
      const h=(i===3?8.1:6.25)+random()*1.4,rise=3.18+random()*.94
      const x=side*(5.5+d/2+random()*.33),angle=yaw+(random()-.5)*.065,index=16+i+(side>0?5:0)
      if(i===1 || (i===3 && side<0)) eavesHouse(batch,roofing,x,z,angle,w,d,h,rise,index,true)
      else house(facade(batch,roofing,x,z,angle),w,d,h,rise,index,true)
      if(i===0 || i===3) endWall(batch,roofing,x,z,angle,w,d,h,i===0?-side:side,index)
    }
    for(let row=0;row<2;row++) for(let i=0;i<3;i++) {
      const x=side*(20.6+row*10.4+random()*1.4)
      const z=41.2+i*12.65+row*3.3+(side<0?0:1.0)+random()*1.4
      const w=7.2+random()*2,d=7.0+random()*1.5,h=6.25+random()*2.7,rise=3.0+random()*1.36
      const index=37+row*4+i+(side>0?3:0),facesNorth=i===0 || (row===1 && i===2)
      const angle=(facesNorth?halfTurn:yaw)+(random()-.5)*.16
      if((i+row)%2===0) eavesHouse(batch,roofing,x,z,angle,w,d,h,rise,index,i===0)
      else house(facade(batch,roofing,x,z,angle),w,d,h,rise,index,i===0)
    }
  }
  batch.finish(g,g.name);g.add(roofing.mesh(palette.roof))
  return g
}

export function makeTownHouses() {
  const district=new T.Group();district.name='Arcaded merchants’ streets and upper terraces'
  const geometry=kit(), palette=materials(), random=seeded(43317)
  for (const side of [-1,1]) {
    const batch=new Instances(geometry,palette), roofing=roofBatch(), yaw=-side*quarterTurn
    const streets=side===-1?[[22.4,7.9,8.7,9.2,4.5],[13.2,9.3,7.3,7.0,3.95],[2.6,10.4,8.6,9.1,4.4],[-7.0,7.3,7.6,6.4,4.1],[-16.6,9.8,9.1,9.9,4.75],[-27.2,8.9,7.8,7.2,4.3]]:
      [[23.4,8.9,7.8,8.4,3.8],[13.5,9.4,8.8,6.9,4.8],[3.45,8.9,7.3,9.3,4.4],[-6.55,8.5,7.7,7.2,3.95],[-16.6,9.7,9.6,8.8,5.1],[-27.8,9.5,8.5,10.2,4.4]]
    streets.forEach(([z,w,d,h,rise],i)=>{
      const front=19.35+(i%3)*.19
      const x=side*(front+d/2),idx=i+(side>0?5:0)
      house(facade(batch,roofing,x,z,yaw),w,d,h,rise,idx,true)
      if(i===0 || i===3 || i===5) endWall(batch,roofing,x,z,yaw,w,d,h,i===5?-side:side,idx)
    })
    const street=new T.Group();street.name=side<0?'West frontage':'East frontage'
    batch.finish(street,street.name);street.add(roofing.mesh(palette.roof));district.add(street)
    const distant=new Instances(geometry,palette), distantRoofs=roofBatch()
    for(let row=0;row<3;row++) {
      let z=-69+random()*3, index=row*11
      while(z<40) {
        const w=6+random()*4, d=6.8+random()*3.5
        const h=7.4+row*1.5+random()*4.4, dist=34.5+row*11.4+random()*1.3
        const lot=facade(distant,distantRoofs,side*dist,z+w/2,yaw+(random()-.5)*.17)
        house(lot,w,d,h,3.0+random()*2.8,index++,false)
        z+=w+1.35+random()*2.2
      }
    }
    for (const [dist,z,y,r,h] of [[36,-36,14.8,2.58,7.3],[51,16,16.5,2.4,7.2],[58,-57,18.8,3.3,9]]) {
      const turret=facade(distant,distantRoofs,side*(dist+random()*2),z+(side>0?6:0),yaw)
      spire(turret,y,r,h,side<0?'#637a79':'#786b64')
    }
    const terrace=new T.Group();terrace.name=side<0?'West upper town':'East upper town'
    distant.finish(terrace,terrace.name);terrace.add(distantRoofs.mesh(palette.roof));district.add(terrace)
  }
  district.add(northernQuarter(geometry,palette),southernApproach(geometry,palette))
  return district
}
