export default function (THREE) {
  const root = new THREE.Group();
  root.name = "bank_rock_large_a";

  const stone = new THREE.MeshStandardMaterial({
    color: 0x58635d,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
  });
  stone.name = "stone";
  const wetStone = new THREE.MeshStandardMaterial({
    color: 0x354541,
    roughness: 0.56,
    metalness: 0,
    flatShading: true,
  });
  wetStone.name = "stone";
  const soil = new THREE.MeshStandardMaterial({
    color: 0x403a2d,
    roughness: 0.98,
    metalness: 0,
    flatShading: true,
  });
  soil.name = "soil";
  const foliage = new THREE.MeshStandardMaterial({
    color: 0x405d35,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  foliage.name = "foliage";

  const hash = (n) => {
    const v = Math.sin(n * 91.731 + 17.31) * 43758.5453;
    return v - Math.floor(v);
  };

  const add = (geometry, material, name, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  // A geologically faceted mass: dense enough for a carved silhouette, but
  // every vertex is displaced in object space so no UV-sphere character remains.
  function rockMass(
    seed,
    radius,
    scale,
    position,
    material,
    lean = 0,
    detail = 3,
  ) {
    const geometry = new THREE.IcosahedronGeometry(radius, detail);
    const p = geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const ny = v.y / radius;
      const angle = Math.atan2(v.z, v.x);
      const strata = Math.sin(v.y * 7.3 + seed) * 0.035;
      const broad = Math.sin(angle * 3 + seed * 1.7) * 0.085;
      const fracture = (hash(seed * 1009 + i * 0.73) - 0.5) * 0.075;
      const ledge = ny > 0.13 && ny < 0.3 ? 0.06 : 0;
      const swell = 1 + strata + broad + fracture + ledge;
      v.multiplyScalar(swell);
      v.x += lean * Math.max(0, ny) * radius;
      // Flatten the submerged base and terrace selected bands into real strata.
      if (ny < -0.63) v.y = -radius * (0.72 + hash(seed + i) * 0.045);
      if (ny > -0.12 && ny < 0.02) v.y -= radius * 0.045;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true;
    geometry.computeVertexNormals();
    const mesh = add(geometry, material, `fractured_rock_${seed}`, ...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(
      (hash(seed + 4) - 0.5) * 0.13,
      (hash(seed + 8) - 0.5) * 0.7,
      (hash(seed + 12) - 0.5) * 0.11,
    );
    return mesh;
  }

  // Eight overlapping bodies read as one eroded bank from every side. Their
  // lower course is deliberately dark and projects into the water.
  const masses = [
    [11, 1.24, [1.28, 1.15, 1.12], [-2.23, 1.16, 0.05], stone, 0.11, 5],
    [17, 1.38, [1.24, 1.28, 1.08], [-0.65, 1.48, -0.3], stone, -0.08, 5],
    [23, 1.3, [1.22, 1.42, 1.14], [1.05, 1.45, 0.05], stone, 0.09, 5],
    [29, 1.18, [1.18, 1.16, 1.18], [2.35, 1.13, -0.18], stone, -0.1, 5],
    [37, 1.05, [1.34, 0.7, 1.1], [-2.45, 0.48, 0.72], wetStone, 0.02, 5],
    [41, 1.18, [1.42, 0.66, 1.1], [-0.78, 0.43, 0.83], wetStone, -0.03, 5],
    [47, 1.13, [1.38, 0.68, 1.05], [1.02, 0.45, 0.82], wetStone, 0.04, 5],
    [53, 1.0, [1.36, 0.69, 1.09], [2.45, 0.42, 0.68], wetStone, -0.02, 5],
  ];
  masses.forEach((args) => rockMass(...args));

  // Smaller keyed wedges interrupt joins between the main bodies and stop the
  // reverse and end views from collapsing into smooth overlapping ellipsoids.
  const wedges = [
    [-3.08, 1.08, -0.63, 0.68, 61],
    [-2.9, 1.82, 0.54, 0.56, 67],
    [-1.72, 2.53, -0.56, 0.61, 71],
    [-0.14, 2.9, 0.14, 0.58, 73],
    [1.54, 2.69, -0.34, 0.63, 79],
    [2.94, 1.66, 0.37, 0.57, 83],
    [-3.03, 0.46, -0.82, 0.58, 89],
    [3.12, 0.51, -0.72, 0.54, 97],
  ];
  wedges.forEach(([x, y, z, r, seed], i) => {
    rockMass(
      seed,
      r,
      [1.18, 0.82 + (i % 3) * 0.11, 0.88],
      [x, y, z],
      i > 5 ? wetStone : stone,
      i % 2 ? 0.08 : -0.06,
    );
  });

  // Broad irregular soil shelf. The lower ring is inset and the upper two rings
  // overhang different amounts, exposing a readable bank cross-section.
  function shelfGeometry(seed) {
    const segments = 48;
    const positions = [];
    const indices = [];
    const rings = [
      { y: 0, rx: 2.82, rz: 1.42 },
      { y: 0.22, rx: 3.18, rz: 1.65 },
      { y: 0.46, rx: 3.02, rz: 1.55 },
      { y: 0.58, rx: 2.74, rz: 1.43 },
    ];
    rings.forEach((ring, ri) => {
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const broken =
          1 +
          Math.sin(a * 5 + seed) * 0.045 +
          (hash(seed * 71 + i) - 0.5) * 0.075;
        positions.push(
          Math.cos(a) * ring.rx * broken,
          ring.y + (hash(seed * 23 + ri * 53 + i) - 0.5) * 0.055,
          Math.sin(a) * ring.rz * broken,
        );
      }
    });
    for (let r = 0; r < rings.length - 1; r++) {
      for (let i = 0; i < segments; i++) {
        const ni = (i + 1) % segments;
        const a = r * segments + i;
        const b = r * segments + ni;
        const c = (r + 1) * segments + i;
        const d = (r + 1) * segments + ni;
        indices.push(a, c, d, a, d, b);
      }
    }
    const topCenter = positions.length / 3;
    positions.push(0, 0.57, 0);
    const top = (rings.length - 1) * segments;
    for (let i = 0; i < segments; i++)
      indices.push(topCenter, top + i, top + ((i + 1) % segments));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  const shelf = add(
    shelfGeometry(107),
    soil,
    "rooted_soil_overhang",
    0,
    2.58,
    -0.06,
  );
  shelf.rotation.y = 0.06;

  // Angular top stones partly break through the soil, visually anchoring it.
  [
    [-2.48, 3.04, -0.15, 0.48, 109],
    [-1.11, 3.18, 0.28, 0.4, 113],
    [0.55, 3.13, -0.32, 0.51, 127],
    [2.15, 3.07, 0.18, 0.43, 131],
  ].forEach(([x, y, z, r, seed], i) => {
    rockMass(seed, r, [1.4, 0.52, 1.0], [x, y, z], stone, i % 2 ? 0.06 : -0.04);
  });

  // Ferns are curved ribbon fronds with a midrib silhouette, placed only at
  // selected authored sockets so the bank remains rock-led rather than shaggy.
  function frondGeometry(length, width, bend, seed) {
    const steps = 12;
    const positions = [];
    const indices = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = t * length;
      const half =
        width *
        Math.sin(Math.PI * Math.pow(t, 0.78)) *
        (0.92 + hash(seed + i) * 0.14);
      const z = bend * t * t + Math.sin(t * Math.PI * 2) * 0.018;
      positions.push(-half, y, z, half, y, z);
      if (i < steps) {
        const a = i * 2;
        indices.push(a, a + 2, a + 3, a, a + 3, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  const sockets = [
    [-2.48, 3.14, 0.16, -0.28],
    [-0.88, 3.27, -0.28, 0.12],
    [0.92, 3.26, 0.18, -0.18],
    [2.38, 3.13, -0.16, 0.27],
  ];
  sockets.forEach(([x, y, z, yaw], si) => {
    const socket = new THREE.Group();
    socket.name = `foliage_socket_${si + 1}`;
    socket.position.set(x, y, z);
    socket.rotation.y = yaw;
    root.add(socket);
    const count = si % 2 ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const frond = new THREE.Mesh(
        frondGeometry(
          0.72 + (i % 3) * 0.12,
          0.13 + (i % 2) * 0.025,
          0.18 + i * 0.025,
          151 + si * 11 + i,
        ),
        foliage,
      );
      frond.name = `fern_frond_${si}_${i}`;
      frond.rotation.set(
        -0.08 + i * 0.035,
        (i - (count - 1) / 2) * 0.46,
        (i - 2) * 0.13,
      );
      frond.castShadow = true;
      socket.add(frond);
    }
  });

  // Small moss shelves soften only a few damp seams along the water course.
  for (let i = 0; i < 8; i++) {
    const geometry = new THREE.IcosahedronGeometry(0.28 + (i % 3) * 0.035, 2);
    const patch = add(
      geometry,
      foliage,
      `wet_seam_moss_${i}`,
      -2.75 + i * 0.78,
      0.7 + (i % 2) * 0.17,
      1.04 - (i % 3) * 0.12,
    );
    patch.scale.set(1.2, 0.16, 0.52);
    patch.rotation.y = ((i % 4) - 1.5) * 0.12;
  }

  // Vertex-measured normalization is the final contract: 7.2 × 3.8 × 4.6 m,
  // based at y=0, centred on X/Z, with +Z as the water-facing side.
  const bounds = new THREE.Box3();
  const vertex = new THREE.Vector3();
  const measure = () => {
    bounds.makeEmpty();
    root.updateMatrixWorld(true);
    root.traverse((node) => {
      const p = node.isMesh && node.geometry.attributes.position;
      if (!p) return;
      for (let i = 0; i < p.count; i++) {
        bounds.expandByPoint(
          vertex.fromBufferAttribute(p, i).applyMatrix4(node.matrixWorld),
        );
      }
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
  root.userData.assetRole = "modular_waterline_bank";
  root.userData.foliageSockets = sockets.map(
    (_, i) => `foliage_socket_${i + 1}`,
  );
  return root;
}
