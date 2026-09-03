// Draw-call optimized revision of forest_guardian candidate A.
// Geometry is merged only inside a single articulated joint and material bucket;
// no geometry crosses a pivot, so the complete animation contract is preserved.
export default function (THREE) {
  const g = new THREE.Group();
  const root = new THREE.Group();
  g.add(root);

  const material = (name, color, roughness = 0.88, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    m.name = name;
    return m;
  };
  const fur = material("fabric", 0x934631, 0.92);
  const darkFur = material("fabric", 0x43251f, 0.94);
  const cream = material("fabric", 0xd8c69c, 0.93);
  const cloth = material("fabric", 0x26372d, 0.96);
  const trim = material("fabric", 0x66714b, 0.9);
  const gold = material("metal", 0xb78a43, 0.55, 0.18);
  const ink = material("fabric", 0x131d1b, 0.82);

  // Each parent owns material buckets. Parts are transformed into that parent's
  // local space before merging, which keeps every anatomical pivot exact.
  const owners = new Map();
  const stage = (geometry, mat, parent, position, scale, rotation) => {
    const p = position || [0, 0, 0];
    const s = scale || [1, 1, 1];
    const r = rotation || [0, 0, 0];
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...p),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
      new THREE.Vector3(...s),
    );
    const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    baked.applyMatrix4(matrix);
    let buckets = owners.get(parent);
    if (!buckets) owners.set(parent, (buckets = new Map()));
    let bucket = buckets.get(mat);
    if (!bucket) buckets.set(mat, (bucket = []));
    bucket.push(baked);
  };
  const merge = (geometries) => {
    if (geometries.length === 1) return geometries[0];
    const names = ["position", "normal", "uv"].filter((name) =>
      geometries.every((geo) => geo.getAttribute(name)),
    );
    const out = new THREE.BufferGeometry();
    for (const name of names) {
      const itemSize = geometries[0].getAttribute(name).itemSize;
      const length = geometries.reduce(
        (sum, geo) => sum + geo.getAttribute(name).array.length,
        0,
      );
      const array = new Float32Array(length);
      let offset = 0;
      for (const geo of geometries) {
        const src = geo.getAttribute(name).array;
        array.set(src, offset);
        offset += src.length;
      }
      out.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
    }
    out.computeBoundingBox();
    out.computeBoundingSphere();
    return out;
  };
  const flush = () => {
    for (const [parent, buckets] of owners) {
      for (const [mat, geometries] of buckets) {
        const n = new THREE.Mesh(merge(geometries), mat);
        n.castShadow = true;
        n.receiveShadow = true;
        parent.add(n);
      }
    }
  };
  const sphere = (
    parent,
    mat,
    r,
    position,
    scale = [1, 1, 1],
    seg = 20,
    rotation,
  ) =>
    stage(
      new THREE.SphereGeometry(r, seg, Math.max(10, Math.round(seg * 0.66))),
      mat,
      parent,
      position,
      scale,
      rotation,
    );
  const capsuleDown = (
    parent,
    mat,
    radius,
    length,
    scale = [1, 1, 1],
    seg = 12,
  ) =>
    stage(
      new THREE.CapsuleGeometry(radius, length, 6, seg),
      mat,
      parent,
      [0, -(length * 0.5 + radius), 0],
      scale,
    );
  const cone = (
    parent,
    mat,
    radius,
    height,
    position,
    rotation = [0, 0, 0],
    seg = 7,
  ) =>
    stage(
      new THREE.ConeGeometry(radius, height, seg),
      mat,
      parent,
      position,
      null,
      rotation,
    );

  const spine = new THREE.Group();
  spine.position.y = 0.73;
  root.add(spine);

  sphere(spine, fur, 0.255, [0, 0.08, 0], [1.02, 1.22, 0.79], 24);
  sphere(spine, cloth, 0.265, [0, 0.09, 0.006], [1.03, 1.05, 0.81], 24);
  sphere(spine, cloth, 0.215, [0, -0.115, -0.005], [1.08, 0.62, 0.84], 20);

  const collarShape = new THREE.Shape();
  collarShape.moveTo(-0.035, 0);
  collarShape.lineTo(0.035, 0);
  collarShape.lineTo(0.027, 0.24);
  collarShape.lineTo(-0.027, 0.24);
  collarShape.closePath();
  const lapelGeo = new THREE.ExtrudeGeometry(collarShape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.009,
    bevelThickness: 0.008,
  });
  stage(lapelGeo, trim, spine, [-0.03, 0.005, 0.201], null, [0, 0, -0.59]);
  stage(lapelGeo, trim, spine, [0.03, 0.005, 0.204], null, [0, 0, 0.59]);
  stage(
    new THREE.TorusGeometry(0.205, 0.029, 8, 28, Math.PI * 1.12),
    trim,
    spine,
    [0, 0.253, 0],
    [1.08, 0.7, 1],
    [Math.PI / 2, 0, -0.18],
  );

  stage(
    new THREE.CylinderGeometry(0.246, 0.225, 0.115, 24),
    cloth,
    spine,
    [0, -0.185, 0],
    [1, 1, 0.79],
  );
  stage(
    new THREE.TorusGeometry(0.112, 0.038, 8, 20),
    trim,
    spine,
    [0, -0.185, 0.208],
    [1, 0.72, 1],
  );
  sphere(spine, trim, 0.066, [0, -0.182, 0.242], [1.25, 0.78, 0.65], 16);
  for (const side of [-1, 1]) {
    const tabShape = new THREE.Shape();
    tabShape.moveTo(-0.085, 0.09);
    tabShape.lineTo(0.085, 0.09);
    tabShape.lineTo(0.062, -0.21);
    tabShape.lineTo(0, -0.255);
    tabShape.lineTo(-0.062, -0.21);
    tabShape.closePath();
    const tabGeo = new THREE.ExtrudeGeometry(tabShape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.006,
    });
    stage(
      tabGeo,
      side < 0 ? cloth : trim,
      spine,
      [side * 0.078, -0.225, 0.19],
      null,
      [0, 0, side * 0.08],
    );
  }

  const head = new THREE.Group();
  head.position.set(0, 0.355, 0.008);
  spine.add(head);
  sphere(head, fur, 0.245, [0, 0.16, 0.01], [1.08, 0.93, 0.9], 28);
  sphere(head, fur, 0.205, [0, 0.105, 0.082], [1.12, 0.85, 0.78], 24);
  for (const side of [-1, 1]) {
    cone(
      head,
      fur,
      0.112,
      0.235,
      [side * 0.174, 0.355, -0.005],
      [0, 0, side * -0.19],
      7,
    );
    cone(
      head,
      cream,
      0.062,
      0.145,
      [side * 0.174, 0.363, 0.046],
      [0, 0, side * -0.19],
      7,
    );
    cone(
      head,
      fur,
      0.052,
      0.15,
      [side * 0.223, 0.115, 0.02],
      [0, 0, side * -1.12],
      6,
    );
    cone(
      head,
      cream,
      0.046,
      0.14,
      [side * 0.181, 0.09, 0.172],
      [Math.PI / 2, 0, side * 0.82],
      6,
    );
  }
  for (let i = -2; i <= 2; i++) {
    cone(
      head,
      fur,
      0.043,
      0.145 + (2 - Math.abs(i)) * 0.018,
      [i * 0.046, 0.37 + (2 - Math.abs(i)) * 0.012, 0.025],
      [0.08, 0, -i * 0.18],
      6,
    );
  }
  for (const side of [-1, 1]) {
    sphere(
      head,
      cream,
      0.105,
      [side * 0.092, 0.16, 0.188],
      [1.2, 0.67, 0.48],
      18,
    );
    sphere(
      head,
      cream,
      0.057,
      [side * 0.09, 0.228, 0.207],
      [1.28, 0.35, 0.28],
      16,
      [0, 0, side * -0.2],
    );
    sphere(
      head,
      ink,
      0.027,
      [side * 0.083, 0.17, 0.227],
      [0.86, 1.05, 0.45],
      14,
    );
    sphere(head, gold, 0.011, [side * 0.083, 0.174, 0.24], [1, 1, 0.55], 10);
  }
  sphere(head, cream, 0.132, [0, 0.075, 0.21], [1.18, 0.69, 0.54], 22);
  sphere(head, ink, 0.048, [0, 0.105, 0.267], [1.12, 0.74, 0.62], 16);
  sphere(head, cream, 0.075, [0, 0.017, 0.215], [1, 0.37, 0.55], 16);

  const limbs = {};
  for (const side of [-1, 1]) {
    const sideName = side < 0 ? "left" : "right";
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.255, 0.245, 0);
    shoulder.rotation.z = side * 0.12;
    spine.add(shoulder);
    sphere(shoulder, fur, 0.102, [0, -0.055, 0], [0.92, 1.16, 0.88], 18);
    capsuleDown(shoulder, fur, 0.078, 0.17, [1.03, 1, 0.92], 14);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.25, 0);
    shoulder.add(elbow);
    sphere(elbow, cream, 0.088, [0, -0.04, 0], [1.02, 0.84, 0.94], 16);
    capsuleDown(elbow, cream, 0.079, 0.16, [1.05, 1, 0.95], 14);
    for (let i = 0; i < 4; i++) {
      stage(
        new THREE.TorusGeometry(0.082, 0.009, 6, 16),
        cream,
        elbow,
        [0, -0.075 - i * 0.045, 0],
        [1, 1, 0.92],
        [Math.PI / 2, 0, side * 0.08],
      );
    }

    const wrist = new THREE.Group();
    wrist.position.set(0, -0.245, 0);
    elbow.add(wrist);
    sphere(wrist, darkFur, 0.092, [0, -0.068, 0.018], [1.05, 1.05, 0.9], 18);
    for (let d = -1; d <= 1; d++) {
      sphere(
        wrist,
        darkFur,
        0.03,
        [d * 0.04, -0.14, 0.045],
        [0.8, 1.25, 1.1],
        10,
      );
    }
    limbs[`${sideName}Shoulder`] = shoulder;
    limbs[`${sideName}Elbow`] = elbow;
    limbs[`${sideName}Wrist`] = wrist;
  }

  for (const side of [-1, 1]) {
    const sideName = side < 0 ? "left" : "right";
    const hip = new THREE.Group();
    hip.position.set(side * 0.135, -0.18, 0);
    hip.rotation.z = side * -0.045;
    spine.add(hip);
    sphere(hip, cloth, 0.145, [0, -0.075, 0], [1.12, 1.18, 0.83], 20);
    capsuleDown(hip, cloth, 0.104, 0.16, [1.1, 1, 0.85], 14);

    const knee = new THREE.Group();
    knee.position.set(0, -0.27, 0);
    hip.add(knee);
    sphere(knee, cream, 0.094, [0, -0.04, 0], [1.03, 0.82, 0.91], 16);
    capsuleDown(knee, cream, 0.083, 0.15, [1.02, 1, 0.94], 14);
    for (let i = 0; i < 4; i++) {
      stage(
        new THREE.TorusGeometry(0.084, 0.009, 6, 16),
        cream,
        knee,
        [0, -0.06 - i * 0.043, 0],
        [1, 1, 0.93],
        [Math.PI / 2, 0, side * -0.07],
      );
    }

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.23, 0);
    knee.add(ankle);
    sphere(ankle, darkFur, 0.105, [0, -0.065, 0.055], [1.17, 0.72, 1.45], 18);
    for (let d = -1; d <= 1; d++) {
      sphere(
        ankle,
        darkFur,
        0.03,
        [d * 0.047, -0.085, 0.16],
        [0.72, 0.7, 1.25],
        10,
      );
    }
    limbs[`${sideName}Hip`] = hip;
    limbs[`${sideName}Knee`] = knee;
    limbs[`${sideName}Ankle`] = ankle;
  }

  const tail0 = new THREE.Group();
  tail0.position.set(-0.05, -0.11, -0.16);
  tail0.rotation.set(-0.12, 0, 1.02);
  spine.add(tail0);
  capsuleDown(tail0, fur, 0.12, 0.28, [1.03, 1, 0.92], 18);
  stage(
    new THREE.TorusGeometry(0.113, 0.043, 8, 20),
    darkFur,
    tail0,
    [0, -0.25, 0],
    [1, 1, 0.92],
    [Math.PI / 2, 0, 0],
  );

  const tail1 = new THREE.Group();
  tail1.position.set(0, -0.38, 0);
  tail1.rotation.z = -0.5;
  tail0.add(tail1);
  capsuleDown(tail1, fur, 0.13, 0.3, [1.05, 1, 0.94], 18);
  stage(
    new THREE.TorusGeometry(0.124, 0.045, 8, 20),
    darkFur,
    tail1,
    [0, -0.265, 0],
    [1, 1, 0.94],
    [Math.PI / 2, 0, 0],
  );

  const tail2 = new THREE.Group();
  tail2.position.set(0, -0.41, 0);
  tail2.rotation.z = -0.5;
  tail1.add(tail2);
  capsuleDown(tail2, fur, 0.145, 0.31, [1.08, 1, 0.96], 20);
  stage(
    new THREE.TorusGeometry(0.137, 0.047, 8, 20),
    darkFur,
    tail2,
    [0, -0.255, 0],
    [1, 1, 0.96],
    [Math.PI / 2, 0, 0],
  );
  sphere(tail2, fur, 0.15, [0, -0.48, 0], [1.08, 1.18, 0.96], 20);
  for (let i = -1; i <= 1; i++) {
    cone(tail2, fur, 0.048, 0.145, [i * 0.055, -0.61, 0], [0, 0, i * 0.2], 6);
  }

  // Material buckets become meshes only after every joint is populated.
  flush();

  const joints = {
    root,
    spine,
    head,
    leftShoulder: limbs.leftShoulder,
    leftElbow: limbs.leftElbow,
    leftWrist: limbs.leftWrist,
    rightShoulder: limbs.rightShoulder,
    rightElbow: limbs.rightElbow,
    rightWrist: limbs.rightWrist,
    leftHip: limbs.leftHip,
    leftKnee: limbs.leftKnee,
    leftAnkle: limbs.leftAnkle,
    rightHip: limbs.rightHip,
    rightKnee: limbs.rightKnee,
    rightAnkle: limbs.rightAnkle,
    tail0,
    tail1,
    tail2,
  };

  const measure = () => {
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const im = new THREE.Matrix4();
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
          put(m.multiplyMatrices(n.matrixWorld, im));
        }
        return;
      }
      put(n.matrixWorld);
    });
    return box;
  };
  let box = measure();
  const size = box.getSize(new THREE.Vector3());
  root.scale.set(0.82 / size.x, 1.25 / size.y, 0.72 / size.z);
  box = measure();
  const center = box.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -box.min.y, -center.z);

  g.userData.joints = joints;
  g.userData.asset = "forest_guardian_a_optimized";
  return g;
}
