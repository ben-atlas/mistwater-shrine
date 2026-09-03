export default function stoneLanternHeroCandidateA(THREE) {
  const root = new THREE.Group();
  root.name = "stone_lantern_hero_a_layered_yukimi";

  const stoneDark = new THREE.MeshStandardMaterial({
    color: 0x424c47,
    roughness: 0.96,
    metalness: 0,
  });
  stoneDark.name = "stone";
  const stoneMid = new THREE.MeshStandardMaterial({
    color: 0x68716a,
    roughness: 0.92,
    metalness: 0,
  });
  stoneMid.name = "stone";
  const stoneLight = new THREE.MeshStandardMaterial({
    color: 0x899088,
    roughness: 0.9,
    metalness: 0,
  });
  stoneLight.name = "stone";
  const moss = new THREE.MeshStandardMaterial({
    color: 0x526d3e,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  moss.name = "foliage";
  const pane = new THREE.MeshStandardMaterial({
    color: 0xffd98a,
    emissive: 0xffa735,
    emissiveIntensity: 1.85,
    roughness: 0.42,
    metalness: 0,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });
  pane.name = "metal";

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
    mesh.castShadow = material !== pane;
    mesh.receiveShadow = material !== pane;
    root.add(mesh);
    return mesh;
  };

  // An irregular octagonal stone blank. Warping is deterministic and kept
  // small so joints remain architectural while highlights break naturally.
  function weatheredCylinder(
    rt,
    rb,
    h,
    radial,
    heightSegments,
    seed,
    bevel = 0,
  ) {
    const geometry = new THREE.CylinderGeometry(
      rt,
      rb,
      h,
      radial,
      heightSegments,
      false,
    ).toNonIndexed();
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const rim = Math.min(1, Math.abs(y) / Math.max(0.001, h * 0.5));
      const chip =
        Math.sin(x * 23 + seed * 1.71 + y * 13) * 0.012 +
        Math.cos(z * 29 - seed * 2.13 + y * 17) * 0.009;
      const broad = Math.sin(Math.atan2(z, x) * 3 + seed) * 0.012;
      const radialWarp = 1 + chip + broad - bevel * rim * 0.018;
      x *= radialWarp;
      z *= radialWarp;
      y += Math.sin(x * 31 + z * 27 + seed) * 0.0025;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  function roughBlock(w, h, d, seed) {
    const geometry = new THREE.BoxGeometry(w, h, d, 7, 5, 7).toNonIndexed();
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const n =
        Math.sin(x * 41 + y * 23 + seed) * 0.0045 +
        Math.cos(z * 37 - y * 29 + seed * 1.8) * 0.0035;
      const ax = Math.abs(x / w);
      const ay = Math.abs(y / h);
      const az = Math.abs(z / d);
      if (ax >= ay && ax >= az) x += Math.sign(x || 1) * n;
      else if (ay >= az) y += Math.sign(y || 1) * n;
      else z += Math.sign(z || 1) * n;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  // Four settled foundation courses give a readable, weighty footprint.
  add(
    weatheredCylinder(0.43, 0.49, 0.13, 8, 6, 2),
    stoneDark,
    "base_foot",
    [0, 0.065, 0],
    [0, Math.PI / 8, 0],
  );
  add(
    weatheredCylinder(0.39, 0.43, 0.1, 8, 5, 5),
    stoneMid,
    "base_lower_course",
    [0, 0.175, 0],
    [0, Math.PI / 8 + 0.025, 0],
  );
  add(
    weatheredCylinder(0.32, 0.38, 0.105, 8, 5, 7),
    stoneLight,
    "base_upper_course",
    [0.015, 0.275, -0.008],
    [0, Math.PI / 8 - 0.018, 0],
  );
  add(
    weatheredCylinder(0.27, 0.31, 0.09, 8, 5, 11),
    stoneDark,
    "base_neck",
    [0, 0.37, 0],
    [0, Math.PI / 8, 0],
  );

  // Tapered pedestal with collar rings; its broad lower shoulder prevents the
  // lantern from reading as a lamp mounted on a generic pole.
  add(
    weatheredCylinder(0.205, 0.265, 0.69, 8, 16, 13),
    stoneMid,
    "tapered_shaft",
    [0, 0.745, 0],
    [0, Math.PI / 8, 0],
  );
  add(
    weatheredCylinder(0.285, 0.255, 0.09, 8, 5, 17),
    stoneLight,
    "shaft_lower_collar",
    [0, 0.445, 0],
    [0, Math.PI / 8, 0],
  );
  add(
    weatheredCylinder(0.275, 0.215, 0.09, 8, 5, 19),
    stoneDark,
    "shaft_upper_collar",
    [0, 1.085, 0],
    [0, Math.PI / 8, 0],
  );

  // Chamber sill and ceiling are separate slabs. Four corner uprights leave
  // true openings on every face, rather than painted rectangles on a box.
  add(
    roughBlock(0.68, 0.12, 0.68, 23),
    stoneDark,
    "chamber_sill_shadow",
    [0, 1.17, 0],
  );
  add(
    roughBlock(0.61, 0.09, 0.61, 29),
    stoneLight,
    "chamber_sill_top",
    [0, 1.275, 0],
  );
  const postGeo = roughBlock(0.105, 0.43, 0.105, 31);
  const postAt = 0.247;
  [
    [-postAt, -postAt],
    [postAt, -postAt],
    [-postAt, postAt],
    [postAt, postAt],
  ].forEach(([x, z], i) =>
    add(postGeo, i % 2 ? stoneMid : stoneLight, `chamber_corner_${i}`, [
      x,
      1.53,
      z,
    ]),
  );

  // Thin deep-set luminous panes suggest a warm interior but preserve a dark
  // reveal between pane and frame. Each side is independently modelled.
  const paneGeo = new THREE.PlaneGeometry(0.325, 0.285, 4, 4);
  add(paneGeo, pane, "light_pane_front", [0, 1.53, 0.222], [0, 0, 0]);
  add(paneGeo, pane, "light_pane_back", [0, 1.53, -0.222], [0, Math.PI, 0]);
  add(
    paneGeo,
    pane,
    "light_pane_left",
    [-0.222, 1.53, 0],
    [0, -Math.PI / 2, 0],
  );
  add(paneGeo, pane, "light_pane_right", [0.222, 1.53, 0], [0, Math.PI / 2, 0]);
  add(
    new THREE.SphereGeometry(0.105, 18, 12),
    pane,
    "interior_lamp",
    [0, 1.51, 0],
    [0, 0, 0],
    [1, 1.16, 1],
  );

  // Heavy lintel and two-stage eaves. The low underside remains visible from
  // gameplay camera height; the broad upper cap supplies the iconic silhouette.
  add(
    roughBlock(0.62, 0.095, 0.62, 37),
    stoneDark,
    "chamber_lintel",
    [0, 1.79, 0],
  );
  add(
    weatheredCylinder(0.49, 0.39, 0.12, 8, 6, 41),
    stoneMid,
    "eave_under_course",
    [0, 1.885, 0],
    [0, Math.PI / 8, 0],
  );
  add(
    weatheredCylinder(0.43, 0.53, 0.17, 8, 7, 43),
    stoneLight,
    "eave_overhang",
    [0, 2.015, 0],
    [0, Math.PI / 8, 0],
  );
  add(
    weatheredCylinder(0.29, 0.4, 0.12, 8, 6, 47),
    stoneMid,
    "roof_shoulders",
    [0, 2.16, 0],
    [0, Math.PI / 8, 0],
  );
  add(
    weatheredCylinder(0.105, 0.27, 0.145, 8, 7, 53),
    stoneDark,
    "roof_crown",
    [0, 2.292, 0],
    [0, Math.PI / 8, 0],
  );
  add(
    weatheredCylinder(0.035, 0.1, 0.09, 8, 5, 59),
    stoneLight,
    "finial",
    [0, 2.405, 0],
    [0, Math.PI / 8, 0],
  );

  // Moss stays in water-catching horizontal seams. Low curved patches make
  // the growth visible from every side without turning the prop green.
  const mossPatch = (name, x, y, z, sx, sy, sz, seed) => {
    const geo = new THREE.IcosahedronGeometry(1, 2).toNonIndexed();
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let px = p.getX(i),
        py = p.getY(i),
        pz = p.getZ(i);
      const r = 1 + Math.sin(px * 8 + pz * 11 + seed) * 0.09;
      p.setXYZ(i, px * r, py * (1 + 0.05 * Math.cos(px * 9 + seed)), pz * r);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    add(geo, moss, name, [x, y, z], [0, seed * 0.37, 0], [sx, sy, sz]);
  };
  mossPatch("moss_base_front", -0.16, 0.145, 0.405, 0.2, 0.026, 0.075, 3);
  mossPatch("moss_base_back", 0.17, 0.255, -0.335, 0.18, 0.022, 0.07, 5);
  mossPatch("moss_sill_left", -0.28, 1.335, 0.07, 0.11, 0.022, 0.16, 7);
  mossPatch("moss_sill_right", 0.28, 1.335, -0.11, 0.105, 0.02, 0.14, 11);
  mossPatch("moss_eave_front", -0.18, 2.094, 0.42, 0.17, 0.018, 0.055, 13);
  mossPatch("moss_eave_back", 0.2, 2.092, -0.42, 0.15, 0.017, 0.05, 17);

  // A few pale chips show long-term erosion at exposed corners. They are
  // embedded fragments, never floating decoration.
  const chipGeo = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
  [
    [-0.414, 0.08, 0.185, 0.055, 0.018, 0.04, 2],
    [0.376, 0.22, -0.13, 0.052, 0.02, 0.042, 3],
    [-0.323, 1.22, -0.238, 0.045, 0.016, 0.035, 5],
    [0.434, 2.0, 0.19, 0.055, 0.016, 0.035, 7],
  ].forEach((c, i) =>
    add(
      chipGeo,
      stoneLight,
      `weather_chip_${i}`,
      [c[0], c[1], c[2]],
      [c[6] * 0.19, c[6] * 0.31, 0],
      [c[3], c[4], c[5]],
    ),
  );

  // Enforce the asset contract from transformed vertices: exact dimensions,
  // centre in X/Z, and lowest stone point at Y=0.
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
  root.scale.set(1.1 / size.x, 2.4 / size.y, 1.1 / size.z);
  measure();
  const center = bounds.getCenter(new THREE.Vector3());
  root.children.forEach((child) => {
    child.position.x -= center.x / root.scale.x;
    child.position.y -= bounds.min.y / root.scale.y;
    child.position.z -= center.z / root.scale.z;
  });

  root.userData.staticBakeable = true;
  root.userData.assetRole = "hero_shrine_wayfinding_lantern";
  root.userData.materialFamilies = ["stone", "foliage", "metal"];
  return root;
}
