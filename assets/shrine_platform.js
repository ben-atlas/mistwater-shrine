export default function (THREE) {
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({
    color: 0x58635d,
    roughness: 0.91,
    metalness: 0.0,
  });
  stone.name = "stone";
  const edge = new THREE.MeshStandardMaterial({
    color: 0x899087,
    roughness: 0.88,
    metalness: 0.0,
  });
  edge.name = "stone";
  const wet = new THREE.MeshStandardMaterial({
    color: 0x354641,
    roughness: 0.72,
    metalness: 0.0,
  });
  wet.name = "stone";
  const moss = new THREE.MeshStandardMaterial({
    color: 0x3f5d32,
    roughness: 1.0,
    metalness: 0.0,
  });
  moss.name = "ground";
  const channel = new THREE.MeshStandardMaterial({
    color: 0x263b36,
    roughness: 0.78,
    metalness: 0.0,
  });
  channel.name = "stone";

  // ExtrudeGeometry bevels grow outward in the profile plane and beyond both
  // extrusion ends. Scale the FINISHED bevelled geometry to the requested
  // dimensions, then place it from its measured minimum. This explicitly
  // compensates bevelSize and bevelThickness instead of trusting the profile.
  function profileMesh(
    points,
    width,
    height,
    depth,
    x,
    y,
    z,
    material,
    bevel = 0.035,
    segments = 4,
  ) {
    const s = new THREE.Shape();
    s.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++)
      s.lineTo(points[i][0], points[i][1]);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: Math.max(0.001, height - bevel * 2),
      bevelEnabled: bevel > 0,
      bevelSegments: segments,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 1,
    });
    geo.rotateX(-Math.PI / 2);
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    const sx = width / (b.max.x - b.min.x);
    const sy = height / (b.max.y - b.min.y);
    const sz = depth / (b.max.z - b.min.z);
    geo.scale(sx, sy, sz);
    geo.computeBoundingBox();
    const c = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-c.x, -geo.boundingBox.min.y, -c.z);
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }

  const rect = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  function slab(
    w,
    h,
    d,
    x,
    y,
    z,
    material = stone,
    bevel = 0.035,
    segments = 4,
  ) {
    return profileMesh(rect, w, h, d, x, y, z, material, bevel, segments);
  }

  // Water-darkened, hand-laid lower courses establish the full 11 x 8 m plan.
  // Deliberately varied blocks leave readable mortar and collapsed gaps.
  const frontBlocks = [
    [-4.95, 0.85],
    [-3.88, 1.03],
    [-2.62, 1.12],
    [-1.3, 1.1],
    [0.02, 1.12],
    [1.34, 1.08],
    [2.62, 1.1],
    [3.88, 1.02],
    [4.95, 0.85],
  ];
  for (let i = 0; i < frontBlocks.length; i++) {
    const [x, w] = frontBlocks[i];
    slab(w, 0.24 + (i % 3) * 0.018, 0.72, x, 0, 2.76, wet, 0.055, 6);
  }
  const rearBlocks = [
    [-4.95, 0.86],
    [-3.92, 0.98],
    [-2.75, 1.1],
    [-1.44, 1.18],
    [-0.08, 1.14],
    [1.23, 1.12],
    [2.53, 1.08],
    [3.77, 0.98],
    [4.91, 0.92],
  ];
  for (let i = 0; i < rearBlocks.length; i++) {
    const [x, w] = rearBlocks[i];
    slab(w, 0.27 + (i % 2) * 0.022, 0.76, x, 0, -3.62, wet, 0.055, 6);
  }
  for (const side of [-1, 1]) {
    const x = side * 5.13;
    const zs = [-2.76, -1.78, -0.78, 0.24, 1.22, 2.12];
    zs.forEach((z, i) =>
      slab(0.74, 0.25 + (i % 2) * 0.035, 0.84, x, 0, z, wet, 0.055, 6),
    );
  }

  // Main irregular structural terrace. The right-front bite and left-rear chip
  // are modeled into the footprint rather than painted onto a rectangle.
  const terraceOutline = [
    [-5.15, -3.32],
    [-3.78, -3.42],
    [-2.32, -3.34],
    [-0.55, -3.44],
    [1.18, -3.37],
    [2.65, -3.46],
    [4.22, -3.32],
    [5.18, -2.78],
    [5.12, -1.02],
    [5.26, 0.32],
    [5.04, 1.34],
    [4.48, 1.84],
    [3.45, 1.9],
    [3.1, 2.38],
    [1.82, 2.42],
    [1.42, 2.06],
    [-1.55, 2.06],
    [-1.88, 2.43],
    [-3.18, 2.4],
    [-3.55, 1.94],
    [-4.54, 1.9],
    [-5.22, 1.42],
    [-5.1, 0.12],
    [-5.26, -1.26],
  ];
  profileMesh(
    terraceOutline,
    10.52,
    0.62,
    6.88,
    0,
    0.2,
    -0.02,
    stone,
    0.065,
    6,
  );

  // Three shallow front steps; asymmetric edges keep the approach hand-built.
  profileMesh(
    [
      [-0.5, -0.45],
      [0.42, -0.5],
      [0.5, -0.35],
      [0.48, 0.5],
      [-0.5, 0.46],
    ],
    7.78,
    0.2,
    1.32,
    -0.28,
    0.0,
    3.34,
    wet,
    0.055,
    6,
  );
  profileMesh(
    [
      [-0.48, -0.5],
      [0.5, -0.46],
      [0.47, 0.5],
      [-0.5, 0.45],
    ],
    7.32,
    0.2,
    1.28,
    -0.18,
    0.2,
    3.0,
    stone,
    0.05,
    6,
  );
  profileMesh(
    [
      [-0.5, -0.46],
      [0.48, -0.5],
      [0.5, 0.48],
      [-0.46, 0.5],
    ],
    6.82,
    0.2,
    1.24,
    -0.12,
    0.4,
    2.66,
    edge,
    0.045,
    6,
  );

  // Hand-cut paving. Each cell is its own subtly irregular extruded profile;
  // seams remain real negative space and catch the runtime surface treatment.
  const colW = [1.17, 1.28, 1.22, 1.31, 1.18, 1.26, 1.16, 1.2];
  const rowD = [0.79, 0.86, 0.82, 0.88, 0.8, 0.84];
  let zCursor = -2.92;
  for (let r = 0; r < rowD.length; r++) {
    let xCursor = -4.78 + (r % 2) * 0.08;
    for (let c = 0; c < colW.length; c++) {
      const w = colW[(c + r * 3) % colW.length];
      const d = rowD[r];
      const seed = r * 17 + c * 11;
      const pts = [
        [-0.5 + ((seed % 5) - 2) * 0.006, -0.46],
        [0.47, -0.5 + ((seed % 7) - 3) * 0.005],
        [0.5 + ((seed % 3) - 1) * 0.008, 0.45],
        [0.18, 0.5],
        [-0.48, 0.47 + ((seed % 4) - 2) * 0.006],
      ];
      const px = xCursor + w * 0.5;
      const pz = zCursor + d * 0.5;
      // Leave the drainage route free and break away several perimeter stones.
      const inDrain =
        (Math.abs(px) > 4.08 && pz > -2.45) ||
        (pz > 1.26 && Math.abs(px) > 3.0);
      const broken =
        (r === 0 && (c === 0 || c === 7)) || (r === 5 && (c === 0 || c === 6));
      if (!inDrain && !broken) {
        const ph = 0.065 + (seed % 4) * 0.006;
        const m = (seed + r) % 6 === 0 ? edge : stone;
        profileMesh(pts, w - 0.075, ph, d - 0.07, px, 0.81, pz, m, 0.018, 7);
      }
      xCursor += w + 0.025;
    }
    zCursor += rowD[r] + 0.035;
  }

  // Engraved drainage channels: recessed dark beds with raised carved lips,
  // turning inward at both front corners as in the Atlas study.
  function drainRun(w, d, x, z, rotation = 0) {
    const bed = slab(w, 0.026, d, x, 0.812, z, channel, 0.008, 1);
    bed.rotation.y = rotation;
    const alongX = rotation === 0;
    if (alongX) {
      slab(w, 0.035, 0.075, x, 0.838, z - d * 0.5 - 0.025, edge, 0.012, 2);
      slab(w, 0.035, 0.075, x, 0.838, z + d * 0.5 + 0.025, edge, 0.012, 2);
    } else {
      slab(0.075, 0.035, w, x - d * 0.5 - 0.025, 0.838, z, edge, 0.012, 2);
      slab(0.075, 0.035, w, x + d * 0.5 + 0.025, 0.838, z, edge, 0.012, 2);
    }
  }
  drainRun(2.0, 0.14, -3.62, 1.52);
  drainRun(2.0, 0.14, 3.62, 1.52);
  drainRun(2.8, 0.14, -4.55, 0.12, Math.PI / 2);
  drainRun(2.8, 0.14, 4.55, 0.12, Math.PI / 2);

  // Broken side masonry and displaced corner blocks.
  const rubble = [
    [-5.28, 0.22, 2.2, 0.44, 0.34, 0.62, -0.1],
    [-5.5, 0.0, 2.78, 0.34, 0.3, 0.48, 0.14],
    [-5.22, 0.25, 3.28, 0.58, 0.38, 0.52, -0.08],
    [-4.76, 0.24, 3.62, 0.48, 0.3, 0.46, 0.11],
    [5.3, 0.16, 2.15, 0.38, 0.32, 0.56, 0.08],
    [5.5, 0.0, 2.72, 0.34, 0.28, 0.42, -0.12],
    [5.17, 0.22, 3.3, 0.6, 0.34, 0.48, 0.1],
    [4.72, 0.22, 3.65, 0.46, 0.32, 0.44, -0.09],
    [-5.45, 0.28, -3.64, 0.44, 0.36, 0.48, 0.08],
    [5.4, 0.27, -3.6, 0.5, 0.35, 0.52, -0.07],
  ];
  rubble.forEach(([x, y, z, w, h, d, ry], i) => {
    const m = slab(w, h, d, x, y, z, i % 3 === 0 ? wet : stone, 0.045, 6);
    m.rotation.y = ry;
  });

  // Low rear rail fragments: substantial carved bases, missing centre span.
  function railSection(x, width) {
    slab(width, 0.14, 0.46, x, 0.82, -3.3, edge, 0.035, 6);
    slab(width - 0.24, 0.16, 0.32, x, 0.96, -3.3, stone, 0.04, 6);
    slab(0.34, 0.24, 0.42, x - width * 0.5 + 0.2, 0.86, -3.3, stone, 0.045, 6);
    slab(0.34, 0.24, 0.42, x + width * 0.5 - 0.2, 0.86, -3.3, stone, 0.045, 6);
  }
  railSection(-3.46, 2.55);
  railSection(3.63, 2.28);

  // Sparse geometric moss in shaded seams, kept subordinate to surface maps.
  const mossPatches = [
    [-4.72, 0.8, -2.62, 0.48, 0.018, 0.18],
    [-3.1, 0.8, 1.62, 0.62, 0.016, 0.16],
    [3.9, 0.8, -3.0, 0.52, 0.017, 0.14],
    [4.74, 0.34, 0.82, 0.18, 0.018, 0.58],
    [-5.02, 0.3, -0.84, 0.15, 0.018, 0.65],
    [2.96, 0.8, 1.72, 0.42, 0.016, 0.14],
  ];
  mossPatches.forEach(([x, y, z, w, h, d]) =>
    slab(w, h, d, x, y, z, moss, 0.006, 1),
  );

  // Contract normalization, measuring transformed vertices (never setFromObject).
  // The designed outer rubble and rear rails define all six exact extents.
  const box = new THREE.Box3(),
    v = new THREE.Vector3(),
    m4 = new THREE.Matrix4(),
    im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position;
    if (!p) return;
    const put = (mat) => {
      for (let i = 0; i < p.count; i++)
        box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat));
    };
    if (n.isInstancedMesh) {
      for (let c = 0; c < n.count; c++) {
        n.getMatrixAt(c, im);
        put(m4.multiplyMatrices(n.matrixWorld, im));
      }
      return;
    }
    put(n.matrixWorld);
  });
  const size = box.getSize(new THREE.Vector3());
  g.scale.set(11 / size.x, 1.1 / size.y, 8 / size.z);
  g.updateMatrixWorld(true);
  box.makeEmpty();
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position;
    if (!p) return;
    const put = (mat) => {
      for (let i = 0; i < p.count; i++)
        box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat));
    };
    if (n.isInstancedMesh) {
      for (let c = 0; c < n.count; c++) {
        n.getMatrixAt(c, im);
        put(m4.multiplyMatrices(n.matrixWorld, im));
      }
      return;
    }
    put(n.matrixWorld);
  });
  const center = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => {
    o.position.x -= center.x / g.scale.x;
    o.position.y -= box.min.y / g.scale.y;
    o.position.z -= center.z / g.scale.z;
  });

  g.userData.asset = "shrine_platform";
  g.userData.variant = "B-profile-led";
  g.userData.static = true;
  return g;
}
