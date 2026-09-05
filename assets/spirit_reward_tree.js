// Candidate A: a static, fully authored mist-spirit tree and altar reward shrine.
export default function generate(THREE) {
  const root = new THREE.Group();

  const makeMaterial = (name, color, roughness, emissive = 0x000000, intensity = 0) => {
    const m = new THREE.MeshStandardMaterial({
      color, roughness, metalness: 0, emissive, emissiveIntensity: intensity,
    });
    m.name = name;
    return m;
  };
  const stone = makeMaterial('stone', 0x59645f, 0.94);
  const stoneDark = makeMaterial('stone', 0x343e3b, 0.97);
  const wood = makeMaterial('wood', 0x594335, 0.91);
  const woodPale = makeMaterial('wood', 0x86745b, 0.87);
  const foliage = makeMaterial('foliage', 0x426b59, 0.89);
  const glow = makeMaterial('emissive', 0xffc46b, 0.32, 0xff9c3c, 2.35);
  const mistGlow = makeMaterial('emissive', 0x8ddac9, 0.48, 0x4cb7a5, 0.8);

  const add = (geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], parent = root) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const tube = (points, radii, material, segments = 22, radial = 9) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    const geo = new THREE.TubeGeometry(curve, segments, 1, radial, false);
    const pos = geo.attributes.position;
    // TubeGeometry has a constant radius. A custom taper is applied by moving each
    // ring vertex toward its sampled centre, preserving the curve's clean sweep.
    for (let ring = 0; ring <= segments; ring++) {
      const t = ring / segments;
      const centre = curve.getPointAt(t);
      const radius = radii[0] + (radii[1] - radii[0]) * t;
      for (let j = 0; j <= radial; j++) {
        const i = ring * (radial + 1) + j;
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        v.sub(centre).multiplyScalar(radius).add(centre);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return add(geo, material);
  };

  // Broad, stepped altar footing: radial profiles read as masonry from every side.
  const plinthProfile = [
    [0.00, 1.78], [0.16, 1.78], [0.21, 1.58], [0.36, 1.52],
    [0.42, 1.30], [0.60, 1.24], [0.66, 1.04], [0.76, 0.98], [0.80, 0.00],
  ].map(([y, r]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(plinthProfile, 32), stone);
  add(new THREE.CylinderGeometry(1.46, 1.53, 0.13, 32), stoneDark, [0, 0.42, 0]);
  // Four heavy corner stones keep the circular base feeling ancient and constructed.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    add(new THREE.DodecahedronGeometry(0.34, 1), stoneDark,
      [Math.cos(a) * 1.38, 0.27, Math.sin(a) * 1.38], [0.12, a, 0.08], [1.28, 0.66, 1.0]);
  }

  // Eight roots grip the altar and make an asymmetric star-shaped footprint.
  const rootEnds = [
    [-1.78, 0.15, 0.58], [1.72, 0.12, 0.70], [-1.50, 0.11, -1.02], [1.42, 0.14, -1.15],
    [-0.63, 0.12, 1.36], [0.72, 0.10, 1.43], [-0.46, 0.10, -1.50], [0.55, 0.12, -1.46],
  ];
  rootEnds.forEach((end, i) => {
    const side = end[0] < 0 ? -1 : 1;
    tube([[side * 0.48, 1.18, end[2] * 0.12], [side * 0.74, 0.68, end[2] * 0.46], end],
      [0.30 - (i % 3) * 0.025, 0.11], i % 3 === 0 ? woodPale : wood, 18, 9);
  });

  // Two trunks bow apart around the reward, forming the defining open cradle.
  tube([[-0.50, 0.62, 0.00], [-0.74, 1.65, -0.08], [-0.88, 2.60, 0.03], [-0.70, 3.48, -0.02], [-0.35, 4.20, 0.02]], [0.42, 0.23], wood, 30, 12);
  tube([[0.46, 0.61, 0.02], [0.70, 1.54, 0.10], [0.84, 2.48, -0.04], [0.66, 3.42, 0.04], [0.28, 4.22, -0.02]], [0.40, 0.22], woodPale, 30, 12);
  // Crown arch and antler-like boughs close the silhouette without closing the opening.
  tube([[-0.35, 4.18, 0.02], [-0.18, 4.56, 0.00], [0, 4.74, 0.02], [0.20, 4.55, 0.00], [0.28, 4.20, -0.02]], [0.22, 0.20], wood, 24, 10);
  const boughs = [
    [[-0.72,3.38,0],[-1.15,3.85,0.10],[-1.62,4.12,0.18],[-1.90,4.58,0.10]],
    [[0.69,3.38,0],[1.12,3.86,-0.12],[1.60,4.12,-0.18],[1.88,4.56,-0.08]],
    [[-0.30,4.30,0],[-0.76,4.72,-0.20],[-1.12,5.18,-0.26],[-1.45,5.44,-0.18]],
    [[0.28,4.30,0],[0.72,4.73,0.22],[1.08,5.18,0.28],[1.38,5.46,0.18]],
    [[-1.18,4.15,0.12],[-1.52,4.55,0.55],[-1.63,4.92,0.74]],
    [[1.16,4.16,-0.12],[1.48,4.56,-0.56],[1.61,4.93,-0.72]],
  ];
  boughs.forEach((pts, i) => tube(pts, [0.20 - (i > 3 ? 0.04 : 0), 0.075], i % 2 ? woodPale : wood, 22, 9));

  // Stone offering bowl nested into the roots, open toward +Z and mirrored on the back.
  const bowlProfile = [
    [0.00,0.82],[0.08,0.96],[0.17,1.08],[0.31,1.15],[0.40,1.08],
    [0.28,0.91],[0.16,0.85],[0.07,0.78],
  ].map(([y, r]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(bowlProfile, 30), stoneDark);
  for (const z of [-1, 1]) {
    add(new THREE.TorusGeometry(0.72, 0.075, 8, 28, Math.PI * 0.72), stone,
      [0, 1.24, z * 0.28], [Math.PI / 2, 0, z > 0 ? 0.42 : -2.72]);
  }

  // The warm spirit orb is the visual reward and remains clear through the opening.
  add(new THREE.SphereGeometry(0.43, 32, 20), glow, [0, 2.35, 0]);
  add(new THREE.TorusGeometry(0.57, 0.035, 8, 40), mistGlow, [0, 2.35, 0], [Math.PI / 2, 0.18, 0.08]);
  add(new THREE.TorusGeometry(0.69, 0.026, 7, 44, Math.PI * 1.45), mistGlow, [0, 2.35, 0], [0.22, 0.72, -0.48]);

  // Sparse leaf clusters, modeled as dimensional forms rather than billboards.
  const leafData = [
    [-1.89,4.58,.10,-.5],[-1.48,5.38,-.18,.35],[-1.02,5.10,-.35,-.2],
    [1.86,4.56,-.08,.55],[1.40,5.40,.18,-.4],[1.02,5.09,.38,.3],
    [-1.62,4.91,.70,.7],[1.60,4.92,-.70,-.65],[-.12,4.78,.32,.1],[.16,4.76,-.32,-.1],
  ];
  leafData.forEach(([x,y,z,rz], i) => add(new THREE.OctahedronGeometry(0.24, 1), foliage,
    [x,y,z], [0.25 * (i % 3), i * 0.61, rz], [0.58, 1.45, 0.34]));

  // Exact finished-vertex normalization: 4.2m W x 5.6m H x 3.2m D, grounded and centered.
  const bounds = new THREE.Box3();
  const v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    const p = node.isMesh && node.geometry.attributes.position;
    if (!p) return;
    for (let i = 0; i < p.count; i++) bounds.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(node.matrixWorld));
  });
  const size = bounds.getSize(new THREE.Vector3());
  root.scale.set(4.2 / size.x, 5.6 / size.y, 3.2 / size.z);
  root.updateMatrixWorld(true);
  bounds.makeEmpty();
  root.traverse((node) => {
    const p = node.isMesh && node.geometry.attributes.position;
    if (!p) return;
    for (let i = 0; i < p.count; i++) bounds.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(node.matrixWorld));
  });
  const centre = bounds.getCenter(new THREE.Vector3());
  root.children.forEach((child) => {
    child.position.x -= centre.x / root.scale.x;
    child.position.y -= bounds.min.y / root.scale.y;
    child.position.z -= centre.z / root.scale.z;
  });

  root.userData.asset = 'mist_spirit_tree_altar_a';
  root.userData.assetRole = 'premium_shrine_reward';
  root.userData.staticBakeable = true;
  return root;
}
