export default function generate(THREE) {
  const root = new THREE.Group();
  root.name = "sanctuary_basin_shell_b";

  const material = (name, color, roughness = 0.96) =>
    new THREE.MeshStandardMaterial({
      name,
      color,
      roughness,
      metalness: 0,
      flatShading: true,
    });
  const stone = material("stone", 0x58635d);
  const stoneDark = material("stone", 0x34453f, 1);
  const stoneEdge = material("stone", 0x788078, 0.92);
  const ground = material("ground", 0x263c31, 1);
  const timber = material("timber", 0x302923, 0.98);
  const foliage = material("foliage", 0x304b2c, 0.95);
  const foliageLight = material("foliage", 0x5b7846, 0.91);

  const add = (geometry, mat, name, position, scale, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  // Deterministically eroded boulders make the flanks read as grown karst,
  // rather than as walls. Broad facets remain legible after static baking.
  const hash = (n) => {
    const x = Math.sin(n * 91.731 + 17.17) * 43758.5453;
    return x - Math.floor(x);
  };
  function rock(seed, position, scale, mat = stone) {
    const geometry = new THREE.IcosahedronGeometry(1, 3);
    const p = geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const angle = Math.atan2(v.z, v.x);
      const strata = Math.sin(v.y * 16 + seed) * 0.045;
      const ribs = Math.sin(angle * 5 + v.y * 5 + seed * 0.3) * 0.055;
      const chip = (hash(seed * 101 + i) - 0.5) * 0.085;
      v.multiplyScalar(1 + strata + ribs + chip);
      if (v.y < -0.72) v.y = -0.74 - hash(seed + i) * 0.025;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();
    return add(geometry, mat, `karst_${seed}`, position, scale, [
      (hash(seed + 1) - 0.5) * 0.18,
      (hash(seed + 2) - 0.5) * 0.44,
      (hash(seed + 3) - 0.5) * 0.14,
    ]);
  }

  // A submerged three-step terrace occupies the rear half of the basin. Its
  // low centre is deliberately clear for gate, hero, and reward silhouettes.
  add(new THREE.BoxGeometry(12.6, 0.35, 4.7, 5, 1, 3), ground,
    "submerged_terrace_lower", [0, 0.05, -1.95], [1, 1, 1]);
  add(new THREE.BoxGeometry(10.7, 0.28, 2.85, 5, 1, 3), stoneDark,
    "submerged_terrace_middle", [0, 0.29, -3.05], [1, 1, 1]);
  add(new THREE.BoxGeometry(8.9, 0.24, 1.45, 5, 1, 2), stone,
    "submerged_terrace_dais", [0, 0.52, -3.77], [1, 1, 1]);
  for (let i = -4; i <= 4; i++) {
    const x = i * 1.02;
    add(new THREE.BoxGeometry(0.035, 0.02, 1.25), stoneEdge,
      `dais_course_${i + 4}`, [x, 0.655, -3.77], [1, 1, 1], [0, (i % 2) * 0.025, 0]);
  }

  // Staggered side masses wrap forward, blocking the pale horizon at the
  // edges while leaving a generous 7 m-wide central shrine corridor.
  const flankData = [
    [-7.8, 2.25, -3.75, 2.25, 3.4, 1.7], [-6.85, 3.4, -4.15, 2.2, 4.55, 1.6],
    [-7.55, 2.1, -0.8, 2.0, 3.15, 1.65], [-7.85, 1.65, 2.15, 1.75, 2.55, 1.55],
    [7.8, 2.4, -3.65, 2.25, 3.55, 1.7], [6.9, 3.55, -4.15, 2.15, 4.7, 1.65],
    [7.5, 2.05, -0.75, 2.05, 3.15, 1.7], [7.9, 1.55, 2.2, 1.7, 2.5, 1.5],
  ];
  flankData.forEach((r, i) => rock(20 + i, r.slice(0, 3), r.slice(3), i % 3 === 0 ? stoneDark : stone));

  // Rear shoulder clusters make a dark backdrop, with a clean central notch
  // rather than a flat wall. The notch frames the shrine gate and reward.
  rock(41, [-5.65, 5.8, -4.62], [3.25, 5.1, 1.15], stoneDark);
  rock(42, [5.8, 5.95, -4.6], [3.3, 5.2, 1.2], stoneDark);
  rock(43, [-3.9, 7.35, -4.72], [2.0, 2.2, 1.0], stone);
  rock(44, [4.1, 7.45, -4.69], [2.1, 2.3, 1.0], stone);

  // Canopy shelves overlap above the central notch but stop above y=6.2,
  // maintaining an unobstructed reward sightline at gameplay height.
  rock(51, [-5.7, 8.15, -1.55], [4.3, 1.2, 2.55], stoneDark);
  rock(52, [5.75, 8.05, -1.45], [4.25, 1.25, 2.6], stoneDark);
  rock(53, [0, 8.55, -2.75], [4.5, 0.68, 1.75], stone);

  // Root ribs bind canopy to banks. Tapered, leaning cylinders create clear
  // load paths and a natural proscenium without crossing the centre aperture.
  const roots = [
    [-7.55, 4.55, 0.45, -0.22, 0.14], [-6.75, 5.45, -1.2, -0.36, 0.32],
    [-5.9, 6.45, -2.75, -0.55, 0.48], [7.55, 4.6, 0.4, 0.22, -0.14],
    [6.75, 5.5, -1.2, 0.36, -0.32], [5.95, 6.5, -2.75, 0.55, -0.48],
  ];
  roots.forEach(([x, y, z, rz, rx], i) => {
    add(new THREE.CylinderGeometry(0.27, 0.52, 5.1, 9, 4), timber,
      `structural_root_${i}`, [x, y, z], [1, 1, 0.82], [rx, 0, rz]);
    add(new THREE.TorusGeometry(0.42, 0.065, 5, 9), foliage,
      `root_moss_band_${i}`, [x, y - 1.45, z + 0.1], [1, 1, 0.8], [Math.PI / 2, 0, 0]);
  });

  // Sparse foliage follows water-catching ledges, avoiding a noisy green
  // screen behind the focal gate.
  const patches = [
    [-7.4, 3.55, 1.1, 1.35], [-6.55, 6.25, -3.1, 1.0], [-4.8, 8.45, -0.7, 1.15],
    [7.45, 3.7, 1.0, 1.3], [6.5, 6.45, -3.0, 1.0], [4.75, 8.4, -0.6, 1.2],
  ];
  patches.forEach(([x, y, z, s], i) => {
    rock(70 + i, [x, y, z], [s, s * 0.34, s * 0.82], i % 2 ? foliageLight : foliage);
  });

  // Normalize measured vertices to the exact delivery contract. This also
  // absorbs erosion and rotation extents without Box3 double-counting.
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  const measure = () => {
    box.makeEmpty();
    root.updateMatrixWorld(true);
    root.traverse((node) => {
      const p = node.isMesh && node.geometry.attributes.position;
      if (!p) return;
      for (let i = 0; i < p.count; i++) {
        box.expandByPoint(point.fromBufferAttribute(p, i).applyMatrix4(node.matrixWorld));
      }
    });
  };
  measure();
  const size = box.getSize(new THREE.Vector3());
  root.scale.set(18 / size.x, 9 / size.y, 10 / size.z);
  measure();
  const center = box.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -box.min.y, -center.z);

  root.userData.staticBakeable = true;
  root.userData.assetRole = "sanctuary_basin_backdrop_shell";
  root.userData.variant = "B_root_karst_canopy";
  root.userData.materialFamilies = ["stone", "ground", "timber", "foliage"];
  root.userData.sightline = { axis: "+Z_to_-Z", clearWidth: 7, clearBelowY: 6.2 };
  root.userData.submergedTerrace = true;
  return root;
}
