import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const TAU=Math.PI*2, panelWidth=1.32, panelHeight=1.65
const palette={night:'#283e72',lapis:'#2f6198',indigo:'#443e83',corn:'#7089c1',opal:'#b3d8c5',
  teal:'#368c95',moss:'#679b89',garnet:'#923448',rose:'#c65c65',amber:'#d59339',honey:'#f1c56d',ivory:'#e1ddbb'}

// Each entry is an actual piece that could be cut from stock. Neighbouring
// pieces share the same sampled curve, so their lead web remains watertight.
function cartoon() {
  const cells=[],add=(points,colour,missing=false)=>cells.push({points,colour,missing})
  const rect=(x0,y0,x1,y1,c)=>add([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],c)
  const w=.568,low=.107,junction=.803,top=1.545
  // In the lower light, quills rise from the stem towards the edges of the frame.
  const rows=[
    [low,.051,.024],[.193,.10,.069],[.287,.17,.111],[.390,.232,.143],
    [.496,.303,.150],[.600,.370,.126],[.695,.430,.082],[.757,.465,.043],[junction,.48,.008],
  ]
  for(const sign of [-1,1]){
    function transverse(r,k,t){
      const [y,m,wing]=rows[r],v=r/(rows.length-1),coat=Math.sin(v*Math.PI)
      const columns=[0,m-wing,m,m+wing,w],x=T.MathUtils.lerp(columns[k],columns[k+1],t)
      const raised=[0,.065*coat,0,.095*coat,0]
      const bend=(k===1||k===2)?.016:-.013
      return [sign*x,y+T.MathUtils.lerp(raised[k],raised[k+1],t)+Math.sin(t*Math.PI)*bend*coat]
    }
    for(let r=0;r<rows.length-1;r++)for(let k=0;k<4;k++){
      const points=[]
      for(let i=0;i<=5;i++)points.push(transverse(r,k,i/5))
      for(let i=5;i>=0;i--)points.push(transverse(r+1,k,i/5))
      const backgrounds=[palette.night,palette.lapis,palette.indigo,palette.lapis]
      const left=[palette.teal,palette.moss,palette.opal,palette.teal],right=[palette.honey,palette.amber,palette.ivory,palette.honey]
      const c=k===1?left[(r+(sign>0?0:2))%4]:k===2?right[(r+(sign>0?2:0))%4]:backgrounds[(r+k+(sign>0?0:1))%4]
      add(points,c,sign===1&&k===1&&r===4)
    }
  }
  const centre=1.168,cornerAngles=[]
  for(const dx of [-w,w])for(const dy of [junction-centre,top-centre])cornerAngles.push((Math.atan2(dy,dx)+TAU)%TAU)
  function rosePoint(a,ring){
    const c=Math.cos(a),s=Math.sin(a),petal=(1+Math.cos(8*a))/2
    const radii=[.056+.008*Math.cos(8*a),.089+.015*petal,.112+.100*petal,.209+.054*petal,.281,.299]
    const far=Math.min(w/Math.max(.00001,Math.abs(c)),(s>=0?top-centre:centre-junction)/Math.max(.00001,Math.abs(s)))
    const radius=ring===7?far:ring===6?.299+(far-.299)*.52:radii[ring]
    return [radius*c,centre+radius*s]
  }
  const sector=Math.PI/8
  for(let k=0;k<16;k++){
    const a0=k*sector,a1=(k+1)*sector,angles=[a0,a1,...cornerAngles.filter(a=>a>a0+.000001&&a<a1-.000001)]
    for(let i=1;i<5;i++)angles.push(a0+(a1-a0)*i/5)
    angles.sort((a,b)=>a-b)
    add([[0,centre],...angles.map(a=>rosePoint(a,0))],k%2?palette.honey:palette.amber)
    const colours=[k%2?palette.amber:palette.ivory,k%2?palette.garnet:palette.rose,k%2?palette.ivory:palette.honey,
      k%2?palette.corn:palette.lapis,palette.honey,k%2?palette.night:palette.indigo,k%3?palette.lapis:palette.night]
    for(let j=0;j<7;j++)add([...angles.map(a=>rosePoint(a,j)),...angles.slice().reverse().map(a=>rosePoint(a,j+1))],colours[j])
  }
  for(let j=0;j<12;j++){
    const y0=low+j*(top-low)/12,y1=low+(j+1)*(top-low)/12
    for(const s of [-1,1]){
      rect(s*w,y0,s*.588,y1,j%3?palette.amber:palette.honey)
      rect(s*.588,y0,s*.631,y1,j%3?palette.indigo:palette.rose)
    }
  }
  for(let j=0;j<15;j++){
    const x0=-.631+1.262*j/15,x1=-.631+1.262*(j+1)/15
    for(const [y0,y1] of [[.06,low],[top,1.601]])rect(x0,y0,x1,y1,j%4?palette.teal:palette.honey)
  }
  return cells
}

