export default function karstMassifCandidateB(THREE) {
  const root = new THREE.Group();
  root.name = "karst_massif_b_split_ink_spires";

  const basalt = new THREE.MeshStandardMaterial({
    color: 0x34413e,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
  });
  const limestone = new THREE.MeshStandardMaterial({
    color: 0x65716a,
    roughness: 0.93,
    metalness: 0,
    flatShading: true,
  });
  const mistStone = new THREE.MeshStandardMaterial({
    color: 0x89918a,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
  });
  const foliage = new THREE.MeshStandardMaterial({
    color: 0x36563a,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  basalt.name = limestone.name = mistStone.name = "stone";
  foliage.name = "foliage";

  function tower(name, cx, cz, height, rx, rz, seed, lean, material) {
    const seg = 64,
      levels = 38;
    const pos = [],
      idx = [];
    for (let j = 0; j <= levels; j++) {
      const t = j / levels;
      const y = height * t;
      const crown = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.06)), 0.34);
      const foot = 1 + 0.22 * Math.pow(1 - t, 5);
      const neck = 1 - 0.26 * Math.exp(-Math.pow((t - 0.68) / 0.12, 2));
      const shelf =
        1 +
        0.075 * Math.sin(t * 18 * Math.PI + seed) +
        0.035 * Math.sin(t * 39 * Math.PI);
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const angular =
          1 +
          0.095 * Math.sin(a * 3 + seed) +
          0.052 * Math.sin(a * 7 - seed * 1.7) +
          0.025 * Math.sin(a * 13 + t * 9);
        const frontCut =
          1 - 0.08 * Math.max(0, Math.cos(a - 0.3)) * Math.sin(t * Math.PI);
        const r = crown * foot * neck * shelf * angular * frontCut;
        const driftX = lean * t + 0.22 * Math.sin(t * 3.5 + seed);
        const driftZ = 0.32 * Math.sin(t * 4.2 + seed * 0.7);
        pos.push(
          cx + driftX + Math.cos(a) * rx * r,
          y,
          cz + driftZ + Math.sin(a) * rz * r,
        );
      }
    }
    for (let j = 0; j < levels; j++)
      for (let i = 0; i < seg; i++) {
        const n = (i + 1) % seg,
          a = j * seg + i,
          b = j * seg + n,
          c = (j + 1) * seg + n,
          d = (j + 1) * seg + i;
        idx.push(a, b, d, b, c, d);
      }
    const bottom = pos.length / 3;
    pos.push(cx, 0, cz);
    const top = pos.length / 3;
    pos.push(cx + lean, height, cz);
    for (let i = 0; i < seg; i++) {
      const n = (i + 1) % seg;
      idx.push(bottom, n, i);
      const a = levels * seg + i,
        b = levels * seg + n;
      idx.push(top, a, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.name = name;
    m.castShadow = m.receiveShadow = true;
    root.add(m);
  }

  tower("stone_west_needle", -3.7, 0.1, 27.2, 4.8, 4.6, 1.2, -1.0, limestone);
  tower("stone_east_blade", 3.7, -0.4, 21.7, 4.2, 4.8, 4.7, 1.35, basalt);
  tower("stone_rear_fin", 0.4, 2.5, 15.2, 3.5, 3.7, 8.3, -0.3, mistStone);

  // Thin ledges read as brush-stroke accents without turning the summit green.
  const ledges = [
    [-5.0, 8.0, -3.4, 2.3, 0.32, 1.25, -0.18],
    [-1.9, 16.1, 2.6, 1.8, 0.28, 1.05, 0.28],
    [4.7, 6.7, -3.3, 2.2, 0.3, 1.25, 0.2],
    [3.1, 13.0, 3.4, 1.7, 0.26, 1.0, -0.25],
    [-0.3, 10.8, 5.0, 1.55, 0.22, 0.85, 0.08],
  ];
  for (let i = 0; i < ledges.length; i++) {
    const [x, y, z, sx, sy, sz, rz] = ledges[i];
    const shelf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 3),
      i % 2 ? mistStone : limestone,
    );
    shelf.name = `stone_erosion_ledge_${i}`;
    shelf.position.set(x, y, z);
    shelf.scale.set(sx, sy, sz);
    shelf.rotation.z = rz;
    shelf.castShadow = shelf.receiveShadow = true;
    root.add(shelf);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(sx * 0.72, 0.58, 14, 3),
      foliage,
    );
    crown.name = `foliage_ledge_pine_${i}`;
    crown.position.set(x, y + 0.4, z);
    crown.scale.z = 0.75;
    crown.rotation.z = rz;
    crown.castShadow = true;
    root.add(crown);
  }

  normalize(root, THREE, 22, 28, 12);
  root.userData.staticBakeable = true;
  return root;
}

function normalize(root, THREE, width, height, depth) {
  const box = new THREE.Box3().setFromObject(root),
    size = new THREE.Vector3(),
    center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  root.scale.set(width / size.x, height / size.y, depth / size.z);
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root);
  b.getCenter(center);
  root.position.set(-center.x, -b.min.y, -center.z);
  root.updateMatrixWorld(true);
}
