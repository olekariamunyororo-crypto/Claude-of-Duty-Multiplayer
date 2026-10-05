// Original geometry for the Jaipur adaptation. All coordinates follow layout.js.
import * as THREE from 'three';

export async function build(ctx) {
  const {L,mat,physics} = ctx;
  const root = new THREE.Group(); root.name = 'jaipur'; ctx.addStatic(root);
  const k=ctx.kit(root);
  const M={pink:mat.toon('#d68c73'),rose:mat.toon('#b96753'),cream:mat.toon('#f4d7a5'),teal:mat.toon('#346a65'),dark:mat.toon('#333e38'),gold:mat.toon('#e6ac39'),green:mat.toon('#29705b'),red:mat.toon('#bc4931'),silver:mat.toon('#bbbfb5'),black:mat.toon('#353538'),glass:mat.glass({tint:'#a6c5c9',opacity:.5}),orange:mat.toon('#ee942f'),white:mat.toon('#fff3d8')};
  const label=(kit,text,sub,w,h,pos,bg='#edbd50',fg='#323a31')=>{
    const map=ctx.tex.draw(1024,256,(g,W,H)=>{g.fillStyle=bg;g.fillRect(0,0,W,H);g.strokeStyle=fg;g.lineWidth=5;g.strokeRect(12,12,W-24,H-24);g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';ctx.tex.fitText(g,text,W/2,H*.39,W*.90,85,ctx.tex.FONTS.sans,800);ctx.tex.fitText(g,sub,W/2,H*.79,W*.88,38,ctx.tex.FONTS.en,700);});
    kit.box(w+.08,h+.08,.08,M.dark,pos);
    kit.plane(w,h,mat.toon('#ffffff',{map}),[pos[0],pos[1],pos[2]+.048]);
  };
  const arch=(kit,x,y,z,w,h,material=M.cream)=>{
    const points=[];
    for(let i=0;i<=28;i++){const a=Math.PI*i/28;const scallop=1+.045*Math.sin(i/28*Math.PI*7);points.push(new THREE.Vector3(x+Math.cos(a)*w*.5*scallop,y+Math.sin(a)*h,z));}
    kit.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.065,6,false),material);
  };
  const chhatri=(kit,x,y,z,s=1)=>{
    kit.box(2.5*s,.18*s,2.5*s,M.cream,[x,y,z]);
    for(const dx of [-.85,.85])for(const dz of [-.85,.85]){kit.cyl(.075*s,.1*s,1.7*s,M.cream,[x+dx*s,y+.88*s,z+dz*s]);kit.box(.26*s,.12*s,.26*s,M.rose,[x+dx*s,y+1.65*s,z+dz*s]);}
    for(const dz of [-.86,.86])arch(kit,x,y+1.2*s,z+dz*s,1.7*s,.55*s);
    kit.box(2.55*s,.18*s,2.55*s,M.cream,[x,y+1.85*s,z]);
    kit.mesh(new THREE.SphereGeometry(1.25*s,24,12,0,Math.PI*2,0,Math.PI/2),M.pink,[x,y+1.94*s,z],null,[1,.7,1]);
    kit.cyl(.07*s,.16*s,.32*s,M.gold,[x,y+2.94*s,z]);kit.sphere(.11*s,M.gold,[x,y+3.16*s,z]);
  };
  // Station terrace and corner pavilions. Entrance and platform routes remain unobstructed.
  k.box(17,.2,11.2,M.cream,[4,4.73,-30.25]);
  k.box(16,.65,.22,M.pink,[4,5.12,-35.65]);
  k.box(.22,.65,10.6,M.pink,[-4.1,5.12,-30.3]);k.box(.22,.65,10.6,M.pink,[12.1,5.12,-30.3]);
  for(let x=-3.8;x<12;x+=.6)k.box(.22,.34,.28,M.cream,[x,5.57,-35.65]);
  chhatri(k,-2.4,4.9,-26.8,.85);chhatri(k,10.4,4.9,-26.8,.85);
  k.box(5.8,1.4,.32,M.pink,[4,5.38,-25]);
  arch(k,4,5.8,-24.8,5.8,1.6);label(k,'पिंक सिटी लाइन','PINK CITY LINE  •  GN 07',5.4,1.1,[4,5.35,-24.78]);
  for(const x of [-2.6,-.5,8.6,10.8])arch(k,x,3.48,-24.86,1.5,.6);
  // Yellow Indian-style platform name boards.
  for(const [x,z,rot] of [[-4,-37.8,0],[35,-48.8,Math.PI]]){
    const g=k.group([x,L.PLATFORM.y,z],rot),q=ctx.kit(g);
    for(const dx of [-1.5,1.5])q.box(.09,2.6,.09,M.dark,[dx,1.3,0]);
    label(q,'गुलाबी नगर','GULABI NAGAR',3.3,.85,[0,2.25,0]);
  }
  // Arched upper façades along the bazaar. Existing shop entrances and interiors are retained.
  for(const [id,top] of [['W1',4.8],['W2',6.4],['W4',6.5],['E1',6.6],['E2',6.2],['E3',6.5],['E5',6.1]]){
    const lot=L.lotById(id),f=L.lotFrame(lot),g=k.group([f.x,f.y,f.z],f.rotY),q=ctx.kit(g),w=f.w-.5;
    q.box(w,1.6,.25,M.pink,[0,top,-.75]);q.box(w+.35,.18,.7,M.cream,[0,top-.82,-.63]);q.box(w+.2,.18,.46,M.cream,[0,top+.83,-.65]);
    const n=Math.floor(w/1.9);
    for(let i=0;i<n;i++){
      const x=(i-(n-1)/2)*1.75;
      q.box(.83,.92,.06,M.teal,[x,top-.08,-.59]);arch(q,x,top+.13,-.54,.9,.48);
      q.box(1.08,.1,.37,M.cream,[x,top-.58,-.48]);
      for(let j=-2;j<=2;j++)q.box(.026,.85,.035,M.cream,[x+j*.16,top-.04,-.53]);
      for(let j=0;j<3;j++)q.box(.84,.025,.035,M.cream,[x,top-.34+j*.25,-.52]);
    }
    for(let x=-w/2+.2;x<w/2;x+=.55)q.box(.20,.27,.3,M.cream,[x,top+1.05,-.68]);
    if(id==='E2'||id==='W4')chhatri(q,0,top+.95,-2,.65);
  }
  // Rickshaws: open passenger cabin, canvas hood, handlebar, one front wheel and two rear wheels.
  function auto(x,z,rot){
    const y=L.heightAt(x,z)+.035,g=k.group([x,y,z],rot),q=ctx.kit(g);g.name='auto-rickshaw';
    q.rbox(1.34,.66,1.8,.1,M.green,[0,.72,-.32]);q.box(1.22,.10,2.3,M.dark,[0,.44,0]);
    q.rbox(1.4,.20,1.9,.09,M.gold,[0,1.94,-.20]);
    q.rbox(1.31,.60,.28,.08,M.green,[0,.86,1.02]);
    q.box(1.25,.68,.09,M.gold,[0,1.43,1.03]);q.box(1.04,.53,.02,M.glass,[0,1.47,1.085]);
    q.box(.045,.55,.035,M.dark,[0,1.48,1.10]);
    for(const dx of [-.64,.64]){q.cyl(.036,.036,1.32,M.dark,[dx,1.25,.72]);q.cyl(.035,.035,1.26,M.dark,[dx,1.26,-1.02]);q.box(.075,.32,1.2,M.green,[dx,.95,-.46]);}
    q.box(1.13,.14,.51,M.black,[0,.84,-.54]);q.box(1.13,.48,.13,M.black,[0,1.09,-.91]);
    q.box(.6,.13,.48,M.black,[0,.87,.42]);q.box(.6,.46,.12,M.black,[0,1.06,.21]);
    q.cyl(.025,.025,.45,M.silver,[0,1.17,.83],[0,0,.15]);q.box(.60,.035,.04,M.dark,[0,1.39,.86]);
    for(const [wx,wz] of [[0,1.0],[-.72,-.77],[.72,-.77]]){q.cyl(.29,.29,.16,M.black,[wx,.3,wz],[0,0,Math.PI/2],18);q.cyl(.14,.14,.18,M.silver,[wx,.3,wz],[0,0,Math.PI/2],14);}
    q.sphere(.12,M.white,[0,.94,1.19]);q.box(.52,.13,.025,M.gold,[0,.59,1.195]);
    label(q,'AUTO','RJ 14  •  0724',.62,.19,[0,.71,-1.235]);
    physics.addBox(x,z,1.6,2.6,rot,y,y+2.1);
  }
  auto(-2.1,16,Math.PI);auto(10,-3.45,-Math.PI/2);auto(27,-19,.4);
  // Chai cart at the edge of the chowk, with an actual kettle, cups and biscuit jars.
  {
    const x=9,z=-13.8,g=k.group([x,.04,z],-.22),q=ctx.kit(g);
    q.box(2.1,.82,1.03,M.teal,[0,.85,0]);q.box(2.24,.1,1.16,M.cream,[0,1.31,0]);
    for(const dx of [-.78,.78])q.cyl(.30,.30,.11,M.dark,[dx,.3,0],[Math.PI/2,0,0],20);
    for(const dx of [-1,1])q.box(.06,1.55,.06,M.dark,[dx,2.0,-.43]);
    for(let i=0;i<8;i++)q.box(.29,.06,1.55,i%2?M.cream:M.red,[-1.015+i*.29,2.86,.04],[.13,0,0]);
    label(q,'गुलाबी चाय','MASALA CHAI  ₹20  •  KACHORI  ₹30',2.05,.43,[0,2.54,.79], '#f4d7a5','#8d3d2e');
    q.cyl(.24,.29,.4,M.silver,[-.45,1.58,0]);q.cyl(.26,.26,.06,M.dark,[-.45,1.82,0]);q.sphere(.07,M.dark,[-.45,1.89,0]);
    q.cyl(.045,.08,.36,M.silver,[-.13,1.66,0],[0,0,-.8]);q.mesh(new THREE.TorusGeometry(.19,.03,6,18),M.dark,[-.77,1.64,0],[0,Math.PI/2,0]);
    for(let i=0;i<6;i++)q.cyl(.06,.037,.13,M.rose,[.20+(i%3)*.19,1.425,.03+Math.floor(i/3)*.20]);
    for(let i=0;i<2;i++){q.cyl(.14,.14,.39,M.glass,[.64+i*.32,1.55,-.24]);q.cyl(.145,.145,.05,M.gold,[.64+i*.32,1.76,-.24]);for(let j=0;j<4;j++)q.cyl(.11,.11,.045,M.cream,[.64+i*.32,1.4+j*.06,-.24]);}
    physics.addBox(x,z,2.3,1.4,-.22,0,1.4);
  }
  // Neighbourhood temple, replacing the source's Shinto shrine.
  {
    const lot=L.lotById('E6'),f=L.lotFrame(lot),g=k.group([f.x,f.y,f.z],f.rotY),q=ctx.kit(g);
    q.box(7.8,.22,12,M.cream,[0,.12,-6.6]);
    const W=(x,z)=>L.lotToWorld(lot,x,z);
    let p=W(0,-6.6);physics.addWalkBox(p.x,p.z,7.8,12,f.rotY,f.y+.23);
    for(let i=0;i<3;i++)q.box(3.2,.08,1.5-i*.35,M.pink,[0,.04+i*.08,-.42-i*.17]);
    q.box(4.4,3.1,3.5,M.pink,[0,1.78,-9]);q.box(4.9,.22,4,M.cream,[0,3.39,-9]);
    q.box(1.7,2.25,.06,M.dark,[0,1.40,-7.22]);arch(q,0,2.3,-7.15,1.75,.80);
    for(const dx of [-1.7,1.7])q.cyl(.14,.18,2.75,M.cream,[dx,1.61,-7.1]);
    for(let i=0;i<9;i++)q.cyl(1.47-i*.14,1.6-i*.14,.39,M.pink,[0,3.7+i*.36,-9],null,8);
    q.cyl(.26,.40,.17,M.cream,[0,6.94,-9],null,16);q.sphere(.17,M.gold,[0,7.17,-9]);q.cyl(.025,.025,1.3,M.gold,[0,7.86,-9]);
    const flag=ctx.geo.extrude([[0,0],[1,-.22],[0,-.48]],.01);q.mesh(flag,M.orange,[.03,8.39,-9]);
    label(q,'गुलाबी नगर मंदिर','NEIGHBOURHOOD MANDIR',3.5,.55,[0,3.05,-7.04]);
    for(const dx of [-2.8,2.8]){q.box(.35,2.6,.35,M.pink,[dx,1.53,-2.9]);q.sphere(.24,M.cream,[dx,2.98,-2.9]);}
    q.box(6.2,.25,.5,M.cream,[0,2.9,-2.9]);
    // Brass bell and marigold garland.
    q.cyl(.018,.018,.5,M.dark,[0,2.6,-2.9]);q.cyl(.09,.20,.24,M.gold,[0,2.25,-2.9]);
    for(let i=0;i<32;i++){let x=-2.6+i*5.2/31;q.sphere(.07,M.orange,[x,2.73-.6*(1-(x/2.6)**2),-2.60],8);}
    p=W(0,-9);physics.addBox(p.x,p.z,4.4,3.5,f.rotY,f.y+.22,f.y+7.4);
  }
  // Bunting above the street, clear of the railway and walking routes.
  for(const z of [7,21,39,58]){
    const cx=L.streetCenterX(z),y=L.heightAt(cx,z)+5.0;
    ctx.wires.add([[cx-5,y,z],[cx,y-.6,z],[cx+5,y,z]],{width:.012,color:'#795b3e'});
    for(let i=0;i<13;i++){
      const x=-4.5+i*.75,h=y-.6*(1-(x/5)**2);
      k.mesh(ctx.geo.extrude([[-.22,0],[.22,0],[0,-.48]],.009),[M.red,M.gold,M.teal,M.cream][i%4],[cx+x,h,z]);
    }
  }
  // Distant fort silhouette on the Aravalli ridge.
  const fort=k.group([0,23,-235]),fk=ctx.kit(fort);
  fk.box(135,7,5,M.rose,[0,0,0]);
  for(let i=-65;i<=65;i+=3)fk.box(1.2,1.6,5.3,M.pink,[i,4.2,0]);
  for(const x of [-60,-30,0,30,60]){fk.cyl(4,4.4,12,M.pink,[x,2,0],null,12);chhatri(fk,x,8,0,2.4);}
  ctx.services.jaipur={rickshaws:3,chaiCart:{x:9,z:-13.8},temple:true};
}
