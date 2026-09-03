export default function (THREE) {
  const g = new THREE.Group();
  const mat = (name, color, roughness, emissive = 0x000000, intensity = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, emissive, emissiveIntensity: intensity });
    m.name = name; return m;
  };
  const stone = mat('stone', 0x777363, 0.94);
  const darkStone = mat('stone', 0x343c38, 0.98);
  const wood = mat('wood', 0x4b2d24, 0.9);
  const heartwood = mat('wood', 0x82513a, 0.82);
  const foliage = mat('foliage', 0x466c4d, 0.9);
  const glow = mat('emissive', 0xffd88a, 0.3, 0xff9d36, 2.6);
  const dimGlow = mat('emissive', 0xbae4a3, 0.55, 0x538f65, 0.8);
  const add = (geo, material, pos = [0,0,0], rot = [0,0,0], scale = [1,1,1], parent = g) => {
    if (!pos.length) pos = [0,0,0]; if (!rot.length) rot = [0,0,0]; if (!scale.length) scale = [1,1,1];
    const m = new THREE.Mesh(geo, material); m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scale);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (s,p,r=[0,0,0], material=stone) => add(new THREE.BoxGeometry(...s,3,2,2), material,p,r);
  const limb = (a,b,r0,r1,material=wood,segments=14,parent=g) => {
    const av=new THREE.Vector3(...a), bv=new THREE.Vector3(...b), d=bv.clone().sub(av), mid=av.clone().add(bv).multiplyScalar(.5);
    const m=add(new THREE.CylinderGeometry(r1,r0,d.length(),segments,3),material,mid.toArray(),[0,0,0],[1,1,1],parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); return m;
  };

  // Ruined reliquary: staggered courses, broken crown, and a deep rear altar.
  box([3.45,.34,2.55],[0,.17,0]);
  box([3.08,.28,2.28],[0,.48,-.03], [0,.025,0], darkStone);
  box([2.70,.24,1.95],[0,.74,.03]);
  for (const x of [-1.28,-.82,.82,1.28]) box([.38,.55,.55],[x,1.05,-.43],[0,0,x*.035]);
  box([.52,1.18,.58],[-1.37,1.60,-.38],[0,0,.035]);
  box([.52,.88,.58],[1.37,1.44,-.38],[0,0,-.05]);
  box([.54,.35,.63],[-1.37,2.30,-.38],[0,0,.13]);
  box([.54,.28,.63],[1.37,2.02,-.38],[0,0,-.16]);
  // Reverse construction and central offering shelf.
  box([2.35,.26,.40],[0,1.00,-.88],[0,0,0],darkStone);
  box([1.65,.18,.62],[0,1.30,-.72],[-.08,0,0]);
  for (const x of [-.68,.68]) box([.22,.78,.28],[x,1.52,-.90],[0,0,x*.12],darkStone);
  box([1.58,.15,.34],[0,1.90,-.91],[0,0,0],stone);

  // Roots visibly clasp and penetrate the masonry, including substantial rear roots.
  limb([-.18,.86,.02],[-1.63,.42,.82],.29,.11,wood,16);
  limb([.18,.88,.02],[1.62,.38,.72],.30,.10,wood,16);
  limb([-.10,.90,-.05],[-1.23,.43,-1.20],.25,.09,heartwood,16);
  limb([.12,.88,-.08],[1.42,.34,-1.15],.24,.08,heartwood,16);
  limb([-.04,.94,.18],[-.66,.25,1.24],.22,.07,wood,14);
  // Split trunk traces an oval negative space; unequal shoulders give direction toward +Z/right.
  limb([-.13,.82,0],[-.62,2.35,.02],.38,.29,wood,18);
  limb([.13,.82,-.02],[.69,2.22,.02],.40,.28,heartwood,18);
  limb([-.62,2.35,.02],[-.92,3.47,.10],.30,.19,wood,16);
  limb([.69,2.22,.02],[1.02,3.33,.13],.29,.18,heartwood,16);
  limb([-.92,3.47,.10],[-.38,4.35,.13],.20,.12,wood,14);
  limb([1.02,3.33,.13],[.40,4.39,.16],.19,.11,heartwood,14);
  limb([-.38,4.35,.13],[.40,4.39,.16],.13,.11,wood,12);
  // Back braces make the cleft structural rather than a facade.
  limb([-.54,2.02,-.12],[-.18,3.82,-.42],.18,.09,wood,12);
  limb([.55,1.95,-.15],[.22,3.72,-.44],.18,.09,heartwood,12);

  // Swept crown branches create a graceful, asymmetric shrine silhouette.
  limb([-.80,3.18,.08],[-1.68,3.88,.30],.17,.075,wood,12);
  limb([-.38,4.28,.14],[-1.45,4.72,.06],.15,.06,wood,12);
  limb([.78,3.05,.10],[1.76,3.70,.50],.17,.065,heartwood,12);
  limb([.37,4.30,.15],[1.55,4.72,.34],.14,.05,heartwood,12);
  limb([1.22,3.52,.40],[1.82,4.25,.72],.10,.035,heartwood,10);

  // Sparse sculpted leaf clouds, never billboard planes.
  const leafGeo = new THREE.IcosahedronGeometry(.25,7);
  for (const [x,y,z,sx,sy,rz] of [[-1.66,4.00,.31,1.7,.65,-.3],[-1.38,4.70,.08,1.4,.6,.2],[-.62,4.76,.02,1.3,.55,-.2],[1.62,3.82,.52,1.8,.62,.25],[1.47,4.67,.32,1.5,.58,-.1],[1.83,4.30,.73,1.05,.48,.5]])
    add(leafGeo,foliage,[x,y,z],[0,0,rz],[sx,sy,.8]);

  // Levitating seed and nested halo have a clean animation pivot.
  const spirit_core = new THREE.Group(); spirit_core.name='spirit_core'; spirit_core.position.set(0,2.93,.46); g.add(spirit_core);
  add(new THREE.SphereGeometry(.27,28,18),glow,[0,0,0],[0,0,0],[.72,1.25,.72],spirit_core);
  add(new THREE.TorusGeometry(.39,.026,10,40),dimGlow,[0,0,0],[Math.PI/2,0,0],[1,1.22,1],spirit_core);

  // Two carved, volumetric spirit ribbons sweep around the aperture front and back.
  const ribbon = (name,z,phase) => { const p=new THREE.Group(); p.name=name; p.position.set(0,2.95,z); g.add(p);
    const pts=[]; for(let i=0;i<9;i++){const a=-2.35+i*.58+phase;pts.push(new THREE.Vector3(Math.cos(a)*1.04,Math.sin(a)*1.26,Math.sin(a*1.7)*.12));}
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),48,.028,7,false),dimGlow,[0,0,0],[],[],p); return p; };
  const ribbon_front=ribbon('ribbon_front',.40,0), ribbon_back=ribbon('ribbon_back',-.46,.3);

  // Draw optimization: preserve the three motion-owner boundaries, and merge only
  // meshes using the identical material object. Baking relative transforms retains
  // every vertex and normal while collapsing the static shrine into five draws.
  const mergeByOwner = (owners) => {
    g.updateMatrixWorld(true);
    for (const owner of owners) {
      const inv = new THREE.Matrix4().copy(owner.matrixWorld).invert();
      const buckets = new Map(), meshes = [];
      owner.traverse(n => {
        if (!n.isMesh) return;
        let p = n.parent, nestedOwner = false;
        while (p && p !== owner) { if (owners.includes(p)) { nestedOwner = true; break; } p = p.parent; }
        if (nestedOwner) return;
        meshes.push(n);
        const geo = n.geometry.index ? n.geometry.toNonIndexed() : n.geometry.clone();
        geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, n.matrixWorld));
        if (!buckets.has(n.material)) buckets.set(n.material, []);
        buckets.get(n.material).push(geo);
      });
      for (const n of meshes) n.parent.remove(n);
      for (const [material, geos] of buckets) {
        const attrs = ['position','normal','uv'].filter(k => geos.every(x => x.getAttribute(k)));
        const merged = new THREE.BufferGeometry();
        for (const key of attrs) {
          const first = geos[0].getAttribute(key), count = geos.reduce((s,x)=>s+x.getAttribute(key).array.length,0);
          const data = new first.array.constructor(count); let offset = 0;
          for (const geo of geos) { const a=geo.getAttribute(key).array; data.set(a,offset); offset+=a.length; }
          merged.setAttribute(key,new THREE.BufferAttribute(data,first.itemSize,first.normalized));
        }
        merged.computeBoundingBox(); merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged,material); mesh.castShadow=true; mesh.receiveShadow=true; owner.add(mesh);
      }
    }
  };
  mergeByOwner([g, spirit_core, ribbon_front, ribbon_back]);

  // Normalize finished transformed vertices to the exact requested envelope.
  const bounds = new THREE.Box3(), v = new THREE.Vector3();
  const measure=()=>{bounds.makeEmpty();g.updateMatrixWorld(true);g.traverse(n=>{const p=n.isMesh&&n.geometry.attributes.position;if(!p)return;for(let i=0;i<p.count;i++)bounds.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));});};
  measure(); const size=bounds.getSize(new THREE.Vector3()); g.scale.set(4.2/size.x,5.6/size.y,3.2/size.z); measure();
  const c=bounds.getCenter(new THREE.Vector3()); g.children.forEach(o=>{o.position.x-=c.x/g.scale.x;o.position.y-=bounds.min.y/g.scale.y;o.position.z-=c.z/g.scale.z;});
  g.userData.asset='spirit_reward_tree_c';
  g.userData.joints={spirit_core,ribbon_front,ribbon_back};
  return g;
}

