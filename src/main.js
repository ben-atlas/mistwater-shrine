import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ASSET, bakeStatic } from "../assetlib.js";
import { setSurfaceDefaults } from "../surfaces.js";
import { createWaterSystem } from "./water-system.js";
import { loadMossyWetStone, applyMossyWetStone, loadAgedRedLacquerTimber, applyAgedRedLacquerTimber, loadOxidizedRoofTileMetal, applyOxidizedRoofTileMetal, loadStainedWaterlineMasonry, applyStainedWaterlineMasonry } from "./patina-materials.js";
import {
  createGuardianAnimation,
  GUARDIAN_ANIM_EVENT,
} from "./animation-controller.js";
import {
  TRAVERSAL,
  OPTIONAL_ROUTE,
  LANDMARKS,
  DRESSING,
  BACKGROUND,
  CAMERA_VOLUMES,
  HUB_ISLANDS,
  HUB_LINKS,
  ENEMY_SPAWNS,
  ARRIVAL_HABITAT,
} from "./world-layout.js";

setSurfaceDefaults({ on: true, size: 512, normalScale: 0.72 });
const mobileMode = matchMedia("(pointer: coarse)").matches;
// Query-only portrait composition study.  This deliberately stays out of the
// production camera until the same earned touch route proves that the active
// destination survives the narrow crop.  It changes only the chase volume;
// movement, collision, combat and authored world placement are untouched.
const portraitRouteCamera =
  new URLSearchParams(location.search).get("portraitRouteCamera") === "north-v1" &&
  innerHeight > innerWidth;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91aaa2);
scene.fog = new THREE.FogExp2(0x86a9a3, 0.025);
const horizonFitParam = new URLSearchParams(location.search).get("horizonFit");
const horizonFit = horizonFitParam === null
  ? 0.63
  : THREE.MathUtils.clamp(Number(horizonFitParam) || 0, 0, 1);
// Keep the opening wet and enclosed without flattening the gate, reeds and
// route into one cyan value plane. The URL switch preserves the previous
// density for exact A/B captures and future critic rejection.
const fogFitParam = new URLSearchParams(location.search).get("fogFit");
const fogFit = fogFitParam === null
  ? 1
  : THREE.MathUtils.clamp(Number(fogFitParam) || 0, 0, 1);
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(175, 32, 18),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uHorizonFit: { value: horizonFit },
    },
    vertexShader: `
      varying vec3 vSkyDirection;
      void main() {
        vSkyDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vSkyDirection;
      uniform float uHorizonFit;
      void main() {
        float h = clamp(vSkyDirection.y * .5 + .5, 0.0, 1.0);
        // These are linear-light values. The former horizon (.63/.72/.67)
        // was effectively specified as display RGB and then passed through
        // ACES a second time, producing the pale strip above the fogged far
        // water. Fit the lower sky to the renderer's actual FogExp2 colour;
        // keep a URL A/B switch so the visual gate can reject the change.
        vec3 legacyLower = vec3(.37, .49, .47);
        vec3 legacyHorizon = vec3(.63, .72, .67);
        vec3 legacyUpper = vec3(.31, .45, .45);
        vec3 lower = mix(legacyLower, vec3(.235, .365, .335), uHorizonFit);
        vec3 horizon = mix(legacyHorizon, vec3(.285, .425, .385), uHorizonFit);
        vec3 upper = mix(legacyUpper, vec3(.255, .405, .405), uHorizonFit);
        vec3 skyColor = mix(lower, horizon, smoothstep(.12, .48, h));
        skyColor = mix(skyColor, upper, smoothstep(.50, .94, h));
        vec3 dawnDirection = normalize(vec3(-.18, .14, -.97));
        float dawn = pow(max(dot(vSkyDirection, dawnDirection), 0.0), 7.0);
        float cloud = sin(vSkyDirection.x * 11.0 + vSkyDirection.z * 7.0)
                    * sin(vSkyDirection.x * 4.0 - vSkyDirection.z * 13.0);
        cloud = smoothstep(.26, .82, cloud * .5 + .5) * smoothstep(.35, .78, h);
        skyColor += vec3(.24, .15, .07) * dawn * .42;
        skyColor += vec3(.035, .045, .038) * cloud;
        gl_FragColor = vec4(skyColor, 1.0);
      }
    `,
  }),
);
sky.renderOrder = -100;
scene.add(sky);
const camera = new THREE.PerspectiveCamera(
  50,
  innerWidth / innerHeight,
  0.1,
  240,
);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const mossyWetStone = await loadMossyWetStone(renderer, mobileMode);
const agedRedLacquer = await loadAgedRedLacquerTimber(renderer, mobileMode);
const oxidizedRoof = await loadOxidizedRoofTileMetal(renderer, mobileMode);
const stainedWaterline = await loadStainedWaterlineMasonry(renderer, mobileMode);
const patinaEnabled = new URLSearchParams(location.search).get("patina") !== "0";
let patinaMeshCount = 0;
let lacquerMeshCount = 0;
let oxidizedRoofMeshCount = 0;
let waterlineMeshCount = 0;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;
scene.environmentIntensity = 0.34;
pmrem.dispose();
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xcfe5e2, 0x142926, 0.92));
const sun = new THREE.DirectionalLight(0xffd39a, 3.65);
sun.position.set(-19, 28, -7);
sun.target.position.set(0, 0, -23);
scene.add(sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(mobileMode ? 1024 : 2048, mobileMode ? 1024 : 2048);
sun.shadow.camera.left = -20;
sun.shadow.camera.right = 20;
sun.shadow.camera.top = 27;
sun.shadow.camera.bottom = -27;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 82;
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.035;
scene.add(sun);
const coolFill = new THREE.DirectionalLight(0x75b8b3, 0.62);
coolFill.position.set(12, 8, 10);
scene.add(coolFill);

// Checkpoint 3: shallow mist banks make the atmosphere spatial instead of
// applying one uniform veil to the whole route. The soft procedural texture is
// shared by every sprite and costs no external asset request.
const mistCanvas = document.createElement("canvas");
mistCanvas.width = mistCanvas.height = 128;
const mistContext = mistCanvas.getContext("2d");
const mistGradient = mistContext.createRadialGradient(64, 64, 5, 64, 64, 62);
mistGradient.addColorStop(0, "rgba(210,238,233,.72)");
mistGradient.addColorStop(.42, "rgba(181,219,214,.34)");
mistGradient.addColorStop(1, "rgba(145,191,187,0)");
mistContext.fillStyle = mistGradient;
mistContext.fillRect(0, 0, 128, 128);
const mistTexture = new THREE.CanvasTexture(mistCanvas);
const mistBanks = [];
for (const [x, y, z, sx, sy, phase] of [
  [-7,.72,-7,11,2.3,.2], [7,.5,-12,10,1.8,1.8], [-6,.62,-20,9,2.1,3.1],
  [6,.8,-28,12,2.5,4.2], [-8,.7,-35,13,2.2,5.4], [7,.9,-41,12,2.8,2.6],
  [-5,1.15,-49,15,3.2,.9], [6,1.5,-56,18,3.6,3.8],
]) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: mistTexture, color: 0xc5e4df, transparent: true, opacity: .3,
    depthWrite: false, fog: true,
  }));
  sprite.position.set(x, y, z); sprite.scale.set(sx, sy, 1);
  sprite.userData.baseX = x; sprite.userData.baseY = y; sprite.userData.phase = phase;
  scene.add(sprite); mistBanks.push(sprite);
}

// Checkpoint 4: a deep horizon assembled from inexpensive authored layers.
// These shapes live beyond the playable basin, so they add scale without
// changing collision, traversal, or the established shoreline.
const horizonGroup = new THREE.Group();
scene.add(horizonGroup);

const cloudTextureCanvas = document.createElement("canvas");
cloudTextureCanvas.width = 256; cloudTextureCanvas.height = 96;
const cloudCtx = cloudTextureCanvas.getContext("2d");
for (const [x, y, r, a] of [[40,55,31,.38],[78,43,41,.48],[122,51,36,.42],[163,39,45,.5],[211,55,32,.34]]) {
  const g = cloudCtx.createRadialGradient(x,y,2,x,y,r);
  g.addColorStop(0, `rgba(229,239,232,${a})`);
  g.addColorStop(.58, `rgba(203,222,216,${a * .62})`);
  g.addColorStop(1, "rgba(177,204,199,0)");
  cloudCtx.fillStyle = g; cloudCtx.fillRect(x-r,y-r,r*2,r*2);
}
const cloudTexture = new THREE.CanvasTexture(cloudTextureCanvas);
const cloudLayers = [];
for (const [x,y,z,sx,sy,opacity,phase] of [
  [-43,31,-102,48,14,.54,.2],[7,35,-118,62,17,.46,2.1],[51,28,-96,44,13,.5,4.4],
  [-28,22,-82,36,10,.3,1.2],[31,19,-76,31,9,.28,3.5],
]) {
  const cloud = new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTexture,color:0xe2eee8,transparent:true,opacity,depthWrite:false,fog:false}));
  cloud.position.set(x,y,z); cloud.scale.set(sx,sy,1); cloud.userData.baseX=x; cloud.userData.phase=phase;
  horizonGroup.add(cloud); cloudLayers.push(cloud);
}

// Goal 8 removes the former ShapeGeometry mountain cards. The verified 404
// karst assets below own the distant silhouette; mist and cloud layers provide
// value separation without putting flat graphic cut-outs behind them.
const mountainLayers = [];

const bambooSilhouettes = [];
const bambooMaterial = new THREE.MeshBasicMaterial({color:0x173d37,transparent:true,opacity:.62,fog:true});
for (const side of [-1,1]) for (let i=0;i<9;i++) {
  const h = 7 + (i % 4) * 1.55;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.07,.11,h,5),bambooMaterial);
  stem.position.set(side * (12.5 + i * 1.65),h*.5-1,-68-i*1.7);
  stem.rotation.z = side * (.025 + (i%3)*.018); horizonGroup.add(stem); bambooSilhouettes.push(stem);
  for (let j=0;j<3;j++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.48,5,3),bambooMaterial);
    leaf.scale.set(2.1,.18,.5); leaf.position.set(stem.position.x-side*(.35+j*.18),h-1.1-j*1.25,stem.position.z);
    leaf.rotation.z=side*(.4+j*.18); horizonGroup.add(leaf);
  }
}

const submergedRuins = [];
const ruinMaterial = new THREE.MeshStandardMaterial({color:0x405c55,roughness:.9,metalness:0});
for (const [x,z,rot] of [[-8.7,-52,.16],[8.2,-57,-.22],[-11.5,-63,.32],[10.7,-69,-.18]]) {
  const ruin = new THREE.Group();
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.6,.42,.72),ruinMaterial);
  lintel.position.y=.58; lintel.rotation.z=rot; ruin.add(lintel);
  for (const px of [-1.38,1.38]) { const pillar=new THREE.Mesh(new THREE.BoxGeometry(.55,2.7,.62),ruinMaterial); pillar.position.set(px,-.42,0); pillar.rotation.z=rot*.55; ruin.add(pillar); }
  ruin.position.set(x,-.82,z); ruin.rotation.y=rot; horizonGroup.add(ruin); submergedRuins.push(ruin);
}

const birds = [];
const birdMaterial = new THREE.LineBasicMaterial({color:0x203b39,transparent:true,opacity:.7,fog:false});
for (let i=0;i<7;i++) {
  const wing = 0.42 + i*.045;
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-wing,.12,0),new THREE.Vector3(0,0,0),new THREE.Vector3(wing,.12,0)]);
  const bird = new THREE.Line(geometry,birdMaterial); bird.position.set(-15+i*5.1,13+(i%3)*1.7,-70-i*3.2); bird.userData.baseX=bird.position.x; bird.userData.phase=i*.83;
  horizonGroup.add(bird); birds.push(bird);
}

const horizonMist = [];
for (const [x,z,s,phase] of [[-27,-74,31,.4],[0,-80,39,2.2],[29,-73,32,4.1]]) {
  const band = new THREE.Sprite(new THREE.SpriteMaterial({map:mistTexture,color:0xc8ded8,transparent:true,opacity:.34,depthWrite:false,fog:false}));
  band.position.set(x,3.1,z); band.scale.set(s,6.2,1); band.userData.baseX=x; band.userData.phase=phase;
  horizonGroup.add(band); horizonMist.push(band);
}

