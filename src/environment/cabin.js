import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { addDaylight, addRidges, noise, rng, placeInstances } from './common.js';
import { plantForest, plantMeadow } from './vegetation.js';

import { loadGeometries } from './geometry-loader.js';
const grassURL = new URL('./assets/forest-grass.webp', import.meta.url).href;
const shingleURL = new URL('./assets/river-shingle.webp', import.meta.url).href;
const waterLevel = -.72;

export function shoreDistance(x,z) {
  const a = Math.atan2((z+60)/51,x/105);
  const uneven = 1.9*Math.sin(a*3+.7)+1.35*Math.sin(a*6-.5)+.7*Math.sin(a*12+.3);
  return (Math.hypot(x/105,(z+60)/51)-1)*51 + uneven;
}

export function groundHeight(x,z) {
  const edge = shoreDistance(x,z);
  if (edge < 0) return waterLevel + edge * (.29+.08*noise(x*.15,z*.15));
  const pad = Math.max(0,Math.abs(x)-6,Math.abs(z+.5)-5.9);
  const shore = waterLevel + 1.03*(1-Math.exp(-edge*.30));
  const distance = Math.hypot(x*.86,z*.95);
  const relief = THREE.MathUtils.smoothstep(distance,11,100) *
     (2.2+12*noise(x*.033+2,z*.029)+12*noise(x*.013,z*.014+2.7));
  return THREE.MathUtils.smoothstep(pad,0,3.5) *
    (shore + relief*THREE.MathUtils.smoothstep(edge,2,28)+.36*noise(x*.18,z*.18));
}

