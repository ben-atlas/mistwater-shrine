import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { ASSET, bakeStatic } from "../assetlib.js";
import { setSurfaceDefaults } from "../surfaces.js";
import { createWaterSystem } from "./water-system.js";
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
} from "./world-layout.js";

setSurfaceDefaults({ on: true, size: 512, normalScale: 0.72 });
const mobileMode = matchMedia("(pointer: coarse)").matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91aaa2);
scene.fog = new THREE.FogExp2(0x86a9a3, 0.025);
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(175, 32, 18),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vSkyDirection;
      void main() {
        vSkyDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vSkyDirection;
      void main() {
        float h = clamp(vSkyDirection.y * .5 + .5, 0.0, 1.0);
        vec3 lower = vec3(.37, .49, .47);
        vec3 horizon = vec3(.63, .72, .67);
        vec3 upper = vec3(.31, .45, .45);
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

const contactMaterial = new THREE.MeshBasicMaterial({
  color: 0x071a18, transparent: true, opacity: .34, depthWrite: false,
  blending: THREE.MultiplyBlending,
});
function createContactShadow(radius = .62) {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), contactMaterial.clone());
  shadow.rotation.x = -Math.PI * .5; shadow.renderOrder = 3; scene.add(shadow);
  return shadow;
}
const waterSystem = createWaterSystem({
  scene,
  width: 70,
  length: 124,
  segmentsX: mobileMode ? 72 : 112,
  segmentsZ: mobileMode ? 112 : 160,
  y: 0,
  colors: {
    deep: 0x0c292c,
    shallow: 0x326467,
    horizon: 0x81998f,
    zenith: 0xb6c7b9,
    sun: 0xf3cd8a,
  },
});
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
for (const placement of placements) {
  const p = await ASSET("./assets/lotus_leaf_traversal.js", { height: 0.38 });
  p.position.set(placement.x, placement.y, placement.z);
  p.scale.setScalar(placement.scale);
  p.rotation.y = placement.yaw;
  scene.add(p);
  const pad = {
    mesh: p,
    x: placement.x,
    z: placement.z,
    r: placement.radius * 1.1,
    top: p.position.y + 0.38 * placement.scale,
    route: placement,
  };
  pad.waterState = waterSystem.registerPad({
    mesh: p,
    radius: pad.r,
    baseY: p.position.y,
  });
  pads.push(pad);
}

