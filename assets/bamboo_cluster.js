// Production near-field bamboo cluster — candidate B.
// Import-free Three.js asset factory; authored curved/tapered culms and leaf sprays.
export default function bambooClusterB(THREE) {
  const root = new THREE.Group();
  root.name = "bamboo_cluster_b";

  const culmMats = [
    new THREE.MeshStandardMaterial({
      color: 0x426f43,
      roughness: 0.78,
      metalness: 0.0,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x587f48,
      roughness: 0.74,
      metalness: 0.0,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x315e3b,
      roughness: 0.82,
      metalness: 0.0,
    }),
  ];
  const nodeMat = new THREE.MeshStandardMaterial({
    color: 0x78935b,
    roughness: 0.8,
  });
  const branchMat = new THREE.MeshStandardMaterial({
    color: 0x3b643d,
    roughness: 0.86,
  });
  const leafMats = [
    new THREE.MeshStandardMaterial({
      color: 0x214f35,
      roughness: 0.88,
      side: THREE.DoubleSide,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x316946,
      roughness: 0.84,
      side: THREE.DoubleSide,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x497c4d,
      roughness: 0.8,
      side: THREE.DoubleSide,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x6d9155,
      roughness: 0.82,
      side: THREE.DoubleSide,
    }),
  ];
  [...culmMats, nodeMat, branchMat, ...leafMats].forEach((m) => {
    m.name = "foliage";
  });

  function taperedCurve(points, radii, radial = 12, rings = 15) {
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.48);
    const vertices = [],
      normals = [],
      uv = [],
      indices = [];
    const tangent = new THREE.Vector3(),
      side = new THREE.Vector3(),
      binormal = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let iy = 0; iy <= rings; iy++) {
      const t = iy / rings;
      const p = curve.getPoint(t);
      curve.getTangent(t, tangent).normalize();
      side
        .crossVectors(
          tangent,
          Math.abs(tangent.y) > 0.96 ? new THREE.Vector3(1, 0, 0) : up,
        )
        .normalize();
      binormal.crossVectors(side, tangent).normalize();
      const rt = t * (radii.length - 1),
        ri = Math.min(radii.length - 2, Math.floor(rt));
      const r = THREE.MathUtils.lerp(radii[ri], radii[ri + 1], rt - ri);
      for (let ix = 0; ix < radial; ix++) {
        const a = (ix / radial) * Math.PI * 2;
        const n = side
          .clone()
          .multiplyScalar(Math.cos(a))
          .addScaledVector(binormal, Math.sin(a));
        const q = p.clone().addScaledVector(n, r);
        vertices.push(q.x, q.y, q.z);
        normals.push(n.x, n.y, n.z);
        uv.push(ix / radial, t);
      }
    }
    for (let iy = 0; iy < rings; iy++)
      for (let ix = 0; ix < radial; ix++) {
        const a = iy * radial + ix,
          b = iy * radial + ((ix + 1) % radial);
        const c = (iy + 1) * radial + ((ix + 1) % radial),
          d = (iy + 1) * radial + ix;
        indices.push(a, b, d, b, c, d);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    return geo;
  }

  function addCurve(
    points,
    radii,
    material,
    radial = 12,
    rings = 15,
    name = "culm",
  ) {
    const mesh = new THREE.Mesh(
      taperedCurve(points, radii, radial, rings),
      material,
    );
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  // Five culms describe a naturally asymmetric fan, with the tallest stem reaching exactly y=5.4.
  const culms = [
    { x: -0.34, z: 0.05, h: 5.4, lean: [-0.13, -0.02], r: 0.105, phase: 0.08 },
    { x: 0.08, z: -0.2, h: 4.92, lean: [0.2, 0.09], r: 0.115, phase: 0.34 },
    { x: 0.42, z: 0.16, h: 4.42, lean: [0.11, -0.12], r: 0.098, phase: 0.61 },
    { x: -0.57, z: -0.24, h: 3.92, lean: [-0.08, 0.14], r: 0.09, phase: 0.82 },
    { x: 0.62, z: -0.05, h: 3.46, lean: [-0.06, -0.04], r: 0.082, phase: 1.07 },
  ];
  culms.forEach((c, ci) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      pts.push(
        new THREE.Vector3(
          c.x + c.lean[0] * t * t + Math.sin(c.phase + t * 3.2) * 0.025,
          c.h * t,
          c.z + c.lean[1] * t * t + Math.cos(c.phase + t * 2.7) * 0.018,
        ),
      );
    }
    addCurve(
      pts,
      [c.r * 1.08, c.r, c.r * 0.78, c.r * 0.42],
      culmMats[ci % 3],
      14,
      20,
      `culm_${ci}`,
    );

    // Raised collar nodes follow the curved stem rather than floating on a straight axis.
    for (let y = 0.48; y < c.h - 0.2; y += 0.48 + (ci % 2) * 0.035) {
      const t = y / c.h;
      const x = c.x + c.lean[0] * t * t + Math.sin(c.phase + t * 3.2) * 0.025;
      const z = c.z + c.lean[1] * t * t + Math.cos(c.phase + t * 2.7) * 0.018;
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(c.r * (1.08 - t * 0.45), 0.016, 5, 14),
        nodeMat,
      );
      collar.name = `collar_${ci}`;
      collar.rotation.x = Math.PI / 2;
      collar.position.set(x, y, z);
      collar.castShadow = true;
      root.add(collar);
    }
  });

  function leafBladeData(origin, direction, length, width, curl, arrays) {
    const d = direction.clone().normalize();
    const side = new THREE.Vector3()
      .crossVectors(
        d,
        Math.abs(d.y) > 0.92
          ? new THREE.Vector3(0, 0, 1)
          : new THREE.Vector3(0, 1, 0),
      )
      .normalize();
    const normal = new THREE.Vector3().crossVectors(side, d).normalize();
    const base = arrays.v.length / 3;
    // Six stations and a keeled cross-section make each blade read in silhouette and specular light.
    for (let i = 0; i <= 6; i++) {
      const t = i / 6,
        envelope = Math.sin(Math.PI * Math.pow(t, 0.82));
      const center = origin
        .clone()
        .addScaledVector(d, length * t)
        .addScaledVector(normal, curl * Math.sin(t * Math.PI));
      const w = width * envelope;
      for (const s of [-1, 0, 1]) {
        const p = center
          .clone()
          .addScaledVector(side, w * s)
          .addScaledVector(normal, s === 0 ? width * 0.1 * envelope : 0);
        arrays.v.push(p.x, p.y, p.z);
        arrays.n.push(normal.x, normal.y, normal.z);
        arrays.u.push((s + 1) / 2, t);
      }
    }
    for (let i = 0; i < 6; i++)
      for (let lane = 0; lane < 2; lane++) {
        const a = base + i * 3 + lane,
          b = a + 1,
          c = base + (i + 1) * 3 + lane + 1,
          d0 = c - 1;
        arrays.idx.push(a, b, d0, b, c, d0);
      }
  }

  function addSpray(anchor, azimuth, scale, seed, matIndex, reach = null) {
    const ca = Math.cos(azimuth),
      sa = Math.sin(azimuth);
    const tip =
      reach ||
      new THREE.Vector3(
        anchor.x + ca * 0.58 * scale,
        anchor.y + 0.15 * scale,
        anchor.z + sa * 0.58 * scale,
      );
    const mid = anchor
      .clone()
      .lerp(tip, 0.52)
      .add(new THREE.Vector3(0, 0.08 * scale, 0));
    addCurve(
      [anchor, mid, tip],
      [0.026 * scale, 0.017 * scale, 0.006],
      branchMat,
      7,
      7,
      "fine_branch",
    );
    const arrays = { v: [], n: [], u: [], idx: [] };
    for (let i = 0; i < 13; i++) {
      const t = 0.13 + (i / 12) * 0.82;
      const stemPoint = anchor
        .clone()
        .lerp(tip, t)
        .add(new THREE.Vector3(0, Math.sin(t * Math.PI) * 0.05 * scale, 0));
      const sideSign = i % 2 ? 1 : -1;
      const spread = 0.68 + ((i * 17 + seed * 11) % 9) * 0.035;
      const dir = new THREE.Vector3(
        ca * 0.34 + -sa * sideSign * spread,
        0.07 + ((i * 7 + seed) % 5) * 0.035,
        sa * 0.34 + ca * sideSign * spread,
      );
      const len = (0.33 + ((i * 13 + seed * 3) % 8) * 0.024) * scale;
      leafBladeData(
        stemPoint,
        dir,
        len,
        (0.052 + (i % 3) * 0.006) * scale,
        (sideSign * 0.025 + 0.018) * scale,
        arrays,
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(arrays.v, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(arrays.n, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(arrays.u, 2));
    geo.setIndex(arrays.idx);
    const mesh = new THREE.Mesh(geo, leafMats[matIndex % leafMats.length]);
    mesh.name = "layered_leaf_spray";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  const sprays = [
    [-0.36, 4.96, 0.04, -2.72, 0.92, 2],
    [-0.38, 4.72, 0.04, 2.46, 0.95, 1],
    [-0.31, 4.42, 0.05, -0.42, 1.0, 0],
    [0.22, 4.57, -0.13, -2.9, 1.04, 1],
    [0.2, 4.25, -0.14, 0.15, 0.95, 2],
    [0.17, 3.96, -0.15, 2.14, 0.88, 0],
    [0.5, 4.06, 0.07, -0.63, 0.92, 3],
    [0.49, 3.72, 0.08, 1.02, 0.86, 1],
    [0.47, 3.4, 0.09, 2.8, 0.78, 0],
    [-0.62, 3.56, -0.13, -2.15, 0.88, 1],
    [-0.61, 3.23, -0.13, 0.78, 0.82, 2],
    [-0.58, 2.9, -0.14, -0.14, 0.72, 0],
    [0.64, 3.11, -0.09, -0.58, 0.82, 2],
    [0.62, 2.8, -0.08, 2.32, 0.74, 1],
    [0.6, 2.49, -0.07, 0.5, 0.66, 0],
    [-0.02, 3.58, -0.12, -1.44, 0.78, 3],
    [-0.15, 3.12, 0.03, 1.7, 0.73, 1],
    [0.27, 2.95, 0.04, -2.4, 0.68, 2],
  ];
  sprays.forEach((s, i) =>
    addSpray(new THREE.Vector3(s[0], s[1], s[2]), s[3], s[4], i + 3, s[5]),
  );

  // Two art-directed outer sprays pin exact 2.1 x 1.5 m horizontal bounds without helper geometry.
  addSpray(
    new THREE.Vector3(-0.62, 3.68, 0.02),
    Math.PI,
    0.7,
    29,
    1,
    new THREE.Vector3(-1.05, 3.74, 0.08),
  );
  addSpray(
    new THREE.Vector3(0.63, 3.3, -0.02),
    0,
    0.72,
    31,
    2,
    new THREE.Vector3(1.05, 3.36, -0.08),
  );
  addSpray(
    new THREE.Vector3(0.12, 4.04, 0.19),
    Math.PI / 2,
    0.78,
    37,
    3,
    new THREE.Vector3(0.08, 4.14, 0.75),
  );
  addSpray(
    new THREE.Vector3(-0.08, 3.46, -0.2),
    -Math.PI / 2,
    0.76,
    41,
    0,
    new THREE.Vector3(-0.05, 3.52, -0.75),
  );

  // Normalize the authored leaf envelope to the strict production footprint.
  // Axis-specific normalization preserves the full 5.4 m silhouette and y=0 planting plane.
  root.scale.set(2.1 / 2.536, 5.4 / 5.405, 1.5 / 1.696);
  root.position.set(-0.017 * root.scale.x, 0.003, 0.005 * root.scale.z);
  return root;
}
