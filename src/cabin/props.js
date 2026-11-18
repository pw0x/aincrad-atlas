import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Kit,random } from './kit.js';
import { beam } from './shell.js';
import { pot,flowers,sprig } from './interior.js';

const assets = import.meta.glob('./assets/*.glb',{query:'?url',import:'default',eager:true});
const rng=random(93336);

function lantern(k,m,x,y,z,scale=1) {
  const dim=.15*scale,h=.29*scale;
  k.stick(m.iron,[x,y+.29*scale,z],[x,y+.49*scale,z],.012*scale);
  k.lathe(m.iron,[[0,0],[.19,.015],[.177,.044],[.11,.054],[0,.055]],x,y-.16*scale,z,[scale,scale,scale],8);
  k.lathe(m.iron,[[.01,.17],[.16,.166],[.178,.184],[.082,.26],[.039,.275],[0,.289]],x,y,z,[scale,scale,scale],8);
  const glow=new T.MeshStandardMaterial({color:0xffcd84,emissive:0xfbb451,emissiveIntensity:.58,roughness:.73});
  k.put(k.cylinder(.88,.74,8),glow,[x,y+.022*scale,z],[dim,h,dim]);
  for(let i=0;i<8;i++){const a=i*.785;k.stick(m.iron,[x+Math.cos(a)*dim*.75,y-.12*scale,z+Math.sin(a)*dim*.75],[x+Math.cos(a)*dim*.89,y+.17*scale,z+Math.sin(a)*dim*.89],.009*scale);}
}
function barrel(k,m,x,y,z,s=1){
  k.lathe(m.oak,[[.01,0],[.23,.008],[.245,.075],[.28,.23],[.285,.35],[.28,.47],[.244,.65],[.22,.70],[.01,.70]],x,y,z,[s,s,s],20);
  for(const h of [.065,.145,.56,.64])k.ring(m.iron,x,y+h*s,z,(h<.10||h>.62?.246:.263)*s,.012*s);
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8,co=Math.cos(a),si=Math.sin(a);
    k.tube(m.edge,[[x+co*.245*s,y+.05*s,z+si*.245*s],[x+co*.285*s,y+.35*s,z+si*.285*s],[x+co*.245*s,y+.65*s,z+si*.245*s]],.003*s,10);
  }
}
function woodpile(k,m){
  for(let layer=0;layer<3;layer++)for(let n=0;n<6-layer;n++){
    const x=4.87+layer*.04,y=.08+layer*.143,z=.52+n*.177+layer*.079;
    k.stick(m.log[(n+layer)%5],[x-.32,y,z],[x+.38,y,z+.015],.085,.078,11);
    k.disc(m.end,[x+.381,y,z+.015],[1,0,0],.081);
  }
}
function creel(k,m,x,y,z){
  // A rattan creel is woven around a slightly tapered elliptical frame.
  const rings=16,staves=25;
  for(let j=0;j<rings;j++){
    const t=j/(rings-1),rx=.171+.054*Math.sin(t*2.55),rz=.118+.039*Math.sin(t*2.60),points=[];
    for(let i=0;i<=100;i++){const a=i/100*Math.PI*2,wave=.0053*Math.cos(a*staves+(j%2)*Math.PI);
      points.push([x+(rx+wave)*Math.cos(a),y+.04+t*.282,z+(rz+wave)*Math.sin(a)]);}
    k.tube(j%3===0?m.gold:m.case,points,.0079,100);
  }
  for(let i=0;i<staves;i++){
    const a=i/staves*6.28318;
    k.tube(m.oak,[[x+.171*Math.cos(a),y+.039,z+.118*Math.sin(a)],[x+.222*Math.cos(a),y+.175,z+.156*Math.sin(a)],[x+.201*Math.cos(a),y+.326,z+.138*Math.sin(a)]],.0068,10);
  }
  k.tube(m.case,[[x-.185,y+.31,z],[x-.138,y+.540,z],[x+.078,y+.57,z],[x+.189,y+.31,z]],.0145,26);
}
function fishingTackle(k,m){
  const ax=-1.34,az=-4.36;
  creel(k,m,ax,.568,az);
  const path=[[-1.94,.58,-4.62],[-2.04,1.05,-4.72],[-2.17,1.77,-4.87],[-2.29,2.27,-5.01],[-2.39,2.60,-5.12]];
  for(let i=1;i<path.length;i++)k.stick(i<2?m.oak:m.case,path[i-1],path[i],.017-i*.002,.023-i*.002);
  k.tube(m.linen,[path.at(-1),[-2.395,2.07,-5.14],[-2.392,1.54,-5.15],[-2.39,1.19,-5.145]],.0015,12);
  k.ell(m.red,-2.39,1.18,-5.145,.012,.026,.012);
}
function roofPlants(k,m){
  const greens=[m.leaf2,m.leaf,m.herb];
  for(const [x,z,height] of [[-2.21,-1.13,.57],[1.68,.84,.39],[2.34,-.82,.25]]){
    const y=5.90-Math.abs(z)*(2/3.85);
    k.stick(m.oak,[x,y+.015,z],[x+.013,y+height,z],.007,.015,8);
    for(let branch=0;branch<18;branch++){
      const t=branch/18,angle=branch*2.399,l=(1-t)*height*.32+.014,yy=y+.06+t*height*.82;
      const tip=[x+Math.cos(angle)*l,yy+.035,z+Math.sin(angle)*l];
      k.stick(m.leaf2,[x,yy,z],tip,.003,.005,6);
      for(let j=1;j<=4;j++){const u=j/4; k.ell(greens[(j+branch)%2],x+Math.cos(angle)*l*u,yy+.021+u*.045,z+Math.sin(angle)*l*u,.019*(1-.6*t),.038*(1-.55*t),.014,[.35,angle,.32]);}
    }
    for(let i=0;i<15;i++){const a=i*2.39,spread=.14*rng();
      k.ell(greens[i%3],x+Math.cos(a)*spread,y+.013,z+Math.sin(a)*spread,.07*rng()+.035,.013,.068,[.26,z<0?0:.8,0]);}
  }
  for(let i=0;i<53;i++){
    const x=-4.74+rng()*.17,z=-3.30+rng()*6.48,y=.445+rng()*.63;
    k.ell(m.leaf2,x,y,z,.023,.031+rng()*.042,.049+rng()*.073,[0,.25,(rng()-.5)]);
  }
}
export function exterior(m){
  const k=new Kit('22F • lakeside porch fittings and closed wood pile');
  for(const [x,w] of [[-2.34,2.78],[.83,1.77]]){
    k.box(m.edge,x,1.236,-3.81,w,.262,.36);
    for(const side of [-1,1]){k.box(m.case,x,1.368,-3.81+side*.164,w+.05,.055,.06);k.box(m.iron,x+side*w*.36,1.20,-3.999,.047,.32,.025);}
    for(let j=0;j<Math.floor(w*7);j++){
      const xx=x-w*.45+j*.141,zz=-3.79+(rng()-.5)*.16;
      const h=.30+rng()*.21;const a=rng()*6.28;
      k.stick(m.leaf2,[xx,1.36,zz],[xx+Math.cos(a)*.08,1.36+h*.69,zz+Math.sin(a)*.06],.007);
      for(let s=0;s<4;s++){const angle=a+s*1.57;k.ell(s%2?m.leaf:m.leaf2,xx+Math.cos(angle)*.048,1.39+(s%2)*.059,zz+Math.sin(angle)*.041,.049,.105,.025,[.65,angle,.42]);}
      if(j%2!==1)flowers(k,m,xx,1.37,zz,4,.59);
    }
  }
  woodpile(k,m);fishingTackle(k,m);roofPlants(k,m);
  barrel(k,m,-4.00,.571,-4.49,1.24);barrel(k,m,-3.39,.571,-4.14,.75);
  k.box(m.oak,-1.58,.96,-4.130,1.92,.12,.40,undefined,true);
  for(const xx of [-2.31,-.86]){k.box(m.oak,xx,.75,-4.13,.128,.40,.32);k.box(m.case,xx,1.15,-3.98,.087,.61,.084);}
  k.box(m.pine,-1.58,1.39,-3.98,1.84,.13,.079);
  lantern(k,m,3.995,2.50,-3.87,.9);beam(k,m.iron,[3.995,2.90,-3.57],[3.995,2.92,-3.89],.055,.06);
  pot(k,m,4.09,.573,-4.51,.19,.32,m.brown);flowers(k,m,4.09,.835,-4.51,16,1.39);
  return k.finish();
}
function wedge(k,m,x,y,z){
  const shape=new T.Shape();shape.moveTo(-.083,-.06);shape.lineTo(.105,.008);shape.quadraticCurveTo(.061,.098,-.085,.079);shape.closePath();
  for(const [px,py,r] of [[-.043,-.019,.009],[.016,.012,.007],[-.055,.041,.006]]){
    const hole=new T.Path();hole.absellipse(px,py,r,r*.78,0,Math.PI*2,true,0);shape.holes.push(hole);
  }
  const geo=new T.ExtrudeGeometry(shape,{depth:.052,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:1,steps:1});
  k.put(geo,m.glaze,[x,y,z],[.79,.79,.70],[-Math.PI/2,.04,.32]);
  for(let i=0;i<4;i++)k.ell(m.gold,x-.016+i*.018,y+.053,z-.01-(i%2)*.018,.004,.001,.005);
}
function garnish(k,m,x,y,z){
  for(let i=0;i<5;i++){
    const a=i*1.32,cx=x+Math.cos(a)*.035,cz=z+Math.sin(a)*.032;
    const shape=new T.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(-.017,.031,0,.061);shape.quadraticCurveTo(.018,.027,0,0);
    k.put(new T.ShapeGeometry(shape,7),i%2?m.leaf:m.leaf2,[cx,y+.012+i*.001,cz],[1,1,1],[-Math.PI/2+.09,0,a]);
    k.stick(m.herb,[cx,y+.014+i*.001,cz],[cx-Math.sin(a)*.044,y+.016+i*.001,cz-Math.cos(a)*.044],.0009);
  }
  for(let i=0;i<3;i++)k.ell(m.red,x+.015*i,y+.027,z+.011*i,.013,.012,.012);
}
function place(src,x,y,z,height,angle=0,rootAtStem=false){
  const clone=src.clone(true);clone.position.set(0,0,0);clone.rotation.y=angle;clone.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(clone),center=box.getCenter(new T.Vector3()),factor=height/(box.max.y-box.min.y);
  if(rootAtStem){
    let count=0,cx=0,cz=0;
    const p=new T.Vector3(),threshold=box.min.y+(box.max.y-box.min.y)*.05;
    clone.traverse(obj=>{if(!obj.isMesh)return;const attr=obj.geometry.attributes.position;
      for(let i=0;i<attr.count;i++){p.fromBufferAttribute(attr,i).applyMatrix4(obj.matrixWorld);
        if(p.y<threshold){count++;cx+=p.x;cz+=p.z;}}
    });
    if(count){center.x=cx/count;center.z=cz/count;}
  }
  const group=new T.Group();group.add(clone);clone.position.set(-center.x,-box.min.y,-center.z);group.scale.setScalar(factor);group.position.set(x,y,z);
  clone.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=true;}});
  return group;
}
export function detailRegions(ctx,m){
  const cache=new Map(),loader=new GLTFLoader();
  function scan(slug){
    if(!cache.has(slug))cache.set(slug,loader.loadAsync(assets['./assets/'+slug+'.glb']).then(g=>g.scene));
    return cache.get(slug);
  }
  const region=(anchor,enter,exit,build)=>ctx.registerDetail({anchor,enter,exit,build});
  region([-.3,1.49,-1.08],7.2,10,async()=>{
    const [apple,pears,bowl,jug,flower]=await Promise.all(['food_apple_01','food_pears_asian_01','wooden_bowl_01','jug_01','flower_heliophila'].map(scan));
    const group=new T.Group();group.name='Close detail • breakfast for two, carved earthenware and fruit skins';
    group.add(place(bowl,-.66,1.495,-1.56,.115,.46),place(pears,-.67,1.535,-1.57,.135,.20),place(apple,-.54,1.544,-1.51,.114,-1.72),
      place(apple,-.90,1.493,-1.48,.112,.25),place(jug,.986,1.481,-1.395,.295,-.68));
    const bouquet=flower.getObjectByName('flower_heliophila_medium')??flower;
    group.add(place(bouquet,-.25,1.63,-1.45,.35,.69,true));
    const kit=new Kit('Serving and garnish');
    wedge(kit,m,-.986,1.506,-.676);wedge(kit,m,.49,1.506,-1.38);
    garnish(kit,m,-.898,1.505,-.726);garnish(kit,m,.59,1.506,-1.31);
    group.add(kit.finish());return group;
  });
  region([-3.9,1.65,-2.2],6.5,9.5,async()=>{
    const [bronze,ceramic,wood]=await Promise.all(['brass_pot_01','ceramic_pot','wooden_candlestick'].map(scan));
    const group=new T.Group();group.name='Close detail • hammered brass, handled pantry crock and turned candlestick';
    group.add(place(bronze,-3.91,1.363,-2.76,.292,.15),place(ceramic,-3.92,1.363,-2.045,.245,1.57),
      place(wood,-3.75,2.636,.325,.25,-.25));
    const k=new Kit('Mantel candle');k.stick(m.wax,[-3.75,2.87,.325],[-3.75,2.991,.325],.024);
    group.add(k.finish());return group;
  });
}
function wisps(ctx,x,y,z,count,span,wind,size,alpha){
  const geo=new T.BufferGeometry(),coordinates=[],seeds=[];
  for(let i=0;i<count;i++){coordinates.push(0,0,0);seeds.push(i/count,rng(),rng());}
  geo.setAttribute('position',new T.Float32BufferAttribute(coordinates,3));geo.setAttribute('seed',new T.Float32BufferAttribute(seeds,3));
  const uniforms={clock:{value:0},height:{value:1},span:{value:span},wind:{value:wind},size:{value:size},alpha:{value:alpha}};
  const shader=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
    vertexShader:`attribute vec3 seed;uniform float clock,height,span,wind,size;varying float life;varying float shift;
      void main(){life=fract(seed.x+clock*(.08+.03*seed.y));shift=seed.z;
        vec3 p=position+vec3(wind*life*life+size*.36*sin(seed.y*16.+life*6.)*life,span*life,size*.21*cos(seed.z*19.+life*11.)*life);
        vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(size*(.25+life)*height*projectionMatrix[1][1]/(-2.*view.z),1.,240.);
      }`,fragmentShader:`uniform float alpha;varying float life;varying float shift;void main(){
        vec2 p=gl_PointCoord*2.-1.;float d=length(p)+.064*sin(p.x*10.+shift*7.)*sin(p.y*8.-life*3.);
        float a=(1.-smoothstep(.0,1.,d))*smoothstep(0.,.16,life)*(1.-smoothstep(.32,1.,life))*alpha;gl_FragColor=vec4(.83,.85,.80,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const obj=new T.Points(geo,shader);obj.position.set(x,y,z);obj.frustumCulled=false;
  ctx.onFrame(t=>{uniforms.clock.value=t;uniforms.height.value=ctx.renderer.domElement.height;});
  return obj;
}
export function accents(ctx,m){
  const k=new Kit('22F • hearth lantern and fine furnishings');
  lantern(k,m,-1.93,2.97,-.95,.70);
  k.stick(m.iron,[-1.93,3.31,-.95],[-1.93,4.87,-.95],.008);
  const group=k.finish();
  const fire=new T.Group();
  const flameGeometry=new T.PlaneGeometry(1,1,7,16),flameTime={value:0};
  const flameMaterial=new T.ShaderMaterial({
    uniforms:{clock:flameTime},
    transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
    vertexShader:`uniform float clock;varying vec2 st;varying float phase;
      void main(){st=uv;vec4 center=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
        phase=fract(sin(dot(center.xyz,vec3(12.21,74.5,35.0)))*4373.);
        float p=phase*6.283,t=clock*(3.2+2.*phase),h=uv.y;
        vec3 v=position;v.x+=sin(h*7.-t*1.7+p)*h*h*.28+sin(t+p)*h*.13;
        v.y=(position.y+.5)*(.84+.13*sin(t+p)+.055*cos(t*1.83+p))-.5;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(v,1.);
      }`,
    fragmentShader:`uniform float clock;varying vec2 st;varying float phase;
      void main(){float y=st.y,p=phase*6.283,t=clock*(3.2+2.*phase);
        float center=.5+.13*sin(y*7.-t+p)*y,dx=abs(st.x-center);
        float width=.41*pow(max(.001,1.-y),.72)*(.88+.13*sin(y*10.+t+p));
        float mask=(1.-smoothstep(.50,1.,dx/max(width,.001)))*smoothstep(0.,.11,y)*(1.-smoothstep(.77,1.,y));
        float core=(1.-smoothstep(.08,.79,dx/max(width,.001)))*(1.-smoothstep(.22,.82,y));
        vec3 color=mix(vec3(.76,.115,.018),vec3(1.,.65,.19),core);
        gl_FragColor=vec4(color,mask*(.47+.29*core));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const flames=new T.InstancedMesh(flameGeometry,flameMaterial,18),dummy=new T.Object3D();
  for(let i=0;i<18;i++){
    const h=.105+rng()*.13;dummy.position.set(-3.80+rng()*.22,.795+h*.5,-.54+rng()*.68);
    dummy.rotation.set(0,Math.PI*.35+rng()*1.64,0);dummy.scale.set(.068+rng()*.068,h,1);dummy.updateMatrix();flames.setMatrixAt(i,dummy.matrix);
  }
  flames.computeBoundingSphere();fire.add(flames);
  group.add(fire,wisps(ctx,-4.07,6.59,-.18,36,2.24,.91,1.03,.14),wisps(ctx,-.63,1.60,-.89,13,.32,.07,.108,.11));
  const light=new T.PointLight(0xffa76d,2.7,5.6,2);light.position.set(-3.45,1.13,-.15);group.add(light);
  // Dust within the light at the lake window, drawn as a single transparent points object.
  const geo=new T.BufferGeometry(),count=59,coords=new Float32Array(count*3);
  const orig=new Float32Array(count*3);
  for(let i=0;i<count;i++){orig[3*i]=-3.64+rng()*5.20;orig[3*i+1]=.70+rng()*2.37;orig[3*i+2]=-3.29+rng()*2.47;}
  coords.set(orig);geo.setAttribute('position',new T.BufferAttribute(coords,3));
  const particle=new T.Points(geo,new T.PointsMaterial({color:0xffefc6,size:.009,transparent:true,opacity:.39,depthWrite:false}));
  group.add(particle);ctx.onFrame((t)=>{
    const inside=ctx.camera.position.distanceToSquared(light.position)<170;
    fire.visible=inside;particle.visible=inside;if(!inside)return;
    flameTime.value=t;
    light.intensity=2.45+.20*Math.sin(t*5)+.09*Math.sin(t*3.7);
    for(let i=0;i<count;i++){coords[3*i]=orig[3*i]+.032*Math.sin(t*.12+i);coords[3*i+1]=orig[3*i+1]+.046*Math.sin(t*.2+i*.71);}
    geo.attributes.position.needsUpdate=true;
  });
  return group;
}