const V=p=>new T.Vector3(...p)
function makeBatch(root) {
  const groups=new Map()
  function add(g,mat,color){
    const geo=g.index?g.toNonIndexed():g
    if(g!==geo)g.dispose()
    geo.clearGroups()
    const c=new T.Color(color),count=geo.attributes.position.count,rgb=new Float32Array(count*3)
    for(let i=0;i<count;i++)c.toArray(rgb,i*3)
    geo.setAttribute('color',new T.BufferAttribute(rgb,3))
    if(!groups.has(mat))groups.set(mat,[])
    groups.get(mat).push(geo)
  }
  function box(position,size,mat,c,rot=[0,0,0]){
    const g=new T.BoxGeometry(...size)
    g.applyQuaternion(new T.Quaternion().setFromEuler(new T.Euler(...rot)));g.translate(...position);add(g,mat,c)
  }
  function stick(a,b,r1,r2,mat,c,n=10){
    const d=V(b).sub(V(a)),g=new T.CylinderGeometry(r2,r1,d.length(),n)
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()))
    g.translate(...V(a).lerp(V(b),.5).toArray());add(g,mat,c)
  }
  function ell(p,s,mat,c){
    const g=new T.SphereGeometry(1,10,6);g.scale(...s);g.translate(...p);add(g,mat,c)
  }
  function trace(points,r,mat,c){
    add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(V)),Math.max(12,points.length*2),r,6,false),mat,c)
  }
  return {add,box,stick,ell,trace,finish(){
    for(const [material,parts] of groups){
      const geo=mergeGeometries(parts,false),mesh=new T.Mesh(geo,material)
      mesh.name=material.name;mesh.castShadow=!material.transparent;mesh.receiveShadow=true
      root.add(mesh);parts.forEach(g=>g.dispose())
    }
  }}
}

function detailTexture(glass) {
  const n=128,bytes=new Uint8Array(n*n*4)
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=TAU*x/n,v=TAU*y/n,idx=(y*n+x)*4
    if(glass){
      const wave=Math.cos(u*4+v+1.1*Math.sin(v*2)),cross=Math.cos(3*v+.8*Math.cos(u))
      bytes[idx]=128+21*wave+6*Math.sin(v*14+u);bytes[idx+1]=128+17*cross+7*wave;bytes[idx+2]=252
    } else {
      const grain=Math.sin(u*22+3*Math.sin(v+.3*Math.sin(3*v))+Math.sin(u*3-v))
      const split=Math.max(0,Math.sin(u*13+.85*Math.cos(v*2))-.79)
      const value=221+8*grain-70*split+4*Math.sin(u*59+v*4)
      bytes[idx]=value+6;bytes[idx+1]=value+1;bytes[idx+2]=value-8
    }
    bytes[idx+3]=255
  }
  const map=new T.DataTexture(bytes,n,n)
  map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter
  map.generateMipmaps=true;map.needsUpdate=true
  if(!glass)map.colorSpace=T.SRGBColorSpace
  return map
}

function atelierMaterials(detailed){
  const woodMap=detailTexture(false)
  const standard=(name,roughness,metalness,extra={})=>new T.MeshStandardMaterial({name,vertexColors:true,roughness,metalness,...extra})
  const glass=detailed?new T.MeshPhysicalMaterial({name:'Rippled glass with ground bevels',vertexColors:true,roughness:.19,
    metalness:.10,clearcoat:.81,clearcoatRoughness:.19,normalMap:detailTexture(true),normalScale:new T.Vector2(.38,.38),
    transparent:true,opacity:.82,depthWrite:false,side:T.DoubleSide}):standard('Distant glazing',.34,.11,
      {transparent:true,opacity:.84,depthWrite:false,side:T.DoubleSide})
  // Transmitted daylight is strongest through the glass, independent of the
  // glancing sun reflected along the lead and the polished edge of each shard.
  glass.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * .33;')
  }
  return {glass,wood:standard('Weathered joinery',.84,0,{map:woodMap,bumpMap:woodMap,bumpScale:.005}),
    lead:standard('Oxidised lead came',.50,.62),metal:standard('Iron and brass tools',.38,.59),
    chalk:detailed?standard('Chalk and cloth',.93,0):null}
}

