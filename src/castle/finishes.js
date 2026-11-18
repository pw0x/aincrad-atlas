import * as THREE from 'three';

export function roofTile(anisotropy){
  const c=document.createElement('canvas');c.width=c.height=512;
  const g=c.getContext('2d');g.fillStyle='#555451';g.fillRect(0,0,512,512);
  let seed=211,rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let y=-1;y<9;y++)for(let x=-1;x<9;x++){
    const xx=x*64+(y%2?32:0),yy=y*64,v=Math.floor(125+rand()*56);
    const grad=g.createLinearGradient(0,yy,0,yy+70);
    grad.addColorStop(0,'rgb('+(v-35)+','+(v-35)+','+(v-38)+')');
    grad.addColorStop(.8,'rgb('+v+','+(v+1)+','+(v+2)+')');
    grad.addColorStop(1,'rgb('+(v-8)+','+(v-8)+','+(v-9)+')');
    g.fillStyle=grad;g.strokeStyle='#575956';g.lineWidth=2;
    g.beginPath();g.moveTo(xx,yy-7);g.lineTo(xx+63,yy-7);g.lineTo(xx+62,yy+54);
    g.quadraticCurveTo(xx+52,yy+68,xx+31,yy+68);g.quadraticCurveTo(xx+10,yy+68,xx+1,yy+53);g.closePath();g.fill();g.stroke();
    g.strokeStyle='rgba(218,223,213,.32)';g.lineWidth=1;
    g.beginPath();g.moveTo(xx+2,yy+4);g.lineTo(xx+2,yy+50);g.quadraticCurveTo(xx+4,yy+58,xx+12,yy+61);g.stroke();
  }
  const pix=g.getImageData(0,0,512,512);
  for(let i=0;i<pix.data.length;i+=4){
    const a=(rand()-.5)*18;
    for(let k=0;k<3;k++)pix.data[i+k]+=a;
  }
  g.putImageData(pix,0,0);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=anisotropy;
  return t;
}

// World-space mapping keeps the physical block and shingle sizes consistent on
// towers, stretched roof panels and metre-scale houses sharing one material.
export function finishInWorld(material,map,metres,gain,lift) {
  material.map=map;
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vFacadeWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec4 facadePoint=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        facadePoint=instanceMatrix*facadePoint;
      #endif
      vFacadeWorld=(modelMatrix*facadePoint).xyz;
      #include <project_vertex>`);
    shader.fragmentShader='varying vec3 vFacadeWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 ws = vFacadeWorld / ${metres.toFixed(3)};
      vec3 planeWeight=abs(normalize(cross(dFdx(vFacadeWorld),dFdy(vFacadeWorld))));
      planeWeight=pow(planeWeight,vec3(4.0));
      planeWeight/=max(.001,dot(planeWeight,vec3(1.)));
      vec3 pattern=texture2D(map,ws.zy).rgb*planeWeight.x+texture2D(map,ws.xz).rgb*planeWeight.y+texture2D(map,ws.xy).rgb*planeWeight.z;
      float value=dot(pattern,vec3(.299,.587,.114));
      diffuseColor.rgb*=clamp(${lift.toFixed(3)}+${gain.toFixed(3)}*value,.20,1.48);
    `);
  };
  material.customProgramCacheKey=()=>['metric',metres,gain,lift].join('/');
}

export function roseGlassMap(anisotropy){
  const c=document.createElement('canvas');c.width=c.height=512;
  const g=c.getContext('2d'),colours=['#753a51','#5c7790','#974e54','#d5a469','#4b7589','#7e7080'];
  g.fillStyle='#293742';g.fillRect(0,0,512,512);g.translate(256,256);
  for(let i=0;i<12;i++){
    g.save();g.rotate(i*Math.PI/6);
    for(let j=0;j<3;j++){
      const near=38+j*58,far=near+66;
      g.fillStyle=colours[(i*3+j)%colours.length];g.strokeStyle='#323c41';g.lineWidth=5;
      g.beginPath();g.moveTo(near,0);g.quadraticCurveTo(near+22,-28,far,0);g.quadraticCurveTo(near+22,28,near,0);g.fill();g.stroke();
    }
    g.restore();
  }
  for(const radius of [38,102,165,222,245]){
    g.strokeStyle='#ae9b76';g.lineWidth=radius===245?11:3;g.beginPath();g.arc(0,0,radius,0,Math.PI*2);g.stroke();
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=anisotropy;return t;
}
