import * as T from 'three'
import { Kit, random } from '../cabin/kit.js'
import { ownDetailInstanceGeometry } from './market.js'

const tau=Math.PI*2
const ellipsoid=new T.SphereGeometry(1,14,9)
const flowerCup=new T.CylinderGeometry(1,.40,1,7)

function textile(dye,pattern){
  const grain=random(8229)
  const canvas=document.createElement('canvas')
  canvas.width=256;canvas.height=256
  const c=canvas.getContext('2d')
  c.fillStyle=dye;c.fillRect(0,0,256,256)
  if(pattern==='checks'){
    for(const x of [0,48,112,220]){
      c.fillStyle='rgba(219,184,127,.68)';c.fillRect(x,0,9,256);c.fillRect(0,x,256,9)
      c.fillStyle='rgba(49,68,71,.64)';c.fillRect(x+12,0,3,256);c.fillRect(0,x+12,256,3)
    }
  }else if(pattern==='sack'){
    c.save();c.translate(106,139);c.rotate(-.07);c.strokeStyle='#827554';c.fillStyle='#827554'
    c.lineWidth=3;c.strokeRect(-31,-40,62,66)
    for(let j=0;j<3;j++){
      const x=(j-1)*14
      c.beginPath();c.moveTo(x,13);c.lineTo(x,-23);c.stroke()
      for(let t=0;t<4;t++)for(const side of [-1,1]){
        c.beginPath();c.ellipse(x+side*3,3-t*6,2.4,5.4,side*.55,0,tau);c.fill()
      }
    }
    c.restore()
  }
  for(let i=0;i<256;i++){
    c.fillStyle='rgba(43,32,22,'+(.025+grain()*.1)+')';c.fillRect(0,i,256,1)
    c.fillStyle='rgba(250,224,173,'+(.02+grain()*.12)+')';c.fillRect(i,0,1,256)
  }
  const tx=new T.CanvasTexture(canvas)
  tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=8
  return tx
}

function palette(fine=false){
  const matte=(color,roughness=.82,metalness=0,options={})=>new T.MeshStandardMaterial({color,roughness,metalness,...options})
  let bakedSurface
  if(!fine){
    const loader=new T.TextureLoader()
    const map=loader.load(new URL('../cabin/assets/bread-crust.webp',import.meta.url).href)
    const normalMap=loader.load(new URL('../cabin/assets/bread-normal.webp',import.meta.url).href)
    map.colorSpace=T.SRGBColorSpace
    bakedSurface={map,normalMap,normalScale:new T.Vector2(.48,.48)}
  }
  return {
    oak:matte(0x826449),walnut:matte(0x66513d),pale:matte(0xa88b60),worn:matte(0xc4a77a),
    rind:matte(0xb28d53),reed:matte(0xc6a76f),goldWick:matte(0xb1976d),
    iron:matte(0x4c514c,.64,.44),brass:matte(0xb99558,.45,.51),cord:matte(0xbb9a67),
    basketCloth:fine?null:matte(0xffffff,.93,0,{map:textile('#915747','checks'),side:T.DoubleSide}),
    sack:fine?null:matte(0xffffff,.97,0,{map:textile('#b6a17b','sack'),side:T.DoubleSide}),
    bread:matte(0xffe6b9,.95,0,bakedSurface),crust:matte(0xffebc1,.92,0,bakedSurface),flour:matte(0xe5cb93),ear:matte(0xd9bb72),
    foliage:matte(0x626f45,.93,0,{side:T.DoubleSide}),leaves:matte(0x8c995c,.91,0,{side:T.DoubleSide}),
    petal:matte(0xca755d),palePetal:matte(0xe8d4ae),bluePetal:matte(0x887f9e),pollen:matte(0xc89948),
    pear:matte(0xabaf64),apple:matte(0xab5347),husk:matte(0x9b723f),
  }
}