const outline=points=>{
  const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s
}
function slumpedPane(points,thickness=.003){
  return new T.ExtrudeGeometry(outline(points),{depth:thickness,bevelEnabled:true,bevelSegments:1,bevelSize:.00165,bevelThickness:.00165,steps:1})
}
const lean=-.125, foot=.46
const panelMatrix=new T.Matrix4().compose(new T.Vector3(-.14,foot,.06),new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),lean),new T.Vector3(1,1,1))
const panelPoint=(x,y,z)=>new T.Vector3(x,y,z).applyMatrix4(panelMatrix).toArray()

function glazing(b,m,cells){
  const points=new Map(),edges=new Set(),leads=[],normals=[],uvs=[]
  const key=(x,y)=>Math.round(x*100000)+':'+Math.round(y*100000)
  for(const cell of cells){
    if(!cell.missing)b.add(slumpedPane(cell.points).applyMatrix4(panelMatrix),m.glass,cell.colour)
    for(let i=0;i<cell.points.length;i++){
      const [x,y]=cell.points[i],[u,v]=cell.points[(i+1)%cell.points.length]
      const ka=key(x,y),kb=key(u,v),id=ka<kb?ka+'|'+kb:kb+'|'+ka
      if(ka===kb||edges.has(id))continue
      edges.add(id)
      for(const [k,px,py] of [[ka,x,y],[kb,u,v]]){
        const node=points.get(k)||{x:px,y:py,degree:0};node.degree++;points.set(k,node)
      }
      const dx=u-x,dy=v-y,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length
      // A lead H-section presents a narrow, slightly domed face to each side.
      const section=[[-.0042,.0042],[-.003,.0073],[0,.0086],[.003,.0073],[.0042,.0042]]
      for(let k=0;k<section.length-1;k++){
        const [lo,h0]=section[k],[hi,h1]=section[k+1]
        const a=[x+lo*nx,y+lo*ny,h0],bb=[u+lo*nx,v+lo*ny,h0],c=[u+hi*nx,v+hi*ny,h1],d=[x+hi*nx,y+hi*ny,h1]
        const normal=V(bb).sub(V(a)).cross(V(d).sub(V(a))).normalize()
        for(const p of [a,bb,c,a,c,d]){leads.push(...p);normals.push(...normal.toArray());uvs.push(p[0],p[1])}
      }
    }
  }
  const g=new T.BufferGeometry()
  g.setAttribute('position',new T.Float32BufferAttribute(leads,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3))
  g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));b.add(g.applyMatrix4(panelMatrix),m.lead,'#655f5a')
  for(const node of points.values())if(node.degree>=3)b.ell(panelPoint(node.x,node.y,.009),[.0065,.0065,.0034],m.lead,'#969083')
}

function easel(b,m){
  // Two rails hold the loose panel by its perimeter. The back of the glass stays open.
  for(const s of [-1,1]){
    const x=-.14+s*.48
    b.box([x,.99,-.093],[.073,1.98,.078],m.wood,s>0?'#866a52':'#735d48',[lean,0,-s*.055])
    b.stick([x+s*.07,.015,-.70],[x,1.65,-.119],.045,.034,m.wood,'#786650',6)
    b.stick([x+s*.07,.23,-.61],[x,.31,.02],.014,.014,m.metal,'#625e53',6)
    for(const y of [.42,1.57])b.ell([x,y,.062+y*Math.sin(lean)],[.020,.020,.008],m.metal,'#8b816a')
  }
  b.box([-.14,.402,.038],[1.47,.068,.21],m.wood,'#a58b6a')
  b.box([-.14,.448,.124],[1.45,.036,.040],m.wood,'#957a58')
  b.box([-.14,1.50,-.185],[1.08,.079,.057],m.wood,'#78634c',[lean,0,0])
  for(const s of [-1,1])b.stick(panelPoint(s*.644,.042,.003),panelPoint(s*.644,1.615,.003),.014,.014,m.lead,'#706e62',8)
  for(const y of [.045,1.615])b.stick(panelPoint(-.644,y,.003),panelPoint(.644,y,.003),.014,.014,m.lead,'#777567',8)
  for(const s of [-1,1]){
    b.stick(panelPoint(s*.65,.065,.004),panelPoint(s*.65,1.598,.004),.010,.010,m.wood,'#937553',8)
  }
}

