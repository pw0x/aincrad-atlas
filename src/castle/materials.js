import * as THREE from 'three';
import {finishInWorld,roofTile,roseGlassMap} from './finishes.js';

// A tile of inlaid steel. All pigment, hammered dimples, copper wire and braided
// relief are drawn locally. Mip maps reduce the metalwork to its mean tone at range.
function forgedPlate(ornament,anisotropy){
  const map=document.createElement('canvas');map.width=768;map.height=384;
  const g=map.getContext('2d'),data=g.createImageData(map.width,map.height);
  let seed=637,rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let y=0;y<384;y++)for(let x=0;x<768;x++){
    const k=(y*768+x)*4,stain=Math.sin(x*.021+Math.sin(y*.014))*4.8+Math.cos(x*.047)*3.5+12*rand()+Math.sin(y*.089)*2.2;
    const base=ornament?64:79;
    data.data[k]=base+stain;data.data[k+1]=base+7+stain;data.data[k+2]=base+13+stain;data.data[k+3]=255;
  }
  g.putImageData(data,0,0);
  // Scale is several hundred metres per tile on the heaviest exterior plates.
  // Long vertical oxide runs cross two courses of offset riveted sheet joints.
  for(let i=0;i<96;i++){
    const x=rand()*768,y=rand()*313,w=.7+rand()*5.8,h=12+rand()*121;
    const grad=g.createLinearGradient(x,y,x,y+h);
    grad.addColorStop(0,rand()>.72?'rgba(157,124,83,.47)':'rgba(29,38,43,.54)');
    grad.addColorStop(.65,'rgba(42,45,45,.19)');grad.addColorStop(1,'rgba(42,45,45,0)');
    g.fillStyle=grad;g.fillRect(x,y,w,h);
  }
  g.lineWidth=5;
  function line(x1,y1,x2,y2,col,width){
    g.lineWidth=width;g.strokeStyle=col;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
  }
  for(const yy of [4,191,378]){
    line(0,yy,768,yy,'#252e34',5);line(0,yy+3,768,yy+3,'#767c78',2);
  }
  for(let row=0;row<2;row++){
    for(const xx of row?[126,510]:[2,384,766]){
      line(xx,row*192,xx,row*192+191,'#263038',5);
      line(xx+3,row*192,xx+3,row*192+191,'#777d79',2);
    }
    for(let j=0;j<16;j++){
      const x=j*48+(row?16:0),y=row*192+12;
      g.fillStyle='#232b30';g.beginPath();g.arc(x,y,3.3,0,Math.PI*2);g.fill();
      g.fillStyle='#949182';g.beginPath();g.arc(x-.7,y-.8,1.9,0,Math.PI*2);g.fill();
    }
  }
  for (const [x,y] of [[10,14],[757,14],[10,367],[757,367],[385,14],[385,367]]){
    g.fillStyle='#252e32';g.beginPath();g.arc(x,y,4,0,Math.PI*2);g.fill();
    g.fillStyle='#898778';g.beginPath();g.arc(x-0.8,y-0.8,2,0,Math.PI*2);g.fill();
  }
  if(ornament){
    for(const pass of [[12,'#253038'],[6,'#9c926d'],[1.5,'#bfab7b']]){
      g.lineWidth=pass[0];g.strokeStyle=pass[1];
      for(const sign of [-1,1]){
        g.beginPath();
        for(let x=-3;x<772;x+=2){
          const z=189+sign*(89*Math.sin(Math.PI*2*x/384)+8*Math.sin(Math.PI*6*x/384));
          if(x===-3)g.moveTo(x,z);else g.lineTo(x,z);
        }
        g.stroke();
      }
      for(let k=0;k<2;k++){
        const x=192+384*k;g.beginPath();g.moveTo(x-40,190);g.lineTo(x,153);g.lineTo(x+40,190);g.lineTo(x,227);g.closePath();g.stroke();
      }
    }
    g.fillStyle='#a49573';for(const y of [53,59,317,323])g.fillRect(0,y,768,2);
  }
  const tex=new THREE.CanvasTexture(map);tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=anisotropy;
  return tex;
}