// Rust17 far-band rule: the haze needs a sparse middle silhouette to consume,
// otherwise the fitted sky and extended lake still resolve as two horizontal
// colour fields.  This is one merged, unlit, non-colliding mesh: broad drowned
// hummocks establish an irregular waterline while bowed reed fans break it into
// discrete vertical clusters.  It deliberately sits closer and larger than a
// literal horizon prop so FogExp2 leaves a restrained readable remnant.
const farMarshEnabled = new URLSearchParams(location.search).get("farMarsh") !== "0";
const farMarshParts = [];
const farMarshHummocks = [
  [-30.0, -62.0, 7.4, 1.25, 3.0], [-21.5, -67.5, 5.8, .82, 2.5],
  [-14.0, -61.5, 4.3, .72, 2.0], [-8.2, -69.0, 5.4, .94, 2.6],
  [8.5, -68.5, 5.6, .88, 2.5], [15.5, -62.5, 4.7, .74, 2.1],
  [23.0, -69.5, 6.2, 1.02, 2.7], [31.5, -63.0, 7.8, 1.18, 3.1],
];
for (const [x, z, sx, sy, sz] of farMarshHummocks) {
  const geometry = new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI * .56);
  geometry.scale(sx, sy, sz);
  geometry.rotateY((x * .071 + z * .037) % .42);
  geometry.translate(x, -.46, z);
  farMarshParts.push(geometry);
}
const farMarshReeds = [
  [-27.5,-61.0,3.7,-.12],[-25.7,-62.4,2.8,.08],[-23.9,-63.0,4.5,.16],
  [-17.2,-65.5,3.2,-.1],[-15.8,-64.2,4.2,.12],[-10.7,-67.2,3.5,-.15],
  [-7.8,-68.0,4.8,.09],[10.2,-67.1,4.1,-.1],[12.1,-66.0,3.0,.14],
  [17.4,-63.0,4.5,.11],[20.8,-67.5,3.4,-.13],[24.2,-68.4,4.9,.08],
  [27.0,-66.0,3.1,.15],[29.8,-62.1,4.2,-.09],
];
for (const [x, z, height, lean] of farMarshReeds) {
  for (let strand = -1; strand <= 1; strand++) {
    const h = height * (1 - Math.abs(strand) * .17);
    const geometry = new THREE.CylinderGeometry(.055, .11, h, 5, 1, false);
    geometry.rotateZ(lean + strand * .075);
    geometry.translate(x + strand * .34, h * .5 - .2, z + Math.abs(strand) * .18);
    farMarshParts.push(geometry);
  }
}
const farMarshGeometry = mergeGeometries(farMarshParts, false);
for (const geometry of farMarshParts) geometry.dispose();
const farMarsh = new THREE.Mesh(
  farMarshGeometry,
  new THREE.MeshBasicMaterial({ color: 0x29483f, transparent: true, opacity: .82, fog: true }),
);
farMarsh.name = "FarMarshSilhouetteBand";
farMarsh.visible = farMarshEnabled;
farMarsh.frustumCulled = true;
farMarsh.renderOrder = -2;
horizonGroup.add(farMarsh);

const contactMaterial = new THREE.MeshBasicMaterial({
  color: 0x071a18, transparent: true, opacity: .34, depthWrite: false,
  blending: THREE.MultiplyBlending,
});
function createContactShadow(radius = .62) {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), contactMaterial.clone());
  shadow.rotation.x = -Math.PI * .5; shadow.renderOrder = 3; scene.add(shadow);
  return shadow;
}
const horizonSkirtEnabled = new URLSearchParams(location.search).get("horizonSkirt") !== "0";
// Query-only depth ownership plate for the rejected separated pagoda proxy.
// Flat, unlit colours preserve the real depth buffer while making it
// impossible to confuse water/reflection shading with baked bank geometry.
const pagodaOwnerPalette = new URLSearchParams(location.search).has("pagodaOwnerPalette");
const waterSystem = createWaterSystem({
  scene,
  width: 70,
  length: horizonSkirtEnabled ? 220 : 124,
  segmentsX: mobileMode ? 72 : 112,
  segmentsZ: horizonSkirtEnabled ? (mobileMode ? 200 : 284) : (mobileMode ? 112 : 160),
  y: 0,
  colors: {
    deep: 0x0c292c,
    shallow: 0x326467,
    horizon: 0x81998f,
    zenith: 0xb6c7b9,
    sun: 0xf3cd8a,
  },
});
if (pagodaOwnerPalette) {
  waterSystem.mesh.material = new THREE.MeshBasicMaterial({
    color: 0x00b8ff,
    fog: false,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
}
// Keep the near edge fixed at z=62 while carrying the existing single water
// mesh deep enough into FogExp2 that its far boundary cannot draw a horizon
// rule. This buys the skirt with no extra draw call or collision surface.
if (horizonSkirtEnabled) waterSystem.mesh.position.z = -48;
// Audit-only hook for deterministic contact-memory captures. Keeping this
// behind an explicit query flag avoids expanding the normal runtime surface.
if (new URLSearchParams(location.search).has("waterAudit")) {
  window.__WATER_AUDIT__ = waterSystem;
}
const shoreAuditMode = new URLSearchParams(location.search).get("shoreAudit");
if (shoreAuditMode) waterSystem.setShoreDebug(shoreAuditMode);
const moonMaterial = new THREE.MeshBasicMaterial({
  color: 0xf3d9a5,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  fog: true,
});
const shrineMoon = new THREE.Mesh(
  new THREE.CircleGeometry(2.7, 64),
  moonMaterial,
);
shrineMoon.position.set(0.45, 4.15, -73);
scene.add(shrineMoon);

const placements = [...TRAVERSAL, ...OPTIONAL_ROUTE];
const pads = [];
const openingLotusMode = new URLSearchParams(location.search).get("openingLotus") || "retain";
// Query-only structural auditions deliberately replace every traversal leaf
// so repetition, underside readability and route-scale cost can be judged in
// the real scene without changing the production asset.
const traversalLotusMode = new URLSearchParams(location.search).get("traversalLotus");
const traversalLotusAssets = {
  "radial-a": "./outputs/goal10-job1518/candidates/lotus_support_a_radial.js",
  "cupped-a": "./outputs/goal10-job1520/candidates/lotus_support_a_cupped_shell.js",
  "integral-wall": "./outputs/goal10-job1523/candidates/lotus_leaf_integral_wall.js",
};
const traversalLotusAsset = traversalLotusAssets[traversalLotusMode]
  || "./assets/lotus_leaf_traversal.js";
for (const placement of placements) {
  const p = await ASSET(traversalLotusAsset, { height: 0.38 });
  // Query-only coupled studies for the camera-near p1_center. Unlike the old
  // `reduce` diagnostic, these values govern the visible leaf, landing centre,
  // collision radius, top height and water response as one physical object.
  // They can therefore be judged with real keyboard/touch traversal.
  const coupledOpeningLotus = placement.id === "p1_center" && openingLotusMode.startsWith("coupled-");
  const openingLotusScale = placement.id === "p1_center"
    ? openingLotusMode === "reduce" ? 0.76
      : openingLotusMode === "coupled-84" || openingLotusMode === "coupled-84-back" ? 0.84
      : 1
    : 1;
  const openingLotusX = coupledOpeningLotus && openingLotusMode === "coupled-84-back" ? placement.x + 0.18 : placement.x;
  const openingLotusZ = coupledOpeningLotus && openingLotusMode === "coupled-84-back" ? placement.z - 0.32 : placement.z;
  p.position.set(openingLotusX, placement.y, openingLotusZ);
  p.scale.setScalar(placement.scale * openingLotusScale);
  p.rotation.y = placement.yaw;
  scene.add(p);
  const pad = {
    mesh: p,
    x: openingLotusX,
    z: openingLotusZ,
    r: placement.radius * 1.1 * (coupledOpeningLotus ? openingLotusScale : 1),
    top: p.position.y + 0.38 * placement.scale * (coupledOpeningLotus ? openingLotusScale : 1),
    route: placement,
  };
  pad.waterState = waterSystem.registerPad({
    mesh: p,
    radius: pad.r,
    baseY: p.position.y,
  });
  pads.push(pad);
}

// Broad authored landings turn the former forward-only pad course into a
// flooded rescue hub. The cylinders below are collision-supporting cores only;
// verified 404 shore anatomy wraps every focal edge so the visible silhouette
// reads as rock/root/moss ownership instead of a pale polygon slab.
const hubIslands = [];
const islandStone = new THREE.MeshStandardMaterial({ color: 0x263f38, roughness: .62 });
const islandMoss = new THREE.MeshStandardMaterial({ color: 0x3f6045, roughness: .82 });
// Query-only ownership diagnostic.  A bright unlit material is deliberately
// applied before baking so the normal depth buffer, camera and occlusion still
// decide which independent object actually owns each visible near-bank pixel.
// With no `ownerProbe` parameter production materials are byte-for-byte the
// same objects as before.
const ownerProbe = new URLSearchParams(location.search).get("ownerProbe") || "0";
// Query-only hub-bank topology audition. Render anatomy may be removed while
// the cylinder support/collision core remains authoritative, so an A/B cannot
// accidentally earn a route by changing gameplay geometry.
const hubBankProbe = new URLSearchParams(location.search).get("hubBankProbe") || "0";
const sectionalBankProbe = hubBankProbe === "sectional-u" || hubBankProbe.startsWith("sectional-u-");
const terrainPatchProbe = hubBankProbe === "terrain-patch-v1";
const pagodaHorseshoeProbe = hubBankProbe === "pagoda-horseshoe-v2";
const pagodaBrokenBackBankProbe = hubBankProbe === "pagoda-broken-back-bank-v1";
const pagodaDiagonalRearShelfProbe = hubBankProbe === "pagoda-diagonal-rear-shelf-v1";
const pagodaPierSocketLedgeProbe = hubBankProbe === "pagoda-pier-socket-ledge-v1";
const pagodaPierCollarLedgeProbe = hubBankProbe === "pagoda-pier-collar-ledge-v2";
const pagodaAsymmetricUBankProbe = hubBankProbe === "pagoda-asymmetric-u-bank-v1";
const pagodaTerracedUBankProbe = hubBankProbe === "pagoda-terraced-u-bank-v1";
const pagodaRootboundUBankProbe = hubBankProbe === "pagoda-rootbound-u-bank-v1";
const pagodaUBankProbe = pagodaAsymmetricUBankProbe || pagodaTerracedUBankProbe || pagodaRootboundUBankProbe;
const pagodaWholeIslandProxy = hubBankProbe === "pagoda-whole-island-surface-proxy-v1";
const pagodaAuthoredIslandSkin = hubBankProbe === "pagoda-authored-island-skin-v2";
const pagodaMultilevelIslandSkin = hubBankProbe === "pagoda-multilevel-sectional-skin-v1";
const pagodaVisibleArcMantle = hubBankProbe === "pagoda-visible-arc-mantle-v1";
const pagodaBankAsset = sectionalBankProbe
  ? "./assets/candidates/pagoda_bank_u_sectional_shelves.js"
  : "./assets/west_pagoda_wet_bank.js";
const pagodaLobeProbe = hubBankProbe === "pagoda-lobes-v1" || hubBankProbe === "pagoda-perimeter-v2";
const pagodaPerimeterProbe = hubBankProbe === "pagoda-perimeter-v2";
const ownerProbeMaterial = new THREE.MeshBasicMaterial({ color: 0xff2ad4 });
const pagodaLobeMaterial = new THREE.MeshBasicMaterial({ color: 0xff2ad4, fog: false });
const pagodaEcologyMaterial = new THREE.MeshBasicMaterial({ color: 0xffd400, fog: false });
const markOwnerProbe = (object, owner) => {
  if (ownerProbe !== owner) return;
  object.traverse((child) => {
    if (child.isMesh) child.material = ownerProbeMaterial;
  });
};
for (const island of HUB_ISLANDS) {
  const group = new THREE.Group(); group.name = `HubIsland_${island.id}`;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.16, .58, 32), islandStone);
  base.scale.set(island.rx * .86, 1, island.rz * .86); base.position.y = island.y - .31; base.receiveShadow = true;
  // The coupled pagoda proxy changes rendering only. The group remains in
  // hubIslands, so its unchanged ellipse continues to own support/collision.
  // Hiding this synthetic cylinder is required before separated shoreline
  // lobes can expose real water channels rather than a smooth disc beneath.
  if ((pagodaLobeProbe && island.id === "pagoda_isle") ||
      ((pagodaHorseshoeProbe || pagodaBrokenBackBankProbe || pagodaDiagonalRearShelfProbe || pagodaPierSocketLedgeProbe || pagodaPierCollarLedgeProbe || pagodaUBankProbe || pagodaWholeIslandProxy || pagodaAuthoredIslandSkin) && island.id === "pagoda_isle") ||
      (terrainPatchProbe && (island.id === "west_rescue" || island.id === "pagoda_isle")) ||
      (sectionalBankProbe && (island.id === "west_rescue" || island.id === "pagoda_isle"))) base.visible = false;
  group.add(base); group.position.set(island.x, 0, island.z); scene.add(group);
  markOwnerProbe(group, `hub-${island.id}`);
  hubIslands.push({ ...island, group, top: island.y + .14 });

  const anatomy = new THREE.Group();
  anatomy.name = `HubShoreAnatomy_${island.id}`;
  const isWestEncounter = island.id === "west_rescue";
  const isPagodaIsland = island.id === "pagoda_isle";
  const usesContinuousBank = isWestEncounter || isPagodaIsland;
  const organicCrown = await ASSET(usesContinuousBank
    ? pagodaBankAsset
    : "./assets/island_crown.js", { surfaces: true });
  if (isWestEncounter) {
    // One continuous, asymmetric mass replaces the crown plus four repeated
    // edge strips in the focal west-to-pagoda view. The support core and all
    // gameplay collision remain unchanged.
    organicCrown.scale.set(.96, .84, .94);
    organicCrown.position.y = island.y - .53;
    organicCrown.rotation.y = -.08;
  } else if (isPagodaIsland) {
    // Reuse the verified continuous wet-bank grammar at the central landmark.
    // Its long axis is compressed to the pagoda core, and the asymmetric low
    // shoulders face the two rescue-loop arrivals. Collision/support remains
    // the unchanged island core, so both west and east openings stay playable.
    organicCrown.scale.set(1.08, .8, .78);
    organicCrown.position.y = island.y - .51;
    organicCrown.rotation.y = .1;
  } else {
    organicCrown.scale.set(island.rx / 6, .55, island.rz / 5);
    organicCrown.position.y = island.y - .46;
    organicCrown.rotation.y = (island.x * .19 + island.z * .07) % .38;
  }
  // Job 1565 camera-context compositions. The two authored sectional bodies
  // stay complete, but no longer occupy the same depth slab. These query-only
  // treatments alter render placement only; the unchanged hub ellipse remains
  // the sole collision/support authority. The progressively narrower apron
  // exposes water in front while the lifted rear crown carries the bank weight.
  if (sectionalBankProbe) {
    const sectionalMeshes = [];
    organicCrown.traverse((child) => { if (child.isMesh) sectionalMeshes.push(child); });
    // The canonical surface loader may flatten source names while preserving
    // deterministic mesh order, so use that order only as a loader fallback.
    const rear = organicCrown.getObjectByName("rear_faulted_crown") || sectionalMeshes[0];
    const apron = organicCrown.getObjectByName("front_torn_apron") || sectionalMeshes[1];
    const treatments = {
      "sectional-u-a": { rear: [0, .24, -.30, .98, 1.12, .78, .04], apron: [0, 0, .32, .82, .92, .64, -.03] },
      "sectional-u-b": { rear: [-.12, .34, -.42, .92, 1.22, .68, -.08], apron: [.16, 0, .43, .72, .86, .56, .06] },
      "sectional-u-c": { rear: [.14, .28, -.50, 1.04, 1.18, .62, .11], apron: [-.18, 0, .48, .66, .82, .50, -.09] },
    };
    const treatment = treatments[hubBankProbe];
    if (treatment && rear && apron) {
      for (const [part, values] of [[rear, treatment.rear], [apron, treatment.apron]]) {
        part.position.set(values[0], values[1], values[2]);
        part.scale.set(values[3], values[4], values[5]);
        part.rotation.y = values[6];
      }
    }
  }
  markOwnerProbe(organicCrown, `crown-${island.id}`);
  if (hubBankProbe !== `remove-crown-${island.id}` && !(pagodaLobeProbe && isPagodaIsland) &&
      !((pagodaHorseshoeProbe || pagodaBrokenBackBankProbe || pagodaDiagonalRearShelfProbe || pagodaPierSocketLedgeProbe || pagodaPierCollarLedgeProbe || pagodaUBankProbe || pagodaWholeIslandProxy || pagodaAuthoredIslandSkin || pagodaMultilevelIslandSkin) && isPagodaIsland) &&
      !(terrainPatchProbe && (isWestEncounter || isPagodaIsland))) anatomy.add(organicCrown);
  if (pagodaLobeProbe && isPagodaIsland) {
    // Camera-scale topology probe only: three unequal verified organic-crown
    // fragments occupy the perimeter while leaving open channels between the
    // west arrival, east exit and southern return. A strict three-strategy
    // 404 asset round is justified only if this coarse coupled silhouette wins.
    // v1 accidentally made every source crown wider than the entire hub
    // (12 m source width * 0.96--1.23), so its three nominal fragments
    // overlapped into the measured field. v2 uses the same verified anatomy
    // only as genuinely narrow, non-overlapping perimeter sections. Their
    // plan-view AABBs leave metre-scale west, east and south water channels;
    // the unchanged invisible ellipse remains the sole gameplay authority.
    const lobeSpecs = pagodaPerimeterProbe ? [
      [-3.48,  1.55, .29, .34, .24, -.58],
      [-3.10, -1.68, .25, .31, .27,  .48],
      [ 3.42,  1.46, .27, .33, .23,  .62],
      [ 3.18, -1.62, .24, .30, .25, -.46],
      [  .02,  3.18, .36, .35, .19,  .04],
    ] : [
      [-2.62, .05, 1.23, .32, .58, -.38],
      [ 2.58, .03,  .96, .29, .52,  .47],
      [ -.18,-2.35, 1.08, .27, .46, -.08],
    ];
    for (const [x, z, sx, sy, sz, yaw] of lobeSpecs) {
      const lobe = await ASSET("./assets/island_crown.js", { surfaces: true });
      lobe.scale.set(sx, sy, sz);
      lobe.position.set(x, island.y - .42, z);
      lobe.rotation.y = yaw;
      if (pagodaOwnerPalette) {
        lobe.traverse((child) => { if (child.isMesh) child.material = pagodaLobeMaterial; });
      }
      anatomy.add(lobe);
    }
  }
  const edgeSpecs = [
    [0, island.rz * .73, 0, island.rx * 2.05 / 9.6],
    [0, -island.rz * .73, Math.PI, island.rx * 2.05 / 9.6],
    [island.rx * .73, 0, -Math.PI * .5, island.rz * 2.05 / 9.6],
    [-island.rx * .73, 0, Math.PI * .5, island.rz * 2.05 / 9.6],
  ];
  for (const [x, z, yaw, scale] of usesContinuousBank ? [] : edgeSpecs) {
    const edge = await ASSET("./assets/shore_transition.js", {});
    edge.position.set(x, island.y - .45, z);
    edge.rotation.y = yaw;
    edge.scale.setScalar(scale);
    anatomy.add(edge);
  }
  const islandBamboo = await ASSET("./assets/bamboo_cluster.js", {});
  const bambooScale = island.landmark ? .48 : .62;
  islandBamboo.scale.setScalar(bambooScale);
  islandBamboo.position.set(
    isWestEncounter ? -island.rx * .74 : -island.rx * .55,
    island.y - .02,
    isWestEncounter ? island.rz * .34 : island.rz * .12,
  );
  islandBamboo.rotation.y = island.x * .37 + island.z * .11;
  markOwnerProbe(islandBamboo, `bamboo-${island.id}`);
  if (!(terrainPatchProbe && (isWestEncounter || isPagodaIsland)) && !((pagodaHorseshoeProbe || pagodaBrokenBackBankProbe || pagodaUBankProbe || pagodaWholeIslandProxy || pagodaAuthoredIslandSkin || pagodaMultilevelIslandSkin) && isPagodaIsland)) anatomy.add(islandBamboo);
  // The verifier-selected Goal 8 ecology cluster supplies the missing middle
  // scale between bamboo trunks and shoreline stones: cattail tips, bowed
  // roots, mossed ruin fragments and a wet mud shelf. Alternate its side and
  // yaw so it forms enclosure without becoming a repeated runway marker.
  const ecology = await ASSET("./assets/wetland_ecology_cluster.js", { surfaces: true });
  const ecologySide = island.x >= 0 ? -1 : 1;
  ecology.scale.setScalar(island.landmark ? .72 : .86);
  ecology.position.set(
    isWestEncounter ? -island.rx * .68 : ecologySide * island.rx * .38,
    island.y - .32,
    isWestEncounter ? -island.rz * .58 : -island.rz * .34,
  );
  ecology.rotation.y = (island.x * .23 - island.z * .17) + (ecologySide < 0 ? Math.PI : 0);
  if (pagodaOwnerPalette && isPagodaIsland) {
    ecology.traverse((child) => { if (child.isMesh) child.material = pagodaEcologyMaterial; });
  }
  markOwnerProbe(ecology, `ecology-${island.id}`);
  if (!(terrainPatchProbe && (isWestEncounter || isPagodaIsland)) && !((pagodaHorseshoeProbe || pagodaBrokenBackBankProbe || pagodaDiagonalRearShelfProbe || pagodaPierSocketLedgeProbe || pagodaPierCollarLedgeProbe || pagodaUBankProbe || pagodaWholeIslandProxy || pagodaAuthoredIslandSkin || pagodaMultilevelIslandSkin) && isPagodaIsland)) anatomy.add(ecology);
  anatomy.position.set(island.x, 0, island.z);
  const bakedAnatomy = bakeStatic(anatomy);
  bakedAnatomy.name = anatomy.name;
  scene.add(bakedAnatomy);
}

