import * as T from 'three';
import { Kit,random } from './kit.js';
import { beam,floorY } from './shell.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const rng=random(13301);
const plateProfile=[[.001,.012],[.50,.007],[.67,.025],[.88,.083],[.994,.104],[1,.12],[.965,.13],[.91,.111],[.70,.067],[.50,.038],[.001,.034]];
const mugProfile=[[.001,.02],[.65,0],[.77,.045],[.79,.18],[.92,.82],[.98,.95],[.95,1],[.87,1],[.84,.93],[.76,.22],[.62,.13],[.001,.13]];
const urnProfile=[[.01,0],[.50,0],[.57,.045],[.56,.12],[.85,.28],[1,.51],[.92,.7],[.56,.82],[.47,.84],[.47,.96],[.52,.97],[.52,1],[.405,1],[.40,.94],[.40,.87],[.01,.81]];
const bowlProfile=[[.002,.01],[.34,.006],[.37,.05],[.48,.08],[.72,.28],[.9,.56],[1,.92],[1,.98],[.94,1],[.90,.92],[.82,.61],[.60,.28],[.37,.15],[.001,.14]];

function pot(k,m,x,y,z,r,h,main=m.teal){
  k.lathe(main,urnProfile,x,y,z,[r,h,r]);
  for(const at of [.88,.935])k.ring(m.glaze,x,y+h*at,z,r*.475,.0065);
}
function bowl(k,m,x,y,z,r,h,mat=m.pale){
  k.lathe(mat,bowlProfile,x,y,z,[r,h,r]);k.ring(m.glaze,x,y+h*.943,z,r*.988,.0042);
}
function plate(k,m,x,y,z,r=.23){
  k.lathe(m.pale,plateProfile,x,y,z,[r,.31,r]);k.ring(m.teal,x,y+.035,z,r*.965,.0032);
  k.ring(m.glaze,x,y+.031,z,r*.875,.0025);
}
function cup(k,m,x,y,z,r=.094,h=.135,side=1){
  k.lathe(m.teal,mugProfile,x,y,z,[r,h,r]);k.ring(m.gold,x,y+h*.974,z,r*.925,.0032);
  k.tube(m.teal,[[x+side*r*.85,y+h*.84,z],[x+side*r*1.46,y+h*.91,z],[x+side*r*1.53,y+h*.58,z],[x+side*r*.81,y+h*.32,z]],.014,20);
  k.disc(m.brown,[x,y+h*.826,z],[0,1,0],r*.827);
}
function teapot(k,m,x,y,z){
  const a=.19;
  k.lathe(m.teal,[[.01,0],[.66,0],[.68,.04],[.68,.09],[.91,.21],[1,.48],[.99,.59],[.85,.81],[.57,.95],[.49,1],[.01,1]],x,y,z,[a,.235,a]);
  k.lathe(m.teal,[[.01,0],[1,0],[1,.13],[.8,.45],[.48,.68],[.28,.78],[.01,.78]],x,y+.231,z,[.109,.058,.109]);
  k.ell(m.gold,x,y+.293,z,.035,.024,.035);k.ring(m.gold,x,y+.234,z,.103,.005);
  k.tube(m.teal,[[x-a*.83,y+.112,z],[x-.211,y+.151,z],[x-.245,y+.209,z],[x-.28,y+.23,z]],.035);
  k.tube(m.teal,[[x+.128,y+.177,z],[x+.245,y+.229,z],[x+.286,y+.122,z],[x+.172,y+.073,z]],.019,24);
  for(let i=0;i<20;i++){
    const t=i*Math.PI/10;k.ell(m.gold,x+Math.cos(t)*a*.99,y+.145,z+Math.sin(t)*a*.99,.006,.009,.006);
  }
}
function sprig(k,m,x,y,z,angle,h,leafmat=m.leaf){
  const dx=Math.sin(angle)*h*.45,dz=Math.cos(angle)*h*.45,bend=.23;
  k.tube(m.herb,[[x,y,z],[x+dx*bend,y+h*.52,z+dz*bend],[x+dx,y+h,z+dz]],.004,9);
  for(let n=0;n<5;n++){
    const u=.24+n*.133,xx=x+dx*u*u,yy=y+h*u,zz=z+dz*u*u,sign=n%2===0?1:-1;
    k.ell(leafmat,xx+sign*Math.cos(angle)*.026,yy+.015,zz-sign*Math.sin(angle)*.026,.021,.048,.009,[.23,angle,-sign*.76]);
  }
}
function flowers(k,m,x,y,z,n=9,scale=1){
  for(let j=0;j<n;j++){
    const a=j*2.399,h=(.29+(j%4)*.048)*scale;const ex=x+Math.cos(a)*h*.47,ez=z+Math.sin(a)*h*.42;
    k.tube(m.leaf2,[[x,y,z],[x+(ex-x)*.23,y+h*.51,z+(ez-z)*.20],[ex,y+h,ez]],.0048*scale,9);
    k.ell(m.leaf, x+(ex-x)*.51,y+h*.60,z+(ez-z)*.50,.018*scale,.053*scale,.012*scale,[.15,a,-.67]);
    for(let n=0;n<5;n++){const t=n*1.256;k.ell(j%3===0?m.violet:m.flower,ex+Math.sin(t)*.020*scale,y+h+.006*scale,ez+Math.cos(t)*.02*scale,.017*scale,.010*scale,.019*scale);}
    k.ell(m.gold,ex,y+h+.013*scale,ez,.011*scale,.009*scale,.011*scale);
  }
}
function loaf(k,m,x,y,z,scale=1,angle=0){
  const mesh=new T.SphereGeometry(1,144,92),positions=mesh.attributes.position,colors=[];
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),u=(x+1)/2,v=(z+1)/2;
    const grains=Math.sin(x*47+Math.sin(z*69))*Math.sin(z*44+y*30)*.009+Math.cos(z*14+x*9)*.013;
    let gash=0;
    for(const center of [-.52,-.14,.27,.60]){
      const dx=x-center-z*.255,edge=Math.max(0,1-Math.abs(z)/(.67-Math.abs(center)*.42));
      gash=Math.max(gash,Math.exp(-dx*dx/.0028)*Math.pow(edge,.55)*Math.min(1,Math.max(0,(y-.27)*3)));
    }
    positions.setXYZ(i,x*(1+grains*.5),Math.max(-.40,y+grains-gash*.086),z*(1+grains));
    const baked=T.MathUtils.clamp((y+.1)*1.7,.66,1);
    colors.push((.87+.64*gash)*baked,(.79+.94*gash)*baked,(.69+1.26*gash)*baked);
  }
  mesh.setAttribute('color',new T.Float32BufferAttribute(colors,3));mesh.computeVertexNormals();
  k.put(mesh,m.bread,[x,y+.0556*scale,z],[.267*scale,.139*scale,.166*scale],[0,angle,0]);

  for(const cx of [-.132,-.015,.108]){
    const vb=[],uv=[],ib=[];const slices=26;
    for(let a=0;a<=slices;a++){
      const t=a/slices, z1=(t-.5)*.198,mid=cx+(t-.5)*.09;
      const width=.014*Math.pow(Math.sin(t*Math.PI),.63)*(1+.12*Math.sin(t*40+cx*17));
      for(const side of [-1,1]){
        const x1=mid+side*width, y1=.054+.139*Math.sqrt(Math.max(.001,1-(x1/.267)**2-(z1/.166)**2))+.0028;
        vb.push(x1,y1,z1);uv.push((side+1)/2,t);
      }
      if(a<slices){const n=a*2;ib.push(n,n+2,n+1,n+1,n+2,n+3);}
    }
    const nick=new T.BufferGeometry();nick.setAttribute('position',new T.Float32BufferAttribute(vb,3));nick.setAttribute('uv',new T.Float32BufferAttribute(uv,2));nick.setIndex(ib);nick.computeVertexNormals();
    k.put(nick,m.flour,[x,y,z],[scale,scale,scale],[0,angle,0]);
  }
}
function fork(k,m,x,y,z,flip){
  k.box(m.iron,x,y+.009,z,.017,.011,.18,undefined,true);
  k.ell(m.case,x,y+.012,z+flip*.07,.020,.009,.075);
  for(let i=0;i<3;i++)k.stick(m.iron,[x+(i-1)*.009,y+.009,z-flip*.075],[x+(i-1)*.011,y+.009,z-flip*.128],.0034);
}
function table(k,m){
  const tx=-.29,tz=-1.04,top=1.48,radius=1.425,d=radius*2;
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=tx+sx*.84,z=tz+sz*.64;
    k.lathe(m.oak,[[0,0],[.076,0],[.08,.035],[.062,.081],[.050,.13],[.041,.20],[.071,.26],[.074,.32],[.053,.355],[.068,.43],[.071,.76],[0,.76]],x,floorY,z);
    k.ell(m.iron,x,top-.18,z+sz*.085,.017,.017,.012);
  }
  k.lathe(m.oak,[[1.22,0],[1.25,.008],[1.25,.075],[1.26,.083],[1.26,.14],[1.22,.14],[1.22,0]],tx,top-.234,tz,[1,1,1],112);
  // Boards are individually clipped to the canonical round tabletop. Their grain stays continuous in metric UV space.
  const boards=9;
  for(let i=0;i<boards;i++){
    const lo=-radius+i*d/boards+.0025,hi=-radius+(i+1)*d/boards-.0025,shape=new T.Shape();
    const angles=[Math.asin(lo/radius),Math.asin(hi/radius)];
    for(let j=0;j<=14;j++){
      const a=T.MathUtils.lerp(angles[0],angles[1],j/14);
      const px=Math.cos(a)*radius,pz=Math.sin(a)*radius;
      if(!j)shape.moveTo(px,-pz);else shape.lineTo(px,-pz);
    }
    for(let j=14;j>=0;j--){const a=T.MathUtils.lerp(angles[0],angles[1],j/14);shape.lineTo(-Math.cos(a)*radius,-Math.sin(a)*radius);}
    shape.closePath();
    const geo=new T.ExtrudeGeometry(shape,{depth:.080,bevelEnabled:true,bevelSegments:2,bevelSize:.008,bevelThickness:.006,steps:1});
    geo.rotateX(-Math.PI/2);
    const uv=geo.attributes.uv,pp=geo.attributes.position,nn=geo.attributes.normal;
    for(let j=0;j<uv.count;j++){
      if(Math.abs(nn.getY(j))>.65)uv.setXY(j,(pp.getZ(j)+radius)*.66,(pp.getX(j)+radius)*.60);
      else uv.setXY(j,pp.getY(j)*1.3,(pp.getX(j)+pp.getZ(j))*.64);
    }
    k.put(geo,m.table,[tx,top-.086,tz]);
  }
  // Indigo runner crosses the table and bends over both edges.
  const pts=[],uv=[],inds=[],rows=38,cols=16;
  const path=[
    [tz-d/2-.018,top-.244],[tz-d/2-.021,top-.09],[tz-d/2-.020,top-.016],[tz-d/2+.008,top+.011],
    [tz+d/2-.008,top+.011],[tz+d/2+.02,top-.016],[tz+d/2+.021,top-.09],[tz+d/2+.018,top-.24]];
  const ab=[0];for(let i=1;i<path.length;i++)ab.push(ab[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
  const len=ab.at(-1);
  for(let j=0;j<=rows;j++){const dist=j/rows*len;let n=1;while(n<ab.length-1&&dist>ab[n])n++;const u=(dist-ab[n-1])/(ab[n]-ab[n-1]);
    for(let i=0;i<=cols;i++){
      const t=i/cols,zz=T.MathUtils.lerp(path[n-1][0],path[n][0],u),yy=T.MathUtils.lerp(path[n-1][1],path[n][1],u);
      const along=(zz-tz)*Math.sqrt(radius*radius-((t-.5)*.66)**2)/radius;
      pts.push(tx+(t-.5)*.66,yy+.003*Math.sin(33*t),tz+along);uv.push(t,j/rows);
      if(i<cols&&j<rows){const a=j*(cols+1)+i;inds.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
    }
  }
  const cloth=new T.BufferGeometry();cloth.setAttribute('position',new T.Float32BufferAttribute(pts,3));cloth.setAttribute('uv',new T.Float32BufferAttribute(uv,2));cloth.setIndex(inds);cloth.computeVertexNormals();k.put(cloth,m.cloth,[0,0,0]);
  for(let i=0;i<37;i++)for(const side of [-1,1])k.stick(m.cream,[tx-.32+i*.0177,top-.237,tz+side*(Math.sqrt(radius*radius-(-.32+i*.0177)**2)+.019)],[tx-.32+i*.0177+.002,top-.276-(i%3)*.003,tz+side*(Math.sqrt(radius*radius-(-.32+i*.0177)**2)+.022)],.003);
  // Parallel place settings sit across the table from one another.
  for(const [x,z,flip] of [[-.95,-.68,1],[.51,-1.38,-1]]){
    plate(k,m,x,top+.003,z);fork(k,m,x-.282,top+.01,z,flip);
    k.ell(m.brass,x+.255,top+.018,z-flip*.089,.031,.009,.048);k.stick(m.brass,[x+.255,top+.015,z-flip*.073],[x+.255,top+.012,z+flip*.105],.007,.009,10);
    cup(k,m,x+.32,top+.005,z-flip*.21,.075,.119,flip);
  }
  const board=[-1.25,top+.023,-1.38];
  k.box(m.pine,...board,.61,.04,.36,[0,.09,0],true);loaf(k,m,board[0],top+.045,board[2],.89,.09);
  teapot(k,m,.09,top+.015,-.92);
  pot(k,m,-.25,top+.018,-1.45,.076,.175,m.pale);
  const candPos=[.87,top+.002,-.68];k.lathe(m.brass,[[.001,.003],[.084,.002],[.087,.01],[.058,.025],[.034,.032],[.022,.09],[.037,.103],[.038,.116],[0,.119]],...candPos);
  k.stick(m.wax,[.87,top+.115,-.68],[.87,top+.26,-.68],.025);k.stick(m.iron,[.87,top+.26,-.68],[.87,top+.27,-.68],.003);
  return top;
}
function chair(k,m,cx,cz,rot=0){
  const tf=(x,y,z)=>[cx+Math.cos(rot)*x+Math.sin(rot)*z,y,cz-Math.sin(rot)*x+Math.cos(rot)*z];
  const part=(mat,x,y,z,w,h,d)=>{const a=tf(x,y,z);k.box(mat,...a,w,h,d,[0,rot,0],true);};
  part(m.case,0,1.065,0,.52,.083,.52);part(m.cloth,0,1.111,0,.45,.047,.45);
  for(const side of [-1,1]){
    k.stick(m.oak,tf(side*.244,.60,-.23),tf(side*.199,1.05,-.199),.031,.037);
    beam(k,m.oak,tf(side*.225,.60,.241),tf(side*.20,1.90,.24),.056,.062);
    beam(k,m.pine,tf(side*.225,.80,.219),tf(side*.216,.80,-.209),.035,.04);
  }
  part(m.oak,0,1.813,.238,.52,.105,.07);part(m.pine,0,1.58,.235,.43,.067,.048);
  for(let i=-2;i<=2;i++)beam(k,m.pine,tf(i*.065,1.23,.227),tf(i*.055,1.74,.238),.022,.034);
}
function matUnder(k,m){
  const geo=new T.PlaneGeometry(3.95,3.58);
  k.put(geo,m.rug,[-.30,.610,-.98],[1,1,1],[-Math.PI/2,0,0]);
  for(let i=0;i<110;i++)for(const side of [-1,1])k.stick(m.linen,[-2.276+(i/109)*3.95,.614,-.98+side*1.785],[-2.276+(i/109)*3.95,.615,-.98+side*(1.82+(i%4)*.007)],.004);
}

function hearth(k,m){
  const fieldshapes=[];
  for(let j=0;j<7;j++){
    const geo=new RoundedBoxGeometry(1,1,1,2,.17),pos=geo.attributes.position;
    for(let n=0;n<pos.count;n++){
      const x=pos.getX(n),y=pos.getY(n),z=pos.getZ(n);
      const squash=.969+.041*Math.sin(6.2*x+3.9*y+2.8*z+2*j)+.037*Math.cos(2.2*x-5.2*y+2.2*z+3*j);
      pos.setXYZ(n,x*squash+.026*Math.sin(z*6+y*5+j),y*squash+.024*Math.sin(z*5+2*j+x*5),z*squash+.031*Math.sin(x*6+y*4+j));
    }
    geo.computeVertexNormals();fieldshapes.push(geo);
  }
  let count=0;
  const rock=(mat,x,y,z,w,h,d,rot=[0,0,0])=>k.put(fieldshapes[count++%7],mat,[x,y,z],[w,h,d],rot);

  const cx=-4.09,cz=-.18;
  k.box(m.stone[0],-4.25,1.59,cz,.4,2.09,2.48);k.box(m.soot,-4.04,1.49,cz,.055,1.45,1.85);
  for(let row=0;row<6;row++)for(let b=0;b<5;b++){
    const zz=cz-.74+b*.357+(row%2)*.06;rock(m.soot,-3.99, .805+row*.219,zz,.17,.252,.394,[0,0,(b%3-1)*.027]);}

  for(let j=0;j<5;j++)rock(m.stone[(j+2)%6],-3.65,.68,cz-.99+j*.50,1.24,.20,.55);
  k.ell(m.soot,-3.73,.794,cz,.39,.026,.70);
  for(const side of [-1,1])for(let h=0;h<6;h++){
    rock(m.stone[(h+(side+1)*2)%6],-3.69,.843+h*.204,cz+side*(.944+(h%2)*.035),.69,.251,.48+(h%2)*.13,[(rng()-.5)*.11,(h%2)*.035,(rng()-.5)*.08]);
    rock(m.stone[(h+3)%6],-3.96,.854+h*.204,cz+side*1.15,.35,.243,.31,[0,0,(rng()-.5)*.1]);
  }
  for(let stone=0;stone<11;stone++){
    const a=stone*Math.PI/10,z=cz+Math.cos(a)*.93,y=1.82+Math.sin(a)*.56;
    rock(m.stone[(stone*5)%6],-3.64,y,z,.69,.42,.334,[-.83*(a-Math.PI/2),(rng()-.5)*.12,(rng()-.5)*.061]);
  }
  k.box(m.oak,-3.87,2.56,cz,.90,.145,2.75,undefined,true);
  for(let j=0;j<18;j++){
    const y=2.68+j*.219,width=Math.max(.91,2.12-j*.155);
    let low=-width/2;
    const blocks=j%2===0?3:4;
    for(let i=0;i<blocks;i++){
      const cell=i===blocks-1?width/2-low:width/blocks*(.76+rng()*.45);
      rock(m.stone[(i*3+j)%6],-4.07+(rng()-.5)*.036,y,cz+low+cell/2,.74+(j<3?.1:0),.275,cell+.057,[(rng()-.5)*.083,0,(rng()-.5)*.07]);low+=cell;
    }
  }
  k.box(m.stone[1],-4.07,6.53,cz,.91,.15,1.16,undefined,true);
  k.box(m.black,-4.07,6.612,cz,.52,.03,.69);
  for(let i=0;i<7;i++){
    const z=cz-.44+i*.15;
    k.stick(m.coal,[-3.91,.79,z-.12],[-3.52,.83,z+.19],.072,.063,12);
    for(let j=0;j<3;j++)k.ell(m.emissive,-3.8+j*.12,.767,z,.035,.016,.027);
  }
  k.stick(m.iron,[-3.72,1.99,cz-.93],[-3.72,1.99,cz+.93],.022);
  k.stick(m.iron,[-3.72,1.99,cz],[-3.72,1.62,cz],.009);
  k.tube(m.iron,[[-3.72,1.39,cz-.24],[-3.72,1.61,cz-.11],[-3.72,1.63,cz+.065],[-3.72,1.40,cz+.24]],.015);
  k.lathe(m.kettle,[[.01,0],[.15,.01],[.23,.082],[.251,.195],[.224,.3],[.23,.318],[.225,.33],[.2,.325],[.18,.283],[.01,.28]],-3.72,1.095,cz);
  for(let i=0;i<4;i++)k.stick(m.oak,[-3.71,2.64,cz-.8+i*.32],[-3.71,2.78,cz-.8+i*.32],.021);
  pot(k,m,-3.79,2.634,.58,.105,.22,m.pale);
  pot(k,m,-3.90,2.634,-1.06,.102,.17,m.brown);
  for(let j=0;j<4;j++)sprig(k,m,-3.79,2.82,.58,j*1.58,.23+j*.015);
}
function hutch(k,m){
  // Open-faced pantry on the western wall, turned towards the table.
  const x=-3.96,z=-2.39;
  k.box(m.edge,x,.94,z,.77,.68,1.66);
  k.box(m.table,x,1.31,z,.89,.10,1.79);
  for(const side of [-1,1]){
    k.box(m.pine,x+.394,.98,z+side*.389,.064,.51,.65,undefined,true);k.ell(m.brass,x+.452,1.08,z+side*.105,.026,.025,.025);
  }
  for(const h of [2.11,2.76]){
    k.box(m.oak,x-.109,h,z,.61,.09,1.65);
    for(const s of [-1,1])beam(k,m.case,[x-.35,h-.27,z+s*.60],[x+.067,h-.059,z+s*.60],.045,.075);
  }
  for(const [i,r,h,mat] of [[0,.12,.25,m.teal],[1,.106,.31,m.pale],[2,.13,.23,m.brown]])pot(k,m,x-.04,2.155,z-.58+i*.30,r,h,mat);
  for(let i=0;i<4;i++)plate(k,m,x-.045,2.158+i*.034,z+.48,.20);
  pot(k,m,x-.049,2.805,z-.49,.141,.30,m.cobalt);
  for(let i=0;i<3;i++)bowl(k,m,x-.032,2.81+i*.062,z+.19,.171,.105,m.brown);
  k.stick(m.iron,[x+.195,2.03,z-.48],[x+.195,2.03,z+.56],.012);
  for(let i=0;i<4;i++){
    const zz=z-.4+i*.26;k.ring(m.iron,x+.196,2.02,zz,.032,.006,[0,Math.PI/2,0]);
    k.stick(i%2?m.case:m.brass,[x+.195,1.99,zz],[x+.195,1.77,zz],.010);
    k.ell(i%2?m.oak:m.copper,x+.191,1.737,zz,.018,.069,.046);
  }
}
function rear(k,m){
  // A settle, travel satchel, small bookcase and hand-thrown stoneware.
  k.box(m.oak,1.23,.85,3.05,2.25,.5,.67,undefined,true);
  k.box(m.cloth,1.23,1.12,3.05,2.17,.085,.64,undefined,true);
  k.box(m.case,1.23,1.45,3.31,2.18,.63,.09,undefined,true);
  for(const side of [-1,1])k.box(m.edge,1.23+side*1.13,1.11,3.04,.09,.44,.70,undefined,true);
  for(const x of [-3.20,-1.0]){
    k.box(m.oak,x,1.52,3.11,.1,1.85,.56);
  }
  for(let j=0;j<4;j++)k.box(m.case,-2.1,.73+j*.53,3.09,2.3,.084,.63);
  for(let i=0;i<22;i++){
    if(i===8||i===9||i===19)continue;
    const row=i<11?0:1,xx=-3.03+(i%11)*.172,h=.25+((i*3)%7)*.029;
    k.box([m.teal,m.red,m.cobalt,m.brown][i%4],xx,.772+row*.53+h/2,3.02,.12,h,.33,[0,0,(i%5===0?.085:0)]);
    k.box(m.gold,xx,.84+row*.53,2.849,.105,.012,.008);k.box(m.gold,xx,.89+row*.53,2.849,.105,.008,.008);
  }
  pot(k,m,-2.73,2.365,3.07,.138,.25,m.pale);flowers(k,m,-2.73,2.59,3.07,7,.61);
  for(const x of [2.75,3.65])k.box(m.pine,x,2.50,3.35,.12,.93,.095);
  k.box(m.oak,3.20,2.56,3.32,1.40,.12,.093);
  for(const x of [2.78,3.07,3.37,3.64])k.stick(m.brass,[x,2.56,3.29],[x,2.58,3.18],.021);
}

function writingDesk(k,m){
  k.box(m.table,3.76,1.393,-.08,.79,.074,1.61,undefined,true);
  for(const x of [3.46,4.06])for(const z of [-.75,.59])k.box(m.oak,x,1.006,z,.078,.81,.081,undefined,true);
  k.box(m.case,3.46,1.286,-.08,.085,.14,1.44);
  for(const z of [-.73,.57])k.box(m.oak,3.76,1.29,z,.68,.13,.083);
  pot(k,m,3.93,1.431,.54,.061,.12,m.cobalt);
}
function travellersCloak(k,m){
  const px=-.986,pz=.553,cols=36,rows=42,points=[],uv=[],indices=[];
  const path=[[1.24,-.09],[1.53,-.02],[1.77,.12],[1.85,.20],[1.87,.252],[1.80,.30],[1.61,.32],[1.25,.36],[1.014,.405]];
  const distance=[0];for(let i=1;i<path.length;i++)distance.push(distance[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
  for(let j=0;j<=rows;j++){
    const t=j/rows,walk=t*distance.at(-1);let n=1;
    while(n<path.length-1&&walk>distance[n])n++;
    const v=(walk-distance[n-1])/(distance[n]-distance[n-1]);
    for(let i=0;i<=cols;i++){const u=i/cols,fold=Math.sin(u*22+.9*Math.sin(t*3.9));
      const yy=T.MathUtils.lerp(path[n-1][0],path[n][0],v)+.023*Math.cos(u*5.2)*t*t+.019*Math.cos(u*18)*t*t*t;
      const zz=T.MathUtils.lerp(path[n-1][1],path[n][1],v)+(.014+.022*t*t)*fold;
      points.push(px+(u-.43)*(.39+.17*t*t)-.048*t,yy,pz+zz);uv.push(u,1-t);
      if(i<cols&&j<rows){const a=j*(cols+1)+i;indices.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
    }
  }
  const cloth=new T.BufferGeometry();cloth.setAttribute('position',new T.Float32BufferAttribute(points,3));cloth.setAttribute('uv',new T.Float32BufferAttribute(uv,2));cloth.setIndex(indices);cloth.computeVertexNormals();
  k.put(cloth,m.cloak,[0,0,0]);
}
export function furnishings(m){
  const k=new Kit('22F • dining room, fieldstone hearth, ceramic pantry');
  matUnder(k,m);table(k,m);chair(k,m,-.97,.55,0);chair(k,m,.46,-2.58,Math.PI);
  hearth(k,m);hutch(k,m);rear(k,m);writingDesk(k,m);travellersCloak(k,m);
  for(const x of [-2.81,.94]){pot(k,m,x,1.476,-3.39,.073,.15,m.brown);for(let i=0;i<4;i++)sprig(k,m,x,1.60,-3.39,i*1.61,.13+i*.018);}
  return k.finish();
}
export {pot,flowers,sprig,bowl,cup};