export function createMaterials(renderer) {
  const anisotropy=Math.min(12,renderer.capabilities.getMaxAnisotropy());
  const loader=new THREE.TextureLoader();
  function maps(name) {
    const result={};
    for (const [file,slot] of [['color','map'],['normal','normalMap'],['roughness','roughnessMap']]) {
      const texture=loader.load(import.meta.env.BASE_URL+'assets/materials/'+name+'/'+file+'.webp');
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=anisotropy;
      if (file==='color') texture.colorSpace=THREE.SRGBColorSpace;
      result[slot]=texture;
    }
    return result;
  }
  const slate=maps('castle_wall_slates'), rock=maps('rock_boulder_dry');
  const plate=forgedPlate(false,anisotropy),frieze=forgedPlate(true,anisotropy);
  const patina=document.createElement('canvas');patina.width=plate.image.width;patina.height=plate.image.height;
  const patinaCtx=patina.getContext('2d');
  patinaCtx.drawImage(plate.image,0,0);
  const height=patinaCtx.getImageData(0,0,patina.width,patina.height);
  for(let j=0;j<height.data.length;j+=4){
    const value=Math.min(255,Math.max(105,Math.round(137+height.data[j+1]*.95)));
    height.data[j]=height.data[j+1]=height.data[j+2]=value;
  }
  patinaCtx.putImageData(height,0,0);
  const aging=new THREE.CanvasTexture(patina);aging.wrapS=aging.wrapT=THREE.RepeatWrapping;aging.anisotropy=anisotropy;
  const metalFace={map:plate,bumpMap:aging,bumpScale:0.62,roughnessMap:aging};
  const standard=(color,roughness=0.82,metalness=0,extras={})=>
    new THREE.MeshStandardMaterial({color,roughness,metalness,...extras});
  const materials={
    facade:standard(0xc6cccd,0.96,0.13,{...slate,normalScale:new THREE.Vector2(0.72,0.72)}),
    foundation:standard(0xb8c4cc,0.95,0.12,{...rock,vertexColors:true,normalScale:new THREE.Vector2(0.9,0.9)}),
    lip:standard(0x788a91,0.75,0.34),
    dark:standard(0x34454e,0.83,0.28),
    bronze:standard(0xa38c63,0.57,0.58),
    trim:standard(0xb4b3a2,0.78,0.2),
    slate:standard(0x526971,0.82,0.18),
    earth:standard(0x726d55,0.99),
    turf:standard(0x707950,0.98),
    stone:standard(0xf9f7e9,0.88,0.07),
    metal:standard(0x78858b,0.62,0.55),
    roofing:standard(0xf2eeed,0.75,0.18),
    bark:standard(0x574638),
    foliage:standard(0xe7efd8,0.98),
    glass:standard(0x303f4c,0.44,0.34),
    light:standard(0xffddb0,0.47,0.1,{emissive:0xffa94e,emissiveIntensity:0.68}),
    ruby:standard(0x922f35,0.62,0.32),
    garnet:standard(0x652c39,0.7,0.18),
    armor:standard(0xe2e8eb,0.76,0.55,metalFace),
    armorCold:standard(0xa8b8bf,0.78,0.52,metalFace),
    armorWarm:standard(0xc1b1a1,0.72,0.52,metalFace),
    damascene:standard(0xf4ead5,0.48,0.54,{map:frieze}),
    escarpment:standard(0xc5c6a8,0.95,0.04,{...rock,vertexColors:true}),
    meadow:standard(0xffffff,0.98,0,{vertexColors:true}),
    gild:standard(0xd9ae68,0.42,0.65),
    banner:standard(0xaf4240,0.93,0,{side:THREE.DoubleSide}),
  };
  const shingles=roofTile(anisotropy);
  const meadow=loader.load(new URL('../environment/assets/forest-grass.webp',import.meta.url).href);
  meadow.colorSpace=THREE.SRGBColorSpace;meadow.wrapS=meadow.wrapT=THREE.RepeatWrapping;meadow.anisotropy=anisotropy;
  const fir=loader.load(new URL('../environment/assets/fir-stand.webp',import.meta.url).href);
  fir.colorSpace=THREE.SRGBColorSpace;fir.anisotropy=anisotropy;
  materials.spruce=standard(0xb7c0aa,.97,0,{map:fir,alphaTest:.30,alphaToCoverage:true,side:THREE.DoubleSide});
  materials.stained=standard(0xffffff,.35,.12,{map:roseGlassMap(anisotropy),emissive:0x4a2738,emissiveIntensity:.27});
  materials.paving=standard(0xb2aa92,.93);
  finishInWorld(materials.stone,slate.map,13,3.55,.20);
  finishInWorld(materials.trim,slate.map,15,2.6,.39);
  finishInWorld(materials.garnet,slate.map,17,3.1,.28);
  finishInWorld(materials.paving,slate.map,12,3.5,.22);
  finishInWorld(materials.roofing,shingles,13,2.4,.31);
  finishInWorld(materials.ruby,shingles,22,2.6,.28);
  finishInWorld(materials.turf,meadow,45,5.4,.30);
  finishInWorld(materials.meadow,meadow,44,4.6,.36);
  return materials;
}