// Query-only structural gate: unlike prior portable bank candidates, this one
// connected terrain topology is composed across both focal support footprints.
// It deliberately stays clay-only until its silhouette passes both cameras.
if (terrainPatchProbe) {
  const terrainPatch = await ASSET("./assets/candidates/west_pagoda_continuous_terrain_patch.js", {});
  terrainPatch.name = "WestPagodaContinuousTerrainPatchProbe";
  terrainPatch.position.set(-2.4, -.02, -18.05);
  scene.add(terrainPatch);
}
if (pagodaHorseshoeProbe) {
  const terrainPatch = await ASSET("./assets/candidates/pagoda_horseshoe_terrain_patch.js", {});
  terrainPatch.name = "PagodaHorseshoeTerrainPatchProbe";
  // Undo the asset-contract centring so the authored horseshoe remains
  // registered around the pagoda's world-space gameplay footprint.
  const anchor = terrainPatch.userData.pagodaAnchorOffset || [1, 0];
  terrainPatch.position.set(.2 + anchor[0], -.02, -23.4 + anchor[1]);
  scene.add(terrainPatch);
}
if (pagodaBrokenBackBankProbe) {
  const terrainPatch = await ASSET("./assets/candidates/pagoda_broken_back_bank_patch.js", {});
  terrainPatch.name = "PagodaBrokenBackBankPatchProbe";
  const anchor = terrainPatch.userData.pagodaAnchorOffset || [0, 0];
  terrainPatch.position.set(.2 + anchor[0], -.02, -23.4 + anchor[1]);
  scene.add(terrainPatch);
}
if (pagodaDiagonalRearShelfProbe) {
  const terrainPatch = await ASSET("./assets/candidates/pagoda_diagonal_rear_shelf_patch.js", {});
  terrainPatch.name = "PagodaDiagonalRearShelfPatchProbe";
  const anchor = terrainPatch.userData.pagodaAnchorOffset || [0, 0];
  terrainPatch.position.set(.2 + anchor[0], -.02, -23.4 + anchor[1]);
  scene.add(terrainPatch);
}
if (pagodaPierSocketLedgeProbe) {
  const terrainPatch = await ASSET("./assets/candidates/pagoda_pier_socket_ledge_patch.js", {});
  terrainPatch.name = "PagodaPierSocketLedgePatchProbe";
  const anchor = terrainPatch.userData.pagodaAnchorOffset || [0, 0];
  terrainPatch.position.set(.2 + anchor[0], -.02, -23.4 + anchor[1]);
  scene.add(terrainPatch);
}
if (pagodaPierCollarLedgeProbe) {
  const terrainPatch = await ASSET("./assets/candidates/pagoda_pier_collar_ledge_patch.js", {});
  terrainPatch.name = "PagodaPierCollarLedgePatchProbe";
  const anchor = terrainPatch.userData.pagodaAnchorOffset || [0, 0];
  terrainPatch.position.set(.2 + anchor[0], -.02, -23.4 + anchor[1]);
  scene.add(terrainPatch);
}
if (pagodaUBankProbe) {
  const bankAssets = {
    "pagoda-asymmetric-u-bank-v1": "./assets/candidates/pagoda_asymmetric_u_bank_patch.js",
    "pagoda-terraced-u-bank-v1": "./assets/candidates/pagoda_terraced_u_bank_patch.js",
    "pagoda-rootbound-u-bank-v1": "./assets/candidates/pagoda_rootbound_u_bank_patch.js",
  };
  const terrainPatch = await ASSET(bankAssets[hubBankProbe], {});
  terrainPatch.name = "PagodaAsymmetricUBankPatchProbe";
  const anchor = terrainPatch.userData.pagodaAnchorOffset || [0, 0];
  terrainPatch.position.set(.2 + anchor[0], -.02, -23.4 + anchor[1]);
  if (pagodaOwnerPalette) terrainPatch.traverse((child) => {
    if (child.isMesh) child.material = new THREE.MeshBasicMaterial({ color: 0xff3b8d, fog: false });
  });
  scene.add(terrainPatch);
}
if (pagodaWholeIslandProxy) {
  const terrainPatch = await ASSET("./assets/candidates/pagoda_whole_island_surface_proxy.js", {});
  terrainPatch.name = "PagodaWholeIslandSurfaceProxy";
  terrainPatch.position.set(.2, -.02, -23.4);
  if (pagodaOwnerPalette) terrainPatch.traverse((child) => {
    if (child.isMesh) child.material = new THREE.MeshBasicMaterial({ color: 0xff3b8d, fog: false });
  });
  scene.add(terrainPatch);
}
if (pagodaAuthoredIslandSkin) {
  const terrainPatch = await ASSET("./assets/candidates/pagoda_authored_perimeter_island_skin.js", {});
  terrainPatch.name = "PagodaAuthoredPerimeterIslandSkin";
  terrainPatch.position.set(.2, -.02, -23.4);
  if (pagodaOwnerPalette) terrainPatch.traverse((child) => {
    if (child.isMesh) child.material = new THREE.MeshBasicMaterial({ color: 0xff3b8d, fog: false });
  });
  scene.add(terrainPatch);
}
if (pagodaMultilevelIslandSkin) {
  const terrainPatch = await ASSET("./assets/candidates/pagoda_multilevel_sectional_island_skin.js", {});
  terrainPatch.name = "PagodaMultilevelSectionalIslandSkin";
  terrainPatch.position.set(.2, -.02, -23.4);
  if (pagodaOwnerPalette) terrainPatch.traverse((child) => {
    if (child.isMesh) child.material = new THREE.MeshBasicMaterial({ color: 0xff3b8d, fog: false });
  });
  scene.add(terrainPatch);
}
if (pagodaVisibleArcMantle) {
  const terrainPatch = await ASSET("./assets/candidates/pagoda_visible_arc_mantle.js", {});
  terrainPatch.name = "PagodaVisibleArcMantle";
  const anchor = terrainPatch.userData.pagodaAnchorOffset || [0, 0];
  terrainPatch.position.set(.2 + anchor[0], -.30, -23.4 + anchor[1]);
  if (pagodaOwnerPalette) terrainPatch.traverse((child) => {
    if (child.isMesh) child.material = new THREE.MeshBasicMaterial({ color: 0xff3b8d, fog: false });
  });
  scene.add(terrainPatch);
}

