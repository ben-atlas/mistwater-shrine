export default function (THREE) {
  const root = new THREE.Group();
  root.name = 'shrine_footing_b';
  root.userData.staticBakeable = true;

  const makeMaterial = (name, color, roughness = 0.95) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness });
    material.name = name; return material;
  };
  const stone = makeMaterial('stone', 0x59635e, 0.98);
  const darkStone = makeMaterial('stone', 0x293b3c, 1.0);
  const paleStone = makeMaterial('stone', 0x778078, 0.96);
  const soil = makeMaterial('soil', 0x4a3929, 1.0);
  const wetSoil = makeMaterial('soil', 0x292820, 1.0);
  const moss = makeMaterial('foliage', 0x4b693c, 1.0);
  const reeds = makeMaterial('foliage', 0x70804c, 0.94);

  const add = (geometry, material, name) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  };

  // Hand-authored concentric shoreline rings. The perimeter wanders while the broad middle
  // remains low and unobtrusive beneath the 11 x 8 m shrine platform.
  const count = 28;
  const outer = [], mid = [], inner = [];
  const noise = [1,.94,1.04,.91,1.02,.97,1.06,.93,1,.89,1.04,.96,1.03,.92,1.07,.95,1.01,.90,1.05,.94,1.02,.91,1.06,.96,1.01,.92,1.04,.95];
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    const asymX = .18 * Math.sin(a * 3 + .6) + .10 * Math.cos(a * 5);
    const asymZ = .15 * Math.sin(a * 4 - .4);
    outer.push([Math.cos(a) * 6.36 * noise[i] + asymX, .075 + .025 * Math.sin(a * 3), Math.sin(a) * 4.70 * noise[(i + 5) % count] + asymZ]);
    mid.push([Math.cos(a) * (5.82 + .12 * Math.sin(a * 5)), .28 + .035 * Math.cos(a * 4), Math.sin(a) * (4.18 + .11 * Math.sin(a * 3))]);
    inner.push([Math.cos(a) * 5.20, .45 + .018 * Math.sin(a * 2), Math.sin(a) * 3.70]);
  }

  function annulus(ringA, ringB, material, name) {
    const vertices = [], indices = [];
    for (let i = 0; i < count; i++) vertices.push(...ringA[i], ...ringB[i]);
    for (let i = 0; i < count; i++) {
      const n = (i + 1) % count, a = i * 2, b = a + 1, c = n * 2, d = c + 1;
      indices.push(a, c, b, c, d, b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return add(geometry, material, name);
  }
  annulus(outer, mid, darkStone, 'submerged_eroded_toe');
  annulus(mid, inner, soil, 'sloped_shore_bank');

  // Low central cap sits under the platform. Its rounded irregular edge cannot read as a slab.
  const capShape = new THREE.Shape();
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    const x = Math.cos(a) * 5.22, z = Math.sin(a) * 3.72;
    if (i === 0) capShape.moveTo(x, z); else capShape.lineTo(x, z);
  }
  capShape.closePath();
  const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: .09, steps: 1, bevelEnabled: false, curveSegments: 1 });
  capGeo.rotateX(Math.PI / 2); capGeo.translate(0, .45, 0);
  add(capGeo, wetSoil, 'low_islet_crown');

  // Uneven waterline shelves sit around all sides, separated by bites of soil and water.
  const shelfData = [
    [-4.65,.27,3.82,1.40,.16,.58,-.12],[-2.25,.30,4.15,1.22,.15,.50,.08],[.45,.31,4.25,1.35,.14,.48,-.04],[3.18,.29,3.98,1.55,.16,.54,.10],
    [-4.98,.28,-3.66,1.34,.15,.57,.09],[-2.05,.31,-4.17,1.42,.14,.46,-.08],[1.05,.29,-4.22,1.25,.16,.51,.05],[4.05,.28,-3.52,1.46,.15,.55,-.11],
    [-5.72,.30,1.72,.58,.15,1.15,.04],[-5.88,.28,-1.05,.55,.14,1.28,-.05],[5.86,.29,1.34,.56,.16,1.20,-.06],[5.72,.30,-1.62,.61,.14,1.10,.08],
  ];
  for (const [x,y,z,sx,sy,sz,rot] of shelfData) {
    const rock = add(new THREE.IcosahedronGeometry(1, 2), stone, 'waterline_stone_shelf');
    rock.position.set(x,y,z); rock.scale.set(sx,sy,sz); rock.rotation.set(.04,rot,.03);
  }

  // Moss cushions overlap selected shelves and make the waterline legible at game distance.
  for (const [x,z,sx,sz] of [[-4.6,3.95,.72,.29],[.4,4.31,.74,.25],[4.15,-3.60,.78,.28],[-5.88,-1.0,.29,.65],[5.84,1.3,.30,.67]]) {
    const patch = add(new THREE.IcosahedronGeometry(1, 2), moss, 'mossy_waterline');
    patch.position.set(x,.405,z); patch.scale.set(sx,.055,sz); patch.rotation.y = x * .13;
  }

  // Fallen corner masonry implies the footprint of older construction without crowding the top.
  const blockData = [
    [-5.00,.45,3.05,.82,.30,.52,-.20],[-4.36,.43,3.48,.58,.26,.44,.13],
    [4.85,.44,-3.07,.78,.28,.56,.17],[5.33,.39,-2.50,.50,.24,.40,-.28],
    [4.72,.40,3.20,.52,.22,.48,.32],[-4.95,.41,-3.00,.57,.24,.45,-.25],
  ];
  for (const [x,y,z,w,h,d,ry] of blockData) {
    const b = add(new THREE.BoxGeometry(w,h,d,2,2,2), paleStone, 'broken_corner_block');
    b.position.set(x,y,z); b.rotation.set(.06,ry,(x + z) * .012);
  }

  // Sparse woody roots bridge from buried platform edge into the shore.
  function branch(a, b, radius) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const delta = vb.clone().sub(va), mesh = add(new THREE.CylinderGeometry(radius*.7,radius,delta.length(),9,2), soil, 'exposed_root');
    mesh.position.copy(va).add(vb).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  }
  branch([-4.55,.47,2.85],[-5.80,.20,3.68],.085);
  branch([4.60,.47,-2.82],[5.73,.18,-3.75],.09);
  branch([-5.10,.44,-2.45],[-5.92,.19,-3.30],.07);

  // Two small reed clumps are enough to sell wet ground without becoming a garden border.
  for (const [x,z] of [[-5.74,2.35],[5.62,-2.20]]) {
    const tuft = new THREE.Group(); tuft.position.set(x,.28,z); root.add(tuft);
    for (let i = 0; i < 3; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.018,.026,.32 + i*.06,6), reeds);
      stem.name = 'reed_stem'; stem.position.set((i-1)*.07,.16+i*.03,(i%2)*.05); stem.rotation.z=(i-1)*.08;
      stem.castShadow=true; tuft.add(stem);
    }
  }

  // Finished-vertex normalization preserves the exact requested footprint despite irregularity.
  const bounds = new THREE.Box3(), point = new THREE.Vector3(), matrix = new THREE.Matrix4(), instance = new THREE.Matrix4();
  function measure() {
    bounds.makeEmpty(); root.updateMatrixWorld(true);
    root.traverse((node) => {
      const position = node.isMesh && node.geometry.attributes.position; if (!position) return;
      const put = (mat) => { for (let i=0;i<position.count;i++) bounds.expandByPoint(point.fromBufferAttribute(position,i).applyMatrix4(mat)); };
      if (node.isInstancedMesh) { for(let i=0;i<node.count;i++){node.getMatrixAt(i,instance);put(matrix.multiplyMatrices(node.matrixWorld,instance));} }
      else put(node.matrixWorld);
    });
  }
  measure();
  const size = bounds.getSize(new THREE.Vector3());
  root.scale.set(12.8/size.x,.62/size.y,9.5/size.z);
  measure();
  const center = bounds.getCenter(new THREE.Vector3());
  root.children.forEach((child) => {
    child.position.x -= center.x/root.scale.x;
    child.position.y -= bounds.min.y/root.scale.y;
    child.position.z -= center.z/root.scale.z;
  });
  return root;
}
