import * as T from 'three'
import { addDaylight } from '../environment/common.js'
import { disposeObjects } from '../runtime/resources'
import { makeSquareGround } from './square.js'
import { makeAvenue } from './avenue.js'
import { makeStandards } from './standards.js'
import { makeTownHouses } from './houses.js'
import { makeTownLandmarks } from './landmarks.js'
import { makeMarketBase, makeMarketDetails } from './market.js'
import { makeTownHorizon } from './horizon.js'
import { makeTownBirds } from './pigeons.js'
import { makeDeliveries, makeDeliveryDetails } from './deliveries.js'
import { makeGlassworkBase, makeGlasswork } from './glaziers.js'

const views=[
  {id:'square',label:'钟楼广场',position:[-4.9,2.95,21.1],target:[.55,6.1,-13.1],fov:57},
  {id:'rooftops',label:'群屋与层缘',position:[42,32,52],target:[-1,10,-10],fov:55},
  {id:'fountain',label:'星盘泉池',position:[4.45,2.45,7.95],target:[-.25,2.25,-.2],fov:43},
  {id:'clock',label:'钟楼刻盘',position:[6.8,20.4,-17.5],target:[0,19.0,-33.5],fov:39},
  {id:'market',label:'制图师摊位',position:[6.1,2.15,15.3],target:[12.35,1.60,11.15],fov:45},
  {id:'chart',label:'图纸与量具',position:[10.45,2.22,10.65],target:[12.16,.98,11.00],fov:41},
  {id:'deliveries',label:'运货花车',position:[-7.65,2.14,15.2],target:[-10.63,.84,12.03],fov:42},
  {id:'doves',label:'石路晨鸽',position:[-6.15,.76,9.55],target:[-7.05,.14,8.0],fov:39},
  {id:'glasswork',label:'北廊花窗',position:[-23.90,1.51,-45.25],target:[-22.48,1.12,-47.92],fov:43}
]

function lightTown(ctx){
  const {scene,renderer}=ctx
  renderer.toneMappingExposure=1.0
  addDaylight(ctx,[-42,35,27],false)
  scene.fog=new T.FogExp2(0xb5c7cd,.00165)
  scene.add(new T.HemisphereLight(0xe1eafa,0xab8d76,.65))
  const sun=new T.DirectionalLight(0xffdb9e,2.60)
  sun.position.set(-42,36,25)
  sun.target.position.set(0,1,-6)
  sun.castShadow=true
  const size=Math.min(4096,renderer.capabilities.maxTextureSize)
  sun.shadow.mapSize.set(size,size)
  Object.assign(sun.shadow.camera,{left:-45,right:45,top:47,bottom:-45,near:.5,far:175})
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.normalBias=.034;sun.shadow.bias=-.00009
  sun.shadow.needsUpdate=true
  ctx.onDispose(()=>sun.shadow.dispose())
  scene.add(sun,sun.target)
}

export async function build(ctx){
  const {scene,camera,controls}=ctx
  camera.near=.05;camera.far=2400
  controls.minDistance=.26;controls.maxDistance=168
  controls.maxPolarAngle=Math.PI*.51
  ctx.report('正在拼合广场石路与街屋…')
  await new Promise(resolve=>requestAnimationFrame(resolve))
  if(ctx.signal.aborted) return {views}
  lightTown(ctx)
  scene.add(makeTownHorizon(),makeSquareGround(ctx.renderer),makeTownHouses(),makeAvenue(ctx))
  ctx.report('正在架设星盘、绸旗与集市…')
  await new Promise(resolve=>requestAnimationFrame(resolve))
  if(ctx.signal.aborted) return {views}
  const landmark=makeTownLandmarks(), birds=makeTownBirds(), glassBase=makeGlassworkBase()
  scene.add(landmark,birds,makeStandards(ctx),makeMarketBase(),makeDeliveries(),glassBase)
  ctx.onFrame(birds.userData.update)
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches) ctx.onFrame(landmark.userData.update)
  ctx.registerDetail({
    anchor:[12.2,1,11.1],enter:13,exit:19,
    build:makeMarketDetails,evict:root=>disposeObjects([root])
  })
  ctx.registerDetail({
    anchor:[-10.58,1,11.85],enter:11,exit:16,
    build:makeDeliveryDetails,evict:root=>disposeObjects([root])
  })
  ctx.registerDetail({
    anchor:[-22.7,1.12,-47.88],enter:10,exit:15,
    build:()=>makeGlasswork(glassBase),evict:root=>disposeObjects([root])
  })
  return {views}
}
