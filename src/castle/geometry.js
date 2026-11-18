import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function polar(radius, angle, height = 0) {
  return new THREE.Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
}

// Profile points run up the outside and then back towards the centre. Each band has
// a sharp profile normal but a smooth circumference. UVs measure world metres.
export function turnProfile(profile, segments = 220, uvMetres = 42, start = 0, arc = TAU) {
  const positions = [], normals = [], uvs = [], indices = [];
  let along = 0;
  for (let j = 1; j < profile.length; j++) {
    const [r0, y0] = profile[j - 1], [r1, y1] = profile[j];
    const dr = r1-r0, dy = y1-y0, length = Math.hypot(dr,dy);
    if (length < 0.0001) continue;
    const offset = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = start + arc * i / segments;
      const sn = Math.sin(a), cs = Math.cos(a);
      for (let k = 0; k < 2; k++) {
        const r = k ? r1 : r0;
        positions.push(sn * r, k ? y1 : y0, cs * r);
        normals.push(sn * dy / length, -dr / length, cs * dy / length);
        uvs.push(i/segments * Math.max(1, Math.round(arc * (r0 + r1) * 0.5 / uvMetres)), (along + k * length) / uvMetres);
      }
      if (i < segments) {
        const v = offset + 2*i;
        indices.push(v, v+2,v+1, v+2,v+3,v+1);
      }
    }
    along += length;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals,3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  geom.setIndex(indices);
  return geom;
}

export function gabledRoof() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5,0); shape.lineTo(0,1); shape.lineTo(0.5,0); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});
  g.translate(0,0,-0.5);
  return g;
}
export function arcade() {
  const s = new THREE.Shape();
  s.moveTo(-0.5,0); s.lineTo(-0.5,1); s.lineTo(0.5,1); s.lineTo(0.5,0);
  s.lineTo(0.405,0); s.lineTo(0.405,0.38);
  s.quadraticCurveTo(0.402,0.64,0,0.91);
  s.quadraticCurveTo(-0.402,0.64,-0.405,0.38);
  s.lineTo(-0.405,0); s.closePath();
  const geom = new THREE.ExtrudeGeometry(s,{depth:1,bevelEnabled:false,curveSegments:6});
  geom.translate(0,0,-0.5);
  return geom;
}
export function lancet() {
  const s = new THREE.Shape();
  s.moveTo(-0.5,0); s.lineTo(0.5,0); s.lineTo(0.5,0.55); s.quadraticCurveTo(0.48,0.78,0,1);
  s.quadraticCurveTo(-0.48,0.78,-0.5,0.55); s.closePath();
  return new THREE.ShapeGeometry(s,5);
}
export function makeKit() {
  const cone = new THREE.ConeGeometry(0.5,1,8); cone.translate(0,0.5,0);
  const polygon4 = new THREE.ConeGeometry(0.70,1,4); polygon4.rotateY(Math.PI/4); polygon4.translate(0,0.5,0);
  const round = new THREE.CylinderGeometry(0.5,0.5,1,12);
  const low = new THREE.CylinderGeometry(0.5,0.5,1,8);
  const cards=[];
  for(let i=0;i<3;i++){
    const card=new THREE.PlaneGeometry(1,1);card.translate(0,.5,0);
    const uv=card.attributes.uv,normal=card.attributes.normal;
    for(let k=0;k<uv.count;k++){uv.setX(k,uv.getX(k)*0.5);normal.setXYZ(k,0,1,0);}
    card.rotateY(i*Math.PI/3);cards.push(card);
  }
  const spruce=mergeGeometries(cards);cards.forEach(g=>g.dispose());
  return {box:new THREE.BoxGeometry(1,1,1), column:round, drum:low, roof:gabledRoof(), cone,spruce,
    oculus:new THREE.CircleGeometry(.5,48),bead:new THREE.TorusGeometry(.5,.044,6,48),
    pinnacle:polygon4, arch:arcade(), window:lancet(), leaf:new THREE.IcosahedronGeometry(0.5,0)};
}

// Each distinct mesh/material pair is one instanced draw. The same geometry kit
// can be shared by distant representations and transient close-up sectors.
const dummy = new THREE.Object3D(), tint = new THREE.Color(), unitY = new THREE.Vector3(0,1,0);
export class Instances {
  constructor(kit, materials) {
    this.kit=kit; this.materials=materials; this.items=new Map();
  }
  add(form, mat, x,y,z, sx,sy,sz, yaw=0, color=0xffffff, roll=0, pitch=0) {
    dummy.position.set(x,y,z); dummy.rotation.set(pitch,yaw,roll,'YXZ');
    dummy.scale.set(sx,sy,sz); dummy.updateMatrix();
    this.write(form,mat,color);
  }
  at(form, mat, r,a,h,w,ht,d, color=0xffffff) {
    this.add(form,mat,Math.sin(a)*r,h,Math.cos(a)*r,w,ht,d,a,color);
  }
  beam(a,b,w,d,mat='metal',color=0xffffff) {
    const disp = new THREE.Vector3().subVectors(b,a);
    dummy.position.copy(a).addScaledVector(disp,0.5);
    dummy.quaternion.setFromUnitVectors(unitY,disp.clone().normalize());
    dummy.scale.set(w,disp.length(),d);dummy.updateMatrix();
    this.write('box',mat,color);
  }
  write(form,mat,color) {
    const key=form+'|'+mat;
    let item=this.items.get(key);
    if (!item) {item={form,mat,transforms:[],colors:[]};this.items.set(key,item);}
    for (const v of dummy.matrix.elements) item.transforms.push(v);
    tint.set(color);item.colors.push(tint.r,tint.g,tint.b);
  }
  finish(group, name='') {
    for (const {form,mat,transforms,colors} of this.items.values()) {
      const count=colors.length/3;
      const mesh = new THREE.InstancedMesh(this.kit[form],this.materials[mat],count);
      mesh.name=name+' '+mat+' '+form;
      mesh.instanceMatrix.array.set(transforms);
      mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(colors),3);
      mesh.computeBoundingSphere();
      mesh.castShadow=mat!=='light' && mat!=='glass';
      mesh.receiveShadow=mat!=='light' && mat!=='glass';
      group.add(mesh);
    }
    this.items.clear();
  }
}

export class Architecture {
  constructor(materials) { this.materials=materials;this.parts=new Map(); }
  add(mat,profile,segments=220,uvMetres=42) {
    this.append(mat,turnProfile(profile,segments,uvMetres));
  }
  append(mat,geometry) {
    if(!this.parts.has(mat))this.parts.set(mat,[]);
    this.parts.get(mat).push(geometry);
  }
  finish(group) {
    for(const [name,pieces] of this.parts) {
      const geometry=mergeGeometries(pieces,false);
      for(const piece of pieces) piece.dispose();
      const obj=new THREE.Mesh(geometry,this.materials[name]);
      obj.name='Architectural section · '+name; obj.castShadow=true; obj.receiveShadow=true;
      group.add(obj);
    }
    this.parts.clear();
  }
}
