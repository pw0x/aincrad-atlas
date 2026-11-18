import * as T from 'three'
import { Kit } from '../cabin/kit.js'
import { gabledRoof, seeded, turnProfile } from '../castle/geometry.js'

const TAU = Math.PI * 2
const frontWall = -27.9
const towerZ = -36.4

// The same limestone is cut into dressed voussoirs, rough courses and turned mouldings.
function limestoneGrain() {
  const size = 192, pixels = new Uint8Array(size * size * 4), noise = seeded(2810)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const a = x * TAU / size, b = y * TAU / size
    const vein = Math.sin(3 * a + 2 * b + .7 * Math.sin(a - b))
    const value = 226 + 4 * Math.sin(a + 3 * b) + 3 * vein + (noise() - .5) * 17 - (noise() < .026 ? 14 : 0)
    const k = (y * size + x) * 4
    pixels.set([value + 4, value + 1, value - 5, 255], k)
  }
  const texture = new T.DataTexture(pixels, size, size)
  texture.colorSpace = T.SRGBColorSpace
  texture.wrapS = texture.wrapT = T.RepeatWrapping
  texture.magFilter = T.LinearFilter
  texture.minFilter = T.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function materials() {
  const grain = limestoneGrain()
  const standard = (name, color, roughness, metalness = 0, extra = {}) =>
    new T.MeshStandardMaterial({ name, color, roughness, metalness, ...extra })
  const stone = (name, color) => standard(name, color, .88, 0, { map: grain, bumpMap: grain, bumpScale: .018 })
  return {
    wall: stone('weathered limestone', 0xc7b49a), dressed: stone('dressed limestone', 0xeee0be),
    honey: stone('ochre sandstone', 0xcfab80), pale: stone('sunlit ashlar', 0xdfccb0),
    mortar: stone('recessed mortar', 0x9b8977), shadow: standard('deep window reveals', 0x26333b, .84),
    timber: standard('oiled oak', 0x684330, .65), copper: standard('verdigris sheet copper', 0x518380, .61, .36),
    seam: standard('copper folds', 0x97b1a0, .48, .37), bronze: standard('oxidised bronze', 0x675744, .57, .56),
    gold: standard('burnished brass', 0xcb9b50, .32, .65), dial: standard('enamelled midnight blue', 0x193d50, .34, .26),
    teal: standard('turquoise glass', 0x559a9a, .27, .18, { emissive: 0x30615f, emissiveIntensity: .33 }),
    amber: standard('honey amber glass', 0xf1bd72, .33, .12, { emissive: 0xde8e40, emissiveIntensity: .35 }),
    red: standard('madder-dyed wool', 0x963d33, .94, 0, { side: T.DoubleSide }),
    tile: standard('deep glazed mosaic', 0x398282, .34, .21), jet: standard('sunlit water', 0xa4dbd5, .18, .23,
      { transparent: true, opacity: .68, depthWrite: false }),
  }
}

function polygon(points, depth = .09) {
  const shape = new T.Shape()
  points.forEach(([x,y], i) => i ? shape.lineTo(x,y) : shape.moveTo(x,y))
  shape.closePath()
  return new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
}

function voussoir(inner, outer, angle, depth) {
  const gap = .012, a = gap / 2, b = angle - gap / 2
  const shape = new T.Shape()
  shape.moveTo(Math.cos(a) * outer, Math.sin(a) * outer)
  shape.absarc(0,0,outer,a,b,false)
  shape.lineTo(Math.cos(b) * inner, Math.sin(b) * inner)
  shape.absarc(0,0,inner,b,a,true)
  shape.closePath()
  return new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 })
}

function archStones(kit, mat, x, spring, z, radius, width, count, depth) {
  const stone = voussoir(radius, radius + width, Math.PI / count, depth)
  for (let n = 0; n < count; n++) {
    const key = n === (count - 1) / 2, rise = key ? 1.045 : 1
    kit.put(stone, key || n % 4 !== 2 ? mat.dressed : mat.pale, [x,spring,z], [rise,rise,key ? 1.12 : 1], [0,0,n * Math.PI / count])
  }
}

