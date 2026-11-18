import * as T from 'three'
import { rng } from '../environment/common.js'

// Embroidered two-tailed standards. The visible pattern is painted once per dye.
function embroideredSilk(dye, time) {
  const cloth=document.createElement('canvas')
  cloth.width=256; cloth.height=512
  const c=cloth.getContext('2d'), random=rng(1168)
  c.fillStyle=dye; c.fillRect(0,0,256,512)
  for(let y=0;y<512;y+=2){
    c.fillStyle=y%4?'#fff2':'#201b211c'; c.fillRect(0,y,256,1)
  }
  for(let x=0;x<256;x+=2){
    c.fillStyle=random()>.5?'#e4c29420':'#2e263624'; c.fillRect(x,0,1,512)
  }
  c.strokeStyle='#ddbf77'; c.fillStyle='#e8ca82'
  for(const x of [12,19,237,244]) { c.lineWidth=x===19||x===237?1:3;c.beginPath();c.moveTo(x,0);c.lineTo(x,512);c.stroke() }
  c.translate(128,166)
  for(const r of [62,67]) { c.lineWidth=r===62?1.3:3;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke() }
  for(let k=0;k<8;k++){
    c.save();c.rotate(k*Math.PI/4)
    c.beginPath();c.moveTo(0,-55);c.quadraticCurveTo(2,-25,11,-16);c.lineTo(0,-7);c.lineTo(-11,-16);c.quadraticCurveTo(-2,-25,0,-55);c.fill()
    c.beginPath();c.arc(0,-77,2.4,0,Math.PI*2);c.fill();c.restore()
  }
  for(const sign of [-1,1]){
    c.save();c.scale(sign,1);c.lineWidth=2.1
    c.beginPath();c.moveTo(0,173);c.bezierCurveTo(66,136,76,92,59,69);c.stroke()
    for(let k=0;k<9;k++){
      const a=k/9,x=20+43*Math.sin(a*1.7),y=154-76*a
      c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+18,y-3,x+17,y-15);c.quadraticCurveTo(x+7,y-14,x,y);c.fill()
    }
    c.restore()
  }
  const texture=new T.CanvasTexture(cloth)
  texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8
  const silk=new T.MeshStandardMaterial({map:texture,roughness:.89,side:T.DoubleSide})
  silk.onBeforeCompile=shader=>{
    shader.uniforms.windTime=time
    shader.vertexShader='uniform float windTime;\n'+shader.vertexShader
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
      #include <beginnormal_vertex>
      float ripple=uv.x*5.+uv.y*4.+windTime*.82+modelMatrix[3].x;
      float hem=1.-uv.y;
      float slopeX=(.988*cos(uv.x*19.+.7)+.9*hem*cos(ripple))/1.2;
      float slopeY=.18*(-sin(ripple)+4.*hem*cos(ripple))/2.45;
      objectNormal=normalize(vec3(-slopeX,-slopeY,1.));
    `).replace('#include <begin_vertex>',`
      #include <begin_vertex>
      transformed.x+=.065*hem*sin(4.*uv.y+windTime*.65);
      transformed.z+=.052*sin(uv.x*19.+.7)+.18*hem*sin(ripple);
    `)
  }
  return silk
}

export function makeStandards(ctx) {
  const root=new T.Group()
  const bronze=new T.MeshStandardMaterial({color:0x8a704b,metalness:.68,roughness:.45})
  const oak=new T.MeshStandardMaterial({color:0x55443c,roughness:.9})
  const time={value:0}
  const ruby=embroideredSilk('#873f40',time), peacock=embroideredSilk('#37605e',time)
  const pole=new T.CylinderGeometry(.06,.09,5.6,10)
  const rail=new T.CylinderGeometry(.035,.035,1.57,10).rotateZ(Math.PI/2)
  const crown=new T.OctahedronGeometry(.14)
  const foot=new T.CylinderGeometry(.21,.29,.32,8)
  for(const [x,z,angle,mat] of [[-12,5,.10,ruby],[12,-4,-.14,peacock],[-12,-17,-.12,peacock],[12,-18,.16,ruby]]){
    const frame=new T.Group();frame.position.set(x,0,z);frame.rotation.y=angle
    function part(geometry,material,x,y) {
      const m=new T.Mesh(geometry,material);m.position.set(x,y,0);m.castShadow=m.receiveShadow=true;frame.add(m)
    }
    part(pole,oak,0,2.8);part(foot,bronze,0,.16);part(crown,bronze,0,5.74)
    const side=x>0?-1:1
    part(rail,bronze,side*.60,5.37)
    const fabric=new T.PlaneGeometry(1.2,2.45,16,24)
    const pos=fabric.attributes.position
    for(let i=0;i<pos.count;i++){
      const u=fabric.attributes.uv.getX(i), v=fabric.attributes.uv.getY(i)
      pos.setY(i,pos.getY(i)+.51*(1-Math.abs(2*u-1))*Math.pow(1-v,8))
    }
    const flag=new T.Mesh(fabric,mat);flag.position.set(side*.65,4.12,0);flag.receiveShadow=true;frame.add(flag)
    root.add(frame)
  }
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    ctx.onFrame(elapsed=>{time.value=elapsed})
  }
  return root
}
