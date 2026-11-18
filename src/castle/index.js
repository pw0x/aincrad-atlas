import * as THREE from 'three';
import {addCastleEnvironment} from '../environment/castle.js';
import {Architecture,Instances,makeKit} from './geometry.js';
import {createMaterials} from './materials.js';
import {buildFoundation,buildSpokes} from './foundation.js';
import {buildTiers} from './tiers.js';
import {buildDistricts,galleryView} from './districts.js';
import {buildPalace,palaceView,registerRoyalCourt} from './palace.js';
import {buildLandforms} from './landforms.js';

function lightCastle(ctx) {
  const {scene,renderer}=ctx;
  scene.add(new THREE.HemisphereLight(0xd8e5f4,0x92918b,1.09));
  const sun=new THREE.DirectionalLight(0xffe9c8,2.9);
  sun.target.position.set(0,1800,0);
  sun.position.set(-11600,11500,6250);
  sun.castShadow=true;
  const dim=Math.min(4096,renderer.capabilities.maxTextureSize);
  sun.shadow.mapSize.set(dim,dim);
  Object.assign(sun.shadow.camera,{left:-8050,right:8050,top:7800,bottom:-7800,near:600,far:32600});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=-0.00009;
  sun.shadow.normalBias=4;
  sun.shadow.radius=2.4;
  sun.shadow.autoUpdate=false;
  sun.shadow.needsUpdate=true;
  let children=-1;
  ctx.onFrame(()=>{
    if(children!==scene.children.length){children=scene.children.length;sun.shadow.needsUpdate=true;}
  });
  scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight(0xaac2d6,0.56);
  fill.position.set(5000,4700,-6500);
  scene.add(fill);
}

const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(resolve));

export async function build(ctx) {
  const {scene,camera,controls}=ctx;
  const group=new THREE.Group();
  group.name='Aincrad · exterior master';
  scene.add(group);
  const hero={id:'overview',label:'浮游城全景',position:[13300,5150,16300],target:[0,2250,0],fov:33.5};
  camera.near=2.5;camera.far=180000;
  camera.position.fromArray(hero.position);camera.fov=hero.fov;camera.updateProjectionMatrix();
  controls.target.fromArray(hero.target);
  controls.minDistance=9;controls.maxDistance=62000;
  controls.maxPolarAngle=Math.PI*0.96;
  controls.update();
  addCastleEnvironment(ctx);
  lightCastle(ctx);
  const kit=makeKit(),materials=createMaterials(ctx.renderer);
  const architecture=new Architecture(materials),pieces=new Instances(kit,materials);
  ctx.report('正在构筑悬岩与百层外廊…');
  await nextPaint();
  if(ctx.signal.aborted)return {views:[hero]};
  buildFoundation(group,architecture,pieces,materials);
  buildSpokes(pieces,architecture);
  buildTiers(architecture,pieces);
  buildLandforms(group,pieces,materials);
  buildPalace(architecture,pieces);
  architecture.finish(group);pieces.finish(group,'Great shell');
  ctx.report('正在布置环城街区和红玉宫…');
  await nextPaint();
  if(ctx.signal.aborted)return {views:[hero]};
  buildDistricts(ctx,group,kit,materials);
  registerRoyalCourt(ctx,kit,materials);
  return {title:'艾因格朗特', views:[
    hero,
    {id:'outer-arms',label:'悬空城翼',position:[2650,1550,9020],target:[-1200,490,5100],fov:52},
    galleryView(),
    palaceView(),
    {id:'keel',label:'悬岩仰望',position:[8060,-1270,9480],target:[0,750,0],fov:47}
  ]};
}