const columnProfile = [
  [.54,0],[.56,.095],[.52,.17],[.46,.19],[.47,.28],[.39,.37],[.35,.47],
  [.335,.54],[.315,.61],[.295,2.78],[.31,2.93],[.39,2.99],[.40,3.11],
  [.34,3.15],[.36,3.25],[.45,3.38],[.51,3.44],[.52,3.54],
]
function column(kit, m, x, y, z, height, radius = 1) {
  kit.lathe(m.dressed,columnProfile,x,y,z,[radius,height/3.54,radius],20)
  kit.box(m.honey,x,y+.095,z,1.22*radius,.19,1.22*radius)
  kit.box(m.dressed,x,y+height-.07,z,1.17*radius,.18,1.17*radius)
  for (let i=0;i<8;i++) {
    const a=i*TAU/8
    kit.ell(m.honey,x+.38*radius*Math.sin(a),y+height*.935,z+.38*radius*Math.cos(a),.083*radius,.20*radius,.075*radius,[.17,a,0])
  }
}

function arcadeBody(kit,m,z,depth) {
  const s = new T.Shape(), r = 2.43, spring = 4.48, foot = .83
  s.moveTo(-9.64,foot)
  for (const x of [-6.24,0,6.24]) {
    s.lineTo(x-r,foot); s.lineTo(x-r,spring)
    s.absarc(x,spring,r,Math.PI,0,true); s.lineTo(x+r,foot)
  }
  s.lineTo(9.64,foot); s.lineTo(9.64,7.82); s.lineTo(-9.64,7.82); s.closePath()
  const volume = new T.ExtrudeGeometry(s,{ depth, bevelEnabled:false, curveSegments:16 })
  kit.put(volume,m.wall,[0,0,z-depth])
}

function windowPanel(kit,m,x,y,z,width,height) {
  const r=width/2, spring=height-r
  const s=new T.Shape()
  s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,spring);s.absarc(0,spring,r,0,Math.PI,false);s.closePath()
  kit.put(new T.ShapeGeometry(s,12),m.shadow,[x,y,z])
  const panes=[m.teal,m.amber]
  for(const side of [-1,1]){
    kit.box(panes[side>0?1:0],x+side*r*.47,y+spring*.50,z+.018,r*.78,spring*.88,.035)
    kit.box(m.bronze,x+side*r*.91,y+spring*.50,z+.04,r*.08,spring,.055)
  }
  const sector=polygon([[0,0],[Math.cos(.07),Math.sin(.07)],[Math.cos(.45),Math.sin(.45)]],.04)
  for(let i=0;i<6;i++)kit.put(sector,panes[i%2],[x,y+spring,z+.025],[r*.92,r*.92,1],[0,0,i*Math.PI/6])
  for(const h of [.30,.68])kit.box(m.bronze,x,y+spring*h,z+.06,width,.045,.08)
  archStones(kit,m,x,y+spring,z+.025,r,.115,9,.12)
  kit.box(m.dressed,x,y-.05,z+.05,width+.34,.15,.31)
}

