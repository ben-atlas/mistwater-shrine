import * as THREE from "three";

const MAX_IMPULSES = 24;
const MAX_REFLECTED_PADS = 16;
const DEFAULT_DROPLETS = 160;
const DEFAULT_CROWNS = 16;
const UP = new THREE.Vector3(0, 1, 0);

const VERTEX_SHADER = /* glsl */ `
#define MAX_IMPULSES 24
#include <fog_pars_vertex>
uniform float uTime;
uniform vec4 uImpulse[MAX_IMPULSES]; // xz, birth, amplitude
uniform vec4 uImpulseShape[MAX_IMPULSES]; // initial radius, speed, frequency, decay
uniform vec4 uImpulseDirection[MAX_IMPULSES]; // direction xz, wake amount, enabled
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vInteraction;
varying float vWaterHeight;

float baseWater(vec2 q) {
  // Five non-harmonic, non-axis-aligned scales avoid long repeating bands.
  return sin(dot(q, vec2(.183, .071)) + uTime * .41) * .058
       + sin(dot(q, vec2(-.097, .231)) - uTime * .34) * .041
       + sin(dot(q, vec2(.417, -.159)) + uTime * .63) * .022
       + sin(dot(q, vec2(-.731, -.283)) - uTime * .89) * .010
       + sin(dot(q, vec2(1.197, .743)) + uTime * 1.17) * .005;
}

vec2 waterSample(vec2 q) {
  float interaction = 0.0;
  float displacement = baseWater(q);

  for (int i = 0; i < MAX_IMPULSES; i++) {
    vec4 impulse = uImpulse[i];
    vec4 shape = uImpulseShape[i];
    vec4 direction = uImpulseDirection[i];
    float age = uTime - impulse.z;
    float alive = step(0.0, age) * step(age, 4.6) * direction.w;
    vec2 delta = q - impulse.xy;
    float distanceToContact = length(delta);
    float radius = shape.x + age * shape.y;
    float ringWidth = mix(.13, .34, clamp(age * .55, 0.0, 1.0));
    float ring = exp(-pow((distanceToContact - radius) / ringWidth, 2.0));
    float decay = exp(-age * shape.w);
    float wave = sin((distanceToContact - radius) * shape.z) * ring;

    // A soft radial cavity makes impact readable before the first ring expands.
    float cavity = -exp(-distanceToContact * distanceToContact / max(.08, .22 + age * .9));
    cavity *= exp(-age * 4.2);

    // Directional wake: widening V arms, with a soft centre and no hard triangle edge.
    vec2 dir = normalize(direction.xy + vec2(.0001));
    float forward = dot(delta, dir);
    float side = abs(delta.x * dir.y - delta.y * dir.x);
    float armDistance = abs(side - max(forward, 0.0) * .36);
    float wakeEnvelope = smoothstep(-.25, .2, forward)
      * exp(-max(forward, 0.0) * .34)
      * exp(-armDistance * armDistance * 22.0)
      * exp(-age * 1.25) * direction.z;

    displacement += alive * impulse.w * (wave * decay * .11 + cavity * .12 + wakeEnvelope * .045);
    interaction += alive * impulse.w * (ring * decay + abs(cavity) * .7 + wakeEnvelope);
  }

  return vec2(displacement, interaction);
}

void main() {
  vec3 p = position;
  vec3 flatWorld = (modelMatrix * vec4(p, 1.0)).xyz;
  vec2 q = flatWorld.xz;
  vec2 center = waterSample(q);

  // Vertex-grid facets were visible because the old fragment shader derived
  // one flat normal per displaced triangle. Sample the same continuous height
  // field around each vertex and interpolate that normal across the triangles.
  // 0.18 m is broad enough to suppress mesh topology but preserves impact rings.
  const float normalEpsilon = .18;
  float heightX = waterSample(q + vec2(normalEpsilon, 0.0)).x;
  float heightZ = waterSample(q + vec2(0.0, normalEpsilon)).x;
  vWorldNormal = normalize(vec3(center.x - heightX, normalEpsilon,
                                center.x - heightZ));
  p.z += center.x;
  vInteraction = center.y;
  vWaterHeight = center.x;
  vWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
  vec4 mvPosition = viewMatrix * vec4(vWorldPosition, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT_SHADER = /* glsl */ `