const availableDressing = [...DRESSING, ...BACKGROUND]
  .filter(
    (item) =>
      (!item.asset.includes("/required/") &&
        !item.asset.includes("mountain_spire")) ||
      item.asset.includes("/required/bank_rock_") ||
      item.asset.includes("/required/karst_"),
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
  object.position.set(...item.position);
  object.scale.set(...item.scale);
  object.rotation.set(...item.rotation);
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

// Checkpoint 2 combat is deliberately built from low-poly primitives so the
// two crocodile roles read clearly without adding another asset dependency.
const enemyBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x315b43, roughness: 0.82 });
const enemyBellyMaterial = new THREE.MeshStandardMaterial({ color: 0x8da56e, roughness: 0.9 });
const warningMaterial = new THREE.MeshBasicMaterial({ color: 0xff7b3d, transparent: true, opacity: 0.62, depthWrite: false });
const enemies = [];
function createCrocodile(role, x, z) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 1.55), enemyBodyMaterial);
  body.position.y = 0.36; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.3, 0.72), enemyBellyMaterial);
  head.position.set(0, 0.37, -0.96); head.castShadow = true;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.31, 1.35, 5), enemyBodyMaterial);
  tail.rotation.x = Math.PI * 0.5; tail.position.set(0, 0.35, 1.25);
  const roleMark = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.045, 6, 18), new THREE.MeshBasicMaterial({ color: role === "ranged" ? 0xffa13d : 0xef4e42 }));
  roleMark.rotation.x = Math.PI * 0.5; roleMark.position.y = 0.72;
  root.add(body, head, tail, roleMark); root.position.set(x, 0.22, z); scene.add(root);
  const contactShadow = createContactShadow(.72);
  const enemy = { role, root, contactShadow, hp: role === "ranged" ? 2 : 3, maxHp: role === "ranged" ? 2 : 3, cooldown: role === "ranged" ? 1.4 : 0.55, windup: 0, stagger: 0, flash: 0, alive: true, roleMark };
  enemies.push(enemy); return enemy;
}
createCrocodile("melee", 0.55, -16.9);
createCrocodile("ranged", -3.35, -20.45);
createCrocodile("melee", 2.25, -28.25);
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
for (const pad of pads.filter(
  (candidate) => candidate.route.reward === "spark",
)) {
  const spark = new THREE.Group();
  spark.name = `LanternSpark_${pad.route.id}`;
  const core = new THREE.Mesh(sparkCoreGeometry, sparkCoreMaterial);
  core.scale.set(0.72, 1.18, 0.72);
  const halo = new THREE.Mesh(sparkHaloGeometry, sparkHaloMaterial);
  halo.rotation.x = Math.PI * 0.5;
  halo.scale.y = 0.72;
  spark.add(core, halo);
  spark.position.set(pad.x, 1, pad.z);
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
  pendingDoubleJump = false,
  checkpointPad = pads[0],
  cameraImpact = 0;
const deterministicCapture = new URLSearchParams(location.search).has(
  "deterministicCapture",
);
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
const cameraObstacles = [
  ...dressingBakes,
  ...shrineRevealLandmarks,
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
    let floor = -0.55;
    let landingPad = null;
    for (const p of pads) {
      if (Math.hypot(hero.position.x - p.x, hero.position.z - p.z) < p.r) {
        const surface = p.top + p.waterState.offset;
        if (vy <= 0 && surface > floor) {
          floor = surface;
          landingPad = p;
        }
      }
    }
    const shrineHalfWidth = shrineCollision.size[0] * 0.5;
    const shrineHalfDepth = shrineCollision.size[2] * 0.5;
    if (
      Math.abs(hero.position.x - shrineCollision.center[0]) < shrineHalfWidth &&
      Math.abs(hero.position.z - shrineCollision.center[2]) < shrineHalfDepth
    ) {
      floor = Math.max(floor, shrineLanding.position[1] + 1.1);
      landingPad = null;
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
  for (let i = 0; i < lanternPools.length; i++) {
    lanternPools[i].material.opacity = .095 + Math.sin(t * 2.2 + i * 1.7) * .018;
  }
  waterSystem.setHeroReflection(hero.position, hero.rotation.y, hero.visible);
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
  const cameraVolume =
    CAMERA_VOLUMES.find(
      (volume) =>
        hero.position.z <= volume.zFrom && hero.position.z >= volume.zTo,
    ) ?? CAMERA_VOLUMES[CAMERA_VOLUMES.length - 1];
  const targetFogDensity =
    hero.position.z > -18 ? 0.029 : hero.position.z > -29 ? 0.023 : 0.0155;
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
  const orbitSin = Math.sin(orbitYaw);
  const orbitCos = Math.cos(orbitYaw);
  const speedRatio = THREE.MathUtils.clamp(moveSpeed / 5.2, 0, 1);
  const lookAhead = cameraVolume.lookAhead + speedRatio * 2.4;
  cameraLookTarget.set(
    hero.position.x + moveVelocity.x * 0.48 + cameraVolume.lateralBias * orbitCos,
    hero.position.y + cameraVolume.targetLift,
    hero.position.z + moveVelocity.y * 0.48 - lookAhead,
  );
  desiredCameraPosition.set(
    hero.position.x + orbitSin * cameraVolume.distance + cameraVolume.lateralBias * orbitCos - moveVelocity.x * 0.08,
    hero.position.y + cameraVolume.height,
    hero.position.z + orbitCos * cameraVolume.distance - cameraVolume.lateralBias * orbitSin - moveVelocity.y * 0.08,
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
        : hero.position.z < -12 && enemiesDefeated < enemies.length ? `ENCOUNTER SEALED · ${enemies.length - enemiesDefeated} WARDENS REMAIN` : "LEAP BETWEEN LOTUS LEAVES · DOUBLE-TAP SPACE IN THE AIR";
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
    health: playerHealth,
    combat: { enemiesAlive: enemies.length - enemiesDefeated, enemiesDefeated, bombs: bombs.length, attacking: attackActive > 0, dodging: dodgeTime > 0, guarding: Boolean(keys.KeyK && dodgeTime <= 0), hits: playerHits },
    atmosphere: { mistBanks: mistBanks.length, lanternPools: lanternPools.length, sunIntensity: sun.intensity, fogDensity: scene.fog.density, contactShadows: 1 + enemies.filter((enemy) => enemy.alive).length },
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
