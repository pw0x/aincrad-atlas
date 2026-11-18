import * as THREE from 'three';
import { addDaylight, addRidges, rng } from './common.js';

const densityURL = new URL('./assets/cloud-density.bin', import.meta.url).href;

function addCloudOcean(ctx, group) {
  const uniforms = {
    densityMap: { value: null }, loaded: { value: 0 }, seconds: { value: 0 },
    lightDirection: { value: new THREE.Vector3(-.68,.72,.38).normalize() }
  };
  const shader = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms,
    vertexShader: `
      varying vec3 vWorld;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vWorld = (modelMatrix * vec4(position,1.)).xyz;
        vec4 mvPosition = viewMatrix * vec4(vWorld,1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      precision highp sampler3D;
      uniform sampler3D densityMap;
      uniform vec3 lightDirection;
      uniform float seconds, loaded;
      varying vec3 vWorld;
      #include <common>
      #include <logdepthbuf_pars_fragment>

      float weather(vec3 p) {
        vec3 q = (p + vec3(seconds*6.,0.,seconds*.9)) * .000049;
        float coarse = texture(densityMap, q).r;
        float detail = texture(densityMap, q*3.09 + vec3(.37,.44,.26)).r;
        float top = -1570. + (coarse-.48)*4600. + (detail-.49)*1040.;
        float upper = clamp((top-p.y)*.0025, 0.,1.);
        float lower = smoothstep(-4580.,-3410.,p.y);
        float cover = smoothstep(.22,.48,coarse + detail*.22);
        return cover * upper * lower;
      }
      void main() {
        #include <logdepthbuf_fragment>
        if (loaded < .5) discard;
        vec3 ray = normalize(vWorld-cameraPosition);
        float dy = abs(ray.y)<.00005 ? .00005 : ray.y;
        float t1 = (-4620.-cameraPosition.y)/dy, t2 = (.0-cameraPosition.y)/dy;
        float start = max(0.,min(t1,t2)), end = min(96000.,max(t1,t2));
        if (end <= start) discard;
        float stepLen = min(5000.,(end-start)/30.);
        float t = start + stepLen*(.22+.56*fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))));
        vec3 sum = vec3(0.);
        float transmit = 1.;
        vec3 shade = vec3(.13,.23,.40), sunlit = vec3(1.16,1.15,1.12);
        for (int i=0; i<30; i++) {
          vec3 p = cameraPosition + ray*t;
          float den = weather(p);
          if (den > .012) {
            float blockage = .54*weather(p+lightDirection*460.) + .46*weather(p+lightDirection*1160.);
            float openness = clamp(1.-blockage,0.,1.);
            float height = smoothstep(-3550.,-820.,p.y);
            vec3 color = mix(shade,sunlit,.035+.78*openness+.11*height);
            color += vec3(.10,.067,.025)*pow(max(dot(ray,lightDirection),0.),5.)*openness;
            color = mix(color,vec3(.66,.77,.89),.80*smoothstep(19000.,83000.,t));
            float alpha = 1.-exp(-den*stepLen*.00155);
            sum += transmit*alpha*color;
            transmit *= 1.-alpha;
            if (transmit<.015) break;
          }
          t += stepLen;
        }
        float a = (1.-transmit)* (1.-smoothstep(65000.,96000.,start));
        if (a<.005) discard;
        gl_FragColor = vec4(sum/max(1.-transmit,.001),a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const geometry = new THREE.PlaneGeometry(1,1);
  geometry.rotateX(-Math.PI/2);
  const field = new THREE.Mesh(geometry,shader);
  field.name = '云海·三维密度积分与沿光方向自遮蔽';
  field.scale.set(194000,1,194000);
  field.frustumCulled = false;
  field.renderOrder = 3;
  group.add(field);
  const eye = ctx.camera.position;
  const syncPlane = () => {
    field.position.set(eye.x, Math.abs(eye.y + 2110) > 5 ? -2110 : eye.y - 5, eye.z);
  };
  syncPlane();
  ctx.onFrame(t => { syncPlane(); uniforms.seconds.value = t; });
  fetch(densityURL, { signal:ctx.signal }).then(r => {
    if (!r.ok) throw Error('Cloud density HTTP '+r.status);
    return r.arrayBuffer();
  }).then(bytes => {
    if (ctx.signal.aborted) return;
    const map = new THREE.Data3DTexture(new Uint8Array(bytes),64,64,64);
    map.format = THREE.RedFormat;
    map.type = THREE.UnsignedByteType;
    map.minFilter = map.magFilter = THREE.LinearFilter;
    map.wrapS = map.wrapT = map.wrapR = THREE.RepeatWrapping;
    map.needsUpdate = true;
    uniforms.densityMap.value = map;
    uniforms.loaded.value = 1;
  }).catch(error => { if (!ctx.signal.aborted) console.error(error); });
  ctx.onDispose(() => uniforms.densityMap.value?.dispose());
}

// These scattered, light-integrated cloud lobes break through the continuous
// lower deck. Their kilometer-scale separation produces parallax during an orbit.
function addCloudBanks(ctx,group) {
  const random=rng(56712), cards=[];
  const textures=[
    new URL('./assets/cumulus-0.webp',import.meta.url),
    new URL('./assets/cumulus-1.webp',import.meta.url),
    new URL('./assets/cumulus-2.webp',import.meta.url),
    new URL('./assets/cumulus-3.webp',import.meta.url)
  ].map(url=>{
    const tex=new THREE.TextureLoader().load(url.href);
    tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  });
  function cloud(x,y,z,w,h,opacity,tint) {
    const mat=new THREE.SpriteMaterial({
      map:textures[Math.floor(random()*4)],color:tint,
      opacity,transparent:true,depthWrite:false,fog:true
    });
    const p=new THREE.Sprite(mat);
    p.position.set(x,y,z);p.scale.set(w,h,1);p.renderOrder=4;
    group.add(p);cards.push([p,x,z,random()*.8+.4]);
  }
  for(const [count,radius,width,alt] of [[27,56000,16700,-1100],[18,35900,12500,-850],[14,25500,10600,-1050]]) {
    for(let i=0;i<count;i++){
      const a=(i+random()*.8)*Math.PI*2/count,r=radius*(.86+random()*.20);
      const w=width*(.61+random()*.73),h=w*(.29+random()*.21);
      cloud(Math.cos(a)*r,alt+random()*1400,Math.sin(a)*r,w,h,.88+random()*.10,0xffffff);
    }
  }
  // Singular detached clouds reveal the scale of the keel without covering the architecture.
  for(const [x,y,z,w,h,a] of [
    [-8200,-790,560,6100,1300,.81],[-6900,-580,1730,3100,490,.48],
    [5700,-1220,-1950,5200,890,.73],[6800,510,-4700,4700,560,.68],
    [-5400,1280,-4700,3900,480,.55],[8900,-1150,800,4400,730,.57],
    [-890,570,-9600,5400,600,.52],[-6800,-1350,-4100,6000,710,.64]
  ])cloud(x,y,z,w,h,a,0xf3faff);
  ctx.onFrame(t=>{for(const [p,x,z,wind] of cards){p.position.x=x+t*wind*2.6;p.position.z=z+t*wind*.4;}});
}

export function addCastleEnvironment(ctx) {
  const group = new THREE.Group();
  group.name = '空域、云层与远山';
  ctx.scene.add(group);
  addDaylight(ctx,[-.68,.72,.38],true);
  ctx.scene.fog = new THREE.FogExp2(0xbdceda,.000009);
  addRidges(group, {
    radii:[39800,56500], bases:[-5100,-5700], amplitudes:[3300,4600],
    colors:[0x9ab2c5,0xaec1d4],seed:17
  });
  addCloudOcean(ctx,group);
  addCloudBanks(ctx,group);
  return group;
}
