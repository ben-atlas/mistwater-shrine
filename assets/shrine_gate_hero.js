export default function (THREE) {
  const g = new THREE.Group();

  const mat = (name, color, roughness = 0.8, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    m.name = name;
    return m;
  };
  const stone = mat('stone', 0x58635d, 0.94);
  const timber = mat('timber', 0x4a2924, 0.72);
  const wornTimber = mat('timber', 0x7a4030, 0.68);
  const tile = mat('tile', 0x285556, 0.58);
  const metal = mat('metal', 0x9a783d, 0.46, 0.42);
  const moss = mat('foliage', 0x526d3e, 0.91);

  const mesh = (geometry, material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geometry, material);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
  };
  const box = (w, h, d, material, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const o = mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), material, x, y, z);
    o.rotation.set(rx, ry, rz); return o;
  };

  // Profile-led roof. Bevel size expands the XY profile and bevel thickness expands Z,
  // so both are subtracted from the authored profile/depth to preserve the intended envelope.
  function roofProfile(width, baseY, crown, tipRise, depth, material) {
    const bs = 0.035, bt = 0.025;
    const half = width / 2 - bs;
    const s = new THREE.Shape();
    const top = (x) => baseY + crown * (1 - (x / half) ** 2) + tipRise * Math.pow(Math.abs(x) / half, 7);
    const bottom = (x) => top(x) - 0.20;
    const n = 18;
    s.moveTo(-half, bottom(-half) + bs);
    for (let i = 0; i <= n; i++) { const x = -half + 2 * half * i / n; s.lineTo(x, top(x) - bs); }
    for (let i = n; i >= 0; i--) { const x = -half + 2 * half * i / n; s.lineTo(x, bottom(x) + bs); }
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: depth - 2 * bt, steps: 1, curveSegments: 2,
      bevelEnabled: true, bevelSegments: 2, bevelSize: bs, bevelThickness: bt,
    });
    geo.translate(0, 0, -depth / 2 + bt);
    return mesh(geo, material);
  }

  // Stepped stone bases, with shifted courses and corner blocks so all four views read.
  for (const side of [-1, 1]) {
    const x = side * 2.62;
    box(1.52, 0.30, 1.42, stone, x, 0.15, 0);
    box(1.32, 0.28, 1.26, stone, x + side * 0.03, 0.44, -0.02);
    box(1.13, 0.28, 1.08, stone, x - side * 0.04, 0.72, 0.01);
    box(0.96, 0.22, 0.93, stone, x, 0.97, 0);
    // Visible stone course joints and moss shoulders, not a monolithic pedestal.
    for (let r = 0; r < 3; r++) for (let q = -1; q <= 1; q++) {
      const ww = 0.39 - r * 0.035;
      box(ww, 0.055, 0.08, wornTimber, x + q * ww, 0.28 + r * 0.28, 0.715 - r * 0.09);
      box(ww, 0.055, 0.08, wornTimber, x - q * ww, 0.28 + r * 0.28, -0.715 + r * 0.09);
    }
    box(0.78, 0.18, 0.78, metal, x, 1.17, 0);
    box(0.65, 3.78, 0.66, wornTimber, x, 3.13, 0);
    // Dark inset faces make the post a timber assembly from front and reverse.
    box(0.42, 3.25, 0.035, timber, x, 3.22, 0.347);
    box(0.42, 3.25, 0.035, timber, x, 3.22, -0.347);
    box(0.79, 0.20, 0.80, metal, x, 5.01, 0);
  }

  // Deep lintel hierarchy and reverse framing.
  box(6.15, 0.55, 0.66, wornTimber, 0, 4.78, 0);
  box(5.50, 0.30, 0.86, timber, 0, 5.22, 0);
  box(4.76, 0.25, 0.54, wornTimber, 0, 5.58, 0);
  for (const z of [-0.46, 0.46]) {
    box(5.85, 0.16, 0.16, timber, 0, 4.43, z);
    for (const side of [-1, 1]) box(0.26, 0.92, 0.24, timber, side * 2.18, 4.91, z);
  }

  // Bracket clouds: stepped cantilevers, mirrored front/back and around both posts.
  for (const z of [-0.53, 0.53]) for (const side of [-1, 1]) {
    const px = side * 2.62;
    for (let level = 0; level < 4; level++) {
      box(1.08 + level * 0.18, 0.15, 0.22, level % 2 ? wornTimber : timber,
          px - side * level * 0.08, 5.13 + level * 0.19, z);
      box(0.20, 0.43, 0.28, timber, px + side * (0.38 + level * 0.09), 5.04 + level * 0.18, z);
    }
  }
  for (const x of [-1.55, -0.78, 0, 0.78, 1.55]) for (const z of [-0.55, 0.55]) {
    box(0.22, 0.52, 0.27, timber, x, 5.58, z);
    box(0.72, 0.14, 0.25, wornTimber, x, 5.78, z);
  }

  // Two distinct curved eave layers with substantial reverse depth.
  roofProfile(8.22, 5.76, 0.34, 0.66, 1.42, tile);
  roofProfile(6.95, 6.43, 0.24, 0.43, 1.18, tile);
  // Shadow boards beneath each roof reinforce the silhouette.
  roofProfile(8.06, 5.68, 0.30, 0.59, 1.20, timber);
  roofProfile(6.80, 6.36, 0.21, 0.38, 0.98, timber);

  // Rolled tile seams follow sampled roof heights on both faces; end caps face front/reverse.
  function addTiles(width, baseY, crown, rise, depth, count) {
    const half = width / 2;
    for (let i = 0; i < count; i++) {
      const x = -half + (2 * half * i) / (count - 1);
      const y = baseY + crown * (1 - (x / half) ** 2) + rise * Math.pow(Math.abs(x) / half, 7) + 0.115;
      const roll = mesh(new THREE.CylinderGeometry(0.055, 0.065, depth + 0.06, 16, 1), tile, x, y, 0);
      roll.rotation.x = Math.PI / 2;
      for (const z of [-depth / 2 - 0.045, depth / 2 + 0.045]) {
        const cap = mesh(new THREE.CylinderGeometry(0.083, 0.083, 0.05, 16, 1), metal, x, y, z);
        cap.rotation.x = Math.PI / 2;
      }
    }
  }
  addTiles(7.92, 5.76, 0.34, 0.60, 1.40, 29);
  addTiles(6.68, 6.43, 0.24, 0.39, 1.16, 25);

  // Crown ridge and upturned finials.
  box(5.95, 0.14, 0.18, tile, 0, 6.80, 0);
  for (const side of [-1, 1]) {
    const f = mesh(new THREE.ConeGeometry(0.13, 0.64, 12), metal, side * 4.00, 6.56, 0);
    f.rotation.z = -side * 0.78;
    const u = mesh(new THREE.ConeGeometry(0.11, 0.48, 12), metal, side * 3.33, 6.82, 0);
    u.rotation.z = -side * 0.55;
  }

  // Abstract concentric gold emblem, readable from either approach and containing no text.
  for (const z of [-0.48, 0.48]) {
    const disc = mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.10, 32, 1), metal, 0, 5.00, z);
    disc.rotation.x = Math.PI / 2;
    const ring = mesh(new THREE.TorusGeometry(0.36, 0.055, 10, 32), timber, 0, 5.00, z + Math.sign(z) * 0.065);
    ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const petal = mesh(new THREE.SphereGeometry(0.095, 12, 8), wornTimber,
        Math.cos(a) * 0.23, 5.00 + Math.sin(a) * 0.23, z + Math.sign(z) * 0.075);
      petal.scale.set(1.45, 0.62, 0.42); petal.rotation.z = a;
    }
  }

  // Hanging attachment points and restrained chimes at four corners.
  for (const x of [-3.72, -1.84, 1.84, 3.72]) {
    const y = 5.82 + 0.20 * Math.abs(x) / 3.72;
    const cord = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 8), metal, x, y - 0.25, 0.57);
    const bell = mesh(new THREE.ConeGeometry(0.10, 0.25, 12, 1, true), metal, x, y - 0.50, 0.57);
    bell.material.side = THREE.DoubleSide;
  }

  // Sparse geometry moss accents stay subordinate to the architectural silhouette.
  for (const [x, y, z, sx] of [[-3.1,.31,.5,.35],[2.8,.58,-.45,.28],[-2.2,.89,-.43,.22],[3.0,.88,.44,.18]]) {
    const o = mesh(new THREE.SphereGeometry(0.18, 10, 6), moss, x, y, z); o.scale.set(sx / .18, .22, 1.2);
  }

  // Finished-vertex normalization guarantees the exact contract after all bevel expansion.
  const box3 = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld));
  });
  const size = box3.getSize(new THREE.Vector3());
  g.scale.set(8.40 / size.x, 7.00 / size.y, 1.55 / size.z);
  g.updateMatrixWorld(true);
  box3.makeEmpty();
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld));
  });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x / g.scale.x; o.position.y -= box3.min.y / g.scale.y; o.position.z -= c.z / g.scale.z; });
  g.userData.asset = 'shrine_gate_hero_b';
  return g;
}
