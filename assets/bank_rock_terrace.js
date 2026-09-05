export default function (THREE) {
  const root = new THREE.Group();
  root.name = "bank_rock_large_b";

  const stone = new THREE.MeshStandardMaterial({
    color: 0x59645b,
    roughness: 0.86,
    metalness: 0.0,
    flatShading: true,
  });
  stone.name = "stone";
  const paleStone = new THREE.MeshStandardMaterial({
    color: 0x778078,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });
  paleStone.name = "stone";
  const wetStone = new THREE.MeshStandardMaterial({
    color: 0x263b3a,
    roughness: 0.44,
    metalness: 0.0,
    flatShading: true,
  });
  wetStone.name = "stone";
  const soil = new THREE.MeshStandardMaterial({
    color: 0x302d20,
    roughness: 0.98,
    metalness: 0.0,
    flatShading: true,
  });
  soil.name = "soil";
  const foliage = new THREE.MeshStandardMaterial({
    color: 0x355337,
    roughness: 0.96,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  foliage.name = "foliage";

  const add = (geometry, material, name) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  const hash = (x, z) => {
    const v = Math.sin(x * 73.13 + z * 119.71 + 1.91) * 43758.5453;
    return v - Math.floor(v);
  };

  // Height-field with a low water-facing shelf and a tall, offset rear crown.
  // The footprint remains broad and solid from every view; the ledges below are
  // additional strata rather than a thin theatrical facade.
  const NX = 72;
  const NZ = 42;
  const positions = [];
  const indices = [];
  const heightAt = (x, z) => {
    const ux = x / 3.6;
    const uz = z / 2.3;
    const shoulder = Math.max(0, 1 - Math.pow(Math.abs(ux), 2.45));
    const rise = 0.63 + 2.5 * Math.pow((uz + 1) * 0.5, 1.08);
    const crown =
      0.75 *
      Math.exp(-Math.pow(ux + 0.2, 2) * 2.4 - Math.pow(uz - 0.38, 2) * 5.2);
    const cleft =
      0.36 *
      Math.exp(-Math.pow(ux - 0.43, 2) * 15 - Math.pow(uz - 0.18, 2) * 8);
    const terraces = 0.075 * Math.sin((rise + crown) * 13.5);
    const grit =
      (hash(Math.round((x + 4) * 5), Math.round((z + 3) * 5)) - 0.5) * 0.055;
    return (
      0.16 + shoulder * (rise + crown - cleft + terraces) + grit * shoulder
    );
  };
  for (let iz = 0; iz <= NZ; iz++) {
    const z = -2.3 + (4.6 * iz) / NZ;
    for (let ix = 0; ix <= NX; ix++) {
      const x = -3.6 + (7.2 * ix) / NX;
      // Pinched irregular shore plan, but retain exact extremities at cardinal points.
      const edge = Math.min(ix / NX, 1 - ix / NX, iz / NZ, 1 - iz / NZ);
      const inset = Math.max(0, 0.12 - edge) / 0.12;
      const warp = 0.035 * Math.sin(z * 4.2) * inset;
      positions.push(
        x * (1 - Math.abs(z / 2.3) * 0.035) + warp,
        heightAt(x, z),
        z,
      );
    }
  }
  for (let iz = 0; iz < NZ; iz++) {
    for (let ix = 0; ix < NX; ix++) {
      const a = iz * (NX + 1) + ix;
      const b = a + 1;
      const c = a + NX + 1;
      const d = c + 1;
      if ((ix + iz) % 2) indices.push(a, c, b, b, c, d);
      else indices.push(a, c, d, a, d, b);
    }
  }
  // Closed perimeter walls and underside, so close low cameras see a mass.
  const perimeter = [];
  for (let ix = 0; ix <= NX; ix++) perimeter.push(ix);
  for (let iz = 1; iz <= NZ; iz++) perimeter.push(iz * (NX + 1) + NX);
  for (let ix = NX - 1; ix >= 0; ix--) perimeter.push(NZ * (NX + 1) + ix);
  for (let iz = NZ - 1; iz > 0; iz--) perimeter.push(iz * (NX + 1));
  const bottomStart = positions.length / 3;
  for (const i of perimeter)
    positions.push(positions[i * 3], 0, positions[i * 3 + 2]);
  for (let i = 0; i < perimeter.length; i++) {
    const n = (i + 1) % perimeter.length;
    indices.push(perimeter[i], bottomStart + i, perimeter[n]);
    indices.push(perimeter[n], bottomStart + i, bottomStart + n);
  }
  const centerBottom = positions.length / 3;
  positions.push(0, 0, 0);
  for (let i = 0; i < perimeter.length; i++) {
    const n = (i + 1) % perimeter.length;
    indices.push(centerBottom, bottomStart + n, bottomStart + i);
  }
  const cliffGeo = new THREE.BufferGeometry();
  cliffGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  cliffGeo.setIndex(indices);
  cliffGeo.computeVertexNormals();
  add(cliffGeo, stone, "closed_karst_bank_mass");

  // Long interrupted shelves make sedimentary layers readable at gameplay range.
  function ledgeBand(y, z, width, depth, seed, material) {
    const seg = 44;
    const p = [];
    const id = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const x = -width / 2 + width * t;
      const wobble =
        Math.sin(t * 19 + seed) * 0.055 + Math.sin(t * 43 + seed * 2) * 0.018;
      const localDepth = depth * (0.76 + 0.24 * Math.sin(t * 11 + seed));
      p.push(x, y + wobble, z - localDepth * 0.25);
      p.push(x, y + 0.09 + wobble * 0.4, z + localDepth * 0.75);
      p.push(x, y - 0.075 + wobble, z - localDepth * 0.3);
      p.push(x, y - 0.025 + wobble * 0.4, z + localDepth * 0.71);
      if (i < seg) {
        const q = i * 4;
        const n = q + 4;
        id.push(q, n, q + 1, q + 1, n, n + 1);
        id.push(q + 2, q + 3, n + 2, q + 3, n + 3, n + 2);
        id.push(q, q + 2, n, q + 2, n + 2, n);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(id);
    g.computeVertexNormals();
    add(g, material, `strata_shelf_${seed}`);
  }
  ledgeBand(0.72, -2.24, 6.55, 0.34, 1, wetStone);
  ledgeBand(1.18, -1.78, 5.95, 0.3, 2, paleStone);
  ledgeBand(1.72, -1.15, 5.35, 0.26, 3, stone);
  ledgeBand(2.34, -0.34, 4.58, 0.24, 4, paleStone);
  ledgeBand(2.94, 0.48, 3.72, 0.21, 5, stone);

  // Dark broken wet skirt: separate low facets catch reflections at water level.
  for (let i = 0; i < 15; i++) {
    const x = -3.25 + i * 0.465;
    const r = 0.29 + 0.06 * ((i * 7) % 4);
    const rock = add(
      new THREE.IcosahedronGeometry(r, 2),
      wetStone,
      "wet_waterline_stone",
    );
    rock.position.set(
      x,
      0.24 + (i % 3) * 0.035,
      -2.16 + Math.sin(i * 2.3) * 0.12,
    );
    rock.scale.set(1.22, 0.65, 0.82);
    rock.rotation.set(i * 0.13, i * 0.47, -i * 0.08);
  }

  // Recess-like dark planting sockets, capped with sparse fern fans. These give
  // level dressing explicit attachment points rather than floating foliage.
  const sockets = [
    [-2.45, 2.34, 0.25],
    [-1.45, 2.83, 0.82],
    [-0.35, 3.24, 1.25],
    [0.78, 2.92, 0.73],
    [1.82, 2.48, 0.18],
    [2.62, 1.87, -0.52],
  ];
  for (let s = 0; s < sockets.length; s++) {
    const [x, y, z] = sockets[s];
    const socket = add(
      new THREE.CylinderGeometry(0.22, 0.27, 0.07, 18, 1),
      soil,
      "soil_fern_socket",
    );
    socket.position.set(x, y, z);
    for (let f = 0; f < 3; f++) {
      const blade = add(
        new THREE.PlaneGeometry(0.12, 0.62, 1, 7),
        foliage,
        "fern_frond",
      );
      blade.position.set(x, y + 0.27, z);
      blade.rotation.order = "YXZ";
      blade.rotation.y = f * 2.094 + s * 0.51;
      blade.rotation.x = -0.42 + f * 0.11;
      blade.translateY(0.18);
    }
  }

  // Small topsoil plates break up the crest without changing its solid silhouette.
  for (let i = 0; i < 5; i++) {
    const patch = add(
      new THREE.CircleGeometry(0.38 + i * 0.045, 28),
      soil,
      "topsoil_pocket",
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(
      -2.0 + i * 1.02,
      3.46 - Math.abs(i - 2) * 0.11,
      1.28 - (i % 2) * 0.22,
    );
    patch.scale.set(1.35, 0.72, 1);
  }

  // Exact metric contract; transform vertices through the authored hierarchy.
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    const attr = node.isMesh && node.geometry.getAttribute("position");
    if (!attr) return;
    for (let i = 0; i < attr.count; i++)
      bounds.expandByPoint(
        point.fromBufferAttribute(attr, i).applyMatrix4(node.matrixWorld),
      );
  });
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const scale = new THREE.Vector3(7.2 / size.x, 3.8 / size.y, 4.6 / size.z);
  root.children.forEach((child) => {
    if (!child.isMesh) return;
    child.updateMatrix();
    child.geometry = child.geometry.clone();
    child.geometry.applyMatrix4(child.matrix);
    const attr = child.geometry.getAttribute("position");
    for (let i = 0; i < attr.count; i++) {
      attr.setXYZ(i,
        (attr.getX(i) - centre.x) * scale.x,
        (attr.getY(i) - bounds.min.y) * scale.y,
        (attr.getZ(i) - centre.z) * scale.z);
    }
    attr.needsUpdate = true;
    child.geometry.computeVertexNormals();
    child.position.set(0, 0, 0);
    child.rotation.set(0, 0, 0);
    child.quaternion.identity();
    child.scale.set(1, 1, 1);
    child.updateMatrix();
  });

  root.userData.staticBakeable = true;
  root.userData.assetRole = "modular_solid_karst_bank";
  root.userData.fernSockets = sockets.map(([x, y, z]) => ({ x, y, z }));
  return root;
}
