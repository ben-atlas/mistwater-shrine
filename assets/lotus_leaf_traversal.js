export default function (THREE) {
  const g = new THREE.Group();

  const face = new THREE.MeshStandardMaterial({
    color: 0x5f934d, roughness: 0.48, metalness: 0.0, side: THREE.DoubleSide,
  });
  face.name = 'foliage';
  const underside = new THREE.MeshStandardMaterial({
    color: 0x1f5136, roughness: 0.72, metalness: 0.0, side: THREE.DoubleSide,
  });
  underside.name = 'foliage';
  const edge = new THREE.MeshStandardMaterial({
    color: 0x304b2c, roughness: 0.62, metalness: 0.0, side: THREE.DoubleSide,
  });
  edge.name = 'foliage';

  const angularSegments = 56;
  const radialSegments = 11;
  // Unequal shoulders make the cleft feel grown and offset rather than die-cut.
  const notchRightAngle = 0.18;
  const notchLeftAngle = 0.34;
  const start = notchRightAngle;
  const span = Math.PI * 2 - notchRightAngle - notchLeftAngle;

  function outlineRadius(a) {
    return 1 + 0.028 * Math.sin(a * 5 + 0.7) + 0.018 * Math.sin(a * 9 - 0.4)
      + 0.035 * Math.sin(a - 1.05);
  }

  function surfaceY(t, a) {
    // A deep flexible bowl whose irregular outer edge curls upward.
    const bowl = -0.105 + 0.19 * Math.pow(t, 1.72);
    const curl = 0.075 * Math.pow(Math.max(0, (t - 0.78) / 0.22), 2);
    const scallop = 0.022 * Math.sin(a * 7 + 0.35) * Math.pow(t, 4);
    const offCentre = 0.018 * Math.sin(a - 0.8) * t;
    return bowl + curl + scallop + offCentre;
  }

  function point(t, a, yOffset = 0) {
    // The cleft pinches into the depression without reading as a punched centre hole.
    const inner = 0.045;
    const rr = inner + (outlineRadius(a) - inner) * t;
    return [
      Math.sin(a) * rr * 1.35,
      surfaceY(t, a) + yOffset,
      Math.cos(a) * rr * 1.275,
    ];
  }

  function makeShell() {
    const positions = [];
    const indices = [];
    const row = angularSegments + 1;
    // Top and underside are separate vertex sheets so their normals remain crisp.
    for (let layer = 0; layer < 2; layer++) {
      for (let r = 0; r <= radialSegments; r++) {
        const t = r / radialSegments;
        for (let i = 0; i <= angularSegments; i++) {
          const a = start + span * i / angularSegments;
          const thickness = 0.075 + 0.055 * Math.pow(t, 1.6);
          positions.push(...point(t, a, layer ? -thickness : 0));
        }
      }
    }
    for (let r = 0; r < radialSegments; r++) {
      for (let i = 0; i < angularSegments; i++) {
        const q = r * row + i;
        indices.push(q, q + row, q + 1, q + 1, q + row, q + row + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  const shell = new THREE.Mesh(makeShell(), face);
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);

  // A second underside-only shell gives the hanging lower face its own material.
  const lowerGeometry = shell.geometry.clone();
  const lowerIndex = [];
  const row = angularSegments + 1;
  const sheet = row * (radialSegments + 1);
  for (let r = 0; r < radialSegments; r++) {
    for (let i = 0; i < angularSegments; i++) {
      const u = sheet + r * row + i;
      lowerIndex.push(u, u + 1, u + row, u + 1, u + row + 1, u + row);
    }
  }
  lowerGeometry.setIndex(lowerIndex);
  const lower = new THREE.Mesh(lowerGeometry, underside);
  lower.castShadow = true;
  lower.receiveShadow = true;
  g.add(lower);

  function makeWall(which) {
    const positions = [];
    const indices = [];
    const steps = which === 'outer' ? angularSegments : radialSegments;
    for (let i = 0; i <= steps; i++) {
      let t;
      let a;
      if (which === 'outer') {
        t = 1;
        a = start + span * i / steps;
      } else if (which === 'inner') {
        t = 0;
        a = start + span * i / steps;
      } else {
        t = i / steps;
        a = which === 'notchRight' ? start : start + span;
      }
      const thick = 0.075 + 0.055 * Math.pow(t, 1.6);
      positions.push(...point(t, a, 0), ...point(t, a, -thick));
      if (i < steps) {
        const q = i * 2;
        indices.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  for (const side of ['outer', 'inner', 'notchRight', 'notchLeft']) {
    const wall = new THREE.Mesh(makeWall(side), side === 'outer' ? edge : underside);
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);
  }

  function makeRim() {
    const positions = [];
    const indices = [];
    const around = 8;
    for (let i = 0; i <= angularSegments; i++) {
      const a = start + span * i / angularSegments;
      const p = point(1, a, 0.002);
      const radius = 0.047 + 0.008 * Math.sin(a * 7 + 0.35);
      // Elliptical tube cross-section, locally vertical/radial around the outline.
      for (let j = 0; j < around; j++) {
        const b = Math.PI * 2 * j / around;
        positions.push(
          p[0] + Math.sin(a) * Math.cos(b) * radius,
          p[1] + Math.sin(b) * radius * 0.82,
          p[2] + Math.cos(a) * Math.cos(b) * radius,
        );
      }
    }
    for (let i = 0; i < angularSegments; i++) {
      for (let j = 0; j < around; j++) {
        const n = (j + 1) % around;
        const a = i * around + j;
        const b = i * around + n;
        const c = (i + 1) * around + j;
        const d = (i + 1) * around + n;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  const rim = new THREE.Mesh(makeRim(), edge);
  rim.castShadow = true;
  rim.receiveShadow = true;
  g.add(rim);

  function makeVein(a, length, width, lift) {
    const positions = [];
    const indices = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = 0.08 + length * i / steps;
      const p = point(t, a, lift);
      const w = width * (1 - 0.68 * i / steps);
      const nx = Math.cos(a);
      const nz = -Math.sin(a);
      // Low, broad ridge integrated into the waxy face, with a softly crowned centre.
      positions.push(p[0] - nx * w, p[1], p[2] - nz * w);
      positions.push(p[0], p[1] + w * 0.34, p[2]);
      positions.push(p[0] + nx * w, p[1], p[2] + nz * w);
    }
    for (let i = 0; i < steps; i++) {
      const q = i * 3;
      const n = q + 3;
      indices.push(q, n, q + 1, q + 1, n, n + 1);
      indices.push(q + 1, n + 1, q + 2, q + 2, n + 1, n + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  // Uneven spacing keeps the leaf organic; these are surface ridges, not rods.
  const veinAngles = [0.43, 0.76, 1.08, 1.41, 1.73, 2.03, 2.35, 2.69, 3.02,
    3.36, 3.68, 4.02, 4.34, 4.68, 5.02, 5.37, 5.72];
  veinAngles.forEach((a, i) => {
    if (a <= start || a >= start + span) return;
    const vein = new THREE.Mesh(makeVein(a, 0.76 + 0.07 * Math.sin(i * 1.7), 0.024, 0.005), edge);
    vein.castShadow = true;
    vein.receiveShadow = true;
    g.add(vein);
  });

  // The leaf is repeated throughout the traversal route, so each authored part
  // is packed into one native draw. Vertex colours preserve the original
  // face/underside/rim palette without material groups (which would still draw
  // once per group). Geometry remains split at the former part boundaries, so
  // its normals and therefore its silhouette/shading are unchanged.
  function mergeAuthoredParts() {
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];
    let vertexOffset = 0;

    for (const part of g.children) {
      if (!part.isMesh) continue;
      const geometry = part.geometry;
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      const tint = part.material.color;
      for (let i = 0; i < position.count; i++) {
        positions.push(position.getX(i), position.getY(i), position.getZ(i));
        normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
        colors.push(tint.r, tint.g, tint.b);
      }
      if (geometry.index) {
        for (let i = 0; i < geometry.index.count; i++) {
          indices.push(vertexOffset + geometry.index.getX(i));
        }
      } else {
        for (let i = 0; i < position.count; i++) indices.push(vertexOffset + i);
      }
      vertexOffset += position.count;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.62,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    material.name = 'foliage';
    const merged = new THREE.Mesh(geometry, material);
    merged.name = 'lotus_leaf_authored_merged';
    merged.castShadow = true;
    merged.receiveShadow = true;
    g.clear();
    g.add(merged);
  }

  mergeAuthoredParts();

  // Normalize the authored geometry to the production contract exactly.
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position;
    if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld));
  });
  const size = box.getSize(new THREE.Vector3());
  g.scale.set(2.70 / size.x, 0.38 / size.y, 2.55 / size.z);
  g.updateMatrixWorld(true);
  box.makeEmpty();
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position;
    if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld));
  });
  const centre = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => {
    o.position.x -= centre.x / g.scale.x;
    o.position.y -= box.min.y / g.scale.y;
    o.position.z -= centre.z / g.scale.z;
  });

  g.userData.expectedSize = { width: 2.70, height: 0.38, depth: 2.55 };
  g.userData.role = 'springy traversal lotus';
  return g;
}