// The hub landmark must be a recognizable verified asset, not the earlier
// cylinder/cone pagoda blockout. The wide opening preserves both rescue-loop
// paths while the layered eaves provide an authored silhouette from approach.
const pagoda = await ASSET("./assets/shrine_gate_hero.js", { surfaces: true });
pagoda.name = "CentralRescueGate";
if (patinaEnabled) patinaMeshCount += applyMossyWetStone(pagoda, mossyWetStone);
if (patinaEnabled) lacquerMeshCount += applyAgedRedLacquerTimber(pagoda, agedRedLacquer);
if (patinaEnabled) oxidizedRoofMeshCount += applyOxidizedRoofTileMetal(pagoda, oxidizedRoof);
pagoda.scale.setScalar(.62);
pagoda.position.set(.2, .38, -23.4);
scene.add(pagoda);
const beacon = new THREE.PointLight(0xffb04a, 8.5, 10, 2);
beacon.position.set(.2, 3.05, -23.12);
scene.add(beacon);

// Keep the old arrival habitat available for deterministic visual A/B. The
// replacement owns only render geometry; ARRIVAL_HABITAT's support/collision
// footprint below remains the gameplay authority for both variants.
const openingBankMode = new URLSearchParams(location.search).get("openingBank") || "0";
const arrivalHabitat = await ASSET(
  openingBankMode === "1"
    ? "./outputs/goal10-job1472/rejected-opening-wet-bank.js"
    : openingBankMode === "cut-a"
      ? "./outputs/goal10-job1475/opening-cut-bank-a.js"
    : openingBankMode === "cross-section-proxy"
      ? "./outputs/goal10-job1483/arrival_habitat_cross_section.js"
    : openingBankMode === "water-notch-proxy"
      ? "./outputs/goal10-job1484/arrival_habitat_water_notch.js"
    : openingBankMode === "closure-positive"
      ? "./outputs/goal10-job1485/arrival_habitat_closure_positive.js"
    : openingBankMode === "closure-negative"
      ? "./outputs/goal10-job1485/arrival_habitat_closure_negative.js"
    : openingBankMode === "cut-near-proxy"
      ? "./outputs/goal10-job1487/arrival_habitat_cut_near.js"
    : openingBankMode === "cut-far-proxy"
      ? "./outputs/goal10-job1487/arrival_habitat_cut_far.js"
    : openingBankMode === "cut-spine-proxy"
      ? "./outputs/goal10-job1487/arrival_habitat_cut_spine.js"
    : openingBankMode === "terrain-bites-1489" || openingBankMode.startsWith("place-")
      ? "./outputs/goal10-job1489/arrival_habitat_terrain_bites.js"
    : openingBankMode === "split-owner-1493"
      ? "./outputs/goal10-job1493/arrival_habitat_split_proxy.js"
    : openingBankMode === "crown-a-1490" || openingBankMode === "crown-b-1490" || openingBankMode === "volume-a-1491" || openingBankMode === "volume-b-1491"
      ? "./outputs/goal10-job1489/arrival_habitat_terrain_bites.js"
    : openingBankMode.startsWith("proxy-")
      ? "./outputs/goal10-job1473/opening-bank-proxy.js"
      : ARRIVAL_HABITAT.asset,
  { surfaces: true },
);
markOwnerProbe(arrivalHabitat, "arrival-habitat");
arrivalHabitat.position.set(...ARRIVAL_HABITAT.position);
arrivalHabitat.scale.set(...ARRIVAL_HABITAT.scale);
arrivalHabitat.rotation.y = ARRIVAL_HABITAT.yaw;
// Job 1492 camera-space composition probes. These remain query-only and do
// not move ARRIVAL_HABITAT's gameplay support/collision authority. The three
// treatments test a lateral retreat, a rotation around the retained water
// window, and a shorter split-owner silhouette before another asset round.
if (openingBankMode === "place-retreat-1492") {
  arrivalHabitat.position.x -= 1.65;
  arrivalHabitat.position.z -= 0.45;
} else if (openingBankMode === "place-rotate-1492") {
  arrivalHabitat.position.x -= 0.8;
  arrivalHabitat.position.z -= 0.35;
  arrivalHabitat.rotation.y += 0.34;
} else if (openingBankMode === "place-split-1492") {
  arrivalHabitat.position.x -= 1.1;
  arrivalHabitat.position.z -= 0.3;
  arrivalHabitat.rotation.y += 0.18;
  arrivalHabitat.scale.x *= 0.72;
}
// Goal 10 job 1494 negative-space diagnostic: hide only the authored arrival
// habitat render body. The broad island support and all collision authorities
// are created separately and remain unchanged, so this isolates whether the
// foreground composition benefits from no bank owner at all.
if (openingBankMode !== "hide-1494" && !openingBankMode.startsWith("anchor-1495-") && !openingBankMode.startsWith("anchor-1496-")) scene.add(bakeStatic(arrivalHabitat));
// Job 1495: three independent, verified 404 vertical-anchor candidates. They
// occupy only the far-left bank outside the lotus corridor and retain the
// clean water aperture proven by hide-1494. Query-only until the matched-frame
// gate selects one; support/collision remains unchanged in every variant.
if (openingBankMode.startsWith("anchor-1495-")) {
  const anchorKey = openingBankMode.slice("anchor-1495-".length);
  const anchorAssets = {
    a: "./outputs/goal10-job1495/candidates/opening_anchor_a_root_pine.js",
    b: "./outputs/goal10-job1495/candidates/opening_anchor_b_bamboo_fan.js",
    c: "./outputs/goal10-job1495/candidates/opening_anchor_c_lantern_reeds.js",
  };
  const openingAnchor = await ASSET(anchorAssets[anchorKey] || anchorAssets.a, { surfaces: true });
  openingAnchor.name = `OpeningAnchor1495${anchorKey.toUpperCase()}`;
  const transforms = {
    a: { p: [-6.0, 0.12, -16.0], s: .78, r: .38 },
    b: { p: [-6.05, 0.12, -16.05], s: .72, r: -.26 },
    c: { p: [-6.02, 0.12, -16.02], s: .82, r: .18 },
  };
  const t = transforms[anchorKey] || transforms.a;
  openingAnchor.position.set(...t.p); openingAnchor.scale.setScalar(t.s); openingAnchor.rotation.y = t.r;
  scene.add(bakeStatic(openingAnchor));
  if (anchorKey === "c") {
    const anchorLanternLight = new THREE.PointLight(0xf2a447, 3.4, 5.5, 2);
    anchorLanternLight.position.set(t.p[0], 3.55, t.p[2]); scene.add(anchorLanternLight);
  }
}
// Job 1496: measured, query-only placement/scale grid for the strongest 1495
// candidate. These mounts move progressively farther from the camera and
// inward toward the readable left silhouette; no gameplay authority changes.
if (openingBankMode.startsWith("anchor-1496-")) {
  const gridKey = openingBankMode.slice("anchor-1496-".length);
  const grid = {
    a: { p: [-5.70, 0.10, -17.40], s: .88, r: .18 },
    b: { p: [-5.15, 0.08, -18.25], s: .98, r: .12 },
    c: { p: [-4.55, 0.06, -19.10], s: 1.08, r: .06 },
  };
  const t = grid[gridKey] || grid.a;
  const openingAnchor = await ASSET("./outputs/goal10-job1495/candidates/opening_anchor_c_lantern_reeds.js", { surfaces: true });
  openingAnchor.name = `OpeningAnchor1496${gridKey.toUpperCase()}`;
  openingAnchor.position.set(...t.p); openingAnchor.scale.setScalar(t.s); openingAnchor.rotation.y = t.r;
  scene.add(bakeStatic(openingAnchor));
  const anchorLanternLight = new THREE.PointLight(0xf2a447, 3.6, 6.2, 2);
  anchorLanternLight.position.set(t.p[0], t.p[1] + 3.47 * t.s, t.p[2]);
  scene.add(anchorLanternLight);
}
// Candidate grafts are additive and reversible: the retained habitat still
// owns the crown, support and collision. This narrow root/toe strip sits only
// on the route-facing opening edge, leaving two water windows between clusters.
if (openingBankMode === "graft-a") {
  const openingToeGraft = await ASSET("./outputs/goal10-job1476/opening-wet-toe-graft-a.js", { surfaces: true });
  openingToeGraft.name = "OpeningWetToeGraftA";
  openingToeGraft.position.set(-3.62, -0.08, -6.7);
  openingToeGraft.rotation.y = ARRIVAL_HABITAT.yaw;
  openingToeGraft.scale.set(0.58, 0.62, 0.58);
  scene.add(bakeStatic(openingToeGraft));
}
if (openingBankMode === "undercut-diag" || openingBankMode === "undercut-a") {
  const openingUndercut = await ASSET("./outputs/goal10-job1477/opening-root-undercut.js", { surfaces: true });
  openingUndercut.name = "OpeningRootUndercut";
  // Camera-probed against the rendered route-facing edge (the render body's
  // bevel/scale is taller than its deliberately conservative support plane).
  // Root tips enter the water while their crowns remain under the visible lip.
  openingUndercut.position.set(-1.82, -0.08, -5.28);
  openingUndercut.rotation.y = ARRIVAL_HABITAT.yaw;
  openingUndercut.scale.set(0.92, 0.82, 0.92);
  scene.add(bakeStatic(openingUndercut));
}
if (openingBankMode === "attached-diag" || openingBankMode === "attached-a") {
  const attachedUndercut = await ASSET("./outputs/goal10-job1478/opening-attached-undercut.js", { surfaces: true });
  attachedUndercut.name = "OpeningAttachedUndercut";
  attachedUndercut.position.set(-1.82, -0.08, -5.28);
  attachedUndercut.rotation.y = ARRIVAL_HABITAT.yaw;
  attachedUndercut.scale.set(0.92, 0.82, 0.92);
  scene.add(bakeStatic(attachedUndercut));
}
if (openingBankMode === "ribbon-diag") {
  const boundaryRibbon = await ASSET("./outputs/goal10-job1479/opening-boundary-ribbon.js", { surfaces: false });
  boundaryRibbon.name = "OpeningBoundaryRibbonDiagnostic";
  // Exact same object transform as the habitat: the ribbon vertices are
  // sampled in the habitat's already-centred local coordinate system.
  boundaryRibbon.position.set(...ARRIVAL_HABITAT.position);
  boundaryRibbon.rotation.y = ARRIVAL_HABITAT.yaw;
  boundaryRibbon.scale.set(...ARRIVAL_HABITAT.scale);
  scene.add(boundaryRibbon);
}
if (openingBankMode === "vertices-diag") {
  // Diagnostics intentionally bypass ASSET's per-module bounds normalisation:
  // these points already inhabit the production asset's centred local frame,
  // and normalising their smaller subset would move the thing being measured.
  const { default: buildVertexLabels } = await import("../outputs/goal10-job1480/outline-vertex-labels.js");
  const vertexLabels = buildVertexLabels(THREE);
  vertexLabels.name = "ArrivalHabitatOutlineVertexLabels";
  vertexLabels.position.set(...ARRIVAL_HABITAT.position);
  vertexLabels.rotation.y = ARRIVAL_HABITAT.yaw;
  vertexLabels.scale.set(...ARRIVAL_HABITAT.scale);
  scene.add(vertexLabels);
}
if (openingBankMode === "visible-lip-diag") {
  const { default: buildVisibleLipRibbon } = await import("../outputs/goal10-job1480/opening-visible-lip-ribbon.js");
  const visibleLipRibbon = buildVisibleLipRibbon(THREE);
  visibleLipRibbon.name = "OpeningVisibleLipRibbonDiagnostic";
  visibleLipRibbon.position.set(...ARRIVAL_HABITAT.position);
  visibleLipRibbon.rotation.y = ARRIVAL_HABITAT.yaw;
  visibleLipRibbon.scale.set(...ARRIVAL_HABITAT.scale);
  scene.add(visibleLipRibbon);
}
if (openingBankMode === "lip-a" || openingBankMode === "lip-a-selected" || openingBankMode.startsWith("lip-a-probe-")) {
  // Camera candidate A is kept in the verified asset's centred coordinates,
  // then mounted into the measured 13 -> 12 -> 11 habitat-local chain. The
  // wrapper receives the habitat transform so non-uniform scale and yaw stay
  // exactly coupled to the production bank.
  const lipAsset = await ASSET("./outputs/goal10-job1481/candidate-a/opening_lip_undercut.js", { surfaces: true });
  lipAsset.name = "OpeningMeasuredLipUndercutA";
  const lipProbeOffsets = {
    "lip-a-selected": [0, 0.16, 0],
    "lip-a-probe-up": [0, 0.16, 0],
    "lip-a-probe-out": [0, 0, -0.16],
    "lip-a-probe-up-out": [0, 0.12, -0.12],
  };
  const [probeX, probeY, probeZ] = lipProbeOffsets[openingBankMode] || [0, 0, 0];
  lipAsset.position.set(-3.65 + probeX, -0.21 + probeY, -1.025 + probeZ);
  if (openingBankMode.startsWith("lip-a-probe-")) {
    // Deliberately loud diagnostic material for the placement gate only. The
    // selected offset must subsequently pass with the candidate's locked wet
    // soil/root materials before it can be considered for production.
    lipAsset.traverse((child) => {
      if (!child.isMesh) return;
      child.material = new THREE.MeshBasicMaterial({ color: 0xff2ad4 });
    });
  }
  const lipMount = new THREE.Group();
  lipMount.position.set(...ARRIVAL_HABITAT.position);
  lipMount.rotation.y = ARRIVAL_HABITAT.yaw;
  lipMount.scale.set(...ARRIVAL_HABITAT.scale);
  lipMount.add(lipAsset);
  scene.add(lipMount);
}
waterSystem.registerSceneFeature({
  position: new THREE.Vector3(...ARRIVAL_HABITAT.position),
  radius: ARRIVAL_HABITAT.halfLength,
  type: "bank",
});

