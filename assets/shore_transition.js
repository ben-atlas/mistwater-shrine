// Selected from three verifier-clean candidates: an interlocked low boulder
// chain with a recessed second course and a pebbled wet toe. It bridges the
// authored bank masses without creating a straight artificial seawall.
export default function shoreTransition(THREE) {
  const root = new THREE.Group();
  root.name = "shore_transition_c_interlocked_shoal";
  const stone = new THREE.MeshStandardMaterial({ color: 0x566159, roughness: 0.91, flatShading: true });
  stone.name = "stone";
  const wet = new THREE.MeshStandardMaterial({ color: 0x31423e, roughness: 0.6, flatShading: true });
  wet.name = "stone";
  const moss = new THREE.MeshStandardMaterial({ color: 0x3b5933, roughness: 0.97, flatShading: true });
  moss.name = "foliage";

  function rock(seed, x, y, z, sx, sy, sz, material) {
    const geometry = new THREE.IcosahedronGeometry(1, 2).toNonIndexed();
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      let px = position.getX(i);
      let py = position.getY(i);
      let pz = position.getZ(i);
      const variation = 1 + 0.09 * Math.sin(px * 7 + seed) + 0.055 * Math.cos(pz * 9 - seed);
      px *= variation;
      pz *= variation;
      if (py < -0.25) { px *= 0.82; pz *= 0.86; }
      py = Math.round(py * 7) / 7 + 0.025 * Math.sin(i + seed);
      position.setXYZ(i, px, py, pz);
    }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `watercut_rock_${seed}`;
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(0.03 * Math.sin(seed), seed * 0.37, 0.04 * Math.cos(seed));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  const xs = [-4.45, -3.72, -2.91, -2.05, -1.12, -0.18, 0.76, 1.68, 2.57, 3.38, 4.17];
  xs.forEach((x, i) => rock(11 + i, x, 0.31, 0.08 + 0.22 * Math.sin(i * 1.37),
    0.62 + 0.12 * (i % 3), 0.38 + 0.06 * (i % 2), 0.72 + 0.12 * ((i + 1) % 3), i % 3 === 0 ? wet : stone));
  for (let i = 0; i < 8; i++) rock(40 + i, -3.92 + i * 1.12, 0.58, -0.55 + 0.1 * Math.sin(i), 0.67, 0.27 + 0.04 * (i % 2), 0.55, i % 4 === 1 ? moss : stone);
  for (let i = 0; i < 15; i++) rock(80 + i, -4.48 + i * 0.64, 0.11, 0.74 + 0.14 * Math.sin(i * 2.2), 0.25 + 0.05 * (i % 3), 0.14, 0.27, wet);

  normalize(root, THREE, [9.6, 0.82, 2.8]);
  root.userData.staticBakeable = true;
  root.userData.assetRole = "low_continuous_shore_transition";
  root.userData.channelProjection = 0.95;
  root.userData.materialFamilies = ["stone", "foliage"];
  return root;
}

function normalize(root, THREE, target) {
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  const measure = () => {
    box.makeEmpty();
    root.updateMatrixWorld(true);
    root.traverse((node) => {
      const attribute = node.isMesh && node.geometry.getAttribute("position");
      if (attribute) for (let i = 0; i < attribute.count; i++) box.expandByPoint(point.fromBufferAttribute(attribute, i).applyMatrix4(node.matrixWorld));
    });
  };
  measure();
  const size = box.getSize(new THREE.Vector3());
  root.scale.set(target[0] / size.x, target[1] / size.y, target[2] / size.z);
  measure();
  const center = box.getCenter(new THREE.Vector3());
  root.children.forEach((node) => {
    node.position.x -= center.x / root.scale.x;
    node.position.y -= box.min.y / root.scale.y;
    node.position.z -= center.z / root.scale.z;
  });
}
