import {polar, TAU,turnProfile} from './geometry.js';

// Each row marks an exterior transfer gallery. Between them every individual
// floor still gets its own ledge. Radii and transfer levels are an art direction
// choice; the canonical hundred storeys and first-floor diameter anchor the scale.
export const TERRACES=[
  [1,0,5000],[7,390,4845],[15,895,4725],[23,1410,4335],
  [29,1795,4160],[39,2450,4015],[48,3050,3720],[54,3460,3560],
  [65,4170,3020],[73,4680,2730],[79,5070,2220],[86,5520,1930],
  [91,5840,1540],[96,6150,1130],[100,6400,850]
];

export function tierLayout(index) {
  const [floor,y,r]=TERRACES[index], [last,top,nextR]=TERRACES[index+1];
  const step=r-nextR,h=top-y;
  const setback=Math.min(185,step*(index===0?0.31:0.40));
  return {floor,last,y,r,top,nextR,h,setback,edge:r-setback};
}

function armorPlates(architecture,pieces,layout,t) {
  const {y,r,h,edge}=layout;
  const count=[11,7,10,15,8,9,16,7,18,11,8,16,11,10][t];
  const arc=TAU/count, engraved=t===1||t===4||t===9;
  for(let i=0;i<count;i++){
    const a=(i+0.31*t)*arc;
    const swept=0.45+0.5*Math.sin(a*2.0+t*1.8);
    const lo=y+h*(0.13+0.12*swept),hi=y+h*(0.69+0.12*swept);
    const lower=r-12+18*Math.cos(a*2.0+t),upper=edge+7+17*Math.cos(a+t*.85);
    const sweep=(t%3===0?0.24:0.13)*h*Math.sin(t*1.2+a*1.3);
    const style=(i+t)%6===1?'armorWarm':(i%4===0?'armorCold':'armor');
    function part(name,profile,isBand=false){
      const n=23,g=turnProfile(profile,n,isBand?540:235,a+arc*.003,arc*.99);
      const pt=g.attributes.position,uv=g.attributes.uv;
      const vmax=Math.max(...Array.from({length:uv.count},(_,k)=>uv.getY(k)));
      for(let k=0;k<pt.count;k++){
        const progress=((k>>1)%(n+1))/n,u=Math.sin(progress*Math.PI);
        const angle=a+progress*arc;
        const offset=0.015*r*u*(0.7+0.3*Math.sin(a*3+t));
        pt.setXYZ(k,pt.getX(k)+Math.sin(angle)*offset,pt.getY(k)+sweep*(progress-0.5),pt.getZ(k)+Math.cos(angle)*offset);
        if(isBand)uv.setY(k,uv.getY(k)/Math.max(.0001,vmax));
      }
      g.computeVertexNormals();architecture.append(name,g);
    }
    part(style,[[lower-35,lo-16],[lower+18,lo],[lower+24,lo+22],[lower-4,(lo+hi)*.5],[upper,hi-14],[upper-16,hi]]);
    const skinStart=lo+22,skinEnd=hi-14,skinMid=(lo+hi)*.5;
    const skinRadius=z=>z<skinMid?lower+24-28*(z-skinStart)/(skinMid-skinStart):lower-4+(upper-lower+4)*(z-skinMid)/(skinEnd-skinMid);
    const surface=(u,v,relief=0)=>{
      const z=skinStart+(skinEnd-skinStart)*v;
      const displacement=.015*r*Math.sin(u*Math.PI)*(.7+.3*Math.sin(a*3+t));
      return polar(skinRadius(z)+displacement+relief,a+arc*(.003+.99*u),z+sweep*(u-.5));
    };
    const bandRad=edge+10;
    if(engraved){
      const ymin=skinStart+(skinEnd-skinStart)*.27,ymax=skinStart+(skinEnd-skinStart)*.70;
      part('damascene',[[skinRadius(ymin)+7,ymin],[skinRadius((ymin+ymax)/2)+7,(ymin+ymax)/2],[skinRadius(ymax)+7,ymax]],true);
    }
    part('metal',[[lower+10,lo],[lower+25,lo+5],[lower+24,lo+13],[lower+6,lo+15]]);
    if(i%3===0)part('bronze',[[bandRad-1,hi-6],[bandRad+7,hi-4],[bandRad+3,hi+2]]);
    // Engraved courses, formed ribs and paired bolting plates remain legible
    // beyond the individual fasteners visible from the exterior galleries.
    const z=skinStart+(skinEnd-skinStart)*(t%2===0?.24:.76),rad=skinRadius(z);
    part('dark',[[rad+5,z-4],[rad+12,z-1],[rad+11,z+5],[rad+4,z+8]]);
    const seams=Math.max(3,Math.round(arc*r/330));
    for(let j=0;j<seams;j++){
      const u=(j+.21)/seams, slant=(t%2===0?.055:-.055)/seams;
      const thick=(j+i)%4===0;
      const v0=.03+(j%3)*.027,v1=.93-(j%2)*.095;
      const p0=surface(u,v0,10),pm=surface(u+slant*.45,.50,12),p1=surface(u+slant,v1,10);
      const colour=thick?0xc0beb0:0x919a99,wd=thick?18:7;
      pieces.beam(p0,pm,wd,thick?13:5,'metal',colour);
      pieces.beam(pm,p1,wd,thick?13:5,'metal',colour);
      for(const v of [.14,.82]){
        const p=surface(u+slant*v,v,19);
        pieces.add('leaf',thick?'bronze':'metal',p.x,p.y,p.z,thick?21:13,thick?21:13,thick?21:13,a);
      }
      if(thick && t%3===0){
        const vp=surface(u+.16/seams,.20,13),up=surface(u+slant,.72,12);
        pieces.beam(vp,up,16,12,'metal',0x96a4a6);
        const bolt=surface(u+.14/seams,.25,18);
        pieces.add('leaf','bronze',bolt.x,bolt.y,bolt.z,17,17,17,a);
      }
    }
  }
}

