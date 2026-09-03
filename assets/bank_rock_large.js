export default function bankRockLargeCandidateC(THREE) {
  const root = new THREE.Group();
  root.name = "bank_rock_large_c_sculptural_undercut";

  const stoneDark = new THREE.MeshStandardMaterial({
    color: 0x303a35,
    roughness: 0.94,
    metalness: 0,
  });
  stoneDark.name = "stone";
  const stoneMid = new THREE.MeshStandardMaterial({
    color: 0x566258,
    roughness: 0.9,
    metalness: 0,
  });
  stoneMid.name = "stone";
  const stoneLight = new THREE.MeshStandardMaterial({
    color: 0x788077,
    roughness: 0.86,
    metalness: 0,
  });
  stoneLight.name = "stone";
  const soil = new THREE.MeshStandardMaterial({
    color: 0x3b3022,
    roughness: 1,
    metalness: 0,
  });
  soil.name = "soil";
  const foliage = new THREE.MeshStandardMaterial({
    color: 0x3f6a3d,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  foliage.name = "foliage";
  const foliageLight = new THREE.MeshStandardMaterial({
    color: 0x6e8a4e,
    roughness: 0.93,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  foliageLight.name = "foliage";

  const add = (
    geometry,
    material,
    name,
    position,
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  // Dense but strongly faceted boulders. The deformation is baked into each
  // vertex, so the rear and end profiles carry the same authored erosion as
  // the hero-facing side rather than becoming smooth ellipsoids.
  function erodedRock(seed, scale, pinch = 0) {
    const geometry = new THREE.IcosahedronGeometry(1, 6).toNonIndexed();
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const ridge =
        Math.sin(x * 8.7 + seed * 1.73) * 0.075 +
        Math.cos(z * 10.4 - seed) * 0.055;
      const strata = Math.sin(y * 19.0 + seed * 0.83) * 0.035;
      const chip = Math.sin((x + z) * 15.3 + y * 6.1 + seed * 4.7) * 0.025;
      const waterUndercut =
        y < -0.23 ? 1 - pinch * Math.min(1, (-y - 0.23) * 2.2) : 1;
      const radial = 1 + ridge + strata + chip;
      x *= radial * waterUndercut * scale[0];
      y *= (1 + ridge * 0.35) * scale[1];
      z *= radial * waterUndercut * scale[2];
      // Broad horizontal bedding planes break the outline into readable tiers.
      if (y > scale[1] * 0.18) y = Math.round(y * 12) / 12;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  const masses = [
    // left crown and overhanging nose
    [-2.48, 1.54, -0.18, 2.15, 1.65, 1.76, -0.08, 0.18, 0.86, stoneMid],
    [-1.15, 2.42, -0.48, 1.58, 1.24, 1.28, 0.12, -0.22, 0.58, stoneLight],
    [-3.02, 2.55, 0.3, 1.18, 1.03, 1.1, -0.15, 0.27, 0.32, stoneLight],
    // central folded strata
    [-0.4, 1.28, 0.46, 1.74, 1.28, 1.63, 0.05, -0.18, 0.82, stoneMid],
    [0.92, 1.72, -0.25, 1.52, 1.48, 1.42, -0.13, 0.32, 0.72, stoneMid],
    [0.3, 2.68, 0.12, 1.18, 0.91, 1.12, 0.08, -0.12, 0.3, stoneLight],
    // lower toe is intentionally recessed beneath the upper shelf
    [-2.42, 0.39, 0.1, 1.52, 0.69, 1.22, 0.08, -0.18, 0.92, stoneDark],
    [-0.72, 0.31, 0.3, 1.44, 0.6, 1.2, -0.06, 0.24, 0.96, stoneDark],
    [1.08, 0.38, 0.15, 1.31, 0.65, 1.28, 0.12, -0.32, 0.94, stoneDark],
    [2.35, 0.62, 0.36, 1.26, 0.85, 1.12, -0.16, 0.12, 0.78, stoneDark],
    // asymmetric right shoulder and back-side counterweight
    [2.55, 1.4, -0.42, 1.34, 1.22, 1.34, 0.04, -0.28, 0.6, stoneMid],
    [2.92, 2.14, 0.24, 0.89, 0.94, 0.93, -0.12, 0.38, 0.36, stoneLight],
    [0.92, 1.16, -1.2, 1.52, 1.04, 1.03, 0.18, 0.11, 0.54, stoneMid],
    [-1.32, 1.1, -1.28, 1.6, 0.96, 1.02, -0.12, -0.17, 0.56, stoneMid],
  ];
  masses.forEach((m, i) => {
    add(
      erodedRock(17 + i * 11, [m[3], m[4], m[5]], m[8]),
      m[9],
      `stone_mass_${i}`,
      [m[0], m[1], m[2]],
      [m[6], m[7], ((i % 3) - 1) * 0.07],
    );
  });

  // Soil appears only where the stone shelves create plausible pockets.
  const soilPockets = [
    [-1.92, 3.0, -0.18, 1.64, 0.28, 1.26, 0.06],
    [0.25, 2.92, 0.28, 1.47, 0.24, 1.1, -0.08],
    [2.34, 2.48, 0.28, 0.94, 0.2, 0.82, 0.13],
  ];
  soilPockets.forEach((s, i) => {
    add(
      erodedRock(201 + i * 19, [s[3], s[4], s[5]], 0),
      soil,
      `soil_shelf_${i}`,
      [s[0], s[1], s[2]],
      [0, s[6], 0],
    );
  });

  // Segmented surface roots bridge soil to crevices. Each segment is aligned
  // from point to point, making the root silhouette readable from both ends.
  function rootSegment(a, b, radius, name) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const delta = vb.clone().sub(va);
    const mesh = add(
      new THREE.CylinderGeometry(radius * 0.72, radius, delta.length(), 10, 3),
      soil,
      name,
      va.clone().add(vb).multiplyScalar(0.5).toArray(),
    );
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
  }
  const roots = [
    [
      [-2.55, 3.2, -0.12],
      [-2.18, 2.56, 0.78],
      [-1.83, 1.85, 1.28],
      [-1.5, 1.18, 1.47],
    ],
    [
      [-1.64, 3.18, 0.02],
      [-1.18, 2.4, -0.48],
      [-0.72, 1.72, -0.88],
      [-0.18, 1.03, -1.32],
    ],
    [
      [0.32, 3.1, 0.3],
      [0.82, 2.42, 0.7],
      [1.32, 1.71, 1.12],
      [1.85, 1.05, 1.32],
    ],
    [
      [2.45, 2.66, 0.18],
      [2.67, 2.08, -0.5],
      [2.72, 1.4, -1.05],
    ],
  ];
  roots.forEach((points, ri) => {
    for (let i = 0; i < points.length - 1; i++)
      rootSegment(
        points[i],
        points[i + 1],
        0.105 - i * 0.018,
        `soil_root_${ri}_${i}`,
      );
  });

  function fern(seed, x, y, z, size, yaw) {
    const positions = [];
    const indices = [];
    const fronds = 11;
    for (let f = 0; f < fronds; f++) {
      const angle =
        yaw + (f / fronds) * Math.PI * 2 + Math.sin(seed * 4.3 + f) * 0.12;
      const length = size * (0.68 + 0.32 * Math.sin(seed + f * 2.1) ** 2);
      const lift = size * (0.34 + 0.2 * Math.cos(f * 1.7));
      const width = size * 0.12;
      const base = positions.length / 3;
      const px = Math.cos(angle);
      const pz = Math.sin(angle);
      const sx = -pz * width;
      const sz = px * width;
      positions.push(
        x,
        y,
        z,
        x + px * length * 0.52 + sx,
        y + lift * 0.72,
        z + pz * length * 0.52 + sz,
        x + px * length,
        y + lift,
        z + pz * length,
        x + px * length * 0.52 - sx,
        y + lift * 0.72,
        z + pz * length * 0.52 - sz,
      );
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    add(
      g,
      seed % 2 ? foliage : foliageLight,
      `foliage_fern_${seed}`,
      [0, 0, 0],
    );
  }
  [
    [-2.66, 3.19, -0.34, 0.72, 0.2],
    [-2.03, 3.25, 0.34, 0.58, 1.1],
    [-1.18, 3.12, -0.18, 0.67, 2.2],
    [0.1, 3.1, 0.48, 0.73, 0.6],
    [0.66, 3.08, -0.12, 0.54, 1.7],
    [2.28, 2.67, 0.45, 0.68, 2.8],
    [2.72, 2.58, -0.14, 0.52, 0.9],
    [-3.1, 2.84, 0.42, 0.48, 1.9],
    [1.55, 2.54, -0.92, 0.58, 0.1],
    [-0.55, 2.64, -0.93, 0.49, 2.4],
  ].forEach((f, i) => fern(31 + i, ...f));

  // Normalize against transformed vertices, then recenter in X/Z and place
  // the lowest undercut toe exactly on Y=0. This is the asset contract.
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  const measure = () => {
    bounds.makeEmpty();
    root.updateMatrixWorld(true);
    root.traverse((node) => {
      const attr = node.isMesh && node.geometry.getAttribute("position");
      if (!attr) return;
      for (let i = 0; i < attr.count; i++)
        bounds.expandByPoint(
          point.fromBufferAttribute(attr, i).applyMatrix4(node.matrixWorld),
        );
    });
  };
  measure();
  const size = bounds.getSize(new THREE.Vector3());
  root.scale.set(7.2 / size.x, 3.8 / size.y, 4.6 / size.z);
  measure();
  const center = bounds.getCenter(new THREE.Vector3());
  root.children.forEach((child) => {
    child.position.x -= center.x / root.scale.x;
    child.position.y -= bounds.min.y / root.scale.y;
    child.position.z -= center.z / root.scale.z;
  });

  root.userData.staticBakeable = true;
  root.userData.assetRole = "modular_authored_bank_rock";
  root.userData.materialFamilies = ["stone", "soil", "foliage"];
  return root;
}