const availableDressing = [...DRESSING, ...BACKGROUND]
  .filter(
    (item) =>
      (!item.asset.includes("/required/") &&
        !item.asset.includes("mountain_spire")) ||
      item.asset.includes("/required/bank_rock_") ||
      item.asset.includes("/required/karst_") ||
      item.asset.includes("/required/reed_fern_cluster_") ||
      item.asset.includes("/required/root_bank_arch_") ||
      item.asset.includes("/required/shrine_vine_dressing_"),
  )
  .map((item) => ({
    ...item,
    asset: item.asset.includes("/required/bank_rock_")
      ? item.id === "arr_bank_r" || item.id === "tun_bank_r2"
        ? "./assets/bank_rock_terrace.js"
        : item.id === "tun_bank_r" || item.id === "rev_rock_l"
          ? "./assets/bank_rock_shelf.js"
          : "./assets/bank_rock_large.js"
      : item.asset.includes("/required/karst_massif_")
        ? "./assets/karst_massif_a.js"
      : item.asset.includes("/required/karst_arch_")
          ? "./assets/karst_arch_b.js"
          : item.asset.includes("/required/reed_fern_cluster_") ||
              item.asset.includes("/required/root_bank_arch_") ||
              item.asset.includes("/required/shrine_vine_dressing_")
            ? "./assets/wetland_ecology_cluster.js"
          : item.asset,
  }));
// Register the actual authored world transforms with the water shader before
// static baking removes per-prop identities. Reflections therefore follow the
// same bank, vegetation and karst positions visible above the waterline.
for (const item of availableDressing) {
  const assetName = `${item.id} ${item.asset}`.toLowerCase();
  const type = assetName.includes("bamboo") || assetName.includes("reed") || assetName.includes("fern") || assetName.includes("habitat_lotus")
    ? "vegetation"
    : assetName.includes("karst") || assetName.includes("mountain")
      ? "karst"
      : assetName.includes("lantern")
        ? "lantern"
        : "bank";
  const radius = type === "karst" ? 4.6 : type === "vegetation" ? 1.35 : 2.2;
  waterSystem.registerSceneFeature({
    position: new THREE.Vector3(...item.position),
    radius: radius * Math.max(item.scale[0], item.scale[2]),
    type,
  });
  for (const footprint of item.waterFootprints ?? []) {
    const itemYaw = item.rotation?.[1] ?? 0;
    const localYaw = footprint.yaw ?? 0;
    const cos = Math.cos(itemYaw);
    const sin = Math.sin(itemYaw);
    const localX = footprint.center[0] * item.scale[0];
    const localZ = footprint.center[1] * item.scale[2];
    waterSystem.registerShorePrimitive({
      center: new THREE.Vector3(
        item.position[0] + localX * cos + localZ * sin,
        0,
        item.position[2] - localX * sin + localZ * cos,
      ),
      radii: new THREE.Vector2(
        footprint.radii[0] * item.scale[0],
        footprint.radii[1] * item.scale[2],
      ),
      yaw: itemYaw + localYaw,
      role: footprint.role,
    });
  }
}
const dressingGroups = new Map();
const dressingBakes = [];
for (const item of availableDressing) {
  const object = await ASSET(item.asset, {});
  markOwnerProbe(object, item.id);
  object.position.set(...item.position);
  object.scale.set(...item.scale);
  object.rotation.set(...item.rotation);
  // The right arch sits closer than the other far forms and formerly retained
  // a near-field pale stone value after fog. Pull its albedo/contrast into the
  // same aerial-perspective family without changing its authored silhouette.
  if (item.id === "karst_right") {
    object.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materialWasArray = Array.isArray(child.material);
      const materials = materialWasArray ? child.material : [child.material];
      const mutedMaterials = materials.map((material) => {
        const muted = material.clone();
        if (muted.color) muted.color.multiply(new THREE.Color(0x78918a));
        muted.roughness = Math.max(.78, muted.roughness ?? 0);
        return muted;
      });
      child.material = materialWasArray ? mutedMaterials : mutedMaterials[0];
    });
  }
  const dressingAssetName = `${item.id} ${item.asset}`.toLowerCase();
  if (
    patinaEnabled &&
    (dressingAssetName.includes("bank") ||
      dressingAssetName.includes("shore") ||
      dressingAssetName.includes("rock"))
  ) {
    patinaMeshCount += applyMossyWetStone(object, mossyWetStone);
  }
  if (patinaEnabled && item.id.startsWith("basin_edge_")) waterlineMeshCount += applyStainedWaterlineMasonry(object, stainedWaterline);
  let group = dressingGroups.get(item.chunk);
  if (!group) {
    group = new THREE.Group();
    group.name = `DressingChunk_${item.chunk}`;
    dressingGroups.set(item.chunk, group);
  }
  group.add(object);
}
for (const group of dressingGroups.values()) {
  const baked = bakeStatic(group);
  baked.userData.chunk = group.name.replace("DressingChunk_", "");
  // Establish the arrival cull state before the first rendered frame. The
  // per-frame controller keeps this updated later, but leaving every chunk
  // visible for one startup frame causes a real mobile draw/triangle spike.
  baked.visible =
    baked.userData.chunk === "far_composition" ||
    baked.userData.chunk === "arrival";
  dressingBakes.push(baked);
  scene.add(baked);
}
let spiritReward = null;
let spiritJoints = {};
const shrineRevealLandmarks = [];
for (const item of LANDMARKS) {
  const object = await ASSET(item.asset, {
    keepHierarchy: item.keepHierarchy === true,
  });
  object.position.set(...item.position);
  object.scale.set(...item.scale);
  object.rotation.set(...item.rotation);
  if (patinaEnabled && (item.id === "shrine_footing" || item.id === "shrine_landing")) {
    patinaMeshCount += applyMossyWetStone(object, mossyWetStone);
  }
  if (item.chunk === "shrine_reveal") {
    // The green tunnel is a complete near-field occluder at the start. Keep
    // terminal landmarks out of the render list until the authored reveal,
    // rather than depending on aspect-ratio-sensitive frustum rejection.
    object.visible = false;
    shrineRevealLandmarks.push(object);
  }
  scene.add(object);
  if (item.id === "spirit_reward") {
    spiritReward = object;
    spiritJoints = object.userData.joints || {};
    if (spiritJoints.spirit_core) {
      spiritJoints.spirit_core.userData.bindY = spiritJoints.spirit_core.position.y;
    }
  }
  if (item.practical) {
    const light = new THREE.PointLight(
      item.practical.color,
      item.practical.intensity,
      item.practical.range,
      2,
    );
    light.position.set(
      item.position[0],
      item.position[1] + (item.practical.yOffset ?? 1.3) * item.scale[1],
      item.position[2],
    );
    scene.add(light);
  }
}

// Warm pools anchor each practical in the cool mist, including the tunnel
// lantern which lives in the baked dressing set rather than LANDMARKS.
const lanternPools = [];
const poolGeometry = new THREE.CircleGeometry(1, 40);
for (const [x, z, radius, intensity] of [
  [6.2, -24.1, 3.1, 5.8], [-3.55, -43.65, 3.7, 8.2], [4.3, -45.55, 3.25, 7.0],
]) {
  const pool = new THREE.Mesh(poolGeometry, new THREE.MeshBasicMaterial({
    color: 0xffae4b, transparent: true, opacity: .115, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  pool.rotation.x = -Math.PI * .5; pool.position.set(x, .028, z);
  pool.scale.set(radius, radius * .72, 1); pool.renderOrder = 2;
  scene.add(pool); lanternPools.push(pool);
  if (z > -30) {
    const tunnelLight = new THREE.PointLight(0xffb55d, intensity, radius * 2.15, 2);
    tunnelLight.position.set(x, 1.7, z); scene.add(tunnelLight);
  }
}

const hero = await ASSET("./assets/forest_guardian.js", {
  height: 1.25,
  keepHierarchy: true,
});
scene.add(hero);
hero.position.set(TRAVERSAL[0].x, pads[0].top, TRAVERSAL[0].z);
const heroContactShadow = createContactShadow(.58);
const joints = hero.userData.joints || {};
const guardianAnimation = createGuardianAnimation(joints);

const warningMaterial = new THREE.MeshBasicMaterial({ color: 0xff7b3d, transparent: true, opacity: 0.62, depthWrite: false });
const enemies = [];
async function createCrocodile(role, x, z, heroScale = .43) {
  // Animated actors are loaded independently with hierarchy intact. Never clone
  // or bake them: either shortcut silently loses the authored joint ownership.
  const root = await ASSET("./assets/marsh_warden.js", {
    surfaces: true,
    keepHierarchy: true,
  });
  root.scale.setScalar(heroScale);
  const joints = root.userData.joints || {};
  const tailJoints = Array.from({ length: 7 }, (_, i) => root.getObjectByName(`tail_${i}`)).filter(Boolean);
  const roleMark = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.045, 6, 18), new THREE.MeshBasicMaterial({ color: role === "ranged" ? 0xffa13d : 0xef4e42 }));
  roleMark.rotation.x = Math.PI * 0.5; roleMark.position.y = 1.18;
  roleMark.scale.setScalar(1 / heroScale);
  root.add(roleMark); root.position.set(x, 0.22, z); scene.add(root);
  const contactShadow = createContactShadow(.72);
  const enemy = { role, root, joints, tailJoints, contactShadow, hp: role === "ranged" ? 2 : 3, maxHp: role === "ranged" ? 2 : 3, cooldown: role === "ranged" ? 1.4 : 0.55, windup: 0, stagger: 0, flash: 0, alive: true, roleMark };
  enemies.push(enemy); return enemy;
}
for (const spawn of ENEMY_SPAWNS) await createCrocodile(spawn.role, spawn.x, spawn.z, spawn.heroScale);
const bombs = [];
const bombGeometry = new THREE.IcosahedronGeometry(0.22, 1);
const bombMaterial = new THREE.MeshStandardMaterial({ color: 0x382b22, emissive: 0xff5426, emissiveIntensity: 0.8 });
function launchBomb(enemy) {
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 24), warningMaterial.clone());
  marker.rotation.x = -Math.PI * 0.5; marker.position.set(hero.position.x, 0.035, hero.position.z); scene.add(marker);
  const mesh = new THREE.Mesh(bombGeometry, bombMaterial); mesh.position.copy(enemy.root.position).add(new THREE.Vector3(0, .8, 0)); scene.add(mesh);
  bombs.push({ mesh, marker, start: mesh.position.clone(), target: hero.position.clone(), age: 0, duration: 1.05 });
}
let playerHealth = 100, attackCooldown = 0, attackActive = 0, dodgeTime = 0, invulnerable = 0, hitStop = 0, playerHits = 0, enemiesDefeated = 0;
const healthFill = document.getElementById("health-fill");
const combatStatus = document.getElementById("combat-status");
function damagePlayer(amount, source) {
  if (invulnerable > 0 || !playing) return false;
  const guarding = keys.KeyK && dodgeTime <= 0;
  playerHealth = Math.max(0, playerHealth - (guarding ? Math.ceil(amount * .25) : amount));
  invulnerable = guarding ? .22 : .65; hitStop = guarding ? .035 : .085; cameraImpact = Math.max(cameraImpact, guarding ? .025 : .075);
  const away = hero.position.clone().sub(source).setY(0).normalize();
  hero.position.addScaledVector(away, guarding ? .18 : .72);
  healthFill.style.width = `${playerHealth}%`;
  combatStatus.textContent = guarding ? "GUARDED" : "WOUNDED · FIND YOUR FOOTING";
  if (playerHealth <= 0) {
    playerHealth = 100; healthFill.style.width = "100%"; combatStatus.textContent = "THE SHRINE RETURNS YOU";
    hero.position.set(checkpointPad.x, checkpointPad.top, checkpointPad.z);
  }
  return true;
}
function strike() {
  if (!playing || attackCooldown > 0) return;
  attackCooldown = .46; attackActive = .16; combatStatus.textContent = "STAFF ARC";
  for (const enemy of enemies) {
    if (!enemy.alive || hero.position.distanceTo(enemy.root.position) > 2.15) continue;
    const toward = enemy.root.position.clone().sub(hero.position).setY(0).normalize();
    enemy.hp--; enemy.stagger = .42; enemy.flash = .12; playerHits++; hitStop = .055;
    enemy.root.position.addScaledVector(toward, .7); cameraImpact = Math.max(cameraImpact, .045);
    if (enemy.hp <= 0) { enemy.alive = false; enemiesDefeated++; combatStatus.textContent = `WARDEN FALLEN · ${enemies.length - enemiesDefeated} REMAIN`; }
  }
}
const sparks = [];
const sparkCoreGeometry = new THREE.IcosahedronGeometry(0.16, 2);
const sparkCoreMaterial = new THREE.MeshStandardMaterial({
  color: 0xffb23f,
  emissive: 0xff7a18,
  emissiveIntensity: 1.35,
  roughness: 0.28,
  metalness: 0.12,
});
const sparkHaloGeometry = new THREE.TorusGeometry(0.25, 0.018, 8, 32);
const sparkHaloMaterial = new THREE.MeshBasicMaterial({
  color: 0x7ff1d1,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  toneMapped: false,
});
for (const island of hubIslands.filter((candidate) => candidate.rescue)) {
  const spark = new THREE.Group();
  spark.name = `RescueBeacon_${island.id}`;
  const core = new THREE.Mesh(sparkCoreGeometry, sparkCoreMaterial);
  core.scale.set(0.72, 1.18, 0.72);
  const halo = new THREE.Mesh(sparkHaloGeometry, sparkHaloMaterial);
  halo.rotation.x = Math.PI * 0.5;
  halo.scale.y = 0.72;
  spark.add(core, halo);
  // A beacon must light the island that carries it, not read as an emissive
  // icon pasted over an unrelated surface. Keep the three practicals short-
  // range so their warm pools separate from the cool environmental fill and
  // do not flatten the wider rescue hub. The audit toggle gives every visual
  // review a literal same-camera A/B, as required by the Rust17 polish gate.
  if (new URLSearchParams(location.search).get("rescueLights") !== "0") {
    const practical = new THREE.PointLight(
      0xffa94f,
      mobileMode ? 2.8 : 3.6,
      mobileMode ? 3.8 : 4.6,
      2,
    );
    practical.position.y = 0.12;
    spark.add(practical);
  }
  spark.position.set(island.x, island.top + .9, island.z);
  spark.userData.rescue = island.rescue;
  spark.userData.halo = halo;
  scene.add(spark);
  sparks.push(spark);
}
let lastWakeMark = 0;

