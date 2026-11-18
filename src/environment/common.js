import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const skyURL = new URL('./assets/highland-sky.webp', import.meta.url).href;
const lightURL = new URL('./assets/daylight-reflection.hdr', import.meta.url).href;
const solarLongitude = (304.5 / 512 - 0.5) * Math.PI * 2;

export function rng(seed) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx *= fx * (3 - 2 * fx);
  fy *= fy * (3 - 2 * fy);
  function hash(dx, dy) {
    let h = Math.imul(ix + dx, 1597334677) ^ Math.imul(iy + dy, 3812015801);
    h = Math.imul(h ^ h >>> 16, 2246822507);
    return ((h ^ h >>> 13) >>> 0) / 4294967296;
  }
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(0, 0), hash(1, 0), fx),
    THREE.MathUtils.lerp(hash(0, 1), hash(1, 1), fx), fy);
}

export function addDaylight(ctx, sun, alpine) {
  const scene = ctx.scene;
  const direction = new THREE.Vector3(...sun).normalize();
  const rotation = solarLongitude - Math.atan2(direction.z, direction.x);
  const uniforms = { panorama: { value: null }, loaded: { value: 0 }, azimuth: { value: rotation }, alpine: { value: alpine ? 1 : 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.ShaderMaterial({
    uniforms, depthWrite: false, depthTest: false, side: THREE.BackSide,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.);
        gl_Position = clip.xyww;
      }`,
    fragmentShader: `
      uniform sampler2D panorama;
      uniform float azimuth, loaded, alpine;
      varying vec3 vDirection;
      void main() {
        vec3 dir = normalize(vDirection);
        vec2 uv = vec2(fract(0.5 + (atan(dir.z, dir.x) + azimuth) / 6.2831853),
                       0.5 + asin(clamp(max(dir.y + alpine * .43, 0.),-1.,1.))/3.14159265);
        float altitude = smoothstep(-.16,.58,dir.y+.18*alpine);
        vec3 clear = mix(vec3(.62,.79,.94),vec3(.057,.23,.49),altitude);
        // Adjacent pixels can straddle longitude zero. Use the wrapped footprint
        // so a meridian never samples the coarsest mip across an otherwise clear sky.
        vec2 dx = dFdx(uv), dy = dFdy(uv);
        dx.x -= floor(dx.x + .5);
        dy.x -= floor(dy.x + .5);
        vec3 plate = textureGrad(panorama, uv, dx, dy).rgb * mix(vec3(1.33,1.46,1.67),vec3(1.12,1.46,1.86),alpine);
        vec3 daylight = mix(clear, plate, loaded * mix(.79,.75,alpine));
        daylight = mix(daylight, vec3(.66,.79,.88), .29*(1.-smoothstep(-.09,.09,dir.y + .05*alpine)));
        gl_FragColor = vec4(daylight,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.name = '全天球实拍云光与大气散射';
  sky.frustumCulled = false;
  sky.renderOrder = -10000;
  scene.add(sky);
  new THREE.TextureLoader().load(skyURL, texture => {
    if (ctx.signal.aborted) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    uniforms.panorama.value = texture;
    uniforms.loaded.value = 1;
  });
  let env;
  new HDRLoader().load(lightURL, texture => {
    if (ctx.signal.aborted) { texture.dispose(); return; }
    texture.mapping = THREE.EquirectangularReflectionMapping;
    env = texture;
    scene.environment = texture;
    scene.environmentRotation.y = rotation;
    scene.environmentIntensity = alpine ? .42 : .34;
  });
  ctx.onDispose(() => {
    uniforms.panorama.value?.dispose();
    if (env && scene.environment === env) scene.environment = null;
    env?.dispose();
  });
}

// Each annulus closes on itself so a full orbit reveals new peaks without seams.
export function addRidges(parent, { radii, bases, amplitudes, colors, seed, roughness = 1 }) {
  const ring = 384, depth = 8;
  for (let s = 0; s < radii.length; s++) {
    const positions = [], shades = [], indices = [];
    const tint = new THREE.Color(colors[s]);
    const radius = radii[s], height = amplitudes[s], base = bases[s];
    for (let j = 0; j <= depth; j++) {
      const t = j / depth;
      for (let i = 0; i <= ring; i++) {
        const a = (i % ring) / ring * Math.PI * 2;
        const cs = Math.cos(a), sn = Math.sin(a);
        const f = (k, offset = 0) => noise(cs*k + seed + offset + s*14, sn*k+35+s*8+offset);
        const profile = .27 + .60 * f(3.7) + .27 * f(10.4) + .11 * f(26) + .045 * f(62);
        const ridge = .7 + .18 * f(4, 117);
        const slope = Math.max(0, 1 - Math.abs(t - ridge) / (t < ridge ? ridge : 1-ridge));
        const r = radius * (.8 + .22 * t + .038 * f(5,21) + .012 * f(17,10));
        const h = base + height * (profile * slope + roughness * .09 * f(22, j*0.22) * slope);
        positions.push(cs*r, h, sn*r);
        const ambient = .73 + .28 * slope + .14 * f(30,j*.67) + .07 * Math.cos(a+1.4);
        shades.push(tint.r*ambient, tint.g*ambient, tint.b*ambient);
        if (i < ring && j < depth) {
          const k = j * (ring+1) + i;
          indices.push(k,k+ring+1,k+1,k+1,k+ring+1,k+ring+2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(shades,3));
    geo.setIndex(indices);
    const mesh = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({ vertexColors:true,side:THREE.DoubleSide }));
    mesh.name = '空气透视·远山 ' + (s + 1);
    parent.add(mesh);
  }
}

export function placeInstances(parent, geometry, material, instances, name, shadows = false) {
  if (!instances.length) return;
  const batch = new THREE.InstancedMesh(geometry,material,instances.length);
  const dummy = new THREE.Object3D();
  instances.forEach((item, idx) => {
    dummy.position.set(item[0],item[1],item[2]);
    dummy.rotation.set(item[7] || 0,item[6] || 0,item[8] || 0);
    dummy.scale.set(item[3],item[4],item[5]);
    dummy.updateMatrix();
    batch.setMatrixAt(idx,dummy.matrix);
    if (item[9]) batch.setColorAt(idx,item[9]);
  });
  batch.computeBoundingSphere();
  batch.castShadow = shadows;
  batch.receiveShadow = true;
  batch.name = name;
  parent.add(batch);
  return batch;
}
