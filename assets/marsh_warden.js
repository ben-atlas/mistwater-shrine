export default function (THREE) {
  const g = new THREE.Group();
  const hide = new THREE.MeshStandardMaterial({ color: 0x263f32, roughness: .72 }); hide.name = 'foliage';
  const belly = new THREE.MeshStandardMaterial({ color: 0x718064, roughness: .86 }); belly.name = 'foliage';
  const scute = new THREE.MeshStandardMaterial({ color: 0x182d25, roughness: .8 }); scute.name = 'foliage';
  const tooth = new THREE.MeshStandardMaterial({ color: 0xd8d0ad, roughness: .72 }); tooth.name = 'stone';
  const bronze = new THREE.MeshStandardMaterial({ color: 0x806a35, roughness: .52, metalness: .62 }); bronze.name = 'metal';
  const cord = new THREE.MeshStandardMaterial({ color: 0x743526, roughness: .9 }); cord.name = 'fabric';
  const eye = new THREE.MeshStandardMaterial({ color: 0xb7b142, roughness: .35, emissive: 0x303408, emissiveIntensity: .35 });
  const add = (geo, mat, p, s, r=[0,0,0], parent=g) => { const m=new THREE.Mesh(geo,mat); m.position.set(...p); m.scale.set(...s); m.rotation.set(...r); m.castShadow=true; parent.add(m); return m; };
  const body = add(new THREE.SphereGeometry(1,18,12), hide, [0,.48,.28],[.62,.36,1.03]); body.name='torso';
  add(new THREE.SphereGeometry(1,16,10), belly,[0,.29,-.58],[.58,.27,.66]);
  const head=add(new THREE.SphereGeometry(1,16,10),hide,[0,.43,-1.08],[.53,.27,.62]); head.name='head';
  add(new THREE.SphereGeometry(1,14,8),hide,[0,.35,-1.60],[.43,.20,.58]);
  add(new THREE.SphereGeometry(1,14,8),belly,[0,.29,-1.59],[.42,.12,.56]);
  for(const x of [-.27,.27]) { add(new THREE.SphereGeometry(1,10,8),hide,[x,.59,-1.12],[.13,.12,.15]); add(new THREE.SphereGeometry(1,8,6),eye,[x,.64,-1.19],[.048,.055,.04]); }
  for(const x of [-.32,-.16,0,.16,.32]) add(new THREE.ConeGeometry(.035,.13,5),tooth,[x,.24,-1.93],[1,1,1],[Math.PI/2,0,0]);
  for(const [x,z,a] of [[-.48,-.38,-.42],[.48,-.38,.42],[-.47,.66,-.32],[.47,.66,.32]]) { const leg=new THREE.Group(); leg.position.set(x,.30,z); leg.rotation.y=a; g.add(leg); add(new THREE.SphereGeometry(1,10,7),hide,[x<0?-.16:.16,-.03,0],[.26,.16,.38],[0,0,x<0?.35:-.35],leg); add(new THREE.SphereGeometry(1,9,6),hide,[x<0?-.34:.34,-.19,-.08],[.25,.09,.23], [0,0,0],leg); for(let i=-1;i<=1;i++) add(new THREE.ConeGeometry(.025,.14,5),tooth,[x<0?-.48:.48+i*.06,-.2,-.22+i*.03],[1,1,1],[Math.PI/2,0,0],leg); }
  let z=1.14; for(let i=0;i<7;i++){ const t=i/7, seg=add(new THREE.SphereGeometry(1,12,8),hide,[Math.sin(i*.45)*.08,.42-i*.045,z],[.48*(1-t)+.07,.25*(1-t)+.04,.38]); seg.name=`tail_${i}`; z+=.33; }
  for(let row=0;row<2;row++) for(let i=0;i<9;i++){ const z0=-.45+i*.22; add(new THREE.ConeGeometry(.075,.20,4),scute,[row?-.18:.18,.83-Math.abs(z0)*.08,z0],[1,1,1],[0,0,row?.15:-.15]); }
  add(new THREE.BoxGeometry(1,.10,1),bronze,[0,.72,-1.34],[.22,1,.30],[.10,0,0]);
  add(new THREE.TorusGeometry(.48,.025,6,24,Math.PI*1.55),cord,[0,.60,-.80],[1,1,.72],[Math.PI/2,.2,.35]);
  g.userData.joints={ head, body }; g.userData.front='+Z';
  g.rotation.y=Math.PI; g.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(g), c=box.getCenter(new THREE.Vector3()); g.position.set(-c.x,-box.min.y,-c.z);
  return g;
}