const keys = {};
const touchMove = new THREE.Vector2();
const movePad = document.querySelector(".move-pad");
const movePadKnob = document.querySelector(".move-pad-knob");
let touchPointer = null;
let cameraPointer = null;
let touchOriginX = 0;
let touchOriginY = 0;
let cameraDragX = 0;
let orbitYaw = 0;
let orbitYawTarget = 0;
let lastCameraInputAt = -Infinity;
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "Space") jump();
  if (e.code === "KeyJ") strike();
  if (e.code === "KeyK" && moveSpeed > 0.8 && dodgeTime <= 0) {
    dodgeTime = .34;
    invulnerable = Math.max(invulnerable, .42);
    combatStatus.textContent = "MIST STEP";
  }
});
addEventListener("keyup", (e) => (keys[e.code] = false));
renderer.domElement.addEventListener("pointerdown", (e) => {
  const wantsCamera =
    e.pointerType === "mouse" || e.clientX > innerWidth * 0.62;
  if (wantsCamera) {
    cameraPointer = e.pointerId;
    cameraDragX = e.clientX;
    lastCameraInputAt = gameNow();
    renderer.domElement.setPointerCapture(e.pointerId);
    return;
  }
  touchPointer = e.pointerId;
  touchOriginX = e.clientX;
  touchOriginY = e.clientY;
  movePad.style.left = `${e.clientX - 56}px`;
  movePad.style.top = `${e.clientY - 56}px`;
  movePad.style.bottom = "auto";
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.pointerId === cameraPointer) {
    const deltaX = e.clientX - cameraDragX;
    cameraDragX = e.clientX;
    orbitYawTarget = THREE.MathUtils.clamp(
      orbitYawTarget - deltaX * 0.006,
      -Math.PI * 0.72,
      Math.PI * 0.72,
    );
    lastCameraInputAt = gameNow();
    return;
  }
  if (e.pointerId !== touchPointer) return;
  touchMove.set(e.clientX - touchOriginX, e.clientY - touchOriginY);
  const length = touchMove.length();
  if (length > 54) touchMove.multiplyScalar(54 / length);
  movePadKnob.style.transform = `translate(${(touchMove.x / 54) * 28}px, ${(touchMove.y / 54) * 28}px)`;
  touchMove.divideScalar(54);
});
function releaseTouch(e) {
  if (e.pointerId === cameraPointer) {
    cameraPointer = null;
    return;
  }
  if (e.pointerId !== touchPointer) return;
  touchPointer = null;
  touchMove.set(0, 0);
  movePadKnob.style.transform = "translate(0, 0)";
  movePad.style.left = "calc(18px + env(safe-area-inset-left))";
  movePad.style.top = "auto";
  movePad.style.bottom = "calc(18px + env(safe-area-inset-bottom))";
}
renderer.domElement.addEventListener("pointerup", releaseTouch);
renderer.domElement.addEventListener("pointercancel", releaseTouch);
document.getElementById("jump").onclick = jump;
// Touch players must be able to finish the rescue, not merely traverse it.
// Keep this on the same combat path as keyboard input so cooldown, hit stop,
// enemy stagger and victory requirements cannot drift between controllers.
document.getElementById("strike").onclick = strike;
const guardButton = document.getElementById("guard");
const setTouchGuard = (held) => {
  keys.KeyK = held;
  guardButton.classList.toggle("is-held", held);
  if (held && moveSpeed > 0.35 && dodgeTime <= 0) {
    dodgeTime = .38;
    invulnerable = .44;
    combatStatus.textContent = "MIST STEP";
  }
};
guardButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  guardButton.setPointerCapture(event.pointerId);
  setTouchGuard(true);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  guardButton.addEventListener(type, () => setTouchGuard(false));
}
let playing = false,
  won = false,
  vy = 0,
  onGround = true,
  score = 0,
  lastGroundedAt = performance.now(),
  jumpQueuedAt = -Infinity,
  moveSpeed = 0,
  airJumps = 0,
  fallStartedAt = 0,
  resetCount = 0,
  resetHistory = [],
  pendingDoubleJump = false,
  checkpointPad = { x: HUB_ISLANDS[0].x, z: HUB_ISLANDS[0].z, top: hubIslands[0].top, waterState: { offset: 0 } },
  cameraImpact = 0;
const deterministicCapture = new URLSearchParams(location.search).has(
  "deterministicCapture",
);
const heroReflectionEnabled = new URLSearchParams(location.search).get(
  "heroReflection",
) !== "0";
const FIXED_CAPTURE_DT_MS = 1000 / 60;
let captureNow = 0;
const gameNow = () =>
  deterministicCapture ? captureNow : performance.now();
const moveVelocity = new THREE.Vector2();
function jump() {
  if (playing) jumpQueuedAt = gameNow();
}
document.getElementById("begin").onclick = () => {
  playing = true;
  document.getElementById("start").classList.add("hide");
};
document.getElementById("again").onclick = () => location.reload();
window.__START__ = () => document.getElementById("begin").click();
const routeHint = document.getElementById("route-hint");
window.__READY__ = true;
window.__PATINA__ = {
  enabled: patinaEnabled,
  set: "mossy-wet-stone",
  meshes: patinaMeshCount,
  resolution: 512,
  textureCount: 5,
  sets: ["mossy-wet-stone", "aged-red-lacquer-timber", "oxidized-roof-tile-metal", "stained-waterline-masonry"],
  lacquerMeshes: lacquerMeshCount,
  oxidizedRoofMeshes: oxidizedRoofMeshCount,
  waterlineMeshes: waterlineMeshCount,
  totalTextureCount: 28,
};
let prev = performance.now(),
  frames = 0,
  fps = 60,
  fpst = prev,
  totalFrames = 0;
const clock = new THREE.Clock();
const cameraTarget = new THREE.Vector3();
const cameraLookTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const cameraRayDirection = new THREE.Vector3();
const cameraRaycaster = new THREE.Raycaster();
// Seed the follow camera at its authored arrival pose. Starting from Three's
// default origin made the first several visible frames fly through the hero
// and foreground bank while the damped follow caught up.
const initialCameraVolume = CAMERA_VOLUMES[0];
camera.position.set(
  hero.position.x + initialCameraVolume.lateralBias,
  hero.position.y + initialCameraVolume.height,
  hero.position.z + initialCameraVolume.distance,
);
camera.lookAt(
  hero.position.x + initialCameraVolume.lateralBias,
  hero.position.y + initialCameraVolume.targetLift,
  hero.position.z - initialCameraVolume.lookAhead,
);
const shrineLanding = LANDMARKS.find((item) => item.id === "shrine_landing");
const shrineCollision = shrineLanding.collision;
// Goal 10 diagnostic: the earned route still shows the central gate crossing
// the hero on both portrait and landscape. Keep this query-only until matched
// full-route evidence proves that treating the verified gate as a camera
// obstacle improves composition without collapsing the follow distance.
const pagodaCameraCollision = new URLSearchParams(location.search).get("pagodaCameraCollision") === "1";
// Query-only alternative to binary camera collision.  Near the gate's open
// south-west landing it moves the chase rig onto a shallow east shoulder and
// adds a small yaw, keeping the authored ray length instead of pushing the
// camera into the hero.  Full earned routes decide whether this is promotable.
const pagodaCameraVolume = new URLSearchParams(location.search).get("pagodaCameraVolume") || "0";
// Query-only portrait passage composed with north-v1.  At the pagoda centre the
// ordinary trailing camera sits beneath the broad south eave, so the roof cuts
// the hero off from both the gate opening and the onward plane.  Ease the eye
// upward and forward across that roof only while the hero is inside the pagoda
// footprint; architecture stays visible and no render/collision owner changes.
const pagodaCameraPassage =
  new URLSearchParams(location.search).get("pagodaCameraPassage") === "over-eave-v1" &&
  portraitRouteCamera;
// Query-only, direction-aware successor to the rejected fixed passage.  The
// camera stays on the approach side until the hero has crossed the pagoda
// opening, then hands off over the eave to the departure side.  Direction is
// latched outside the opening so small combat/landing reversals cannot flip the
// composition while the roof is near the lens.
const pagodaDirectionalPassage =
  new URLSearchParams(location.search).get("pagodaCameraPassage") === "directional-v1" &&
  portraitRouteCamera;