function patch(cols,rows,sample){
  const vertices=[],uv=[],idx=[]
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=i/cols,v=j/rows
    vertices.push(...sample(u,v));uv.push(u,v)
    if(i<cols&&j<rows){
      const a=j*(cols+1)+i
      idx.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2)
    }
  }
  const geo=new T.BufferGeometry()
  geo.setIndex(idx);geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3))
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals()
  return geo
}

function oval(k,m,x,y,z,rx,ry,rz,angles=[0,0,0]){
  k.put(ellipsoid,m,[x,y,z],[rx,ry,rz],angles)
}

// A basket is one strip mesh per weave colour, with alternating passes over the uprights.
function basket(k,m,x,y,z,r,h,hasHandle,layer='full'){
  const count=20, layers=Math.max(7,Math.round(h/.023))
  function radius(t){return r*(.69+.30*t+.12*Math.sin(t*Math.PI))}
  if(layer!=='base')for(let n=0;n<layers;n++){
    const middle=(n+.55)/layers
    const geo=patch(count*3,1,(u,v)=>{
      const a=u*tau,t=middle+(v-.5)*.75/layers,rr=radius(t)+Math.cos(a*count*.5+n*Math.PI)*.005
      return [Math.cos(a)*rr,t*h,Math.sin(a)*rr*.85]
    })
    k.put(geo,n%4===0?m.rind:m.reed,[x,y,z])
  }
  if(layer!=='base')for(let i=0;i<count;i++){
    const a=i*tau/count
    k.stick(m.goldWick,[x+radius(0)*Math.cos(a),y,z+radius(0)*Math.sin(a)*.85],
      [x+r*Math.cos(a),y+h,z+r*Math.sin(a)*.85],.006,.008,5)
  }
  if(layer==='detail')return
  // The dark willow lining stays inside the raised weave. At distance it keeps
  // the baskets visibly full, while the nearby weave keeps its own highlights.
  const lining=patch(18,4,(u,v)=>{
    const a=u*tau,rr=radius(v)-.015
    return [rr*Math.cos(a),h*v-.002,rr*Math.sin(a)*.85]
  })
  k.put(lining,m.husk,[x,y,z])
  const rim=patch(64,4,(u,v)=>{
    const a=u*tau,p=v*tau,rr=r+.009*Math.cos(p)
    return [rr*Math.cos(a),h+.009*Math.sin(p),rr*Math.sin(a)*.85]
  })
  k.put(rim,m.rind,[x,y,z])
  oval(k,m.walnut,x,y+.012,z,r*.7,.01,r*.58)
  if(hasHandle){
    const points=[]
    for(let i=0;i<=12;i++){
      const a=i*Math.PI/12
      points.push([x+r*Math.cos(a),y+h+Math.sin(a)*r*1.47,z+.035*Math.sin(a)])
    }
    k.tube(m.rind,points,.016,19)
  }
}

function sack(k,m,x,y,z,r,h,seed,fine){
  if(fine){
    for(const delta of [-.009,0,.009]) k.ring(m.cord,x+.033,y+h*.907+delta,z,r*.25,.005)
    k.tube(m.cord,[[x+r*.25,y+h*.91,z],[x+r*.37,y+h*.88,z+.015],[x+r*.44,y+h*.74,z+.028]],.006,7)
    return
  }
  const mesh=patch(32,15,(u,v)=>{
    const a=u*tau
    const profile=v<.77 ? .61+.43*Math.sin(v*Math.PI) : v<.91 ? .91-(v-.77)*4.55 : .27+(v-.91)*2.28
    const shape=1+.08*Math.sin(a*3+seed)+(.035+v*v*.08)*Math.sin(a*6+seed+v*2)
    const rr=r*profile*shape
    return [rr*Math.cos(a)+.04*v*v,v*h+.015*v*Math.sin(a*4+seed),rr*.77*Math.sin(a)]
  })
  k.put(mesh,m.sack,[x,y,z])
}