export function buildTiers(architecture, pieces) {
  for(let t=0;t<TERRACES.length-1;t++){
    const layout=tierLayout(t),{floor,last,y,r,top,nextR,h,edge}=layout;
    const arcadeTier=t===2||t===8||t===11, selective=t===5||t===13;
    const deep=(t===0||t===2||t===5||t===8||t===11), upper=t>=10;
    const skirt=deep?1.18:0.76, inset=deep?88:58;
    const footprint=[[r-101,y-73*skirt],[r+8,y-39*skirt],[r+24,y+3],[r+18,y+21],[r-24,y+46],
      [r-45,y+h*0.20],[edge-inset,y+h*0.51],[edge-inset,top-40],[edge-65,top-15],[edge-35,top-5],
      [nextR-30,top-4]];
    architecture.add(arcadeTier?'facade':t%3===0?'armorCold':'armor',footprint,216,upper?64:83);
    if(!arcadeTier)armorPlates(architecture,pieces,layout,t);
    architecture.add(arcadeTier?'lip':'armorCold',[[r-105,y-77*skirt],[r-16,y-57*skirt],[r+31,y-12],[r+34,y+6],[r-10,y+19]],216,65);
    if(arcadeTier||t===0)architecture.add('trim',[[r+16,y+13],[r+26,y+23],[r+24,y+30],[r-4,y+34]],216);
    if(t%4===0)architecture.add('bronze',[[r-44,y-49*skirt],[r-4,y-42*skirt],[r+6,y-36*skirt]],216);
    architecture.add('slate',[[edge-29,top-38],[edge+14,top-29],[edge+24,top-12],[edge+23,top-4]],216);
    architecture.add(arcadeTier?'trim':'dark',[[edge+21,top-8],[edge+31,top-2],[edge+31,top+8],[edge+17,top+12],
      [edge+1,top+13]],216);
    architecture.add('earth',[[edge+1,top+12],[edge-18,top+16],[nextR-45,top+10]],216,60);
    architecture.add(t%3===1?'earth':'turf',[[edge-29,top+17],[nextR+18,top+16]],216);
    const storeys=last-floor;
    for(let f=1;f<storeys;f++){
      const u=f/storeys,yy=y+h*u;
      // The lower half reads as layered armour; below the open upper gallery
      // the thin strips disappear behind the nave walls and arcade piers.
      const rr=u<0.20?r-24-21*u/0.20:u<0.51?r-45+(edge-inset-r+45)*(u-0.20)/0.31:edge-inset;
      architecture.add(f%3===0?'lip':'dark',[[rr-4,yy-11],[rr+14,yy-5],[rr+16,yy+2],[rr+2,yy+6]],176);
    }
    const galleryY=y+h*(t%3===1?0.23:0.41),galleryH=top-galleryY-25;
    const galleryR=edge-12,desired=deep?115:91;
    const count=Math.max(32,Math.round(TAU*galleryR/desired/4)*4);
    const bay=TAU*galleryR/count, offset=(t%2===0?0.18:0.61)*TAU/count;
    for(let k=0;k<count;k++){
      const a=k*TAU/count+offset;
      const open=arcadeTier?(t===2||Math.sin(3*a+t*.7)>-.27):selective&&Math.sin(a*3+t*1.6)>.72;
      const angularColour=Math.sin(a*3+t)*0.5+0.5;
      const stone=angularColour>0.74?0x99a3a2:angularColour>0.36?0x8a9898:0x7d8b8d;
      if(open)pieces.at('arch','stone',galleryR,a,galleryY,bay*1.016,galleryH,34,stone);
      if(open&&k%2===0){
        pieces.at('window',k%13===0?'light':'glass',edge-inset+4,a,galleryY+galleryH*0.15,
          bay*0.30,galleryH*0.63,1);
      }
      const pierAngle=a+Math.PI/count;
      if(open&&k%2===0){
        pieces.at('box','trim',galleryR+18,pierAngle,galleryY+galleryH*0.45,9,galleryH*0.83,13);
        pieces.at('box','metal',galleryR+22,pierAngle,top-38,17,14,25);
      }
      const majorEvery=deep?8:12;
      if(open&&k%majorEvery===0){
        // Broad buttresses make visually legible, staggered vertical districts
        // across the fine horizontal registrations of all hundred floors.
        const w=deep?71:52;
        pieces.beam(polar(r+18,pierAngle,y+38),polar(edge+4,pierAngle,top-27),w,48,'stone',0x909b9a);
        pieces.at('box','lip',r+8,pierAngle,y+47,w*1.60,60,73);
        pieces.at('drum','bronze',edge+8,pierAngle,top+6,w*0.8,22,w*0.8);
        if(deep && k%16===0){
          pieces.at('pinnacle','roofing',edge+8,pierAngle,top+13,w*0.85,92,w*0.85,0x586d73);
        }
      }
      if(open&&k%4===0){
        pieces.at('box','slate',r-23,a,y+68,bay*0.40,27,19);
        pieces.at('box','bronze',r-10,a,y+68,bay*0.06,26,10);
      }
    }
    // Separate city wall at the outer lip of the inhabited terraces.
    architecture.add(arcadeTier?'trim':'slate',[[edge-2,top+13],[edge+5,top+13],[edge+4,top+29],[edge,top+32],[edge-5,top+31]],216);
    if(t===0||t===2||t===5||t===8){
      const n=t===0?96:62;
      for(let j=0;j<n;j++){
        const a=(j+0.42)*TAU/n;
        const rr=edge-12;
        pieces.at('drum','stone',rr,a,top+36,43,63,43,0xa4a69a);
        pieces.at('cone','roofing',rr,a,top+67,54,46,54,0x546a75);
      }
    }
  }
}
