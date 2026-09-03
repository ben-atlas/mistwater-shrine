export default function (THREE) {
  const root = new THREE.Group();
  root.name = "karst_arch_b";

  const stone = new THREE.MeshStandardMaterial({
    name: "stone",
    color: 0x5d6e68,
    roughness: 0.97,
    metalness: 0,
    flatShading: true,
  });
  const deepStone = new THREE.MeshStandardMaterial({
    name: "stone",
    color: 0x384b48,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const warmStone = new THREE.MeshStandardMaterial({
    name: "stone",
    color: 0x718078,
    roughness: 0.94,
    metalness: 0,
    flatShading: true,
  });
  const foliage = new THREE.MeshStandardMaterial({
    name: "foliage",
    color: 0x315840,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
  });
  const hash = (n) => {
    const v = Math.sin(n * 113.87 + 9.73) * 43758.5453;
    return v - Math.floor(v);
  };
  const add = (
    geometry,
    material,
    name,
    position,
    scale = [1, 1, 1],
    rotation = [0, 0, 0],
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  function erodedBody(
    seed,
    radius,
    position,
    scale,
    detail,
    material,
    inward = 0,
  ) {
    const geometry = new THREE.IcosahedronGeometry(radius, detail);
    const p = geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const ny = v.y / radius;
      const angle = Math.atan2(v.z, v.x);
      const rib = Math.sin(angle * 4.0 + ny * 7.5 + seed) * 0.07;
      const chips = (hash(seed * 773 + i * 0.91) - 0.5) * 0.085;
      const shelf = Math.sin((ny + 0.2) * 31 + seed) > 0.76 ? 0.07 : 0;
      v.x *= 1 + rib + chips + shelf;
      v.z *= 1 + rib * 0.6 + chips;
      v.y *= 1 + chips * 0.22;
      v.x += inward * Math.max(0, ny + 0.3) * radius;
      if (ny < -0.72) v.y = -radius * (0.75 + hash(i + seed) * 0.03);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true;
    geometry.computeVertexNormals();
    return add(geometry, material, `arch_pillar_${seed}`, position, scale, [
      (hash(seed + 2) - 0.5) * 0.08,
      (hash(seed + 3) - 0.5) * 0.38,
      (hash(seed + 4) - 0.5) * 0.06,
    ]);
  }

  // Two independently eroded, inward-leaning piers define the open lower span.
  erodedBody(
    13,
    3.2,
    [-6.05, 6.1, 0.25],
    [1.35, 2.36, 1.24],
    6,
    deepStone,
    0.34,
  );
  erodedBody(23, 3.05, [6.1, 6.0, -0.25], [1.42, 2.3, 1.22], 6, stone, -0.34);

  // A real extruded annular arch. The void passes fully through Z and remains
  // visibly open in front, reverse, and three-quarter views.
  function archRingGeometry() {
    const segments = 48;
    const depth = 3.35;
    const positions = [];
    const indices = [];
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = Math.PI * (1 - t);
      const outerNoise =
        1 + Math.sin(i * 1.71) * 0.018 + (hash(401 + i) - 0.5) * 0.035;
      const innerNoise =
        1 + Math.sin(i * 1.37 + 1.4) * 0.015 + (hash(701 + i) - 0.5) * 0.025;
      points.push([
        Math.cos(a) * 8.25 * outerNoise,
        7.7 + Math.sin(a) * 8.2 * outerNoise,
        Math.cos(a) * 5.15 * innerNoise,
        7.65 + Math.sin(a) * 5.25 * innerNoise,
      ]);
    }
    // four vertices per sample: outer/inner on front and back.
    points.forEach(([ox, oy, ix, iy]) =>
      positions.push(
        ox,
        oy,
        depth,
        ix,
        iy,
        depth,
        ox,
        oy,
        -depth,
        ix,
        iy,
        -depth,
      ),
    );
    for (let i = 0; i < segments; i++) {
      const a = i * 4,
        b = (i + 1) * 4;
      // front/back annular faces
      indices.push(a, b, b + 1, a, b + 1, a + 1);
      indices.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2);
      // outer and inner reveal surfaces
      indices.push(a, a + 2, b + 2, a, b + 2, b);
      indices.push(a + 1, b + 1, b + 3, a + 1, b + 3, a + 3);
    }
    // Close both springing ends without closing the central opening.
    const first = 0,
      last = segments * 4;
    indices.push(first, first + 1, first + 3, first, first + 3, first + 2);
    indices.push(last, last + 2, last + 3, last, last + 3, last + 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  add(archRingGeometry(), stone, "through_arch_ring", [0, 2.15, 0], [1, 1, 1]);

  // Irregular crown, shoulder shelves, and rear depth keys conceal geometric joins.
  const keys = [
    [31, [-8.5, 4.0, -1.2], [1.45, 1.25, 1.05], 0.12],
    [37, [8.6, 4.35, 1.0], [1.38, 1.35, 1.0], -0.13],
    [43, [-6.15, 13.2, 0.8], [1.25, 0.72, 0.88], 0.18],
    [47, [5.7, 14.0, -0.85], [1.35, 0.78, 0.9], -0.18],
    [53, [0.65, 18.75, 0.2], [1.55, 0.73, 1.03], -0.08],
  ];
  keys.forEach(([seed, pos, scale, lean], i) =>
    erodedBody(
      seed,
      2.05,
      pos,
      scale,
      6,
      i === 4 ? warmStone : i < 2 ? deepStone : stone,
      lean,
    ),
  );

  // Foliage is confined to believable water-catching shelves and the crown.
  const patches = [
    [-8.25, 7.4, 1.4, 0.82],
    [8.0, 8.15, -1.15, 0.75],
    [-5.15, 15.1, 0.55, 0.6],
    [4.8, 15.7, -0.45, 0.66],
    [0.5, 20.15, 0.25, 0.72],
  ];
  patches.forEach(([x, y, z, s], i) => {
    const geometry = new THREE.IcosahedronGeometry(0.78, 3);
    const p = geometry.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const m = 0.9 + hash(901 + i * 41 + j) * 0.2;
      p.setXYZ(j, p.getX(j) * m, p.getY(j) * (0.45 + m * 0.14), p.getZ(j) * m);
    }
    geometry.computeVertexNormals();
    add(
      geometry,
      foliage,
      `foliage_shelf_${i}`,
      [x, y, z],
      [s * 1.8, s, s * 1.3],
    );
  });

  // Exact delivery contract: 26 W x 24 H x 10 D, y=0, X/Z centered.
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  const measure = () => {
    box.makeEmpty();
    root.updateMatrixWorld(true);
    root.traverse((node) => {
      const p = node.isMesh && node.geometry.attributes.position;
      if (!p) return;
      for (let i = 0; i < p.count; i++)
        box.expandByPoint(
          point.fromBufferAttribute(p, i).applyMatrix4(node.matrixWorld),
        );
    });
  };
  measure();
  const size = box.getSize(new THREE.Vector3());
  root.scale.set(26 / size.x, 24 / size.y, 10 / size.z);
  measure();
  const center = box.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -box.min.y, -center.z);
  root.userData.staticBakeable = true;
  root.userData.assetRole = "distant_karst_arch";
  root.userData.silhouette = "open_window_arch";
  return root;
}