function addGround(ctx,parent) {
  const grid = new THREE.PlaneGeometry(450,410,244,220);
  grid.rotateX(-Math.PI/2);
  grid.translate(0,0,-29);
  const pos = grid.attributes.position;
  const c = new THREE.Color(), colors = [], bank = [];
  const shoreColor = new THREE.Color(0xf4eedc), grass = new THREE.Color(0xbfce97), bottom = new THREE.Color(0x5b6c56);
  for (let i=0; i<pos.count;i++) {
    const x=pos.getX(i),z=pos.getZ(i);
    const d=shoreDistance(x,z);
    pos.setY(i,groundHeight(x,z));
    bank.push(1-THREE.MathUtils.smoothstep(d+.56*noise(x*.7,z*.7),1.1,4.2));
    c.copy(shoreColor).lerp(grass,THREE.MathUtils.smoothstep(d,0,4)).lerp(bottom,THREE.MathUtils.smoothstep(-d,0,3));
    c.multiplyScalar(.81 + .28*noise(x*.09,z*.09)+.11*noise(x*.47,z*.47));
    colors.push(c.r,c.g,c.b);
    grid.attributes.uv.setXY(i,x/3.1,z/3.1);
  }
  grid.setAttribute('shoreBlend',new THREE.Float32BufferAttribute(bank,1));
  grid.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  grid.computeVertexNormals();
  const texture = new THREE.TextureLoader().load(grassURL);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8,ctx.renderer.capabilities.getMaxAnisotropy());
  const shingle=new THREE.TextureLoader().load(shingleURL);
  shingle.colorSpace=THREE.SRGBColorSpace;
  shingle.wrapS=shingle.wrapT=THREE.RepeatWrapping;
  shingle.anisotropy=texture.anisotropy;
  ctx.onDispose(()=>shingle.dispose());
  const material = new THREE.MeshStandardMaterial({map:texture,color:0xffffff,vertexColors:true,roughness:1});
  material.onBeforeCompile = shader => {
    // Rotated secondary octave breaks the telltale grid of a repeated terrain tile.
    shader.uniforms.shingle={value:shingle};
    shader.vertexShader='attribute float shoreBlend; varying float vShingle;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvShingle=shoreBlend;');
    shader.fragmentShader='uniform sampler2D shingle; varying float vShingle;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
      vec4 sampledDiffuseColor = texture2D(map,vMapUv);
      vec2 secondary = mat2(.80,-.60,.60,.80)*vMapUv*.31;
      sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb,
        texture2D(map,secondary).rgb,.25);
      vec3 shore = texture2D(shingle,vMapUv*1.6).rgb;
      sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb * vec3(1.07,1.26,1.03),shore,vShingle);
      diffuseColor *= sampledDiffuseColor;
    `);
  };
  const mesh=new THREE.Mesh(grid,material);
  mesh.receiveShadow=true;
  mesh.name='湖盆、沙砾冲积岸与草甸';
  parent.add(mesh);
}

function addLake(ctx,parent) {
  const geometry=new THREE.PlaneGeometry(245,129,96,48);
  const pos=geometry.attributes.position;
  const depth=[];
  for (let i=0;i<pos.count;i++) depth.push(Math.max(0,-shoreDistance(pos.getX(i), -60-pos.getY(i))));
  geometry.setAttribute('shoreDepth',new THREE.Float32BufferAttribute(depth,1));
  const shader = {
    name:'Yofel alpine lake', uniforms: {...Reflector.ReflectorShader.uniforms, seconds:{value:0}},
    vertexShader:`
      uniform mat4 textureMatrix;
      attribute float shoreDepth;
      varying vec3 vWorld;
      varying float vDepth;
      varying vec4 vMirror;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){
        vWorld=(modelMatrix*vec4(position,1.)).xyz;
        vDepth=shoreDepth;
        vMirror=textureMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      uniform sampler2D tDiffuse;
      uniform float seconds;
      varying vec3 vWorld;
      varying float vDepth;
      varying vec4 vMirror;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p=vWorld.xz;
        float t=seconds;
        float distanceToEye=length(vWorld-cameraPosition);
        float shortWave=1.-smoothstep(14.,125.,distanceToEye);
        float warp=sin(dot(p,vec2(.28,.46))+t*.35)*.72 + .35*sin(p.x*1.6+p.y*.83+t*.58);
        vec2 slope=vec2(.65,.31)*cos(dot(p,vec2(1.1,.54))+t*.86+warp)*.056;
        slope+=vec2(-.48,.86)*cos(dot(p,vec2(-2.52,4.35))+t*1.42+warp)*.043;
        slope+=vec2(-.67,-.54)*cos(dot(p,vec2(-7.7,-6.4))+t*2.05)*.022*shortWave;
        slope+=vec2(.29,-.91)*cos(dot(p,vec2(6.8,-22.4))+t*2.92+warp)*.010*shortWave;
        vec3 n=normalize(vec3(-slope.x,1.,-slope.y));
        vec3 view=normalize(cameraPosition-vWorld);
        float fresnel=.055+.88*pow(1.-clamp(dot(view,n),0.,1.),4.);
        vec2 projected=vMirror.xy/vMirror.w;
        vec3 reflection=texture2D(tDiffuse,clamp(projected+slope*.061,vec2(.001),vec2(.999))).rgb;
        float shallow=exp(-vDepth*.42);
        float lightline=.4+.6*pow(.5+.5*sin(dot(p,vec2(5.,2.4))+warp+sin(p.y*4.1+t)+t*.5),5.);
        vec3 body=mix(vec3(.027,.137,.137),vec3(.15,.24,.15)+vec3(.09,.10,.042)*lightline,shallow);
        vec3 skyLight=vec3(.35,.53,.66)*.22;
        vec3 color=mix(body+skyLight,reflection,clamp(fresnel+.18,0.,.96));
        vec3 halfVector=normalize(view+normalize(vec3(-20.,24.,-18.)));
        color+=vec3(2.8,2.24,1.57)*pow(max(dot(halfVector,n),0.),620.);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  };
  const water=new Reflector(geometry,{textureWidth:768,textureHeight:512,multisample:0,clipBias:.002,shader});
  water.name='湖面·折射色衰减、微表面波纹与几何镜像';
  water.rotation.x=-Math.PI/2;
  water.position.set(0,waterLevel,-60);
  parent.add(water);
  const renderMirror=water.onBeforeRender.bind(water);
  let elapsed=0, last=-Infinity;
  const oldPosition=new THREE.Vector3(Infinity,Infinity,Infinity);
  const oldRotation=new THREE.Quaternion();
  water.onBeforeRender=(renderer,scene,camera,...args) => {
    if (elapsed-last<.13 && oldPosition.distanceToSquared(camera.position)<.018 &&
      oldRotation.angleTo(camera.quaternion)<.013) return;
    if (camera.position.y<waterLevel) return;
    last=elapsed;
    oldPosition.copy(camera.position);
    oldRotation.copy(camera.quaternion);
    renderMirror(renderer,scene,camera,...args);
  };
  ctx.onFrame(t=>{elapsed=t;water.material.uniforms.seconds.value=t;});
  ctx.onDispose(()=>water.dispose());
}

