// 404 Path B candidate B: closed, grounded terrain volume.
// Reference: Treacherous Waters flooded karst banks and supplied defect screenshot.
export default function generate(THREE) {
  const root = new THREE.Group();
  root.name = "bank_rock_shelf_b_closed_flooded_bank";
  const material = (name,color,roughness) => { const m = new THREE.MeshStandardMaterial({color,roughness,metalness:0}); m.name=name; return m; };
  const stone = material('stone',0x465b55,.62);
  const wetStone = material('stone',0x263f3c,.48);
  const ground = material('ground',0x253127,.76);
  const moss = material('foliage',0x476a43,.67);
  const timber = material('timber',0x30281d,.63);
  const W=7.2, H=3.8, D=4.6, NX=15, NZ=17, SEED=23;
  const island=false;
  const variant="b";
  const verts=[], indices=[], groups=[];
  const top=[];
  function height(x,z){
    const u=x/(W*.5), v=z/(D*.5);
    const radial=Math.max(0,1-Math.pow(Math.min(1,Math.hypot(u*(island?1:.72),v*(island?.92:1.2))),1.7));
    const shoulder=Math.max(0,1-Math.abs(u));
    const ridge=variant==='a' ? .16*Math.sin(u*5.4+SEED)+.1*Math.cos(v*6.1-SEED) : variant==='b' ? .12*Math.sin((u+v)*7.3)+.08*Math.cos(u*9.2) : .13*Math.cos(u*4.1-v*6.8)+.09*Math.sin(v*10.2);
    const terrace=Math.floor((radial + ridge*.28)*5)/5;
    const form=island ? radial : (.18+.82*shoulder)*(0.42+.58*Math.max(0,1-(v*.78)*(v*.78)));
    return Math.max(.10,H*(variant==='b' ? .18+.82*terrace : .16+.84*form)+ridge*H*.28);
  }
  for(let iz=0;iz<NZ;iz++){ top[iz]=[]; for(let ix=0;ix<NX;ix++){
    const x=-W/2+W*ix/(NX-1), z=-D/2+D*iz/(NZ-1);
    const inset=(ix===0||ix===NX-1||iz===0||iz===NZ-1) ? .08*H : 0;
    const y=Math.max(.08,height(x,z)-inset); top[iz][ix]=verts.length/3; verts.push(x,y,z);
  }}
  for(let iz=0;iz<NZ-1;iz++) for(let ix=0;ix<NX-1;ix++) { const a=top[iz][ix],b=top[iz][ix+1],c=top[iz+1][ix+1],d=top[iz+1][ix]; indices.push(a,d,b,b,d,c); }
  const perimeter=[];
  for(let ix=0;ix<NX;ix++) perimeter.push(top[0][ix]);
  for(let iz=1;iz<NZ;iz++) perimeter.push(top[iz][NX-1]);
  for(let ix=NX-2;ix>=0;ix--) perimeter.push(top[NZ-1][ix]);
  for(let iz=NZ-2;iz>0;iz--) perimeter.push(top[iz][0]);
  const bottom=[]; for(const ti of perimeter){bottom.push(verts.length/3); verts.push(verts[ti*3],0,verts[ti*3+2]);}
  const center=verts.length/3; verts.push(0,0,0);
  const sideStart=indices.length;
  for(let i=0;i<perimeter.length;i++){const j=(i+1)%perimeter.length;indices.push(perimeter[i],bottom[i],perimeter[j],perimeter[j],bottom[i],bottom[j]);}
  const bottomStart=indices.length;
  for(let i=0;i<bottom.length;i++){const j=(i+1)%bottom.length;indices.push(center,bottom[j],bottom[i]);}
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3)); geo.setIndex(indices); geo.computeVertexNormals();
  geo.clearGroups(); geo.addGroup(0,sideStart,0); geo.addGroup(sideStart,bottomStart-sideStart,1); geo.addGroup(bottomStart,indices.length-bottomStart,2);
  // One connected shell owns the entire silhouette. Surface detail is supplied
  // by the game-side PBR recipes, never by detached decorative geometry.
  const body=new THREE.Mesh(geo,[moss,wetStone,ground]); body.name='continuous_closed_bank_body'; body.castShadow=body.receiveShadow=true; root.add(body);
  root.updateMatrixWorld(true); let bounds=new THREE.Box3().setFromObject(root), measured=bounds.getSize(new THREE.Vector3());
  root.scale.set(W/measured.x,H/measured.y,D/measured.z); root.updateMatrixWorld(true);
  bounds=new THREE.Box3().setFromObject(root); const centerXZ=bounds.getCenter(new THREE.Vector3());
  root.position.set(-centerXZ.x,-bounds.min.y,-centerXZ.z); root.updateMatrixWorld(true);
  root.userData.staticBakeable=true; root.userData.assetRole="bank_rock_shelf"; root.userData.closedGeometry=true; root.userData.materialFamilies=['stone','ground','foliage','timber'];
  return root;
}