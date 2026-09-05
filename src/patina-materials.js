import * as THREE from "three";

const ROOT = "./assets/materials/mossy-wet-stone/";
const LACQUER_ROOT = "./assets/materials/aged-red-lacquer-timber/";
const OXIDIZED_ROOF_ROOT = "./assets/materials/oxidized-roof-tile-metal/";
const WATERLINE_ROOT = "./assets/materials/stained-waterline-masonry/";

// Several 404 assets use authored BufferGeometry and therefore arrive without
// UVs. A texture silently has no visible effect on those meshes. Generate a
// deterministic box projection per triangle so every selected PBR surface has
// real coordinates on horizontal and vertical faces alike.
function ensureBoxProjectedUV(node, metresPerTile = 1.8) {
  if (node.geometry.attributes.uv) {
    if (!node.geometry.attributes.uv1) node.geometry.setAttribute("uv1", node.geometry.attributes.uv);
    return;
  }
  let geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = new Float32Array(position.count * 2);
  const inv = 1 / metresPerTile;
  for (let i = 0; i < position.count; i++) {
    const ax = Math.abs(normal.getX(i));
    const ay = Math.abs(normal.getY(i));
    const az = Math.abs(normal.getZ(i));
    if (ay >= ax && ay >= az) {
      uv[i * 2] = position.getX(i) * inv;
      uv[i * 2 + 1] = position.getZ(i) * inv;
    } else if (ax >= az) {
      uv[i * 2] = position.getZ(i) * inv;
      uv[i * 2 + 1] = position.getY(i) * inv;
    } else {
      uv[i * 2] = position.getX(i) * inv;
      uv[i * 2 + 1] = position.getY(i) * inv;
    }
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute("uv1", geometry.attributes.uv);
  node.geometry = geometry;
}

function configure(texture, { color = false, repeat = 1.35, anisotropy = 4 } = {}) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = anisotropy;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function loadMossyWetStone(renderer, mobileMode) {
  const loader = new THREE.TextureLoader();
  const path = (channel) => `${ROOT}mossy-wet-stone_${channel}.png`;
  const [map, roughnessMap, normalMap, aoMap, wetnessMap] = await Promise.all([
    loader.loadAsync(path("albedo")),
    loader.loadAsync(path("roughness")),
    loader.loadAsync(path("normal")),
    loader.loadAsync(path("ao")),
    loader.loadAsync(path("wetness")),
  ]);
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), mobileMode ? 2 : 6);
  [map, roughnessMap, normalMap, aoMap, wetnessMap].forEach((t) =>
    configure(t, { color: t === map, anisotropy }),
  );
  const material = new THREE.MeshStandardMaterial({
    name: "patina_mossy_wet_stone",
    color: 0xd4ddd8,
    map,
    roughness: .82,
    roughnessMap,
    normalMap,
    normalScale: new THREE.Vector2(.42, .42),
    aoMap,
    aoMapIntensity: .58,
    metalness: 0,
    envMapIntensity: .62,
  });
  material.userData.patina = {
    set: "mossy-wet-stone",
    metresPerTile: 1.8,
    channels: ["albedo", "roughness", "normal", "ao", "wetness"],
    wetnessIntegratedInto: "roughness",
    wetnessMap,
  };
  return material;
}

export async function loadAgedRedLacquerTimber(renderer, mobileMode) {
  const loader = new THREE.TextureLoader();
  const path = (channel) => `${LACQUER_ROOT}aged-red-lacquer-timber_${channel}.png`;
  const source = await Promise.all(["albedo", "roughness", "normal", "ao"].map((c) => loader.loadAsync(path(c))));
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), mobileMode ? 2 : 6);
  const build = (vertical) => {
    const [map, roughnessMap, normalMap, aoMap] = source.map((texture, i) => {
      const t = texture.clone();
      t.needsUpdate = true;
      configure(t, { color: i === 0, repeat: vertical ? 1.65 : 1.9, anisotropy });
      if (vertical) { t.center.set(.5, .5); t.rotation = Math.PI / 2; }
      return t;
    });
    const material = new THREE.MeshStandardMaterial({
      name: `patina_aged_red_lacquer_${vertical ? "vertical" : "horizontal"}`,
      color: 0xd8a8a0, map, roughness: .61, roughnessMap,
      normalMap, normalScale: new THREE.Vector2(.32, .32),
      aoMap, aoMapIntensity: .42, metalness: 0, envMapIntensity: .68,
    });
    material.userData.patina = { set: "aged-red-lacquer-timber", metresPerTile: 1.25, channels: ["albedo","roughness","normal","ao"] };
    return material;
  };
  return { vertical: build(true), horizontal: build(false) };
}