function wheel(k,m,x,y,z){
  const r=.484
  k.ring(m.iron,x,y,z,r,.027,[0,Math.PI/2,0])
  for(const dx of [-.023,.02])k.ring(m.oak,x+dx,y,z,r-.035,.027,[0,Math.PI/2,0])
  for(let j=0;j<12;j++){
    const a=(j+.25)*tau/12,dy=Math.sin(a),dz=Math.cos(a)
    k.stick(m.pale,[x,y+dy*.077,z+dz*.077],[x,y+dy*(r-.05),z+dz*(r-.05)],.019,.026,6)
  }
  k.stick(m.oak,[x-.085,y,z],[x+.085,y,z],.088,.084,14)
  k.stick(m.iron,[x-.094,y,z],[x-.088,y,z],.069,.071,14)
  k.stick(m.iron,[x+.088,y,z],[x+.094,y,z],.069,.071,14)
  oval(k,m.brass,x+Math.sign(x)*.10,y,z,.017,.042,.042)
}

function wagon(k,m,fine){
  const axleZ=-.11
  if(fine){
    for(const side of [-1,1]){
      for(let j=0;j<12;j+=2){
        const a=(j+.25)*tau/12
        oval(k,m.brass,side*.845,.547+Math.sin(a)*.460,axleZ+Math.cos(a)*.460,.011,.014,.014)
      }
      for(const zz of [-.90,-.42,.45,.9])oval(k,m.iron,side*.683,.87,zz,.011,.017,.017)
      for(const x of [-.56,0,.56])for(const y of [.84,1.0])oval(k,m.iron,x,y,side*.987,.012,.012,.006)
    }
    return
  }
  k.stick(m.iron,[-.9,.547,axleZ],[.9,.547,axleZ],.056,.056,12)
  for(const side of [-1,1]){
    wheel(k,m,side*.81,.547,axleZ)
    k.stick(m.walnut,[side*.48,.65,-1.0],[side*.65,.75,1.96],.048,.055,7)
    k.stick(m.worn,[side*.64,.745,1.72],[side*.66,.76,1.97],.044,.049,10)
    k.stick(m.oak,[side*.44,.69,.77],[side*.51,.06,.85],.037,.048,6)
    for(const zz of [-.90,-.42,.45,.9]){
      k.box(m.walnut,side*.648,.92,zz,.07,.51,.072,[.025,0,side*-.08])
    }
    for(let rail=0;rail<2;rail++)
      k.box(rail?m.oak:m.pale,side*(.645+.008*rail),.81+rail*.21,0,.048,.15,1.94,[0,0,side*-.04])
  }
  for(let j=0;j<8;j++)k.box(j%3?m.oak:m.pale,(j-3.5)*.158,.72,0,.155,.084,1.96)
  for(const z of [-.953,.953]){
    k.box(m.walnut,0,.66,z,1.35,.10,.084)
    for(let rail=0;rail<2;rail++)k.box(rail?m.pale:m.oak,0,.83+.17*rail,z,1.29,.123,.047)
  }
  // A madder check cloth has caught over the near side of the cart.
  const cloth=patch(26,19,(u,v)=>{
    const z=-.74+u*.84
    if(v<.57){
      const q=v/.57
      return [-.18-.50*q,1.065+.023*Math.sin(u*20+q*2)+.036*q*q,z+.035*Math.sin(q*Math.PI+u*5)]
    }
    const t=(v-.57)/.43
    return [-.68-.027*Math.sin(t*Math.PI)-.024*Math.sin(u*26+2*t),1.105-t*(.42+.10*Math.sin(u*Math.PI)-.05*u),z+.027*Math.sin(t*3+u*5)]
  })
  k.put(cloth,m.basketCloth,[0,0,0])
}

function baguette(k,m,x,y,z,turn,scale,fine){
  const length=.33*scale
  if(!fine){
    oval(k,m.crust,x,y,z,.077*scale,.068*scale,length,[.03,turn,.045])
    return
  }
  const axis=[Math.sin(turn),Math.cos(turn)]
  for(let i=-2;i<=2;i++){
    const t=i*.09*scale
    oval(k,m.flour,x+t*axis[0],y+.058*scale*(1-.28*Math.abs(i)/2),z+t*axis[1],.048*scale,.004,.014*scale,[0,turn-.56,.05])
  }
}