function joineryMarks(b,m){
  for(const s of [-1,1]){
    for(const y of [.117,.51,1.11,1.55])b.stick(panelPoint(s*.664,y,.010),panelPoint(s*.638,y+.001,.012),.0024,.0020,m.metal,'#65716a',6)
  }
  // Pegged mortise, bruised timber edges and a few chalk alignment ticks.
  for(const x of [-.59,.31])for(const dx of [-.024,.024])b.ell([x+dx,.405,.143],[.0045,.005,.0028],m.metal,'#595749')
  for(let j=0;j<6;j++)b.stick([-.73+j*.016,.438,.122],[-.724+j*.016,.438,.104],.0013,.0013,m.chalk,'#c8b994',5)
}

function workbench(b,m){
  const z=.30,x=.88
  for(let i=0;i<3;i++)b.box([x,.50,z+(i-1)*.145],[.88,.055,.141],m.wood,i%2?'#a48a67':'#93795d')
  for(const s of [-1,1])for(const f of [-1,1]){
    const a=[x+s*.342,.485,z+f*.157],c=[x+s*.395,.007,z+f*.177]
    b.stick(c,a,.031,.043,m.wood,'#766049',5)
  }
  for(const s of [-1,1])b.box([x+s*.349,.36,z],[.051,.069,.368],m.wood,'#8b7455')
  b.box([x,.235,z-.052],[.74,.05,.043],m.wood,'#7d664a')
}

function benchTools(b,m,cells){
  const z=.30,x=.88
  const matY=.531
  b.box([x-.122,matY,z-.016],[.51,.005,.32],m.chalk,'#9d917d',[0,.04,0])
  // A matching leaf is out for fitting; its folded tracing sits beside the cut glass.
  const missing=cells.find(c=>c.missing),avg=missing.points.reduce((p,[u,v])=>[p[0]+u/missing.points.length,p[1]+v/missing.points.length],[0,0])
  function offcut(pts,px,pz,col,turn,y=matY+.008){
    const g=slumpedPane(pts,.0038)
    g.rotateX(-Math.PI/2);g.rotateY(turn);g.translate(px,y,pz);b.add(g,m.glass,col)
  }
  const leaf=missing.points.map(([u,v])=>[u-avg[0],v-avg[1]])
  offcut(leaf,.70,.34,missing.colour,-.22)
  offcut([[-.061,-.026],[.036,-.035],[.072,-.009],[.022,.033],[-.039,.032]],.85,.24,palette.garnet,.47)
  offcut([[-.035,-.019],[.050,-.022],[.032,.031]],.76,.207,palette.honey,-.15,matY+.014)
  for(let i=0;i<4;i++){
    const cx=.496+i*.024
    b.stick([cx,.54,.132],[cx+.024,.541,.282+i*.014],.003,.003,m.lead,'#7e8075',5)
  }
  // The grozing pliers have blunt opposing jaws and a visible rivet at the crossing.
  const cx=1.091,cz=.323
  for(const s of [-1,1]){
    b.trace([[cx+s*.051,.542,cz+.108],[cx+s*.041,.545,cz+.041],[cx-s*.006,.553,cz-.012],[cx-s*.018,.551,cz-.052]],.009,m.metal,'#585c57')
    b.stick([cx+s*.052,.541,cz+.111],[cx+s*.042,.545,cz+.042],.012,.010,m.wood,'#8c563d',8)
    b.box([cx-s*.014,.55,cz-.061],[.016,.014,.022],m.metal,'#9b9a8c',[0,s*.21,0])
  }
  b.ell([cx,.562,cz-.009],[.013,.006,.013],m.metal,'#b39c70')
  const cutterStart=[.950,.544,.205],cutterMid=[1.059,.548,.181],cutterTip=[1.126,.548,.164]
  b.stick(cutterStart,cutterMid,.014,.013,m.wood,'#8c6b47',12)
  b.stick(cutterMid,cutterTip,.008,.005,m.metal,'#ab9770',8)
  b.stick([1.123,.546,.158],[1.128,.546,.172],.009,.009,m.metal,'#686c67',12)
  b.box([.59,.545,.397],[.062,.009,.013],m.chalk,'#d4ceb6',[0,-.28,0])
  const leadCoil=[]
  for(let j=0;j<=82;j++){
    const a=j/82*TAU*2.65,r=.064-a*.0021
    leadCoil.push([1.152+Math.cos(a)*r,.537+.001*j/82,.469+Math.sin(a)*r*.70])
  }
  b.trace(leadCoil,.0037,m.lead,'#777a70')
}

