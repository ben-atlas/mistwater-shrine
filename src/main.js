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
scene.background = new THREE.Color(0xaebfb4);
scene.fog = new THREE.FogExp2(0x98afa3, 0.023);
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
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;
scene.environmentIntensity = 0.34;
pmrem.dispose();
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdce8dd, 0x1d302c, 1.15));
const sun = new THREE.DirectionalLight(0xffdda3, 3.1);
sun.position.set(-16, 26, -10);
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
const coolFill = new THREE.DirectionalLight(0x8fb8ad, 0.45);
coolFill.position.set(12, 8, 10);
scene.add(coolFill);
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
  dressingBakes.push(baked);
  scene.add(baked);
}
let spiritReward = null;
let spiritJoints = {};
for (const item of LANDMARKS) {
  const object = await ASSET(item.asset, {
    keepHierarchy: item.keepHierarchy === true,
  });
  object.position.set(...item.position);
  object.scale.set(...item.scale);
  object.rotation.set(...item.rotation);
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

const hero = await ASSET("./assets/forest_guardian.js", {
  height: 1.25,
  keepHierarchy: true,
});
scene.add(hero);
hero.position.set(TRAVERSAL[0].x, pads[0].top, TRAVERSAL[0].z);
const joints = hero.userData.joints || {};
const guardianAnimation = createGuardianAnimation(joints);
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
let touchOriginX = 0;
let touchOriginY = 0;
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "Space") jump();
});
addEventListener("keyup", (e) => (keys[e.code] = false));
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" || e.clientX > innerWidth * 0.68) return;
  touchPointer = e.pointerId;
  touchOriginX = e.clientX;
  touchOriginY = e.clientY;
  movePad.style.left = `${e.clientX - 56}px`;
  movePad.style.top = `${e.clientY - 56}px`;
  movePad.style.bottom = "auto";
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.pointerId !== touchPointer) return;
  touchMove.set(e.clientX - touchOriginX, e.clientY - touchOriginY);
  const length = touchMove.length();
  if (length > 54) touchMove.multiplyScalar(54 / length);
  movePadKnob.style.transform = `translate(${(touchMove.x / 54) * 28}px, ${(touchMove.y / 54) * 28}px)`;
  touchMove.divideScalar(54);
});
function releaseTouch(e) {
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
const moveVelocity = new THREE.Vector2();
function jump() {
  if (playing) jumpQueuedAt = performance.now();
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
const shrineLanding = LANDMARKS.find((item) => item.id === "shrine_landing");
const shrineCollision = shrineLanding.collision;
function animate(now) {
  requestAnimationFrame(animate);
  const real = (now - prev) / 1000;
  prev = now;
  const dt = Math.min(real, 0.033),
    t = clock.getElapsedTime();
  totalFrames++;
  frames++;
  if (now - fpst > 500) {
    fps = frames / ((now - fpst) / 1000);
    frames = 0;
    fpst = now;
  }
  if (playing) {
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
    }
    const targetSpeed = inputLength * 5.2;
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
    if (!won && onShrine && score === 3) {
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
  }
  waterSystem.update(dt, t);
  if (spiritReward) {
    // The green-tunnel banks fully occlude the shrine before this threshold;
    // avoid spending landmark draws while it cannot contribute to the frame.
    spiritReward.visible = hero.position.z < -15;
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
  cameraTarget.set(
    hero.position.x +
      cameraVolume.lateralBias -
      moveVelocity.x * 0.08 +
      Math.sin(t * 47) * cameraImpact,
    hero.position.y +
      cameraVolume.height +
      Math.sin(t * 61) * cameraImpact * 0.7,
    hero.position.z + cameraVolume.distance - moveVelocity.y * 0.08,
  );
  camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 5));
  sky.position.copy(camera.position);
  camera.lookAt(
    hero.position.x + moveVelocity.x * 0.24 + cameraVolume.lateralBias,
    hero.position.y + cameraVolume.targetLift,
    hero.position.z + moveVelocity.y * 0.5 - cameraVolume.lookAhead,
  );
  if (routeHint) {
    routeHint.textContent =
      hero.position.z < -41
        ? score === 3
          ? "THE SPIRIT STIRS · ENTER THE GATE"
          : `THE SHRINE AWAITS ${3 - score} MORE SPARK${3 - score === 1 ? "" : "S"}`
        : "LEAP BETWEEN LOTUS LEAVES · DOUBLE-TAP SPACE IN THE AIR";
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
    over: false,
    won,
    draws: renderer.info.render.calls,
    tris: renderer.info.render.triangles,
  };
}
requestAnimationFrame(animate);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