const leafShape=patch(8,2,(u,v)=>{
  const breadth=Math.sin(u*Math.PI)*.04,dy=(1-Math.abs(v*2-1))*.012*Math.sin(u*Math.PI)
  return [(v*2-1)*breadth,dy+.015*Math.sin(u*Math.PI),u*.135]
})

function flowers(k,m,x,y,z,count,seed,fine) {
  const rng=random(seed)
  for(let j=0;j<count;j++){
    const a=rng()*tau,r=rng()*.13
    const bx=x+Math.cos(a)*r, bz=z+Math.sin(a)*r
    const by=y+.23+rng()*.24
    const petals=[m.petal,m.palePetal,m.bluePetal][j%3]
    if(!fine){
      k.stick(m.foliage,[x+(bx-x)*.26,y,z+(bz-z)*.26],[bx,by,bz],.005,.0032,5)
      // Each permanent corolla cup is the back of its bloom. The streamed
      // petals open around it, so both distances share the same flower heads.
      k.put(flowerCup,petals,[bx,by-.012,bz],[.026,.018,.026])
      continue
    }
    k.put(leafShape,j%2?m.leaves:m.foliage,[(x+bx)/2,(y+by)/2,(z+bz)/2],[.53,.7,.68],[-.36,a,-.18])
    for(let i=0;i<5;i++){
      const b=(i+.3)*tau/5
      oval(k,petals,bx+Math.sin(b)*.027,by,bz+Math.cos(b)*.027,.018,.012,.027,[.09,b,.13])
    }
    oval(k,m.pollen,bx,by+.008,bz,.015,.012,.015)
  }
}

function rope(k,m){
  const points=[]
  for(let i=0;i<=45;i++){
    const a=i*tau/15, r=.087+.0020*i
    points.push([.68+Math.cos(a)*r,.067+.002*i,.67+Math.sin(a)*r*.73])
  }
  points.push([.91,.077,.66],[1.04,.063,.81],[1.15,.062,.78],[1.18,.060,.73])
  k.tube(m.cord,points,.009,78)
}

function breadCart(m,fine) {
  const k=new Kit(fine?'Cart joinery, wickerwork, petals and milled flour':'Baker and florist’s delivery')
  const layer=fine?'detail':'base'
  wagon(k,m,fine)
  sack(k,m,.25,.76,-.54,.27,.66,1.8,fine)
  sack(k,m,.34,.77,.04,.23,.53,4.1,fine)
  // A sheaf tucked behind the flour sack can be recognised even above the rails.
  for(let j=0;j<7;j++){
    const a=j*2.41,x=.10+.17*Math.cos(a),z=-.78+.11*Math.sin(a),y=1.42+(j%3)*.074
    if(!fine){
      k.stick(m.husk,[.12,.90,-.67],[x,y+.09,z],.007,.003,5)
      continue
    }
    for(let i=0;i<5;i++){
      const side=i%2?1:-1
      oval(k,m.ear,x+side*.012,y+i*.018,z,.011,.026,.009,[.16,0,side*-.40])
      k.stick(m.ear,[x+side*.014,y+i*.018+.01,z],[x+side*.028,y+i*.018+.054,z+.006],.0017,.0007,4)
    }
  }
  basket(k,m,-.18,1.07,-.40,.29,.17,false,layer)
  for(let i=0;i<4;i++)baguette(k,m,-.34+i*.107,1.23+(i%2)*.025,-.4,-.24+(i%3)*.18,.89,fine)
  basket(k,m,-.26,.79,.49,.29,.23,true,layer)
  for(let i=0;i<4;i++) {
    const x=-.39+(i%2)*.22,z=.39+Math.floor(i/2)*.20
    if(!fine) oval(k,m.bread,x,1.04,z,.146,.102,.122,[.04,.2,.12])
    else for(const off of [-.043,.043]) oval(k,m.flour,x+off,1.133,z,.010,.006,.068,[0,-.47,.16])
  }
  basket(k,m,.35,.78,.59,.18,.23,false,layer)
  flowers(k,m,.35,.97,.59,18,483,fine)
  basket(k,m,-1.15,.055,-.36,.34,.25,true,layer)
  flowers(k,m,-1.15,.24,-.36,28,358,fine)
  sack(k,m,-1.06,.06,.4,.21,.43,8.4,fine)
  if(fine)rope(k,m)
  const rng=random(233)
  if(fine)for(let i=0;i<23;i++){
    const x=-1.58+rng()*1.35,z=-1.0+rng()*2.6,s=.35+rng()*.44
    k.put(leafShape,i%3?m.leaves:m.foliage,[x,.059+rng()*.006,z],[s,s,s],[0,rng()*tau,0])
    if(i%4===0)oval(k,m.petal,x+.06,.066,z+.01,.019,.007,.025,[0,rng()*tau,0])
  }
  const group=k.finish()
  group.position.set(-10.58,0,11.85);group.rotation.y=1.22
  return group
}

