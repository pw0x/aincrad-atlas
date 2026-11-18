import * as T from 'three';
import { addCabinEnvironment } from '../environment/cabin.js';
import { palette } from './kit.js';
import { architecture } from './shell.js';
import { furnishings } from './interior.js';
import { exterior,detailRegions,accents } from './props.js';
import { addJournal,journalView } from './journal.js';

const views=[
  {id:'room',label:'湖窗餐室',position:[3.67,2.27,2.49],target:[-.91,1.85,-2.18],fov:51},
  {id:'breakfast',label:'两人餐桌',position:[1.71,2.15,.316],target:[-.43,1.59,-1.19],fov:35},
  {id:'porch',label:'林间门廊',position:[9.6,4.08,-13.7],target:[-.27,2.43,-.80],fov:43},
  {id:'hearth',label:'石砌炉边',position:[-.57,2.02,.81],target:[-3.81,1.77,-.87],fov:43},
  {id:'carving',label:'门扉细工',position:[1.79,2.20,-5.39],target:[3.12,1.88,-3.69],fov:43},
  {id:'lakeshore',label:'隔湖回望',position:[12.1,2.14,-32.0],target:[-.24,2.05,-1.10],fov:34}
];
function lighting(ctx){
  const {scene,renderer}=ctx;
  renderer.toneMappingExposure=1.02;
  const sky=new T.HemisphereLight(0xe4edf0,0x947a65,.80);
  scene.add(sky);
  const sun=new T.DirectionalLight(0xffe6bf,2.8);
  sun.position.set(-20,24,-18);sun.target.position.set(0,1,0);
  sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
  Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:12,far:61});
  sun.shadow.normalBias=.013;sun.shadow.bias=-.00016;sun.shadow.radius=2.2;
  sun.shadow.camera.updateProjectionMatrix();scene.add(sun,sun.target);
  const windowFill=new T.SpotLight(0xffe6c4,18,11,Math.PI*.37,.88,1.55);
  windowFill.position.set(-2.41,3.14,-3.40);windowFill.target.position.set(-.55,1.14,-.47);
  scene.add(windowFill,windowFill.target);
  const lakeBounce=new T.PointLight(0xc1d6d3,3.5,7.8,2);lakeBounce.position.set(1.75,2.51,-2.74);scene.add(lakeBounce);
  const slant=new T.SpotLight(0xffd79b,425,25,.40,.63,1.82);
  slant.position.set(-7.7,4.3,-12.77);slant.target.position.set(-.33,1.18,-.45);
  slant.castShadow=true;slant.shadow.mapSize.set(2048,2048);slant.shadow.bias=-.00015;slant.shadow.normalBias=.006;
  slant.shadow.camera.near=.3;slant.shadow.camera.far=26;
  scene.add(slant,slant.target);ctx.onDispose(()=>slant.shadow.dispose());
  // The shell and cookware are static. A streaming-region attachment dirties both fixed shadow maps.
  sun.shadow.autoUpdate=false;slant.shadow.autoUpdate=false;
  const refreshShadows=()=>{sun.shadow.needsUpdate=true;slant.shadow.needsUpdate=true;};
  refreshShadows();
  scene.addEventListener('childadded',refreshShadows);scene.addEventListener('childremoved',refreshShadows);
  ctx.onDispose(()=>{scene.removeEventListener('childadded',refreshShadows);scene.removeEventListener('childremoved',refreshShadows);});
  const rearBounce=new T.PointLight(0xf9dab5,4.0,6.8,2);rearBounce.position.set(.77,3.7,.75);scene.add(rearBounce);
  ctx.onDispose(()=>{sun.shadow.dispose();});
}
function contactShadows(ctx){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const c=canvas.getContext('2d');const gradient=c.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(38,28,23,.47)');gradient.addColorStop(.37,'rgba(38,28,23,.36)');gradient.addColorStop(.72,'rgba(38,28,23,.10)');gradient.addColorStop(1,'rgba(38,28,23,0)');
  c.fillStyle=gradient;c.fillRect(0,0,128,128);
  const tx=new T.CanvasTexture(canvas);tx.colorSpace=T.SRGBColorSpace;
  const mat=new T.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const geo=new T.PlaneGeometry(1,1);const placements=[[-.29,.619,-1.04,3.02,3.02],[-.97,.622,.55,.73,.65],[.46,.622,-2.58,.73,.65],[-3.76,.607,-.18,1.57,2.83],
    [-3.98,.607,-2.38,1.15,1.97],[-1.25,1.483,-1.38,.73,.41],[.99,1.485,-1.40,.30,.27],[-.66,1.484,-1.56,.40,.41],[-.25,1.501,-1.45,.22,.16],
    [.09,1.500,-.92,.43,.41],[-.95,1.483,-.68,.53,.51],[.51,1.483,-1.38,.53,.50]];
  for(const x of [-1.13,.55])for(const z of [-.40,-1.68])placements.push([x,.623,z,.42,.34]);
  const mesh=new T.InstancedMesh(geo,mat,placements.length),obj=new T.Object3D();
  placements.forEach(([x,y,z,w,d],i)=>{obj.position.set(x,y,z);obj.rotation.x=-Math.PI/2;obj.scale.set(w,d,1);obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);});
  mesh.name='Baked soft contacts below timber legs and tableware';mesh.computeBoundingSphere();mesh.renderOrder=1;ctx.scene.add(mesh);
}
export async function build(ctx){
  ctx.report('正在铺设原木、织物与餐桌…');
  const mat=await palette(Math.min(16,ctx.renderer.capabilities.getMaxAnisotropy()));
  if(ctx.signal.aborted)return {views};
  mat.table.color.setRGB(1.06,1.02,.92);
  mat.case.color.setRGB(.93,.86,.77);
  mat.pine.color.setRGB(1.14,1.07,.94);
  mat.oak.color.setRGB(.75,.68,.60);
  addCabinEnvironment(ctx);
  lighting(ctx);
  ctx.scene.add(architecture(mat),exterior(mat),furnishings(mat),accents(ctx,mat));
  contactShadows(ctx);detailRegions(ctx,mat);addJournal(ctx);
  const {camera,controls}=ctx;
  camera.near=.024;camera.far=2500;camera.updateProjectionMatrix();
  controls.minDistance=.18;controls.maxDistance=225;controls.maxPolarAngle=Math.PI*.935;
  return {views:[...views,journalView]};
}