export async function loadOxidizedRoofTileMetal(renderer, mobileMode) {
  const loader = new THREE.TextureLoader();
  const path = (channel) => `${OXIDIZED_ROOF_ROOT}oxidized-roof-tile-metal_${channel}.png`;
  const source = await Promise.all(["albedo", "roughness", "normal", "ao", "metalness"].map((c) => loader.loadAsync(path(c))));
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), mobileMode ? 2 : 6);
  const build = (metal) => {
    const [map, roughnessMap, normalMap, aoMap, metalnessMap] = source.map((texture, i) => {
      const t = texture.clone(); t.needsUpdate = true;
      configure(t, { color: i === 0, repeat: metal ? 2.15 : 1.5, anisotropy });
      return t;
    });
    const material = new THREE.MeshStandardMaterial({
      name: `patina_oxidized_roof_${metal ? "metal" : "tile"}`,
      color: metal ? 0xa4b2aa : 0xc0cac7, map,
      roughness: metal ? .66 : .74, roughnessMap,
      normalMap, normalScale: new THREE.Vector2(metal ? .22 : .34, metal ? .22 : .34),
      aoMap, aoMapIntensity: metal ? .34 : .46,
      metalness: metal ? .64 : .08, metalnessMap,
      envMapIntensity: metal ? .78 : .58,
    });
    material.userData.patina = { set: "oxidized-roof-tile-metal", metresPerTile: metal ? .72 : 1.4, channels: ["albedo","roughness","normal","ao","metalness"], variant: metal ? "metal" : "tile" };
    return material;
  };
  return { tile: build(false), metal: build(true) };
}

export async function loadStainedWaterlineMasonry(renderer, mobileMode) {
  const loader = new THREE.TextureLoader();
  const path = (channel) => `${WATERLINE_ROOT}stained-waterline-masonry_${channel}.png`;
  const [map, roughnessMap, normalMap, aoMap, wetnessMap] = await Promise.all(
    ["albedo", "roughness", "normal", "ao", "wetness"].map((c) => loader.loadAsync(path(c))),
  );
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), mobileMode ? 2 : 6);
  [map, roughnessMap, normalMap, aoMap, wetnessMap].forEach((t) => configure(t, { color: t === map, repeat: 1.72, anisotropy }));
  const material = new THREE.MeshStandardMaterial({
    name: "patina_stained_waterline_masonry", color: 0xc4cbc3, map,
    roughness: .71, roughnessMap, normalMap, normalScale: new THREE.Vector2(.3, .3),
    aoMap, aoMapIntensity: .5, metalness: 0, envMapIntensity: .66,
  });
  material.userData.patina = { set: "stained-waterline-masonry", metresPerTile: 1.55,
    channels: ["albedo", "roughness", "normal", "ao", "wetness"], wetnessIntegratedInto: "roughness", wetnessMap };
  return material;
}

export function applyStainedWaterlineMasonry(root, material) {
  let count = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;
    const old = Array.isArray(node.material) ? node.material : [node.material];
    if (!old.some((m) => `${m?.name || ""}`.toLowerCase().includes("stone"))) return;
    if (node.geometry.attributes.uv && !node.geometry.attributes.uv1) node.geometry.setAttribute("uv1", node.geometry.attributes.uv);
    node.material = material; count++;
  });
  root.userData.waterlinePatinaMeshes = count;
  return count;
}

export function applyOxidizedRoofTileMetal(root, materials) {
  let count = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;
    const old = Array.isArray(node.material) ? node.material : [node.material];
    const names = old.map((m) => `${m?.name || ""} ${node.name || ""}`.toLowerCase()).join(" ");
    const variant = names.includes("tile") || names.includes("roof") ? "tile" : names.includes("metal") ? "metal" : null;
    if (!variant) return;
    if (node.geometry.attributes.uv && !node.geometry.attributes.uv1) node.geometry.setAttribute("uv1", node.geometry.attributes.uv);
    node.material = materials[variant]; count++;
  });
  root.userData.oxidizedRoofPatinaMeshes = count;
  return count;
}

export function applyAgedRedLacquerTimber(root, materials) {
  let count = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;
    const old = Array.isArray(node.material) ? node.material : [node.material];
    if (!old.some((m) => `${m?.name || ""} ${node.name || ""}`.toLowerCase().includes("timber"))) return;
    if (node.geometry.attributes.uv && !node.geometry.attributes.uv1) node.geometry.setAttribute("uv1", node.geometry.attributes.uv);
    node.geometry.computeBoundingBox();
    const size = node.geometry.boundingBox.getSize(new THREE.Vector3());
    node.material = size.y > size.x * 1.15 ? materials.vertical : materials.horizontal;
    count++;
  });
  root.userData.lacquerPatinaMeshes = count;
  return count;
}

export function applyMossyWetStone(root, material) {
  let count = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;
    const old = node.material;
    const materials = Array.isArray(old) ? old : [old];
    const shouldReplace = materials.some((m) => {
      const name = `${m?.name || ""} ${node.name || ""}`.toLowerCase();
      return name.includes("stone") || name.includes("masonry") || name.includes("foundation");
    });
    if (!shouldReplace) return;
    ensureBoxProjectedUV(node, material.userData.patina?.metresPerTile || 1.8);
    // Three's aoMap samples uv1. Authored primitives already have uv; aliasing
    // the same attribute avoids another buffer allocation on mobile.
    if (node.geometry.attributes.uv && !node.geometry.attributes.uv1) {
      node.geometry.setAttribute("uv1", node.geometry.attributes.uv);
    }
    node.material = material;
    count++;
  });
  root.userData.patinaMeshes = count;
  return count;
}