function barrel(k,m,x,y,z,scale){
  const r=.30*scale,h=.73*scale
  for(let j=0;j<18;j++){
    const geom=patch(3,6,(u,v)=>{
      const a=(j+.012+u*.976)*tau/18,rr=r*(.85+.16*Math.sin(v*Math.PI))
      return [rr*Math.cos(a),v*h,rr*Math.sin(a)]
    })
    k.put(geom,j%4===0?m.pale:m.oak,[x,y,z])
  }
  for(const v of [.11,.27,.72,.89]){
    const rr=r*(.85+.16*Math.sin(v*Math.PI))+.003
    const geom=patch(44,1,(u,t)=>[Math.cos(u*tau)*rr,(t-.5)*.032,Math.sin(u*tau)*rr])
    k.put(geom,m.iron,[x,y+h*v,z])
  }
  oval(k,m.walnut,x,y+h-.015,z,r*.85,.016,r*.85)
  for(let j=-2;j<=2;j++){
    const off=j*r*.31,length=2*Math.sqrt((r*.83)**2-off**2)
    k.box(j%2?m.oak:m.pale,x+off,y+h-.009,z,r*.295,.012,length)
  }
}

function eastDelivery(m){
  const k=new Kit('Orchard boxes behind the charts')
  barrel(k,m,.36,.049,.13,1.02);barrel(k,m,-.07,.049,-.44,.85)
  basket(k,m,.87,.05,-.37,.28,.28,true)
  for(const x of [-.34,.34])for(const z of [-.27,.27])k.box(m.walnut,x,.27,.99+z,.056,.46,.052)
  for(let j=0;j<3;j++){
    for(const side of [-1,1]){
      k.box(j%2?m.oak:m.pale,side*.35,.13+j*.135,.99,.049,.103,.61)
      k.box(m.pale,0,.13+j*.135,.99+side*.289,.67,.10,.039)
    }
  }
  for(let i=0;i<18;i++){
    const x=-.22+(i%4)*.147,z=.80+Math.floor(i/4)*.102
    oval(k,i%5?m.pear:m.apple,x,.40+(i%3)*.012,z,.082,.079,.081)
    if(i%4===0)k.stick(m.walnut,[x,.458,z],[x-.012,.513,z+.013],.005,.003,5)
  }
  const group=k.finish()
  group.position.set(14.05,0,14.24);group.rotation.y=-.29
  return group
}

export function makeDeliveries(){
  const group=new T.Group(),m=palette()
  group.name='The morning market delivery'
  group.add(breadCart(m,false),eastDelivery(m))
  return group
}

export function makeDeliveryDetails(){
  return ownDetailInstanceGeometry(breadCart(palette(true),true))
}