function addPebbles(ctx,parent) {
  const random=rng(94328);
  const basalt=new THREE.SphereGeometry(1,11,8);
  const p=basalt.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=.72+.51*noise(x*3.4,z*3.4+y);
    p.setXYZ(i,x*r,y*r,z*r);
  }
  basalt.computeVertexNormals();
  const stones=[], hero=[];
  const rgb=new THREE.Color();
  for(let i=0;i<6600;i++){
    const a=random()*Math.PI*2, r=1+(random()-.47)*.2;
    const x=Math.cos(a)*105*r,z=-60+Math.sin(a)*51*r;
    const d=shoreDistance(x,z);
    if(d < -2 || d>3.1) continue;
    const size=.045+Math.pow(random(),5)*.68;
    const grade=.70+random()*.32;rgb.setRGB(grade,grade*(.96+random()*.075),grade*(.92+random()*.07));
    if(d<.04) rgb.multiplyScalar(.6);
    const target = size>.19 && Math.hypot(x,z)<28 ? hero : stones;
    target.push([x,groundHeight(x,z)+size*.15,z,size*(.8+random()*.6),size*(.36+random()*.4),size,random()*6,random()*.4,0,rgb.clone()]);
  }
  const tex=new THREE.TextureLoader().load(shingleURL);
  tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.86,color:0xb9b7a5});
  placeInstances(parent,basalt,mat,stones,'水蚀卵石与浅滩砾石');
  ctx.registerDetail({anchor:[0,0,-9],enter:64,exit:82,build:async signal=>{
    const [rock]=await loadGeometries(new URL('./assets/moss-boulder.glb',import.meta.url),signal);
    const loader=new THREE.TextureLoader();
    const color=loader.load(new URL('./assets/moss-rock.webp',import.meta.url).href);
    const normal=loader.load(new URL('./assets/moss-rock-normal.webp',import.meta.url).href);
    color.flipY=normal.flipY=false;
    color.colorSpace=THREE.SRGBColorSpace;
    const group=new THREE.Group();
    for(const d of hero){d[3]*=1.16;d[4]*=1.5;d[5]*=1.10;}
    placeInstances(group,rock,new THREE.MeshStandardMaterial({map:color,normalMap:normal,normalScale:new THREE.Vector2(.75,.75),roughness:.82}),hero,'水边的扫描苔石',true);
    return group;
  }});
}

// The outer supports glimpsed beyond the tree crowns place the domestic scene
// inside Aincrad. Their exact architecture and orientation are interpretive.
function addFloorSupports(parent) {
  const stone=new THREE.MeshBasicMaterial({color:0x8298a6});
  const edge=new THREE.MeshBasicMaterial({color:0x9baebb});
  const group=new THREE.Group();
  group.name='外周支柱·树梢以远的楼层结构';
  function shaft(x,z,h,scale){
    const tower=new THREE.Group();
    tower.position.set(x,0,z);tower.scale.setScalar(scale);
    function section(y,bottom,top,height,mat,side=10){
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,side,1,false),mat);
      mesh.position.y=y;tower.add(mesh);
    }
    section(h*.49,7.3,4.85,h*.98,stone);
    section(20,10.7,7.3,40,stone);
    for(const ratio of [.23,.47,.71,.9]){
      const r=7.45-ratio*2.5;
      section(h*ratio,r+1.1,r+.86,2.45,edge);
      section(h*ratio-2.1,r+.38,r+.92,2.3,stone);
    }
    section(h*.98,5.1,10.2,11,edge);
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5;
      const rib=new THREE.Mesh(new THREE.CylinderGeometry(.56,1.05,h*.82,5),edge);
      rib.position.set(Math.cos(a)*5.65,h*.47,Math.sin(a)*5.65);tower.add(rib);
    }
    group.add(tower);
  }
  shaft(-14,367,183,1);
  shaft(-242,316,164,1);
  shaft(188,-334,175,1.06);
  parent.add(group);
}

export function addCabinEnvironment(ctx) {
  const group=new THREE.Group();
  group.name='二十二层·湖与针叶林';
  ctx.scene.add(group);
  ctx.scene.fog=new THREE.FogExp2(0xbeced0,.0028);
  addDaylight(ctx,[-20,24,-18],false);
  addGround(ctx,group);
  addLake(ctx,group);
  addRidges(group,{radii:[215,309,458],bases:[-3,0,0],amplitudes:[42,79,121],
    colors:[0x738b77,0x899d9b,0xaabac2],seed:62});
  addFloorSupports(group);
  addPebbles(ctx,group);
  plantForest(ctx,group,groundHeight,shoreDistance);
  ctx.registerDetail({anchor:[0,0,-5],enter:72,exit:91,build:()=>plantMeadow(ctx,groundHeight,shoreDistance)});
  return group;
}
