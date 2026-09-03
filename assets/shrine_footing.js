export default function (THREE) {
  const root = new THREE.Group();
  root.name = 'shrine_footing_waterline_apron';

  const material = (name, color, roughness = 0.96) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    m.name = name;
    return m;
  };
  const submergedStone = material('stone_submerged_masonry', 0x263734, 0.91);
  const oldStone = material('stone_weathered_course', 0x526059, 0.96);
  const silt = material('soil_waterline_silt', 0x39382d, 1);
  const moss = material('foliage_waterline_moss', 0x405338, 1);
  const rootMat = material('foliage_exposed_roots', 0x44382b, 1);

  const add = (geometry, mat, name, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  // Organic concentric shelves. Each outline changes direction frequently, so the
  // waterline never reads as a disguised rectangular slab from any approach.
  const outline = [
    [-6.40,-3.42],[-6.12,-4.12],[-5.36,-4.48],[-4.42,-4.35],[-3.72,-4.68],
    [-2.70,-4.42],[-1.72,-4.75],[-0.72,-4.49],[0.18,-4.66],[1.12,-4.40],
    [2.08,-4.65],[3.02,-4.36],[4.06,-4.58],[4.92,-4.24],[5.78,-4.36],
    [6.22,-3.82],[6.08,-3.05],[6.40,-2.25],[6.15,-1.35],[6.34,-0.46],
    [6.10,0.42],[6.32,1.28],[6.02,2.20],[6.24,3.05],[5.82,3.92],
    [5.08,4.23],[4.16,4.05],[3.28,4.52],[2.30,4.28],[1.34,4.62],
    [0.32,4.38],[-0.62,4.57],[-1.58,4.31],[-2.48,4.55],[-3.34,4.24],
    [-4.34,4.43],[-5.22,4.12],[-5.96,4.24],[-6.31,3.53],[-6.12,2.70],
    [-6.36,1.88],[-6.15,0.98],[-6.40,0.12],[-6.17,-0.72],[-6.36,-1.56],[-6.13,-2.38]
  ];
  const shelf = (points, h, y, mat, name, scale = 1) => {
    const shape = new THREE.Shape();
    points.forEach((p, i) => (i ? shape.lineTo(p[0] * scale, p[1] * scale) : shape.moveTo(p[0] * scale, p[1] * scale)));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, steps: 1, curveSegments: 1 });
    geo.rotateX(Math.PI / 2);
    // Extrusion points down after rotation: y is the desired top surface.
    return add(geo, mat, name, 0, y, 0);
  };
  shelf(outline, 0.30, 0.30, submergedStone, 'continuous_submerged_foundation', 1);
  shelf(outline, 0.13, 0.43, silt, 'irregular_silt_skirt', 0.955);
  shelf(outline, 0.10, 0.52, moss, 'moss_waterline_shelf', 0.905);

  // Broken upper masonry: short separated runs leave an open centre for the 11 x 8m
  // gameplay platform, while clearly continuing its old foundation around all sides.
  const blocks = [
    [-4.72,-3.93,1.42,.46,.34,.05],[-2.80,-4.03,1.55,.40,.32,-.04],[-.72,-4.10,1.32,.46,.30,.03],
    [1.35,-4.02,1.48,.42,.34,-.03],[3.36,-4.04,1.30,.45,.31,.05],[5.05,-3.77,.88,.42,.38,-.11],
    [-5.78,-2.66,.56,1.20,.32,-.04],[-5.91,-.88,.48,1.18,.34,.05],[-5.82,.92,.55,1.04,.30,-.06],[-5.76,2.65,.58,1.12,.37,.08],
    [5.79,-2.52,.58,1.12,.34,.05],[5.88,-.72,.48,1.25,.31,-.05],[5.76,1.10,.54,1.10,.36,.08],[5.72,2.83,.62,1.00,.32,-.07],
    [-4.92,3.82,1.18,.48,.32,-.04],[-3.08,4.02,1.32,.40,.36,.06],[-1.10,4.02,1.42,.44,.30,-.03],
    [.92,4.00,1.30,.45,.34,.04],[2.88,3.96,1.40,.42,.31,-.05],[4.72,3.80,1.08,.48,.36,.07]
  ];
  for (let i = 0; i < blocks.length; i++) {
    const [x,z,w,d,h,r] = blocks[i];
    const geo = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
    const b = add(geo, i % 5 === 0 ? moss : oldStone, `broken_perimeter_stone_${i}`, x, 0.43 + h / 2, z);
    b.rotation.y = r;
    b.rotation.z = ((i % 3) - 1) * 0.018;
  }

  // Small interruptions break the rhythm further: two stones and two exposed roots,
  // deliberately kept outside the playable floor footprint.
  const interruptions = [
    [-5.55,.52,-3.60,.62,.22,.50,-.18], [5.58,.49,3.55,.55,.18,.46,.20]
  ];
  interruptions.forEach((q, i) => {
    const m = add(new THREE.DodecahedronGeometry(0.5, 0), oldStone, `tumbled_waterline_stone_${i}`, q[0], q[1], q[2]);
    m.scale.set(q[3], q[4], q[5]); m.rotation.y = q[6];
  });
  [[-5.84,0.43,3.40,.72,-.22],[5.88,0.42,-3.40,.68,.18]].forEach((q, i) => {
    const geo = new THREE.CylinderGeometry(0.075, 0.12, q[3], 7, 1, false);
    const r = add(geo, rootMat, `exposed_root_${i}`, q[0], q[1], q[2]);
    r.rotation.z = Math.PI / 2; r.rotation.y = q[4];
  });

  // Exact contract: 12.8 W x 0.62 H x 9.5 D, base y=0 and centred.
  const measure = () => {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    root.traverse((n) => { if (n.isMesh) box.expandByObject(n); });
    return box;
  };
  let box = measure();
  const size = box.getSize(new THREE.Vector3());
  root.scale.set(12.8 / size.x, 0.62 / size.y, 9.5 / size.z);
  root.updateMatrixWorld(true);
  box = measure();
  const center = box.getCenter(new THREE.Vector3());
  root.children.forEach((n) => {
    n.position.x -= center.x / root.scale.x;
    n.position.y -= box.min.y / root.scale.y;
    n.position.z -= center.z / root.scale.z;
  });

  root.userData.staticBakeable = true;
  root.userData.placement = { worldY: -0.30, waterY: 0, platformFootprint: [11, 8] };
  return root;
}