function clock(kit,m,x,y,z,radius) {
  kit.disc(m.shadow,[x,y,z],[0,0,1],radius*1.12)
  kit.disc(m.dial,[x,y,z+.05],[0,0,1],radius)
  for(const [r,thickness,material] of [[1.10,.085,m.honey],[1.035,.044,m.gold],[.83,.022,m.gold],[.59,.012,m.seam]]){
    kit.ring(material,x,y,z+.11,r*radius,thickness*radius,[0,0,0])
  }
  const numerals = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI']
  const strokes = { I:[[0,-.5,0,.5]], V:[[-.42,.5,0,-.5],[0,-.5,.42,.5]], X:[[-.4,.5,.4,-.5],[.4,.5,-.4,-.5]] }
  for(let n=0;n<60;n++){
    const a=n*TAU/60,s=Math.sin(a),c=Math.cos(a)
    kit.box(m.gold,x+s*radius*.944,y+c*radius*.944,z+.13,n%5===0?.036:.018,n%5===0?.12:.055,.027,[0,0,-a])
    if(n%5)continue
    const text=numerals[n/5], size=radius*.15, centres=text.split('').map(ch=>ch==='I'?.43:.86)
    const total=centres.reduce((a,b)=>a+b,0), basex=x+s*radius*.73,basey=y+c*radius*.73
    let cursor=-total/2
    for(let j=0;j<text.length;j++){
      const advance=centres[j], offset=cursor+advance/2
      const world=(u,v)=>[basex+(c*(offset+u)+s*v)*size,basey+(-s*(offset+u)+c*v)*size,z+.139]
      for(const [x1,y1,x2,y2] of strokes[text[j]])kit.stick(m.gold,world(x1,y1),world(x2,y2),.018,.018,6)
      cursor+=advance
    }
  }
  const hand=polygon([[0,1],[.075,.45],[.035,.19],[.055,-.14],[0,-.23],[-.055,-.14],[-.035,.19],[-.075,.45]],.036)
  kit.put(hand,m.gold,[x,y,z+.17],[radius*.89,radius*.89,1],[0,0,-Math.PI/3])
  kit.put(hand,m.dressed,[x,y,z+.22],[radius*.74,radius*.63,1],[0,0,Math.PI/3])
  kit.disc(m.gold,[x,y,z+.28],[0,0,1],.105)
}

function rose(kit,m,x,y,z,r) {
  kit.disc(m.shadow,[x,y,z],[0,0,1],r)
  const petal=polygon([[0,.16],[-.13,.41],[-.115,.69],[0,.92],[.115,.69],[.13,.41]],.05)
  for(let i=0;i<12;i++){
    const a=i*TAU/12
    kit.put(petal,i%3===1?m.amber:m.teal,[x,y,z+.05],[r,r,1],[0,0,a])
    const tip=[x-Math.sin(a)*r*.9,y+Math.cos(a)*r*.9,z+.13]
    kit.stick(m.bronze,[x-Math.sin(a)*r*.72,y+Math.cos(a)*r*.72,z+.13],tip,.018)
  }
  kit.disc(m.amber,[x,y,z+.12],[0,0,1],r*.15)
  for(const [size,thick,material] of [[1.09,.093,m.dressed],[.97,.034,m.gold],[.20,.03,m.gold]])kit.ring(material,x,y,z+.1,r*size,r*thick,[0,0,0])
}

// A bell-shaped hipped roof is built from real copper facets, with standing seams.
function spire(kit,m,x,y,z,r,h,n=8) {
  const profile=[[r,0],[r*1.06,h*.036],[r*.85,h*.11],[r*.60,h*.30],[r*.32,h*.56],[r*.13,h*.80],[.035,h]]
  kit.lathe(m.copper,profile,x,y,z,[1,1,1],n)
  kit.ring(m.gold,x,y+.01,z,r*.98,Math.max(.025,r*.025))
  for(let i=0;i<n;i++){
    const a=i*TAU/n, at=([rad,high])=>[x+Math.sin(a)*rad,y+high,z+Math.cos(a)*rad]
    for(let j=2;j<profile.length;j++)kit.stick(m.seam,at(profile[j-1]),at(profile[j]),Math.max(.018,r*.013),undefined,6)
  }
  kit.ell(m.gold,x,y+h+.10,z,.13,.15,.13)
  kit.stick(m.gold,[x,y+h+.08,z],[x,y+h+.72,z],.018,.045,8)
}

