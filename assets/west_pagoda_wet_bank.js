// Candidate A: one asymmetric, camera-authored wet-bank mass. The unbroken
// peat body owns the silhouette; sparse stone/root clusters interrupt it.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (name, color, roughness) => { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.015 }); m.name = name; return m; };
  const peat = mat('ground', 0x19271f, 0.72), moss = mat('foliage', 0x385b3b, 0.62);
  const stone = mat('stone', 0x3b5049, 0.50), wet = mat('stone', 0x203b38, 0.38), root = mat('timber', 0x27251c, 0.58);
  const pool = mat('ground', 0x173b39, 0.24), leaf = mat('foliage', 0x47734a, 0.48), leafDark = mat('foliage', 0x294c36, 0.60);
  function extruded(points, depth, bevel, material, y, name) {
    const s = new THREE.Shape(); points.forEach(([x,z], i) => i ? s.lineTo(x,z) : s.moveTo(x,z)); s.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:true, bevelSize:bevel, bevelThickness:bevel*.7, bevelSegments:2, curveSegments:2 }), material);
    mesh.name=name; mesh.rotation.x=-Math.PI/2; mesh.position.y=y; mesh.castShadow=mesh.receiveShadow=true; g.add(mesh); return mesh;
  }
  extruded([[-3.55,-3.85],[-2.05,-4.75],[.1,-4.95],[2.15,-4.25],[3.45,-2.75],[3.7,-.35],[3.15,1.65],[2.0,3.85],[-.2,4.65],[-2.25,4.15],[-3.55,2.45],[-3.82,.25]], .62,.16,peat,.12,'continuous_peat_body');
  extruded([[-2.9,-3.35],[-1.45,-4.02],[.35,-4.05],[2.1,-3.25],[2.95,-1.4],[2.78,.85],[1.75,2.9],[-.15,3.65],[-1.85,3.2],[-2.8,1.55],[-3.05,-.55]], .22,.13,moss,.67,'moss_crown');
  // Crown breakup is deliberately broad and camera-authored: dark root scars
  // lead toward small wet pockets, while low leaf rafts interrupt the lawn-like
  // highlight without becoming new perimeter beads or blocking the combat lane.
  const patch = (name, points, material, y, depth=.035) => extruded(points, depth, .025, material, y, name);
  patch('root_channel_west', [[-2.72,-2.43],[-2.08,-2.02],[-1.38,-1.36],[-.7,-.62],[-.79,-.48],[-1.52,-1.14],[-2.2,-1.78],[-2.82,-2.27]], root, 1.015, .038);
  patch('root_channel_north', [[-1.72,2.94],[-1.12,2.3],[-.42,1.78],[.18,1.42],[.24,1.54],[-.36,1.94],[-1.02,2.46],[-1.82,3.08]], root, 1.018, .035);
  patch('shallow_pool_south', [[-.92,-3.43],[-.18,-3.63],[.58,-3.42],[.82,-2.95],[.35,-2.62],[-.42,-2.68],[-.98,-3.02]], pool, 1.032, .025);
  patch('shallow_pool_east', [[1.52,.52],[2.17,.35],[2.55,.78],[2.32,1.25],[1.7,1.4],[1.28,1.05]], pool, 1.034, .025);
  patch('shallow_pool_center', [[-.98,.3],[-.35,.05],[.26,.3],[.38,.78],[-.1,1.08],[-.72,.92]], pool, 1.036, .025);
  function lowLeaf(i,x,z,sx,sz,yaw,material=leaf){
    const shape=new THREE.Shape();
    shape.moveTo(-.56,0); shape.bezierCurveTo(-.48,-.42,.15,-.48,.58,-.08);
    shape.bezierCurveTo(.25,.34,-.3,.42,-.56,0); shape.closePath();
    const m=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelSize:.025,bevelThickness:.018,bevelSegments:1}),material);
    m.name=`waxy_ground_leaf_${i}`; m.rotation.x=-Math.PI/2; m.rotation.z=yaw; m.position.set(x,1.05,z); m.scale.set(sx,1,sz); m.castShadow=m.receiveShadow=true; g.add(m);
  }
  [[-2.25,.18,.8,.62,-.5],[-1.72,.62,.68,.5,.4],[-2.08,1.18,.54,.42,-.9],[.92,2.45,.72,.52,.7],[1.48,2.08,.56,.46,-.25],[2.15,-1.72,.74,.56,.45],[1.62,-2.12,.55,.42,-.7]].forEach((r,i)=>lowLeaf(i,...r,i%3===1?leafDark:leaf));
  function rock(i,x,z,sx,sy,sz,material=stone){const q=new THREE.IcosahedronGeometry(1,2).toNonIndexed(),p=q.attributes.position;for(let n=0;n<p.count;n++){const k=1+.07*Math.sin(n*1.71+i*2.3);p.setXYZ(n,p.getX(n)*k,Math.round(p.getY(n)*6)/6,p.getZ(n)*(2-k));}q.computeVertexNormals();const m=new THREE.Mesh(q,material);m.name=`watercut_stone_${i}`;m.position.set(x,.47,z);m.scale.set(sx,sy,sz);m.rotation.y=i*.83;m.castShadow=m.receiveShadow=true;g.add(m);}
  [[-3.25,-2.7,.72,.45,.82],[-3.55,-.85,.65,.38,.9],[-3.4,1.2,.78,.42,.7],[-2.65,3.25,.9,.43,.72],[-.8,4.35,.72,.32,.8],[1.15,4.05,.84,.38,.7],[2.72,2.7,.82,.4,.78],[3.42,.8,.64,.36,.92],[3.32,-1.2,.85,.42,.72],[2.55,-3.35,.95,.38,.7],[.65,-4.65,.75,.31,.8],[-1.55,-4.42,.72,.34,.75]].forEach((r,i)=>rock(i,...r,i%4===0?wet:stone));
  function bentRoot(i,x,z,yaw){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.18,.28,.28),new THREE.Vector3(-.1,.18,.7),new THREE.Vector3(.12,.02,1.15)]);const m=new THREE.Mesh(new THREE.TubeGeometry(curve,8,.055,6,false),root);m.name=`bowed_root_${i}`;m.position.set(x,.3,z);m.rotation.y=yaw;m.castShadow=true;g.add(m);}
  [[-3.1,-1.8,2.8],[-3.0,2.0,2.5],[2.85,1.75,-.35],[2.9,-2.05,-.6],[-1.0,-4.0,.2],[.55,3.9,3.05]].forEach((r,i)=>bentRoot(i,...r));
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2+.2*Math.sin(i*2.1),rx=3.2+.25*Math.sin(i),rz=4.05+.3*Math.cos(i*1.7),h=.72+(i%5)*.16;const m=new THREE.Mesh(new THREE.CylinderGeometry(.018,.04,h,7),mat('foliage',0x244835,.58));m.name=`reed_${i}`;m.position.set(Math.cos(a)*rx,.55+h/2,Math.sin(a)*rz);m.rotation.z=.08*Math.sin(i*1.4);g.add(m);}
  normalize(g,THREE,[8.0,1.55,10.2]); g.userData.staticBakeable=true; g.userData.assetRole='single_asymmetric_west_wet_bank'; return g;
}
function normalize(g,THREE,target){const b=new THREE.Box3().setFromObject(g),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());g.scale.set(target[0]/s.x,target[1]/s.y,target[2]/s.z);g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=b.min.y;o.position.z-=c.z;});}