let pagodaTravelDirection = -1;
let pagodaHandoff = 0;
const cameraObstacles = [
  ...dressingBakes,
  ...shrineRevealLandmarks,
  ...(pagodaCameraCollision ? [pagoda] : []),
];
function animate(now) {
  if (!deterministicCapture) requestAnimationFrame(animate);
  const real = deterministicCapture ? 1 / 60 : (now - prev) / 1000;
  prev = now;
  const dt = Math.min(real, 0.033),
    t = deterministicCapture ? now / 1000 : clock.getElapsedTime();
  totalFrames++;
  frames++;
  if (now - fpst > 500) {
    fps = frames / ((now - fpst) / 1000);
    frames = 0;
    fpst = now;
  }
  if (playing) {
    if (hitStop > 0) hitStop = Math.max(0, hitStop - real);
    const combatDt = hitStop > 0 ? 0 : dt;
    attackCooldown = Math.max(0, attackCooldown - combatDt);
    attackActive = Math.max(0, attackActive - combatDt);
    dodgeTime = Math.max(0, dodgeTime - combatDt);
    invulnerable = Math.max(0, invulnerable - combatDt);
    const orbitKey = (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0);
    if (orbitKey) {
      orbitYawTarget = THREE.MathUtils.clamp(
        orbitYawTarget + orbitKey * dt * 1.65,
        -Math.PI * 0.72,
        Math.PI * 0.72,
      );
      lastCameraInputAt = now;
    }
    let dx =
        (keys.KeyD || keys.ArrowRight ? 1 : 0) -
        (keys.KeyA || keys.ArrowLeft ? 1 : 0) +
        touchMove.x,
      dz =
        (keys.KeyS || keys.ArrowDown ? 1 : 0) -
        (keys.KeyW || keys.ArrowUp ? 1 : 0) +
        touchMove.y;
    const rawInputLength = Math.hypot(dx, dz);
    const inputLength = Math.min(1, rawInputLength);
    if (inputLength > 0.001) {
      dx /= rawInputLength;
      dz /= rawInputLength;
      const localX = dx;
      dx = localX * Math.cos(orbitYaw) + dz * Math.sin(orbitYaw);
      dz = -localX * Math.sin(orbitYaw) + dz * Math.cos(orbitYaw);
    }
    const targetSpeed = inputLength * 5.2 * (dodgeTime > 0 ? 1.85 : keys.KeyK ? .42 : 1);
    const response = targetSpeed > moveSpeed ? 9 : 13;
    moveSpeed = THREE.MathUtils.damp(moveSpeed, targetSpeed, response, dt);
    moveVelocity.set(dx * moveSpeed, dz * moveSpeed);
    hero.position.x += moveVelocity.x * dt;
    hero.position.z += moveVelocity.y * dt;
    if (inputLength > 0.02) {
      const targetYaw = Math.atan2(dx, dz);
      let yawDelta = Math.atan2(
        Math.sin(targetYaw - hero.rotation.y),
        Math.cos(targetYaw - hero.rotation.y),
      );
      hero.rotation.y += yawDelta * (1 - Math.exp(-dt * 14));
    }
    const canGroundJump = onGround || now - lastGroundedAt < 120;
    const canAirJump = !canGroundJump && airJumps < 1 && !fallStartedAt;
    if (now - jumpQueuedAt < 150 && (canGroundJump || canAirJump)) {
      pendingDoubleJump = canAirJump;
      if (guardianAnimation.beginJump(pendingDoubleJump)) {
        jumpQueuedAt = -Infinity;
      }
    }
    guardianAnimation.update(dt, moveSpeed, onGround, vy, -dx * inputLength);
    const animationEvents = guardianAnimation.takeEvents();
    if (animationEvents & GUARDIAN_ANIM_EVENT.LAUNCH) {
      vy = pendingDoubleJump ? 5.1 : 6.4;
      onGround = false;
      if (pendingDoubleJump) airJumps++;
      waterSystem.emitImpulse({
        position: hero.position,
        impactSpeed: Math.abs(vy),
        horizontalSpeed: moveSpeed,
        heading: { x: moveVelocity.x, z: moveVelocity.y },
        tier: pendingDoubleJump ? "soft" : undefined,
      });
    }
    vy -= 11 * dt;
    hero.position.y += vy * dt;
    // Takeoff anticipation can carry the visual/physical root briefly below
    // the water threshold before the animation emits LAUNCH. Once a real
    // upward launch exists, any timer armed by that dip is stale; otherwise a
    // valid long phone jump is respawned in midair ~700 ms later.
    if (vy > 0.2) fallStartedAt = 0;
    let floor = -0.55;
    let landingPad = null;
    let landingIsland = null;
    let hasSafeSupport = false;
    for (const p of pads) {
      if (Math.hypot(hero.position.x - p.x, hero.position.z - p.z) < p.r) {
        const surface = p.top + p.waterState.offset;
        if (vy <= 0 && surface > floor) {
          floor = surface;
          landingPad = p;
          hasSafeSupport = true;
        }
      }
    }
    for (const island of hubIslands) {
      const nx = (hero.position.x - island.x) / island.rx;
      const nz = (hero.position.z - island.z) / island.rz;
      if (nx * nx + nz * nz < .88 && vy <= 0 && island.top > floor) {
        floor = island.top;
        landingIsland = island;
        landingPad = null;
        hasSafeSupport = true;
      }
    }
    const habitatDx = hero.position.x - ARRIVAL_HABITAT.position[0];
    const habitatDz = hero.position.z - ARRIVAL_HABITAT.position[2];
    const habitatCos = Math.cos(ARRIVAL_HABITAT.yaw);
    const habitatSin = Math.sin(ARRIVAL_HABITAT.yaw);
    const habitatLocalX = habitatDx * habitatCos - habitatDz * habitatSin;
    const habitatLocalZ = habitatDx * habitatSin + habitatDz * habitatCos;
    if (
      !landingPad &&
      Math.abs(habitatLocalX) < ARRIVAL_HABITAT.halfLength &&
      Math.abs(habitatLocalZ) < ARRIVAL_HABITAT.halfWidth &&
      vy <= 0 && ARRIVAL_HABITAT.top > floor
    ) {
      floor = ARRIVAL_HABITAT.top;
      landingPad = null;
      hasSafeSupport = true;
    }
    const shrineHalfWidth = shrineCollision.size[0] * 0.5;
    const shrineHalfDepth = shrineCollision.size[2] * 0.5;
    if (
      Math.abs(hero.position.x - shrineCollision.center[0]) < shrineHalfWidth &&
      Math.abs(hero.position.z - shrineCollision.center[2]) < shrineHalfDepth
    ) {
      floor = Math.max(floor, shrineLanding.position[1] + 1.1);
      landingPad = null;
      hasSafeSupport = true;
    }
    if (hero.position.y <= floor) {
      if (!onGround && vy < -0.8) {
        guardianAnimation.land(vy);
        cameraImpact = Math.max(
          cameraImpact,
          THREE.MathUtils.clamp(Math.abs(vy) / 85, 0.018, 0.095),
        );
        if (landingPad) {
          waterSystem.impulsePad(landingPad.waterState, {
            position: hero.position,
            impactSpeed: vy,
            horizontalSpeed: moveSpeed,
            heading: { x: moveVelocity.x, z: moveVelocity.y },
          });
        } else {
          waterSystem.emitImpulse({
            position: hero.position,
            impactSpeed: vy,
            horizontalSpeed: moveSpeed,
            heading: { x: moveVelocity.x, z: moveVelocity.y },
          });
        }
      }
      hero.position.y = floor;
      vy = 0;
      onGround = true;
      airJumps = 0;
      lastGroundedAt = now;
      if (landingPad?.route.rest) checkpointPad = landingPad;
      if (landingIsland?.checkpoint) checkpointPad = { ...landingIsland, waterState: { offset: 0 } };
      // A low water dip may arm the delayed recovery timer immediately before
      // an edge landing. Once geometry has actually supported the hero, that
      // pending fall is no longer valid and must not reset a grounded player.
      if (hasSafeSupport) fallStartedAt = 0;
    } else onGround = false;
    if (hero.position.y < 0.04 && !fallStartedAt) {
      fallStartedAt = now;
      waterSystem.emitImpulse({
        position: hero.position,
        impactSpeed: vy,
        horizontalSpeed: moveSpeed,
        heading: { x: moveVelocity.x, z: moveVelocity.y },
        tier: "hard",
      });
    }
    if (fallStartedAt && now - fallStartedAt > 700) {
      // Keep a small deterministic audit trail in the harness state. This is
      // deliberately gameplay-owned rather than inferred by the route driver:
      // intermittent phone failures otherwise reveal only the later respawn.
      resetHistory.push({
        at: now,
        fallMs: now - fallStartedAt,
        from: [hero.position.x, hero.position.y, hero.position.z],
        checkpoint: [
          checkpointPad.x,
          checkpointPad.top + checkpointPad.waterState.offset,
          checkpointPad.z,
        ],
      });
      if (resetHistory.length > 8) resetHistory.shift();
      hero.position.set(
        checkpointPad.x,
        checkpointPad.top + checkpointPad.waterState.offset,
        checkpointPad.z,
      );
      moveVelocity.set(0, 0);
      moveSpeed = 0;
      vy = 0;
      onGround = true;
      airJumps = 0;
      fallStartedAt = 0;
      resetCount++;
      guardianAnimation.reset();
      lastGroundedAt = now;
    }
    const onShrine =
      Math.abs(hero.position.x - shrineCollision.center[0]) < shrineHalfWidth &&
      Math.abs(hero.position.z - shrineCollision.center[2]) < shrineHalfDepth;
    if (!won && onShrine && score === 3 && enemiesDefeated === enemies.length) {
      won = true;
      playing = false;
      document.getElementById("complete").classList.remove("hide");
    }
    if (
      inputLength > 0.02 &&
      hero.position.y < 0.3 &&
      !landingPad &&
      now - lastWakeMark > 115
    ) {
      waterSystem.stampWake(
        hero.position,
        { x: moveVelocity.x, z: moveVelocity.y },
        moveSpeed,
      );
      lastWakeMark = now;
    }
    for (const s of sparks) {
      if (s.visible && hero.position.distanceTo(s.position) < 1.1) {
        s.visible = false;
        score++;
        document.getElementById("score").textContent = score;
        combatStatus.textContent = `${s.userData.rescue} RESCUED · ${3 - score} REMAIN`;
        waterSystem.emitImpulse({
          position: hero.position,
          impactSpeed: 3.8,
          horizontalSpeed: moveSpeed,
          heading: { x: moveVelocity.x, z: moveVelocity.y },
        });
      }
      s.rotation.y += dt * 2;
      s.userData.halo.rotation.z -= dt * 1.35;
      s.userData.halo.rotation.x = Math.PI * 0.5 + Math.sin(t * 1.7 + s.id) * 0.22;
      s.position.y = 1 + Math.sin(t * 3 + s.id) * 0.15;
    }
    for (const enemy of enemies) {
      if (!enemy.alive) { enemy.root.visible = false; continue; }
      enemy.cooldown -= combatDt; enemy.stagger = Math.max(0, enemy.stagger - combatDt); enemy.flash = Math.max(0, enemy.flash - combatDt);
      enemy.roleMark.scale.setScalar(enemy.flash > 0 ? 1.7 : 1 + Math.sin(t * 4 + enemy.root.id) * .08);
      const toHero = hero.position.clone().sub(enemy.root.position); toHero.y = 0;
      const distance = toHero.length(); enemy.root.rotation.y = Math.atan2(toHero.x, toHero.z) + Math.PI;
      const gait = Math.min(1, distance / 2.4);
      if (enemy.joints.head) enemy.joints.head.rotation.x = Math.sin(t * 2.2 + enemy.root.id) * .045 + (enemy.windup > 0 ? -.14 : 0);
      enemy.tailJoints.forEach((joint, index) => {
        joint.rotation.y = Math.sin(t * (2.8 + gait) - index * .58 + enemy.root.id) * (.035 + index * .012);
      });
      if (enemy.stagger > 0 || hero.position.z > -12 || hero.position.z < -35) continue;
      if (enemy.role === "melee") {
        if (enemy.windup > 0) {
          enemy.windup -= combatDt; enemy.roleMark.material.color.setHex(0xffca55);
          if (enemy.windup <= 0 && distance < 1.75) { damagePlayer(22, enemy.root.position); enemy.cooldown = 1.25; }
        } else if (distance < 1.6 && enemy.cooldown <= 0) {
          enemy.windup = .48; combatStatus.textContent = "RED FLASH · GUARD OR DODGE";
        } else if (distance < 6) enemy.root.position.addScaledVector(toHero.normalize(), combatDt * 1.35);
      } else if (enemy.windup > 0) {
        enemy.windup -= combatDt; enemy.roleMark.material.color.setHex(0xffdf64);
        if (enemy.windup <= 0) { launchBomb(enemy); enemy.cooldown = 2.5; }
      } else if (distance < 10 && enemy.cooldown <= 0) {
        enemy.windup = .72; combatStatus.textContent = "GOLD RING · BOMB INCOMING";
      }
    }
    for (let i = bombs.length - 1; i >= 0; i--) {
      const bomb = bombs[i]; bomb.age += combatDt;
      const p = Math.min(1, bomb.age / bomb.duration);
      bomb.mesh.position.lerpVectors(bomb.start, bomb.target, p);
      bomb.mesh.position.y += Math.sin(p * Math.PI) * 3.2;
      bomb.marker.scale.setScalar(.65 + p * .55); bomb.marker.material.opacity = .35 + p * .45;
      if (p >= 1) {
        if (hero.position.distanceTo(bomb.target) < 1.25) damagePlayer(28, bomb.target);
        waterSystem.emitImpulse({ position: bomb.target, impactSpeed: 7, horizontalSpeed: 0, heading: { x: 0, z: -1 }, tier: "hard" });
        scene.remove(bomb.mesh, bomb.marker); bombs.splice(i, 1);
      }
    }
  }
  const heroShadowHeight = Math.max(0, hero.position.y - .08);
  heroContactShadow.position.set(hero.position.x, .042, hero.position.z);
  heroContactShadow.scale.setScalar(THREE.MathUtils.clamp(1.18 - heroShadowHeight * .13, .48, 1));
  heroContactShadow.material.opacity = THREE.MathUtils.clamp(.38 - heroShadowHeight * .055, .08, .34);
  // A water-level receiver becomes a detached oval when it draws over a
  // traversal leaf. Let the leaf's real shadow-map, authored dip/tilt/squash,
  // splash crown and broken water histories own that contact instead. Keep
  // the receiver only over open water and solid banks where it has a surface
  // to darken. The old query flag remains accepted for capture compatibility.
  const shadowPad = pads.find((pad) =>
    Math.hypot(hero.position.x - pad.x, hero.position.z - pad.z) < pad.r * 1.08
  );
  heroContactShadow.visible = !shadowPad;
  for (const enemy of enemies) {
    enemy.contactShadow.visible = enemy.alive;
    enemy.contactShadow.position.set(enemy.root.position.x, .044, enemy.root.position.z);
  }
  for (const mist of mistBanks) {
    const phase = mist.userData.phase;
    mist.position.x = mist.userData.baseX + Math.sin(t * .115 + phase) * 1.35;
    mist.position.y = mist.userData.baseY + Math.sin(t * .23 + phase) * .1;
    mist.material.opacity = .22 + (Math.sin(t * .31 + phase) * .5 + .5) * .14;
  }
  for (let i = 0; i < cloudLayers.length; i++) {
    const cloud = cloudLayers[i];
    cloud.position.x = cloud.userData.baseX + Math.sin(t * .018 + cloud.userData.phase) * (3.5 + i);
  }
  for (const band of horizonMist) {
    band.position.x = band.userData.baseX + Math.sin(t * .052 + band.userData.phase) * 4.2;
    band.material.opacity = .27 + Math.sin(t * .12 + band.userData.phase) * .07;
  }
  for (const bird of birds) {
    bird.position.x = bird.userData.baseX + Math.sin(t * .09 + bird.userData.phase) * 3.2;
    bird.position.y += Math.sin(t * 1.8 + bird.userData.phase) * .0015;
    bird.rotation.z = Math.sin(t * 2.1 + bird.userData.phase) * .08;
  }
  for (let i = 0; i < lanternPools.length; i++) {
    lanternPools[i].material.opacity = .095 + Math.sin(t * 2.2 + i * 1.7) * .018;
  }
  waterSystem.setHeroReflection(
    hero.position,
    hero.rotation.y,
    hero.visible && heroReflectionEnabled,
  );
  waterSystem.update(dt, t);
  const shrineRevealed = hero.position.z < -15;
  for (const landmark of shrineRevealLandmarks) {
    landmark.visible = shrineRevealed;
  }
  if (spiritReward) {
    // The green-tunnel banks fully occlude the shrine before this threshold;
    // avoid spending landmark draws while it cannot contribute to the frame.
    const core = spiritJoints.spirit_core;
    const ribbonFront = spiritJoints.ribbon_front;
    const ribbonBack = spiritJoints.ribbon_back;
    if (core) {
      core.rotation.y = t * 0.42;
      core.position.y = core.userData.bindY + Math.sin(t * 1.35) * 0.055;
      const pulse = 1 + Math.sin(t * 2.7) * 0.035;
      core.scale.setScalar(pulse);
    }
    if (ribbonFront) ribbonFront.rotation.z = Math.sin(t * 0.72) * 0.035;
    if (ribbonBack) ribbonBack.rotation.z = -Math.sin(t * 0.63) * 0.03;
  }
  if (mobileMode) {
    for (const pad of pads) {
      pad.mesh.visible = Math.abs(pad.z - hero.position.z) < 21;
    }
    for (const chunk of dressingBakes) {
      chunk.visible =
        chunk.userData.chunk === "far_composition" ||
        (chunk.userData.chunk === "arrival" && hero.position.z > -15) ||
        (chunk.userData.chunk === "green_tunnel" &&
          hero.position.z < 3 &&
          hero.position.z > -34) ||
        (chunk.userData.chunk === "shrine_reveal" && hero.position.z < -15);
    }
  }
  cameraImpact = THREE.MathUtils.damp(cameraImpact, 0, 8.5, dt);
  const baseCameraVolume =
    CAMERA_VOLUMES.find(
      (volume) =>
        hero.position.z <= volume.zFrom && hero.position.z >= volume.zTo,
    ) ?? CAMERA_VOLUMES[CAMERA_VOLUMES.length - 1];
  // Portrait loses most of the horizontal relationship between the hero and
  // the next island.  Buy that relationship back with a modestly longer and
  // higher rig plus a route-axis (-Z / northward) look-ahead.  Keep the hero's
  // authored target lift change small so this remains a chase camera, not an
  // overhead map view.
  const portraitRouteWeight = portraitRouteCamera
    ? THREE.MathUtils.smoothstep(-7.0, -15.0, hero.position.z)
    : 0;
  const cameraVolume = portraitRouteWeight > 0
    ? {
        ...baseCameraVolume,
        distance: baseCameraVolume.distance + 0.72 * portraitRouteWeight,
        height: baseCameraVolume.height + 0.42 * portraitRouteWeight,
        targetLift: baseCameraVolume.targetLift + 0.24 * portraitRouteWeight,
        lookAhead: baseCameraVolume.lookAhead + 1.85 * portraitRouteWeight,
      }
    : baseCameraVolume;
  const legacyFogDensity =
    hero.position.z > -18 ? 0.029 : hero.position.z > -29 ? 0.023 : 0.0155;
  const fittedFogDensity =
    hero.position.z > -18 ? 0.0255 : hero.position.z > -29 ? 0.021 : 0.0155;
  const targetFogDensity = THREE.MathUtils.lerp(
    legacyFogDensity,
    fittedFogDensity,
    fogFit,
  );
  scene.fog.density = THREE.MathUtils.damp(
    scene.fog.density,
    targetFogDensity,
    1.35,
    dt,
  );
  camera.fov = THREE.MathUtils.damp(camera.fov, cameraVolume.fov, 4.5, dt);
  camera.updateProjectionMatrix();
  const cameraIdleMs = now - lastCameraInputAt;
  if (cameraPointer === null && !keys.KeyQ && !keys.KeyE && cameraIdleMs > 1350) {
    orbitYawTarget = THREE.MathUtils.damp(orbitYawTarget, 0, 0.82, dt);
  }
  orbitYaw = THREE.MathUtils.damp(orbitYaw, orbitYawTarget, 8.5, dt);
  const pagodaDx = hero.position.x + 1.55;
  const pagodaDz = hero.position.z + 20.35;
  const pagodaProximity = pagodaCameraVolume === "sw-shoulder"
    ? THREE.MathUtils.smoothstep(1 - Math.hypot(pagodaDx / 4.8, pagodaDz / 6.2), 0, 1)
    : 0;
  const pagodaPassageWeight = pagodaCameraPassage
    ? THREE.MathUtils.smoothstep(1 - Math.hypot((hero.position.x - 0.2) / 4.0, (hero.position.z + 23.4) / 4.4), 0, 1)
    : 0;
  const pagodaLocalZ = hero.position.z + 23.4;
  const pagodaDirectionZone = Math.abs(pagodaLocalZ) < 7.2 && Math.abs(hero.position.x - 0.2) < 5.2;
  if (pagodaDirectionalPassage && pagodaDirectionZone && Math.abs(moveVelocity.y) > 0.55) {
    pagodaTravelDirection = moveVelocity.y < 0 ? -1 : 1;
  }
  // Northbound crosses from 0 -> 1 after the north opening; southbound makes
  // the exact reverse handoff.  The damped state is intentionally slower than
  // one jump, eliminating a hard camera cut at either threshold.
  const directionalHandoffTarget = pagodaDirectionalPassage && pagodaDirectionZone
    ? (pagodaTravelDirection < 0
        ? 1 - THREE.MathUtils.smoothstep(pagodaLocalZ, -4.6, -1.4)
        : THREE.MathUtils.smoothstep(1.4, 4.6, pagodaLocalZ))
    : 0;
  pagodaHandoff = THREE.MathUtils.damp(pagodaHandoff, directionalHandoffTarget, 2.2, dt);
  const directionalPassageWeight = pagodaDirectionalPassage && pagodaDirectionZone
    ? THREE.MathUtils.smoothstep(1 - Math.abs(pagodaLocalZ) / 6.4, 0, 1)
    : 0;
  const departureSide = pagodaTravelDirection < 0 ? -1 : 1;
  const directionalSide = departureSide * pagodaHandoff;
  const composedYaw = orbitYaw - pagodaProximity * 0.105;
  const composedLateralBias = cameraVolume.lateralBias + pagodaProximity * 1.15;
  const orbitSin = Math.sin(composedYaw);
  const orbitCos = Math.cos(composedYaw);
  const speedRatio = THREE.MathUtils.clamp(moveSpeed / 5.2, 0, 1);
  const lookAhead = cameraVolume.lookAhead + speedRatio * 2.4 - pagodaPassageWeight * 3.2;
  cameraLookTarget.set(
    hero.position.x + moveVelocity.x * 0.48 + composedLateralBias * orbitCos,
    hero.position.y + cameraVolume.targetLift + directionalPassageWeight * 0.45,
    hero.position.z + moveVelocity.y * 0.48 - lookAhead + directionalSide * 1.6,
  );
  desiredCameraPosition.set(
    hero.position.x + orbitSin * cameraVolume.distance + composedLateralBias * orbitCos - moveVelocity.x * 0.08,
    hero.position.y + cameraVolume.height + pagodaPassageWeight * 4.8 + directionalPassageWeight * (3.9 + pagodaHandoff * 1.2),
    hero.position.z + orbitCos * (cameraVolume.distance - pagodaPassageWeight * 1.2) - composedLateralBias * orbitSin - moveVelocity.y * 0.08 + directionalSide * cameraVolume.distance * 1.72,
  );
  cameraRayDirection.subVectors(desiredCameraPosition, cameraLookTarget);
  const desiredDistance = cameraRayDirection.length();
  cameraRayDirection.normalize();
  cameraRaycaster.set(cameraLookTarget, cameraRayDirection);
  cameraRaycaster.far = desiredDistance;
  const cameraHit = cameraRaycaster.intersectObjects(cameraObstacles, true)[0];
  const safeDistance = cameraHit
    ? Math.max(1.35, cameraHit.distance - 0.42)
    : desiredDistance;
  cameraTarget
    .copy(cameraLookTarget)
    .addScaledVector(cameraRayDirection, safeDistance);
  cameraTarget.x += Math.sin(t * 47) * cameraImpact;
  cameraTarget.y += Math.sin(t * 61) * cameraImpact * 0.7;
  camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 5));
  sky.position.copy(camera.position);
  camera.lookAt(cameraLookTarget);
  if (routeHint) {
    routeHint.textContent =
      hero.position.z < -41
        ? score === 3 && enemiesDefeated === enemies.length
          ? "THE SPIRIT STIRS · ENTER THE GATE"
          : score < 3 ? `THE SHRINE AWAITS ${3 - score} MORE SPARK${3 - score === 1 ? "" : "S"}` : `DEFEAT ${enemies.length - enemiesDefeated} MARSH WARDEN${enemies.length - enemiesDefeated === 1 ? "" : "S"}`
        : hero.position.z < -12 && enemiesDefeated < enemies.length ? `HUB ENCOUNTER · ${enemies.length - enemiesDefeated} WARDENS REMAIN` : "CHOOSE A BRANCH · RESCUE THE THREE KEEPERS";
  }
  renderer.render(scene, camera);
  window.__GAME__ = {
    fps,
    frame: totalFrames,
    speed: playing ? moveSpeed : 0,
    pos: [hero.position.x, hero.position.z],
    score,
    y: hero.position.y,
    grounded: onGround,
    resets: resetCount,
    resetHistory: resetHistory.map((entry) => ({
      ...entry,
      from: [...entry.from],
      checkpoint: [...entry.checkpoint],
    })),
    health: playerHealth,
    combat: { enemiesAlive: enemies.length - enemiesDefeated, enemiesDefeated, bombs: bombs.length, attacking: attackActive > 0, dodging: dodgeTime > 0, guarding: Boolean(keys.KeyK && dodgeTime <= 0), hits: playerHits },
    atmosphere: { mistBanks: mistBanks.length, lanternPools: lanternPools.length, sunIntensity: sun.intensity, fogDensity: scene.fog.density, contactShadows: 1 + enemies.filter((enemy) => enemy.alive).length },
    horizon: { cloudLayers: cloudLayers.length, mountainLayers: mountainLayers.length, bambooSilhouettes: bambooSilhouettes.length, submergedRuins: submergedRuins.length, birds: birds.length, mistBands: horizonMist.length },
    hub: { islands: hubIslands.length, loops: HUB_LINKS.length, shortcuts: HUB_LINKS.filter((link) => link.gated).length, rescueBeacons: sparks.length, pagoda: pagoda.name, enemyPosts: ENEMY_SPAWNS.length },
    over: false,
    won,
    draws: renderer.info.render.calls,
    tris: renderer.info.render.triangles,
    camera: {
      yaw: orbitYaw,
      targetYaw: orbitYawTarget,
      distance: camera.position.distanceTo(cameraLookTarget),
      obstructed: Boolean(cameraHit),
      lookAhead,
      pagodaVolume: pagodaCameraVolume,
      pagodaVolumeWeight: pagodaProximity,
      pagodaPassage: pagodaCameraPassage ? "over-eave-v1" : "0",
      pagodaPassageWeight,
      pagodaDirectionalPassage: pagodaDirectionalPassage ? "directional-v1" : "0",
      pagodaTravelDirection,
      pagodaHandoff,
      directionalPassageWeight,
      portraitRouteCamera: portraitRouteCamera ? "north-v1" : "0",
      portraitRouteWeight,
    },
  };
}
if (deterministicCapture) {
  window.__COMBAT_TEST__ = {
    teleport(x, z) { hero.position.x = x; hero.position.z = z; hero.position.y = .65; },
    enemy(index) { const e = enemies[index]; return { position: [e.root.position.x, e.root.position.z], hp: e.hp, alive: e.alive, role: e.role }; },
    primeEnemy(index) { enemies[index].hp = 1; enemies[index].cooldown = 0; },
    launchBomb(index) { launchBomb(enemies[index]); },
  };
  window.__STEP__ = (count = 1) => {
    const steps = Math.max(0, Math.min(600, Math.floor(Number(count) || 0)));
    for (let i = 0; i < steps; i++) {
      captureNow += FIXED_CAPTURE_DT_MS;
      animate(captureNow);
    }
    return structuredClone(window.__GAME__);
  };
  window.__GOAL10_PLAN_VIEW__ = () => {
    camera.up.set(0, 0, -1);
    camera.position.set(.2, 24, -23.4);
    camera.lookAt(.2, 0, -23.4);
    renderer.render(scene, camera);
  };
  // Establish an identical rendered frame before a controller begins input.
  window.__STEP__(1);
} else {
  requestAnimationFrame(animate);
}
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