function civicHall(kit,m) {
  const roof=gabledRoof()
  for(let k=0;k<6;k++){
    const north=-43.4, south=-23.65-k*.61
    kit.box(k%2?m.dressed:m.pale,0,.077+k*.139,(south+north)/2,20.8-k*.11,.155,south-north)
    kit.box(m.honey,0,.115+k*.139,south-.045,20.8-k*.11,.045,.11)
  }
  kit.box(m.wall,0,4.35,-36.2,19.1,7.05,8.6)
  for(const x of [-8.95,8.95])kit.box(m.wall,x,4.18,-31.45,1.1,6.72,6.1)
  arcadeBody(kit,m,frontWall,1.05)
  arcadeBody(kit,m,-31.30,.52)
  for(const x of [-6.24,0,6.24]){
    archStones(kit,m,x,4.48,frontWall,2.43,.44,17,.38)
    archStones(kit,m,x,4.48,-31.3,2.43,.32,15,.17)
    const back=-31.86
    windowPanel(kit,m,x,1.03,back,3.28,5.15)
    for(let n=0;n<12;n++){
      const plank=x+(n-5.5)*.254
      kit.box(n%4===0?m.bronze:m.timber,plank,2.55,back+.071,.243,2.85,.10)
    }
    for(const off of [-.72,.72]){
      for(const h of [1.56,3.43])kit.box(m.bronze,x+off,h,back+.142,1.40,.095,.065)
      kit.ring(m.gold,x+off*.29,2.3,back+.19,.08,.021,[0,0,0])
    }
  }
  for(const x of [-9.31,-3.12,3.12,9.31]){
    column(kit,m,x,.83,frontWall+.29,3.65,1.13)
    column(kit,m,x,.83,-31.28,3.65,.93)
    kit.box(m.dressed,x,6.67,frontWall+.085,.68,1.64,.32)
    kit.box(m.honey,x,7.40,frontWall+.22,.88,.16,.66)
  }
  kit.box(m.dressed,0,7.97,-34.3,20.22,.38,13.3)
  kit.box(m.honey,0,8.22,-34.3,20.0,.18,13.12)
  kit.box(m.wall,0,9.48,-34.55,18.75,2.4,12.07)
  for(const x of [-8,-6.3,-4.55,4.55,6.3,8]){
    windowPanel(kit,m,x,8.47,-28.475,1.07,1.78)
  }
  for(let x=-9.25;x<=9.25;x+=.55)kit.box(m.honey,x,7.65,frontWall+.10,.22,.31,.47)
  kit.box(m.dressed,0,10.76,-34.48,20.05,.38,12.63)
  kit.put(roof,m.copper,[0,10.91,-35.10],[20.9,4.72,13.55])
  for(let z=-41.52;z < -28.35;z+=.62){
    for(const s of [-1,1])kit.stick(m.seam,[s*10.41,10.97,z],[0,15.66,z],.023,.023,6)
  }
  kit.box(m.wall,0,10.56,-29.96,7.18,4.92,4.22)
  kit.put(roof,m.wall,[0,12.99,-29.96],[7.18,2.47,4.22])
  for(const s of [-1,1]){
    kit.stick(m.dressed,[s*3.76,12.99,-27.63],[0,15.63,-27.63],.16,.16,8)
    kit.stick(m.copper,[s*3.83,13.13,-27.6],[0,15.81,-27.6],.08,.08,8)
  }
  rose(kit,m,0,11.63,-27.8,1.25)
  // Flanking pilasters carry fork-tailed processional banners.
  const banner=polygon([[-.57,0],[.57,0],[.57,-3.02],[.25,-2.78],[0,-3.34],[-.25,-2.78],[-.57,-3.02]],.028)
  const emblem=polygon([[0,.40],[.16,.06],[0,-.26],[-.16,.06]],.025)
  for(const s of [-1,1]){
    const x=s*3.15,z=frontWall+.62
    kit.put(banner,m.red,[x,8.45,z])
    kit.stick(m.gold,[x-.75,8.48,z],[x+.75,8.48,z],.047)
    kit.ring(m.gold,x,7.62,z+.061,.315,.023,[0,0,0])
    kit.put(emblem,m.gold,[x,7.62,z+.06])
    for(const edge of [-1,1])kit.box(m.gold,x+edge*.48,6.97,z+.047,.032,2.78,.022)
    const sx=s*8.86
    kit.lathe(m.pale,[[1.03,0],[1.03,.20],[.91,.32],[.88,4.35],[1.05,4.48],[1.08,4.68]],sx,8.4,-29.04,[1,1,1],8)
    spire(kit,m,sx,13.06,-29.04,1.21,3.40)
  }
  // Clock stage and belfry sit behind the front gable, visible above its ridge.
  kit.box(m.wall,0,16.56,towerZ,5.88,9.86,5.81)
  for(const sx of [-1,1])for(const sz of [-1,1])for(let n=0;n<15;n++){
    kit.box(n%3?m.dressed:m.pale,sx*2.79,12.04+n*.64,towerZ+sz*2.81,n%2?.54:.82,.59,n%2?.83:.56)
  }
  for(const [y,size,height,mat] of [[15.89,6.32,.22,m.honey],[16.19,6.28,.16,m.dressed],[20.89,6.16,.18,m.honey],[21.28,6.67,.42,m.dressed],[21.62,6.76,.16,m.copper]]){
    kit.box(mat,0,y,towerZ,size,height,size)
  }
  clock(kit,m,0,18.58,towerZ+2.925,1.83)
  // Each return elevation has an oculus and shutters behind it. From the side
  // streets the louvres read as a dark opening in the clock stage.
  for(const side of [-1,1]){
    const face=side*2.96
    kit.disc(m.shadow,[face,18.65,towerZ],[side,0,0],1.43)
    kit.ring(m.dressed,face+side*.045,18.65,towerZ,1.48,.115,[0,Math.PI/2,0])
    kit.ring(m.gold,face+side*.08,18.65,towerZ,1.36,.027,[0,Math.PI/2,0])
    for(let n=-4;n<=4;n++){
      const h=n*.27,w=2*Math.sqrt(1.31*1.31-h*h)
      kit.box(m.copper,face+side*.039,18.65+h,towerZ,.09,.092,w,[0,0,side*.28])
    }
    for(let n=0;n<3;n++){
      const z=-33.1-n*3.3
      kit.box(m.dressed,side*9.58,3.53,z-.95,.39,5.38,.55)
      kit.box(m.honey,side*9.61,6.38,z-.95,.52,.28,.71)
      kit.box(m.shadow,side*9.565,4.14,z+ .18,.07,2.88,1.28)
      kit.box(m.teal,side*9.62,4.18,z+.16,.024,2.54,1.03)
      kit.box(m.bronze,side*9.65,4.18,z+.16,.06,2.55,.065)
      kit.box(m.gold,side*9.65,4.52,z+.16,.06,.058,1.09)
      kit.box(m.pale,side*9.62,2.63,z+.18,.39,.19,1.59)
    }
  }
  kit.lathe(m.bronze,[[.60,0],[.85,.04],[.88,.13],[.72,.31],[.54,.64],[.47,1.08],[.33,1.22],[.23,1.26]],0,22.64,towerZ,[1,1,1],28)
  kit.ell(m.bronze,0,22.58,towerZ,.14,.22,.14)
  kit.stick(m.timber,[-2.50,24.05,towerZ],[2.50,24.05,towerZ],.15)
  for(const sx of [-1,1])for(const sz of [-1,1]){
    column(kit,m,sx*2.17,21.68,towerZ+sz*2.17,3.19,.90)
    const x=sx*2.79,z=towerZ+sz*2.79
    kit.lathe(m.dressed,[[.32,0],[.35,.22],[.22,.32],[.17,1.13]],x,21.60,z,[1,1,1],8)
    spire(kit,m,x,22.69,z,.43,1.10)
  }
  kit.box(m.honey,0,24.92,towerZ,5.86,.32,5.86)
  kit.box(m.copper,0,25.15,towerZ,6.52,.23,6.52)
  spire(kit,m,0,25.29,towerZ,4.18,6.16)
  kit.stick(m.gold,[0,31.70,towerZ],[0,32.66,towerZ],.032)
  kit.put(polygon([[0,0],[.95,.25],[.67,-.04],[1.06,-.18],[0,-.17]],.05),m.gold,[0,32.48,towerZ])
}