#define MAX_IMPULSES 24
#include <fog_pars_fragment>
uniform float uTime;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uHorizonColor;
uniform vec3 uZenithColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uOpacity;
uniform vec4 uReflectedPad[16]; // x, z, radius, enabled
uniform vec4 uImpulse[MAX_IMPULSES];
uniform vec4 uImpulseShape[MAX_IMPULSES];
uniform vec4 uImpulseDirection[MAX_IMPULSES];
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vInteraction;
varying float vWaterHeight;

// Signed distance helpers for the reflected-scene proxy.  This is deliberately
// tiny compared with a planar reflection: the lake analytically reflects the
// composition's important silhouettes without a second scene render.
float boxSdf(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float gateSdf(vec2 p) {
  float leftPillar = boxSdf(p - vec2(-3.35, 2.35), vec2(.42, 2.35));
  float rightPillar = boxSdf(p - vec2(3.35, 2.35), vec2(.42, 2.35));
  float beam = boxSdf(p - vec2(0.0, 4.20), vec2(4.35, .38));
  float lowerBeam = boxSdf(p - vec2(0.0, 3.37), vec2(3.72, .20));
  float roof = boxSdf(p - vec2(0.0, 4.73), vec2(4.95, .18));
  return min(min(leftPillar, rightPillar), min(min(beam, lowerBeam), roof));
}

vec4 reflectedArchitecture(vec3 origin, vec3 ray) {
  // Shrine gate proxy at the same world-space depth as the authored landmark.
  float denom = ray.z;
  float t = (-45.75 - origin.z) / (abs(denom) < .0001 ? -.0001 : denom);
  vec3 hit = origin + ray * t;
  float gateDistance = gateSdf(vec2(hit.x - .35, hit.y));
  float gateMask = step(0.0, t) * (1.0 - smoothstep(-.06, .17, gateDistance));
  float goldMask = gateMask * (1.0 - smoothstep(-.03, .11,
    min(boxSdf(vec2(hit.x - .35, hit.y) - vec2(0.0, 4.25), vec2(1.15, .10)),
        boxSdf(vec2(hit.x - .35, hit.y) - vec2(0.0, 3.40), vec2(.95, .07)))));
  vec3 lacquer = mix(vec3(.19, .025, .018), vec3(.52, .095, .040),
    smoothstep(-5.0, 5.0, hit.x));
  vec3 color = mix(lacquer, vec3(.96, .56, .20), goldMask);
  return vec4(color, gateMask * smoothstep(-.03, .22, -ray.y));
}

float karstProfile(float x) {
  float left = 4.8 * exp(-pow((x + 11.5) * .105, 2.0))
             + 2.7 * exp(-pow((x + 6.3) * .18, 2.0));
  float right = 5.6 * exp(-pow((x - 12.5) * .095, 2.0))
              + 2.2 * exp(-pow((x - 7.0) * .20, 2.0));
  return max(left, right);
}

vec4 reflectedKarsts(vec3 origin, vec3 ray) {
  float t = (-62.0 - origin.z) / (abs(ray.z) < .0001 ? -.0001 : ray.z);
  vec3 hit = origin + ray * t;
  float ridge = karstProfile(hit.x);
  float mask = step(0.0, t) * (1.0 - smoothstep(-.15, .32, hit.y - ridge));
  // Centre aperture remains open, framing rather than obscuring the gate.
  mask *= smoothstep(4.4, 7.0, abs(hit.x));
  return vec4(vec3(.075, .145, .135), mask * .72);
}

float bankDistance(vec2 p) {
  // Broad authored shore phrases, used only for reflected/turbid edge response.
  float left = p.x + 8.2 + sin(p.y * .18) * 1.25 + sin(p.y * .47) * .45;
  float right = 8.7 - p.x + sin(p.y * .15 + 1.7) * 1.35;
  float shrine = length((p - vec2(.3, -45.0)) * vec2(.58, 1.0)) - 5.4;
  return min(min(left, right), shrine);
}

vec3 sceneCoupledReflection(vec2 surfacePoint, vec3 normal, out float coverage) {
  // Normal-driven parallax is shared by every proxy class. Silhouettes shear
  // and fragment with the exact broad + capillary normal used for specular.
  vec2 p = surfacePoint + normal.xz * vec2(3.8, 7.2);
  vec3 reflected = vec3(0.0);
  coverage = 0.0;

  // Lotus pads: broad green elliptical reflections extended toward the viewer.
  // The active/nearest pad also carries the guardian's russet segmented streak.
  vec2 expectedHero = cameraPosition.xz + vec2(0.0, -5.6);
  float nearestDistance = 999.0;
  int nearestPad = 0;
  for (int i = 0; i < 16; i++) {
    vec4 pad = uReflectedPad[i];
    float distanceToExpected = length(pad.xy - expectedHero) + (1.0 - pad.w) * 999.0;
    if (distanceToExpected < nearestDistance) {
      nearestDistance = distanceToExpected;
      nearestPad = i;
    }
  }
  for (int i = 0; i < 16; i++) {
    vec4 pad = uReflectedPad[i];
    vec2 d = p - (pad.xy + vec2(0.0, pad.z * .68));
    // Reflected footprint extends +z (towards chase camera), with a split edge.
    float ellipse = length(vec2(d.x / max(.1, pad.z), d.y / max(.1, pad.z * 1.85)));
    float mask = pad.w * (1.0 - smoothstep(.78, 1.13, ellipse));
    float normalBreak = smoothstep(.12, .82,
      .5 + .5 * sin(d.y * 4.7 + normal.x * 13.0 + normal.z * 7.0));
    mask *= mix(.52, 1.0, normalBreak);
    float alpha = mask * .34;
    reflected = mix(reflected, vec3(.075, .20, .105), alpha);
    coverage = max(coverage, alpha);

    if (i == nearestPad) {
      vec2 heroDelta = p - (pad.xy + vec2(.0, pad.z * 1.55));
      float torso = 1.0 - smoothstep(.42, .74,
        length(vec2(heroDelta.x / .5, heroDelta.y / 1.65)));
      float segments = smoothstep(.08, .7,
        .5 + .5 * sin(heroDelta.y * 8.2 + normal.x * 5.0));
      float heroMask = pad.w * torso * segments
        * (1.0 - smoothstep(5.5, 8.5, nearestDistance));
      reflected = mix(reflected, vec3(.48, .095, .038), heroMask * .57);
      coverage = max(coverage, heroMask * .57);
    }
  }

  // Three warm practicals: the tunnel lantern and shrine pair. Their tapered,
  // broken vertical strokes are immediately distinguishable from moonlight.
  vec2 lanterns[3];
  lanterns[0] = vec2(6.2, -24.1);
  lanterns[1] = vec2(-3.55, -43.65);
  lanterns[2] = vec2(4.3, -45.55);
  for (int i = 0; i < 3; i++) {
    vec2 d = p - (lanterns[i] + vec2(0.0, 1.25));
    float taper = exp(-abs(d.x) * (2.6 + max(d.y, 0.0) * .35));
    float reach = smoothstep(-.45, .2, d.y) * (1.0 - smoothstep(4.8, 8.5, d.y));
    float broken = smoothstep(.22, .78, .5 + .5 * sin(d.y * 5.3 + normal.z * 11.0));
    float lampMask = taper * reach * broken * .68;
    reflected = mix(reflected, vec3(1.0, .48, .10), lampMask);
    coverage = max(coverage, lampMask);
  }
  return reflected;
}

vec2 fragmentContact(vec2 p) {
  float ridge = 0.0;
  float cavity = 0.0;
  for (int i = 0; i < MAX_IMPULSES; i++) {
    vec4 impulse = uImpulse[i];
    vec4 shape = uImpulseShape[i];
    vec4 direction = uImpulseDirection[i];
    float age = uTime - impulse.z;
    float alive = step(0.0, age) * step(age, 4.8) * direction.w;
    float distanceToContact = length(p - impulse.xy);
    float radius = shape.x + age * shape.y;
    float width = .105 + age * .075;
    float ring = exp(-pow((distanceToContact - radius) / width, 2.0));
    float memory = exp(-age * .31);
    ridge += alive * impulse.w * ring * memory;
    cavity += alive * impulse.w
      * exp(-distanceToContact * distanceToContact / (.18 + age * 1.15))
      * exp(-age * .72);
  }
  return vec2(ridge, cavity);
}

void main() {
  vec3 N = normalize(vWorldNormal);
  if (N.y < 0.0) N = -N;

  // Two opposed capillary octaves plus a tiny cross-scale break-up. Their
  // slopes, not their brightness, disturb reflected silhouettes.
  float a = sin(dot(vWorldPosition.xz, vec2(2.73, 1.19)) + uTime * 1.31);
  float b = sin(dot(vWorldPosition.xz, vec2(-1.61, 4.07)) - uTime * 1.03);
  float c = sin(dot(vWorldPosition.xz, vec2(6.31, -2.37)) + uTime * 1.83);
  N = normalize(N + vec3((a + b * .74 + c * .22) * .022, 0.0,
                         (a * .58 - b + c * .27) * .019));

  vec3 V = normalize(cameraPosition - vWorldPosition);
  float NdotV = clamp(dot(N, V), 0.0, 1.0);
  // Schlick Fresnel for water (F0 ~= 0.02), used to mix body and sky reflection.
  float fresnel = .02 + .98 * pow(1.0 - NdotV, 5.0);
  vec3 reflectedRay = reflect(-V, N);
  float skyMix = smoothstep(-.12, .82, reflectedRay.y);
  vec3 reflectedSky = mix(uHorizonColor, uZenithColor, skyMix);
  vec4 karstReflection = reflectedKarsts(vWorldPosition, reflectedRay);
  vec4 gateReflection = reflectedArchitecture(vWorldPosition, reflectedRay);
  reflectedSky = mix(reflectedSky, karstReflection.rgb, karstReflection.a);
  reflectedSky = mix(reflectedSky, gateReflection.rgb, gateReflection.a);
  float objectCoverage;
  vec3 objectReflection = sceneCoupledReflection(vWorldPosition.xz, N, objectCoverage);
  reflectedSky = mix(reflectedSky, objectReflection, objectCoverage);

  // The physically intersected gate resolves near the horizon. A restrained,
  // broken lacquer trail carries its dominant colour into gameplay-distance
  // water without becoming a straight painted stripe.
  float routeDepth = -vWorldPosition.z;
  float gateTrailEnvelope = exp(-abs(vWorldPosition.x - .35
    - sin(vWorldPosition.z * .19 + uTime * .17) * .18) * 1.05)
    * smoothstep(9.0, 18.0, routeDepth)
    * (1.0 - smoothstep(45.0, 52.0, routeDepth));
  float gateTrailBreakup = .5 + .5 * sin(vWorldPosition.z * 2.31
    + sin(vWorldPosition.x * 5.2) + uTime * .46);
  gateTrailBreakup = smoothstep(.27, .78, gateTrailBreakup);
  reflectedSky = mix(reflectedSky, vec3(.39, .07, .035),
    gateTrailEnvelope * gateTrailBreakup * .22);

  // Analytic moon and its vertically stretched warm path. This is a reflected
  // light source rather than a painted stripe, so wave normals break it up.
  vec3 moonDirection = normalize(vec3(.45, 4.15, -73.0) - vWorldPosition);
  float moonDisc = smoothstep(.9987, .99965, dot(reflectedRay, moonDirection));
  float warmPath = pow(max(dot(reflectedRay.xz, moonDirection.xz), 0.0), 44.0)
    * smoothstep(-.06, .42, reflectedRay.y);
  reflectedSky += uSunColor * (moonDisc * 1.15 + warmPath * .075);

  // Depth proxy keeps broad tonal variation without pretending to know scene depth.
  float depthNoise = .5 + .5 * sin(vWorldPosition.x * .071 + vWorldPosition.z * .113
    + sin(vWorldPosition.x * .19 - uTime * .17));
  float shore = bankDistance(vWorldPosition.xz);
  float shallows = 1.0 - smoothstep(-.4, 2.5, shore);
  vec3 body = mix(uDeepColor, uShallowColor,
    .19 + depthNoise * .12 + shallows * .31);
  float broadBand = .5 + .5 * sin(
    dot(vWorldPosition.xz, vec2(.31, -.17)) + uTime * .38
    + sin(dot(vWorldPosition.xz, vec2(-.11, .27)) - uTime * .24) * .72
  );
  body *= .86 + broadBand * .22 + vWaterHeight * .22;
  vec3 H = normalize(normalize(uSunDirection) + V);
  float broadSpecular = pow(max(dot(N, H), 0.0), 92.0);
  float glint = pow(max(dot(N, H), 0.0), 380.0);
  float reflectionWeight = .25 + fresnel * .73;
  vec3 color = mix(body, reflectedSky, reflectionWeight);
  color += uSunColor * (broadSpecular * .13 + glint * .34);
  color += uShallowColor * shallows * .08;
  color += uHorizonColor * smoothstep(.16, .92, vInteraction) * .11;

  // Interaction is vertex-evaluated, so a narrow/high-contrast threshold exposes
  // the water grid again. Keep shader foam broad and subtle; pooled crowns and
  // droplets carry the crisp contact read without turning a triangle white.
  vec2 fragmentHistory = fragmentContact(vWorldPosition.xz);
  float contact = smoothstep(.09, .66, fragmentHistory.x);
  float cavity = smoothstep(.08, .58, fragmentHistory.y);
  // Alternating luminance is essential: rings survive grayscale while remaining
  // green-water phenomena, not white decals.
  color *= 1.0 - cavity * .20;
  color = mix(color, vec3(.24, .57, .50), contact * .31);
  color += vec3(.13, .25, .22) * contact * .12;
  gl_FragColor = vec4(color, uOpacity);
  #include <fog_fragment>
}
`;

function tierFromImpact(impactSpeed = 0, horizontalSpeed = 0) {
  const energy = Math.max(Math.abs(impactSpeed), horizontalSpeed * 0.55);
  if (energy >= 7.0) return "hard";
  if (energy >= 3.2) return "normal";
  return "soft";
}

function tierSettings(tier) {
  if (tier === "hard")
    return { amplitude: 1, rings: 3, droplets: 34, crown: 1, pad: 1 };
  if (tier === "normal")
    return { amplitude: 0.68, rings: 2, droplets: 17, crown: 0.7, pad: 0.58 };
  return { amplitude: 0.34, rings: 1, droplets: 4, crown: 0.3, pad: 0.24 };
}

export function createWaterSystem({
  scene,
  width = 90,
  length = 120,
  segmentsX = 128,
  segmentsZ = 192,
  y = 0,
  maxDroplets = DEFAULT_DROPLETS,
  maxCrowns = DEFAULT_CROWNS,
  colors = {},
} = {}) {
  if (!scene) throw new Error("createWaterSystem requires a THREE.Scene");

  const impulse = Array.from(
    { length: MAX_IMPULSES },
    () => new THREE.Vector4(9999, 9999, -9999, 0),
  );
  const impulseShape = Array.from(
    { length: MAX_IMPULSES },
    () => new THREE.Vector4(0.12, 1.6, 10, 1.1),
  );
  const impulseDirection = Array.from(
    { length: MAX_IMPULSES },
    () => new THREE.Vector4(0, -1, 0, 0),
  );
  const reflectedPad = Array.from(
    { length: MAX_REFLECTED_PADS },
    () => new THREE.Vector4(9999, 9999, 1, 0),
  );
  const uniforms = {
    uTime: { value: 0 },
    uImpulse: { value: impulse },
    uImpulseShape: { value: impulseShape },
    uImpulseDirection: { value: impulseDirection },
    uReflectedPad: { value: reflectedPad },
    uDeepColor: { value: new THREE.Color(colors.deep ?? 0x102f33) },
    uShallowColor: { value: new THREE.Color(colors.shallow ?? 0x285f61) },
    uHorizonColor: { value: new THREE.Color(colors.horizon ?? 0x78958b) },
    uZenithColor: { value: new THREE.Color(colors.zenith ?? 0xb8c7b9) },
    uSunDirection: { value: new THREE.Vector3(-0.38, 0.82, -0.42).normalize() },
    uSunColor: { value: new THREE.Color(colors.sun ?? 0xffd99b) },
    uOpacity: { value: 1 },
    fogColor: { value: new THREE.Color(colors.fog ?? 0x98afa3) },
    fogDensity: { value: 0.023 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: false,
    fog: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    extensions: { derivatives: true },
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length, segmentsX, segmentsZ),
    material,
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  mesh.name = "MistwaterLake";
  scene.add(mesh);

  // One draw for every active droplet. Inactive instances have zero scale.
  const dropletGeometry = new THREE.ConeGeometry(0.024, 0.13, 5, 1, false);
  dropletGeometry.translate(0, 0.035, 0);
  const dropletMaterial = new THREE.MeshStandardMaterial({
    color: 0x4f8982,
    emissive: 0x071815,
    roughness: 0.24,
    metalness: 0.0,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    fog: true,
  });
  const droplets = new THREE.InstancedMesh(
    dropletGeometry,
    dropletMaterial,
    maxDroplets,
  );
  droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  droplets.frustumCulled = false;
  droplets.name = "PooledWaterDroplets";
  scene.add(droplets);

  // Crowns use a shared open cone wall; scaling produces a brief radial sheet.
  const crownGeometry = new THREE.CylinderGeometry(
    0.58,
    0.18,
    0.24,
    24,
    1,
    true,
  );
  crownGeometry.translate(0, 0.12, 0);
  const crownMaterial = new THREE.MeshStandardMaterial({
    color: 0x5e9f94,
    emissive: 0x061511,
    roughness: 0.3,
    metalness: 0.0,
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: true,
  });
  const crowns = new THREE.InstancedMesh(
    crownGeometry,
    crownMaterial,
    maxCrowns,
  );
  crowns.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  crowns.frustumCulled = false;
  crowns.name = "PooledSplashCrowns";
  scene.add(crowns);

  const dropletPosition = Array.from(
    { length: maxDroplets },
    () => new THREE.Vector3(),
  );
  const dropletVelocity = Array.from(
    { length: maxDroplets },
    () => new THREE.Vector3(),
  );
  const dropletLife = new Float32Array(maxDroplets);
  const dropletLifetime = new Float32Array(maxDroplets);
  const crownPosition = Array.from(
    { length: maxCrowns },
    () => new THREE.Vector3(),
  );
  const crownLife = new Float32Array(maxCrowns);
  const crownLifetime = new Float32Array(maxCrowns);
  const crownStrength = new Float32Array(maxCrowns);
  const pads = [];
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const direction = new THREE.Vector2();
  const particleDirection = new THREE.Vector3();
  const particleQuaternion = new THREE.Quaternion();
  let impulseCursor = 0;
  let dropletCursor = 0;
  let crownCursor = 0;
  let time = 0;
  let seed = 0x7f4a7c15;

  // Deterministic and allocation-free; art remains stable across captures.
  function random() {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  }

  function writeImpulse(
    x,
    z,
    amplitude,
    initialRadius,
    speed,
    frequency,
    decay,
    dirX,
    dirZ,
    wake,
  ) {
    const i = impulseCursor;
    impulse[i].set(x, z, time, amplitude);
    impulseShape[i].set(initialRadius, speed, frequency, decay);
    impulseDirection[i].set(dirX, dirZ, wake, 1);
    impulseCursor = (i + 1) % MAX_IMPULSES;
  }

  function emitDroplets(position, count, strength, dirX, dirZ) {
    for (let n = 0; n < count; n++) {
      const i = dropletCursor;
      const angle = random() * Math.PI * 2;
      const outward = (0.55 + random() * 1.35) * (0.65 + strength * 0.65);
      // Break even spacing with direction bias and independent vertical energy.
      dropletPosition[i].set(
        position.x,
        y + 0.06 + random() * 0.06,
        position.z,
      );
      dropletVelocity[i].set(
        Math.cos(angle) * outward + dirX * strength * 0.42,
        1.25 + random() * (1.45 + strength * 1.25),
        Math.sin(angle) * outward + dirZ * strength * 0.42,
      );
      dropletLife[i] = 0.0001;
      dropletLifetime[i] = 0.55 + random() * 0.55;
      dropletCursor = (i + 1) % maxDroplets;
    }
  }

  function emitCrown(position, strength) {
    const i = crownCursor;
    crownPosition[i].set(position.x, y + 0.012, position.z);
    crownLife[i] = 0.0001;
    crownLifetime[i] = 0.22 + strength * 0.16;
    crownStrength[i] = strength;
    crownCursor = (i + 1) % maxCrowns;
  }

  function emitImpulse({
    position,
    impactSpeed = 0,
    horizontalSpeed = 0,
    heading,
    tier,
  } = {}) {
    if (!position) return;
    const resolvedTier = tier ?? tierFromImpact(impactSpeed, horizontalSpeed);
    const settings = tierSettings(resolvedTier);
    direction.set(heading?.x ?? 0, heading?.z ?? heading?.y ?? -1);
    if (direction.lengthSq() < 0.0001) direction.set(0, -1);
    direction.normalize();

    for (let ring = 0; ring < settings.rings; ring++) {
      writeImpulse(
        position.x,
        position.z,
        settings.amplitude * (1 - ring * 0.16),
        0.1 + ring * 0.13,
        1.45 + ring * 0.38,
        9.5 + ring * 1.2,
        0.82 + ring * 0.18,
        direction.x,
        direction.y,
        horizontalSpeed > 1.1 && ring === 0
          ? Math.min(1, horizontalSpeed / 6)
          : 0,
      );
    }
    emitDroplets(
      position,
      settings.droplets,
      settings.amplitude,
      direction.x,
      direction.y,
    );
    if (settings.crown >= 0.5) emitCrown(position, settings.crown);
    return resolvedTier;
  }

  function stampWake(position, heading, speed = 0) {
    if (!position || speed < 0.65) return;
    direction.set(heading?.x ?? 0, heading?.z ?? heading?.y ?? -1);
    if (direction.lengthSq() < 0.0001) direction.set(0, -1);
    direction.normalize();
    writeImpulse(
      position.x,
      position.z,
      Math.min(0.7, 0.18 + speed * 0.07),
      0.08,
      1.15,
      9.2,
      1.05,
      direction.x,
      direction.y,
      Math.min(1, speed / 5),
    );
  }

  function registerPad({
    mesh: padMesh,
    radius = 1.2,
    baseY = padMesh?.position.y ?? 0,
  } = {}) {
    if (!padMesh) throw new Error("registerPad requires a mesh or Object3D");
    const state = {
      mesh: padMesh,
      radius,
      baseY,
      baseRotationX: padMesh.rotation.x,
      baseRotationZ: padMesh.rotation.z,
      offset: 0,
      velocity: 0,
      tiltX: 0,
      tiltZ: 0,
      tiltVelocityX: 0,
      tiltVelocityZ: 0,
    };
    pads.push(state);
    const reflectionIndex = pads.length - 1;
    if (reflectionIndex < MAX_REFLECTED_PADS) {
      reflectedPad[reflectionIndex].set(
        padMesh.position.x,
        padMesh.position.z,
        radius,
        1,
      );
    }
    return state;
  }

  function impulsePad(
    pad,
    { position, impactSpeed = 4, horizontalSpeed = 0, heading, tier } = {},
  ) {
    if (!pad || !position) return;
    const resolvedTier = tier ?? tierFromImpact(impactSpeed, horizontalSpeed);
    const strength = tierSettings(resolvedTier).pad;
    pad.velocity -= 2.35 * strength;
    const dx = THREE.MathUtils.clamp(
      (position.x - pad.mesh.position.x) / pad.radius,
      -1,
      1,
    );
    const dz = THREE.MathUtils.clamp(
      (position.z - pad.mesh.position.z) / pad.radius,
      -1,
      1,
    );
    pad.tiltVelocityX += dz * 0.72 * strength;
    pad.tiltVelocityZ -= dx * 0.72 * strength;
    emitImpulse({
      position,
      impactSpeed,
      horizontalSpeed,
      heading,
      tier: resolvedTier,
    });

    // A weaker same-frame pressure transfer gives nearby pads phase-shifted heave.
    for (let i = 0; i < pads.length; i++) {
      const neighbor = pads[i];
      if (neighbor === pad) continue;
      const nx = neighbor.mesh.position.x - position.x;
      const nz = neighbor.mesh.position.z - position.z;
      const distance = Math.hypot(nx, nz);
      if (distance < 3.4)
        neighbor.velocity -= (1 - distance / 3.4) * 0.42 * strength;
    }
    return resolvedTier;
  }

  function updatePads(dt) {
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      // Critically-near damping with one controlled overshoot: settles ~0.7 s.
      pad.velocity += (-42 * pad.offset - 8.6 * pad.velocity) * dt;
      pad.offset += pad.velocity * dt;
      pad.tiltVelocityX += (-34 * pad.tiltX - 8 * pad.tiltVelocityX) * dt;
      pad.tiltVelocityZ += (-34 * pad.tiltZ - 8 * pad.tiltVelocityZ) * dt;
      pad.tiltX += pad.tiltVelocityX * dt;
      pad.tiltZ += pad.tiltVelocityZ * dt;
      pad.mesh.position.y = pad.baseY + pad.offset;
      pad.mesh.rotation.x = pad.baseRotationX + pad.tiltX;
      pad.mesh.rotation.z = pad.baseRotationZ + pad.tiltZ;
      if (i < MAX_REFLECTED_PADS) {
        reflectedPad[i].x = pad.mesh.position.x;
        reflectedPad[i].y = pad.mesh.position.z;
      }
    }
  }

  function update(dt, elapsedTime) {
    time = elapsedTime ?? time + dt;
    uniforms.uTime.value = time;
    if (scene.fog?.isFogExp2) {
      uniforms.fogColor.value.copy(scene.fog.color);
      uniforms.fogDensity.value = scene.fog.density;
    }
    updatePads(dt);

    for (let i = 0; i < maxDroplets; i++) {
      const life = dropletLife[i];
      if (life <= 0) {
        scale.setScalar(0);
      } else {
        const nextLife = life + dt;
        dropletLife[i] = nextLife >= dropletLifetime[i] ? 0 : nextLife;
        dropletVelocity[i].y -= 6.8 * dt;
        dropletPosition[i].addScaledVector(dropletVelocity[i], dt);
        const fade = Math.max(0, 1 - nextLife / dropletLifetime[i]);
        scale.setScalar(fade);
      }
      particleQuaternion.identity();
      if (dropletVelocity[i].lengthSq() > 0.001) {
        particleDirection.copy(dropletVelocity[i]).normalize();
        particleQuaternion.setFromUnitVectors(UP, particleDirection);
      }
      matrix.compose(dropletPosition[i], particleQuaternion, scale);
      droplets.setMatrixAt(i, matrix);
    }
    droplets.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < maxCrowns; i++) {
      const life = crownLife[i];
      if (life <= 0) {
        scale.setScalar(0);
      } else {
        const nextLife = life + dt;
        crownLife[i] = nextLife >= crownLifetime[i] ? 0 : nextLife;
        const phase = Math.min(1, nextLife / crownLifetime[i]);
        const fade = 1 - phase;
        scale.set(
          0.55 + phase * 1.55,
          fade * crownStrength[i],
          0.55 + phase * 1.55,
        );
      }
      particleQuaternion.identity();
      matrix.compose(crownPosition[i], particleQuaternion, scale);
      crowns.setMatrixAt(i, matrix);
    }
    crowns.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    scene.remove(mesh, droplets, crowns);
    mesh.geometry.dispose();
    material.dispose();
    dropletGeometry.dispose();
    dropletMaterial.dispose();
    crownGeometry.dispose();
    crownMaterial.dispose();
  }

  return {
    mesh,
    material,
    uniforms,
    update,
    emitImpulse,
    stampWake,
    registerPad,
    impulsePad,
    classifyTier: tierFromImpact,
    dispose,
    stats: { maxImpulses: MAX_IMPULSES, maxDroplets, maxCrowns, drawCalls: 3 },
  };
}

export { tierFromImpact as classifyWaterImpact };