function lightImpression(cells) {
  // Rasterise the cut pattern at low resolution and diffuse it like daylight
  // crossing rippled antique glass. Pixels outside the drawing remain clear.
  const w=96,h=120,raw=new Uint8Array(w*h*4)
  for(const {points,colour,missing} of cells){
    if(missing)continue
    const poly=points.map(([x,y])=>[(x/panelWidth+.5)*w,y/panelHeight*h])
    const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),c=parseInt(colour.slice(1),16)
    const x0=Math.max(1,Math.floor(Math.min(...xs))),x1=Math.min(w-2,Math.ceil(Math.max(...xs)))
    const y0=Math.max(1,Math.floor(Math.min(...ys))),y1=Math.min(h-2,Math.ceil(Math.max(...ys)))
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      let inside=false
      for(let i=0,j=poly.length-1;i<poly.length;j=i++){
        const [a,b]=poly[i],[d,e]=poly[j]
        if((b>y+.5)!==(e>y+.5)&&x+.5<(d-a)*(y+.5-b)/(e-b)+a)inside=!inside
      }
      if(inside){const n=(y*w+x)*4;raw[n]=c>>16;raw[n+1]=c>>8&255;raw[n+2]=c&255;raw[n+3]=224}
    }
  }
  let input=raw
  for(let pass=0;pass<2;pass++){
    const next=new Uint8Array(input.length)
    for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++)for(let c=0;c<4;c++){
      let sum=0
      for(let off=-2;off<=2;off++)sum+=input[((y+(pass?off:0))*w+x+(pass?0:off))*4+c]*(3-Math.abs(off))
      next[(y*w+x)*4+c]=sum/9
    }
    input=next
  }
  const map=new T.DataTexture(input,w,h);map.colorSpace=T.SRGBColorSpace;map.magFilter=map.minFilter=T.LinearFilter;map.needsUpdate=true
  const g=new T.BufferGeometry(),coords=[]
  for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){
    const y=foot+v*panelHeight
    coords.push((u-.5)*panelWidth-.14+y*1.04,.004,.06-y*.77)
  }
  g.setAttribute('position',new T.Float32BufferAttribute(coords,3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2))
  g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals()
  const mat=new T.MeshBasicMaterial({name:'Coloured daylight on the stone',map,transparent:true,opacity:.36,depthWrite:false,
    side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1})
  const mesh=new T.Mesh(g,mat);mesh.name=mat.name;return mesh
}

function placedRoot(name) {
  const root=new T.Group();root.name=name
  root.position.set(-22.70,-.042,-47.88);root.rotation.y=-.17
  return root
}

/** The wooden support and its broad coloured silhouette stay visible from the street. */
export function makeGlassworkBase(){
  const root=placedRoot('Glazier’s easel and workbench'),m=atelierMaterials(false),b=makeBatch(root)
  easel(b,m);workbench(b,m)
  const pane=(pts,c)=>b.add(new T.ShapeGeometry(outline(pts)).applyMatrix4(panelMatrix),m.glass,c)
  const levels=[[.06,.018,.030],[.31,.08,.32],[.52,.18,.47],[.803,.47,.50]]
  for(const s of [-1,1])for(let j=0;j<levels.length-1;j++){
    const [lo,in0,out0]=levels[j],[hi,in1,out1]=levels[j+1],w=.631
    for(const [a,b0,c,d,colour] of [[0,in0,0,in1,palette.night],[in0,out0,in1,out1,palette.teal],[out0,w,out1,w,palette.lapis]])
      pane([[s*a,lo],[s*b0,lo],[s*d,hi],[s*c,hi]],colour)
  }
  const centre=1.175,sy=.40,sx=.631
  const border=[[sx,centre],[sx,1.601],[0,1.601],[-sx,1.601],[-sx,centre],[-sx,.803],[0,.803],[sx,.803]]
  for(let i=0;i<8;i++){
    const ang=i*TAU/8,next=(i+1)*TAU/8
    const a=[.22*Math.cos(ang),centre+sy*.59*Math.sin(ang)],c=[.22*Math.cos(next),centre+sy*.59*Math.sin(next)]
    pane([[0,centre],a,c],i%2?palette.rose:palette.amber)
    pane([a,border[i],border[(i+1)%8],c],i%2?palette.night:palette.lapis)
  }
  b.finish()
  return root
}

/** Every disposable belongs to the detail. The attached base owns its own resources. */
export function makeGlasswork(base){
  const root=placedRoot('Glazier’s bench · feather and pomegranate light')
  const cells=cartoon(),m=atelierMaterials(true),b=makeBatch(root)
  glazing(b,m,cells);benchTools(b,m,cells);joineryMarks(b,m);b.finish()
  root.add(lightImpression(cells))
  const coarse=base?.getObjectByName('Distant glazing')
  if(coarse){
    root.addEventListener('added',()=>{coarse.visible=false})
    root.addEventListener('removed',()=>{coarse.visible=true})
  }
  return root
}