function ripplingWater(root) {
  const clock = { value: 0 }
  const water = new T.MeshPhysicalMaterial({
    name: 'shallow fountain water', color: 0x70c5b7, transparent: true, opacity: .70, depthWrite: false,
    roughness: .21, metalness: .17, clearcoat: .68, clearcoatRoughness: .19
  })
  // All eight jets share this pool. Fold its angle into an eighth of a turn
  // to get the distance to the nearest impact without eight fragment loops.
  water.onBeforeCompile = shader => {
    shader.uniforms.fountainTime = clock
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 poolXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\npoolXZ = position.xz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 poolXZ;
        uniform float fountainTime;
        float poolWave(vec2 p) {
          float angle = mod(atan(p.y, p.x) + 0.3926991, 0.7853982) - 0.3926991;
          float r = length(p);
          float d = length(r * vec2(cos(angle), sin(angle)) - vec2(3.12, 0.0));
          return .015 * sin(d * 22.0 - fountainTime * 4.2) * exp(-1.6*d)
               + .008 * sin(r * 8.0 - fountainTime * 1.7)
               + .009 * sin(dot(p,vec2(4.2,2.6)) + fountainTime)
                 * sin(dot(p,vec2(-1.9,3.1)) - fountainTime * .73);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float w = poolWave(poolXZ);
        float dx = (poolWave(poolXZ + vec2(.018,0)) - w) / .018;
        float dz = (poolWave(poolXZ + vec2(0,.018)) - w) / .018;
        float crest = smoothstep(.035,.14,dx + dz) * .25;
        diffuseColor.rgb += vec3(.32,.58,.48) * crest;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal + mat3(viewMatrix) * vec3(-dx,0.,-dz));`)
  }
  const geo = new T.CircleGeometry(4.47,96).rotateX(-Math.PI/2)
  const surface = new T.Mesh(geo,water)
  surface.name = 'Eight converging ripple fields'
  surface.position.y=.76
  surface.renderOrder=1
  root.add(surface)
  root.userData.update=elapsed=>{clock.value=elapsed}
}

function fountain(kit,m) {
  const profile=(mat,points,sides=80)=>kit.lathe(mat,points,0,0,0,[1,1,1],sides)
  profile(m.mortar,[[.01,0],[5.59,0],[5.60,.09],[5.49,.14],[.01,.14]])
  profile(m.pale,[[4.69,.12],[5.22,.12],[5.24,.20],[5.16,.25],[4.78,.25],[4.75,.29]])
  profile(m.wall,[[4.45,.24],[4.96,.24],[5.08,.32],[5.08,.40],[4.99,.44],[4.96,.72],[4.48,.72],[4.48,.41],[.01,.41]])
  for(const [r,y,t,mat] of [[5.12,.315,.028,m.honey],[4.97,.47,.025,m.honey],[4.98,.62,.019,m.bronze]])kit.ring(mat,0,y,0,r,t)
  const coping=turnProfile([[4.93,.66],[5.05,.70],[5.10,.76],[5.09,.84],[5.02,.90],[4.56,.90],[4.47,.84],[4.46,.75]],5,.50,.003,TAU/40-.006)
  for(let i=0;i<40;i++)kit.put(coping,i%7===0?m.honey:i%3===1?m.pale:m.dressed,[0,0,0],[1,1,1],[0,i*TAU/40,0])
  // The shadow line between each bed tile and its neighbour remains visible through water.
  for(let band=0;band<5;band++){
    const inner=.88+band*.70,outer=inner+.685,n=24+band*4
    const tile=turnProfile([[outer,.439],[inner,.439]],3,.4,.003,TAU/n-.006)
    for(let i=0;i<n;i++)kit.put(tile,(i+band)%7===0?m.teal:m.tile,[0,0,0],[1,1,1],[0,(i+band*.5)*TAU/n,0])
  }
  for(const r of [1.59,2.98,4.38])kit.ring(m.gold,0,.452,0,r,.016)
  // Narrow points of a compass rose cross the tessellated floor.
  const ray=polygon([[0,.94],[-.16,1.91],[0,3.82],[.16,1.91]],.015)
  for(let i=0;i<8;i++)kit.put(ray,i%2?m.pale:m.gold,[0,.45,0],[1,1,1],new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,i*TAU/8,0,'YXZ')))
  profile(m.pale,[[.01,.44],[1.13,.44],[1.19,.55],[1.16,.65],[.95,.69],[.92,.79],[.73,.82],[.66,.98],[.62,1.13],[.51,1.22],[.49,1.49],[.40,1.61],[.47,1.76],[.71,1.94],[.72,2.01]])
  profile(m.bronze,[[.49,1.48],[.61,1.53],[.63,1.61],[.58,1.68],[.62,1.76]])
  profile(m.dressed,[[.01,1.91],[.60,1.91],[.79,1.97],[1.05,2.12],[1.35,2.22],[1.54,2.32],[1.58,2.40],[1.57,2.47],[1.49,2.50],[1.40,2.43],[.85,2.30],[.01,2.29]])
  kit.ring(m.gold,0,2.38,0,1.57,.026)
  profile(m.copper,[[.06,2.31],[.29,2.31],[.38,2.39],[.37,2.48],[.17,2.53],[.09,2.65],[.12,2.88]])
  const sphereY=3.45,sphereR=.73
  const tilt=[1.18,.18,.35],meridian=[.25,.48,.16]
  kit.ring(m.bronze,0,sphereY,0,sphereR,.051,tilt)
  kit.ring(m.gold,0,sphereY,0,sphereR*.93,.043,meridian)
  kit.ring(m.gold,0,sphereY,0,sphereR*.75,.029,[.64,-.23,-.76])
  kit.stick(m.bronze,[-.23,2.55,.10],[.24,4.37,-.13],.035)
  kit.ell(m.gold,0,sphereY,0,.17,.17,.17)
  kit.ell(m.gold,.24,4.37,-.13,.074,.074,.074)
  const tiltQ=new T.Quaternion().setFromEuler(new T.Euler(...tilt))
  for(let n=0;n<36;n++){
    const a=n*TAU/36, at=r=>new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,0).applyQuaternion(tiltQ).add(new T.Vector3(0,sphereY,0)).toArray()
    kit.stick(m.gold,at(sphereR-.004),at(sphereR+(n%3===0?.078:.04)),.011,.011,6)
  }
  for(let i=0;i<16;i++){
    const a=i*TAU/16,s=Math.sin(a),c=Math.cos(a)
    kit.ell(m.honey,s*.57,1.32,c*.57,.082,.26,.082,[0,a,0])
    const edge=[s*4.988,.55,c*4.988]
    kit.disc(m.bronze,edge,[s,0,c],.085)
    kit.ell(m.gold,s*5.002,.55,c*5.002,.048,.048,.048)
    const end=[s*1.48,2.39,c*1.48]
    kit.tube(m.honey,[[s*.63,1.90,c*.63],[s*.85,2.12,c*.85],[s*1.18,2.20,c*1.18],end],.036,9)
    if(i%2)continue
    const path=[]
    for(let k=0;k<=9;k++){
      const t=k/9, r=1.50+1.62*t
      path.push([s*r,2.36+.33*t-1.93*t*t,c*r])
    }
    kit.tube(m.jet,path,.038,24)
    kit.ell(m.jet,s*3.12,.776,c*3.12,.102,.047,.102)
    for(const r of [.17,.29])kit.ring(m.jet,s*3.12,.770,c*3.12,r,.009)
  }
}

/** A civic clock hall and an armillary fountain, original designs for this district. */
export function makeTownLandmarks() {
  const root=new T.Group()
  root.name='Plaza fountain and clock hall'
  const palette=materials()
  const clockHall=new Kit('Clock hall · loggia, enamel dial and copper belfry')
  civicHall(clockHall,palette)
  root.add(clockHall.finish())
  const basin=new Kit('Armillary fountain · limestone coping and submerged compass')
  fountain(basin,palette)
  root.add(basin.finish())
  ripplingWater(root)
  return root
}
