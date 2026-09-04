import * as THREE from "three";

const MAX_IMPULSES = 24;
// Keep locomotion wakes from erasing the landing history. The shader/uniform
// budget stays fixed; these are simply two independently recycled lanes.
const IMPACT_IMPULSES = 16;
const WAKE_IMPULSES = MAX_IMPULSES - IMPACT_IMPULSES;
const MAX_REFLECTED_PADS = 16;
const MAX_SCENE_FEATURES = 24;
const MAX_SHORE_PRIMITIVES = 24;
const DEFAULT_DROPLETS = 160;
const DEFAULT_CROWNS = 16;
const DEFAULT_VISIBLE_RINGS = 48;
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
    float alive = step(0.0, age) * step(age, 5.6) * direction.w;
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
uniform vec4 uHeroReflection; // x, z, yaw, enabled
uniform vec4 uSceneFeature[24]; // x, z, radius, class: bank=1 vegetation=2 lantern=3 karst=4
uniform vec4 uShorePrimitive[24]; // centre xz, ellipse radii
uniform vec4 uShoreMeta[24]; // cos(yaw), sin(yaw), role wet=1 toe=2 reed=3, enabled
uniform float uShoreDebug; // 0 beauty, 1 union, 2 wet toe, 3 submerged, 4 foam
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

vec4 reflectedWetland(vec3 origin, vec3 ray) {
  // The playable corridor is enclosed by authored banks and reed/bamboo
  // clusters. Project those scene classes through the reflected ray so their
  // image length changes with camera and surface normal instead of behaving
  // like a screen-space tint.
  float depth = clamp((-ray.y) * 19.0 + 7.0, 3.0, 24.0);
  vec2 hit = origin.xz + ray.xz * depth;
  float leftEdge = -8.0 - sin(hit.y * .19) * 1.15 - sin(hit.y * .47) * .42;
  float rightEdge = 8.5 + sin(hit.y * .16 + 1.7) * 1.20;
  float leftBank = 1.0 - smoothstep(.05, 1.25, hit.x - leftEdge);
  float rightBank = 1.0 - smoothstep(.05, 1.25, rightEdge - hit.x);
  float bank = max(leftBank, rightBank);

  // Vertical reed strokes grow only from the two bank bands. Independent
  // frequencies stop the reflection becoming a barcode or a solid wall.
  float edgeDistance = min(abs(hit.x - leftEdge), abs(hit.x - rightEdge));
  float rooted = 1.0 - smoothstep(.15, 2.05, edgeDistance);
  float reeds = pow(.5 + .5 * sin(hit.x * 5.7 + hit.y * 1.31), 7.0);
  reeds *= .45 + .55 * pow(.5 + .5 * sin(hit.x * 2.11 - hit.y * 2.73), 3.0);
  float normalBreak = smoothstep(.20, .79, .5 + .5 * sin(
    hit.y * 3.7 + origin.x * 1.9 + ray.x * 27.0));
  float reedMask = rooted * reeds * normalBreak;
  float mask = clamp(bank * .56 + reedMask * .72, 0.0, .82);
  vec3 mudMoss = mix(vec3(.105, .115, .072), vec3(.075, .205, .125),
    clamp(reedMask * 1.25 + .18, 0.0, 1.0));
  return vec4(mudMoss, mask);
}

float bankDistance(vec2 p) {
  // Broad authored shore phrases, used only for reflected/turbid edge response.
  float left = p.x + 8.2 + sin(p.y * .18) * 1.25 + sin(p.y * .47) * .45;
  float right = 8.7 - p.x + sin(p.y * .15 + 1.7) * 1.35;
  float shrine = length((p - vec2(.3, -45.0)) * vec2(.58, 1.0)) - 5.4;
  return min(min(left, right), shrine);
}

vec3 shoreField(vec2 p) {
  float authoredDistance = 9999.0;
  float role = 0.0;
  float enabled = 0.0;
  for (int i = 0; i < 24; i++) {
    vec4 primitive = uShorePrimitive[i];
    vec4 meta = uShoreMeta[i];
    vec2 delta = p - primitive.xy;
    vec2 local = vec2(
      delta.x * meta.x + delta.y * meta.y,
      -delta.x * meta.y + delta.y * meta.x
    );
    vec2 radii = max(primitive.zw, vec2(.08));
    vec2 normalizedLocal = local / radii;
    float angle = atan(normalizedLocal.y, normalizedLocal.x);
    // Preserve the cheap analytic footprint while breaking its unmistakable
    // ellipse silhouette. Phase is derived from the registered world centre so
    // neighbouring lobes do not repeat and the contour stays camera-stable.
    float phase = primitive.x * 1.73 + primitive.y * .91 + meta.z * 2.17;
    float contour = 1.0
      + sin(angle * 3.0 + phase) * .105
      + sin(angle * 5.0 - phase * .73) * .052
      + sin(angle * 8.0 + phase * 1.31) * .026;
    float ellipse = (length(normalizedLocal) - contour) * min(radii.x, radii.y);
    if (meta.w > .5 && ellipse < authoredDistance) {
      authoredDistance = ellipse;
      role = meta.z;
      enabled = 1.0;
    }
  }
  float fallback = bankDistance(p);
  return vec3(enabled > .5 ? authoredDistance : fallback, role, enabled);
}

vec3 sceneCoupledReflection(vec2 surfacePoint, vec3 normal, out float coverage) {
  // Normal-driven parallax is shared by every proxy class. Silhouettes shear
  // and fragment with the exact broad + capillary normal used for specular.
  vec2 p = surfacePoint + normal.xz * vec2(3.8, 7.2);
  vec3 reflected = vec3(0.0);
  coverage = 0.0;

  // Lotus mirrors are ray-stretched notched leaves, not painted ovals. The
  // shared normal field breaks their rims into coherent moving fragments.
  for (int i = 0; i < 16; i++) {
    vec4 pad = uReflectedPad[i];
    vec2 viewAxis = normalize(cameraPosition.xz - pad.xy + vec2(.001));
    vec2 sideAxis = vec2(-viewAxis.y, viewAxis.x);
    vec2 d = p - (pad.xy + viewAxis * pad.z * .72);
    vec2 leaf = vec2(dot(d, sideAxis), dot(d, viewAxis));
    float ellipse = length(vec2(leaf.x / max(.1, pad.z * 1.02),
                                leaf.y / max(.1, pad.z * 1.92)));
    float notch = smoothstep(.08, .34, abs(leaf.x) / max(.1, pad.z))
      + smoothstep(.04, .42, -leaf.y / max(.1, pad.z));
    float mask = pad.w * (1.0 - smoothstep(.76, 1.08, ellipse))
      * clamp(notch, 0.0, 1.0);
    float normalBreak = smoothstep(.18, .76, .5 + .5 * sin(
      leaf.y * 5.1 + leaf.x * 2.2 + normal.x * 17.0 + normal.z * 11.0));
    mask *= mix(.38, 1.0, normalBreak);
    float rim = 1.0 - smoothstep(.035, .20, abs(ellipse - .86));
    float alpha = mask * (.27 + rim * .13);
    reflected = mix(reflected, vec3(.075, .20, .105), alpha);
    coverage = max(coverage, alpha);
  }

  // Live guardian reflection. Heading controls the shoulder/tail silhouette;
  // camera alignment controls its reflected reach, while water normals break
  // the body into bands. This follows the actor instead of guessing a pad.
  vec2 heroForward = vec2(sin(uHeroReflection.z), cos(uHeroReflection.z));
  vec2 heroSide = vec2(heroForward.y, -heroForward.x);
  vec2 heroView = normalize(cameraPosition.xz - uHeroReflection.xy + vec2(.001));
  // The hero uses restrained distortion: the larger pad parallax made its
  // compact body occasionally jump into a foreground-sized red band.
  vec2 heroPoint = surfacePoint + normal.xz * vec2(1.35, 2.15);
  vec2 hd = heroPoint - (uHeroReflection.xy + heroView * .88);
  vec2 h = vec2(dot(hd, heroSide), dot(hd, heroView));
  float torso = 1.0 - smoothstep(.72, 1.04,
    length(vec2(h.x / .58, (h.y - .55) / 1.72)));
  vec2 tailCentre = vec2(dot(heroForward * -.62, heroSide),
                         dot(heroForward * -.62, heroView) + .42);
  float tail = 1.0 - smoothstep(.17, .34,
    abs(length(h - tailCentre) - .48));
  float legs = (1.0 - smoothstep(.13, .27, abs(h.x - .27)))
    * smoothstep(-.12, .18, h.y) * (1.0 - smoothstep(.58, .96, h.y));
  legs = max(legs, (1.0 - smoothstep(.13, .27, abs(h.x + .27)))
    * smoothstep(-.12, .18, h.y) * (1.0 - smoothstep(.58, .96, h.y)));
  float waterBreak = smoothstep(.20, .78, .5 + .5 * sin(
    h.y * 8.7 + h.x * 3.2 + normal.x * 21.0 + normal.z * 13.0));
  float heroMask = uHeroReflection.w * max(max(torso, tail * .72), legs * .8)
    * mix(.28, 1.0, waterBreak);
  reflected = mix(reflected, vec3(.42, .060, .024), heroMask * .48);
  coverage = max(coverage, heroMask * .48);

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

vec4 reflectedSceneFeatures(vec2 surfacePoint, vec3 normal) {
  vec3 color = vec3(0.0);
  float coverage = 0.0;
  for (int i = 0; i < 24; i++) {
    vec4 feature = uSceneFeature[i];
    float enabled = step(.5, feature.w);
    vec2 towardCamera = normalize(cameraPosition.xz - feature.xy + vec2(.001));
    vec2 side = vec2(-towardCamera.y, towardCamera.x);
    // The same animated normal that lights the lake offsets every registered
    // silhouette. This makes the image shear into water-borne fragments rather
    // than sitting on the surface as a decal.
    vec2 q = surfacePoint + normal.xz * vec2(4.8, 8.6);
    vec2 d = q - feature.xy;
    float along = dot(d, towardCamera);
    float across = dot(d, side);
    float radius = max(.35, feature.z);
    float klass = feature.w;
    float isBank = 1.0 - step(1.5, klass);
    float isVegetation = step(1.5, klass) * (1.0 - step(2.5, klass));
    float isLantern = step(2.5, klass) * (1.0 - step(3.5, klass));
    float isKarst = step(3.5, klass);
    float reach = radius * (1.25 + isVegetation * 1.35 + isKarst * 1.9);
    float lengthMask = smoothstep(-.12 * radius, .18 * radius, along)
      * (1.0 - smoothstep(reach * .72, reach, along));
    float width = radius * mix(.92, .34, isVegetation + isLantern);
    float widthMask = 1.0 - smoothstep(width * .45, width, abs(across));
    float verticalStrands = smoothstep(.18, .82, .5 + .5 * sin(
      across * mix(2.2, 8.7, isVegetation) + along * 2.9 + float(i) * 1.71));
    float waveBreak = smoothstep(.15, .78, .5 + .5 * sin(
      along * 5.1 + across * 2.4 + normal.x * 31.0 + normal.z * 23.0));
    float mask = enabled * lengthMask * widthMask
      * mix(.36, 1.0, waveBreak) * mix(1.0, verticalStrands, isVegetation);
    vec3 bankColor = mix(vec3(.055, .105, .075), vec3(.11, .19, .105), verticalStrands);
    vec3 featureColor = mix(bankColor, vec3(.045, .145, .075), isVegetation);
    featureColor = mix(featureColor, vec3(1.0, .43, .075), isLantern);
    featureColor = mix(featureColor, vec3(.055, .105, .105), isKarst);
    float alpha = mask * (.42 + isVegetation * .18 + isLantern * .48 + isKarst * .16);
    color = mix(color, featureColor, alpha);
    coverage = max(coverage, alpha);
  }
  return vec4(color, coverage);
}

vec2 padWaterlineCoupling(vec2 surfacePoint) {
  float wetSkirt = 0.0;
  float stirredSilt = 0.0;
  for (int i = 0; i < 16; i++) {
    vec4 pad = uReflectedPad[i];
    vec2 d = surfacePoint - pad.xy;
    // Match the traversal leaf's broad x / shallow z footprint. The dark inner
    // skirt grounds the leaf; the wider asymmetric silt halo connects it to the
    // moving lake instead of leaving a clean card edge over flat water.
    float ellipse = length(vec2(d.x / max(.1, pad.z * 1.08),
                                d.y / max(.1, pad.z * .73)));
    float inner = smoothstep(.78, .94, ellipse);
    float outer = 1.0 - smoothstep(.96, 1.20, ellipse);
    wetSkirt = max(wetSkirt, pad.w * inner * outer);
    float downstream = smoothstep(-.35, .65, d.y / max(.1, pad.z));
    float halo = smoothstep(.94, 1.08, ellipse)
      * (1.0 - smoothstep(1.08, 1.62, ellipse));
    stirredSilt = max(stirredSilt, pad.w * halo * mix(.45, 1.0, downstream));
  }
  return vec2(wetSkirt, stirredSilt);
}

vec4 fragmentContact(vec2 p) {
  float ridge = 0.0;
  float cavity = 0.0;
  float wakeCrest = 0.0;
  float wakeTrough = 0.0;
  for (int i = 0; i < MAX_IMPULSES; i++) {
    vec4 impulse = uImpulse[i];
    vec4 shape = uImpulseShape[i];
    vec4 direction = uImpulseDirection[i];
    float age = uTime - impulse.z;
    float alive = step(0.0, age) * step(age, 5.6) * direction.w;
    float distanceToContact = length(p - impulse.xy);
    float radius = shape.x + age * shape.y;
    // The chase camera compresses the lake into a shallow screen-space wedge.
    // A physically tiny ridge disappeared entirely at normal framing, so the
    // readable event uses a broad trough/crest pair while retaining a broken rim.
    float width = .14 + age * .030;
    float ring = exp(-pow((distanceToContact - radius) / width, 2.0));
    vec2 radial = p - impulse.xy;
    float angle = atan(radial.y, radial.x);
    // Real landing rings are interrupted by capillary chop and leaf wakes.
    // Give each contact a stable but different broken rim instead of summing
    // perfect neon circles into a moire target.
    float broken = smoothstep(.12, .82, .5 + .5 * sin(
      angle * (7.0 + mod(float(i), 5.0))
      + distanceToContact * 1.65 + impulse.x * .71 + impulse.y * .37));
    broken = mix(.26, 1.0, broken);
    float memory = exp(-age * .62);
    ridge += alive * impulse.w * ring * memory * broken;
    cavity += alive * impulse.w
      * exp(-distanceToContact * distanceToContact / (.18 + age * 1.15))
      * exp(-age * .72);

    // Preserve heading at fragment resolution. The displaced mesh alone cannot
    // carry a narrow V through the chase camera's foreshortening, so two broad,
    // broken pressure arms get their own dark/bright pair. They widen from the
    // recorded contact and decay more slowly than the crown, making direction
    // and prior-origin memory readable without becoming a painted arrow.
    vec2 dir = normalize(direction.xy + vec2(.0001));
    float forward = dot(radial, dir);
    float side = abs(radial.x * dir.y - radial.y * dir.x);
    float wakeLength = 1.85 + age * .16;
    float arm = abs(side - max(forward, 0.0) * .38);
    float armWidth = .12 + age * .025;
    float envelope = smoothstep(-.18, .10, forward)
      * (1.0 - smoothstep(wakeLength * .72, wakeLength, forward));
    float vWake = exp(-arm * arm / max(.008, armWidth * armWidth)) * envelope;
    float brokenWake = mix(.38, 1.0, smoothstep(.18, .82,
      .5 + .5 * sin(forward * 5.3 + side * 8.1 + impulse.x * 1.7)));
    float wakeMemory = exp(-age * .68) * direction.z;
    wakeCrest += alive * impulse.w * vWake * brokenWake * wakeMemory;
    float troughArm = abs(side - max(forward, 0.0) * .38 - .16);
    wakeTrough += alive * impulse.w
      * exp(-troughArm * troughArm / max(.012, armWidth * armWidth * 1.8))
      * envelope * wakeMemory;
  }
  return vec4(ridge, cavity, wakeCrest, wakeTrough);
}

vec2 interactionReflectionWarp(vec2 p) {
  vec2 warp = vec2(0.0);
  for (int i = 0; i < MAX_IMPULSES; i++) {
    vec4 impulse = uImpulse[i];
    vec4 direction = uImpulseDirection[i];
    float age = uTime - impulse.z;
    float alive = step(0.0, age) * step(age, 3.6) * direction.w;
    vec2 delta = p - impulse.xy;
    float local = exp(-dot(delta, delta) / (1.05 + age * 1.35));
    vec2 radial = normalize(delta + vec2(.001));
    vec2 travel = normalize(direction.xy + vec2(.001));
    // Radial displacement parts the reflected actor/pad silhouette around the
    // crown; heading adds a smaller downstream shear that visibly ties it to
    // the V wake rather than merely tinting the water beneath it.
    warp += alive * impulse.w * local * exp(-age * .48)
      * (radial * .72 + travel * direction.z * .46);
  }
  return clamp(warp, vec2(-1.15), vec2(1.15));
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
  vec4 wetlandReflection = reflectedWetland(vWorldPosition, reflectedRay);
  vec4 featureReflection = reflectedSceneFeatures(vWorldPosition.xz, N);
  reflectedSky = mix(reflectedSky, karstReflection.rgb, karstReflection.a * 1.16);
  reflectedSky = mix(reflectedSky, wetlandReflection.rgb,
    wetlandReflection.a * (.76 + fresnel * .38));
  reflectedSky = mix(reflectedSky, gateReflection.rgb, gateReflection.a * 1.12);
  reflectedSky = mix(reflectedSky, featureReflection.rgb,
    min(1.0, featureReflection.a * (1.05 + fresnel * .25)));
  float objectCoverage;
  vec2 reflectionWarp = interactionReflectionWarp(vWorldPosition.xz);
  vec3 objectReflection = sceneCoupledReflection(
    vWorldPosition.xz + reflectionWarp, N, objectCoverage);
  reflectedSky = mix(reflectedSky, objectReflection, min(1.0, objectCoverage * 1.28));
  vec2 padCoupling = padWaterlineCoupling(vWorldPosition.xz);

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
  vec3 shoreData = shoreField(vWorldPosition.xz);
  float shore = shoreData.x;
  float fallbackShallows = 1.0 - smoothstep(-.4, 2.5, shore);
  float authoredShallows = 1.0 - smoothstep(.08, 1.18, abs(shore));
  float shallows = mix(fallbackShallows, authoredShallows, shoreData.z);
  vec3 body = mix(uDeepColor, uShallowColor,
    .19 + depthNoise * .12 + shallows * .31);
  // A submerged continuation of the banks: normal-offset silt/stone mottling
  // shows through at steep view angles and vanishes into deeper route water.
  vec2 refractedPoint = vWorldPosition.xz - N.xz * (1.15 + (1.0 - NdotV) * 1.7);
  float submergedNoise = .5 + .5 * sin(refractedPoint.x * 1.47
    + sin(refractedPoint.y * .83) * 1.3);
  submergedNoise *= .58 + .42 * (.5 + .5 * sin(
    refractedPoint.y * 2.31 - refractedPoint.x * .63));
  vec3 submerged = mix(vec3(.115, .135, .082), vec3(.26, .285, .155),
    submergedNoise);
  body = mix(body, submerged, shallows * (.16 + NdotV * .18));
  // Placement-driven bank anatomy. The edge is deliberately broken so this
  // reads as wet silt, submerged roots and trapped flecks rather than a white
  // outline. All sampling is in world space, so it cannot swim with camera.
  float wetToe = shoreData.z * (1.0 - smoothstep(-.28, .32, abs(shore)));
  float outerToe = shoreData.z * smoothstep(-.08, .18, shore)
    * (1.0 - smoothstep(.18, 1.15, shore));
  float shoreBreak = .5 + .5 * sin(vWorldPosition.x * 3.71
    + vWorldPosition.z * 2.17 + sin(vWorldPosition.z * 1.31) * 2.2);
  shoreBreak *= .55 + .45 * (.5 + .5 * sin(
    vWorldPosition.x * 7.13 - vWorldPosition.z * 4.27 + uTime * .24));
  float reedBias = step(2.5, shoreData.y);
  body = mix(body, vec3(.075, .105, .064), wetToe * (.24 - reedBias * .07));
  body = mix(body, vec3(.17, .205, .105), outerToe * (.08 + NdotV * .10));
  float foamFleck = outerToe * smoothstep(.76, .93, shoreBreak)
    * smoothstep(.18, .7, abs(N.x) + abs(N.z));
  body += vec3(.44, .52, .35) * foamFleck * .055;
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

  color *= 1.0 - padCoupling.x * .38;
  color = mix(color, vec3(.22, .30, .20), padCoupling.y * .24);
  color += uShallowColor * padCoupling.y * .055;
  color += uSunColor * (broadSpecular * .13 + glint * .34);
  color += uShallowColor * shallows * .08;
  color += uHorizonColor * smoothstep(.16, .92, vInteraction) * .11;

  // Interaction is vertex-evaluated, so a narrow/high-contrast threshold exposes
  // the water grid again. Keep shader foam broad and subtle; pooled crowns and
  // droplets carry the crisp contact read without turning a triangle white.
  vec4 fragmentHistory = fragmentContact(vWorldPosition.xz);
  float contact = smoothstep(.035, .34, fragmentHistory.x);
  float cavity = smoothstep(.045, .46, fragmentHistory.y);
  // Alternating luminance is essential: rings survive grayscale while remaining
  // green-water phenomena, not white decals.
  color *= 1.0 - cavity * .30;
  // A dark outer trough plus restrained pale crest survives downsampling and
  // grayscale without reading as a pasted white decal.
  float trough = smoothstep(.018, .16, fragmentHistory.x)
    * (1.0 - smoothstep(.38, .88, fragmentHistory.x));
  color *= 1.0 - trough * .34;
  // Let the ring alter the reflected image as well as its colour: a dark
  // underside, bright broken crest and offset secondary lip form a small
  // displaced-water event that remains legible after 25% grayscale reduction.
  float crestBreak = .66 + .34 * smoothstep(.18, .82, .5 + .5 * sin(
    atan(vWorldPosition.z, vWorldPosition.x) * 11.0
    + vWorldPosition.x * 1.7 - vWorldPosition.z * 1.1));
  float crest = contact * crestBreak;
  color *= 1.0 - cavity * .08 - trough * .10;
  color = mix(color, vec3(.46, .69, .62), crest * .43);
  color += vec3(.16, .27, .23) * crest * .12;
  float wakeDark = smoothstep(.025, .34, fragmentHistory.w);
  float wakeBright = smoothstep(.035, .38, fragmentHistory.z);
  color *= 1.0 - wakeDark * .26;
  color = mix(color, vec3(.39, .63, .57), wakeBright * .36);
  // Deterministic audit planes. Capture scripts can pause the simulation once,
  // switch this uniform, and take all four masks from the identical camera/tick.
  // Black is absence; saturated colours are deliberately independent of scene
  // lighting, fog and grading so exact pixel measurements remain possible.
  if (uShoreDebug > .5) {
    float unionMask = shoreData.z * (1.0 - smoothstep(1.18, 1.36, abs(shore)));
    float debugMask = unionMask;
    vec3 debugColor = vec3(1.0);
    if (uShoreDebug > 1.5 && uShoreDebug < 2.5) {
      debugMask = wetToe;
      debugColor = vec3(0.0, 1.0, 1.0);
    } else if (uShoreDebug > 2.5 && uShoreDebug < 3.5) {
      debugMask = shoreData.z * (1.0 - smoothstep(.02, .18, shore))
        * (1.0 - smoothstep(.02, 1.18, -shore));
      debugColor = vec3(.15, .55, 1.0);
    } else if (uShoreDebug > 3.5) {
      debugMask = foamFleck;
      debugColor = vec3(1.0, .15, .05);
    }
    gl_FragColor = vec4(debugColor * step(.035, debugMask), 1.0);
    return;
  }
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
    return { amplitude: 0.72, rings: 3, droplets: 17, crown: 0.78, pad: 0.58 };
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
  maxVisibleRings = DEFAULT_VISIBLE_RINGS,
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
  const heroReflection = new THREE.Vector4(9999, 9999, 0, 0);
  const sceneFeature = Array.from(
    { length: MAX_SCENE_FEATURES },
    () => new THREE.Vector4(9999, 9999, 1, 0),
  );
  const shorePrimitive = Array.from(
    { length: MAX_SHORE_PRIMITIVES },
    () => new THREE.Vector4(9999, 9999, 1, 1),
  );
  const shoreMeta = Array.from(
    { length: MAX_SHORE_PRIMITIVES },
    () => new THREE.Vector4(1, 0, 0, 0),
  );
  const uniforms = {
    uTime: { value: 0 },
    uImpulse: { value: impulse },
    uImpulseShape: { value: impulseShape },
    uImpulseDirection: { value: impulseDirection },
    uReflectedPad: { value: reflectedPad },
    uHeroReflection: { value: heroReflection },
    uSceneFeature: { value: sceneFeature },
    uShorePrimitive: { value: shorePrimitive },
    uShoreMeta: { value: shoreMeta },
    uShoreDebug: { value: 0 },
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
    0.46,
    0.22,
    0.24,
    20,
    1,
    true,
  );
  crownGeometry.translate(0, 0.12, 0);
  // Break the lathed silhouette into an authored impact rim. The alternating
  // lip heights catch light as distinct splash tongues while retaining one
  // pooled instanced draw and the same collision-free footprint.
  const crownPositions = crownGeometry.attributes.position;
  for (let i = 0; i < crownPositions.count; i++) {
    const px = crownPositions.getX(i);
    const py = crownPositions.getY(i);
    const pz = crownPositions.getZ(i);
    if (py < 0.18) continue;
    const angle = Math.atan2(pz, px);
    // Keep the plan-view rim mostly circular and put the irregularity into
    // vertical tongues. The former .76–1.0 radial modulation projected as a
    // bright twelve-point star whenever the chase camera looked down.
    const tongue = 0.5 + 0.5 * Math.cos(angle * 10 + 0.35);
    const radial = 0.92 + 0.08 * tongue;
    crownPositions.setXYZ(
      i,
      px * radial,
      py + 0.11 * tongue * tongue,
      pz * radial,
    );
  }
  crownPositions.needsUpdate = true;
  crownGeometry.computeVertexNormals();
  const crownMaterial = new THREE.MeshStandardMaterial({
    color: 0x477b74,
    emissive: 0x061511,
    roughness: 0.3,
    metalness: 0.0,
    transparent: true,
    opacity: 0.64,
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

  // A pooled, grazing-angle ring layer carries impact history at ordinary
  // chase-camera scale. Shader displacement remains the physical response;
  // these thin broken rims supply the missing value contrast in grayscale.
  const ringGeometry = new THREE.TorusGeometry(1, 0.010, 4, 40);
  ringGeometry.rotateX(Math.PI / 2);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x628f86,
    emissive: 0x061411,
    emissiveIntensity: 0.18,
    roughness: 0.48,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    fog: true,
  });
  const visibleRings = new THREE.InstancedMesh(
    ringGeometry,
    ringMaterial,
    maxVisibleRings,
  );
  visibleRings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  visibleRings.frustumCulled = false;
  visibleRings.name = "PooledLandingMemoryRings";
  scene.add(visibleRings);

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
  const visibleRingPosition = Array.from(
    { length: maxVisibleRings },
    () => new THREE.Vector3(),
  );
  const visibleRingLife = new Float32Array(maxVisibleRings);
  const visibleRingLifetime = new Float32Array(maxVisibleRings);
  const visibleRingStrength = new Float32Array(maxVisibleRings);
  const visibleRingDelay = new Float32Array(maxVisibleRings);
  const pads = [];
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const direction = new THREE.Vector2();
  const particleDirection = new THREE.Vector3();
  const particleQuaternion = new THREE.Quaternion();
  let impactCursor = 0;
  let wakeCursor = 0;
  let dropletCursor = 0;
  let crownCursor = 0;
  let visibleRingCursor = 0;
  let time = 0;
  let seed = 0x7f4a7c15;
  let sceneFeatureCount = 0;
  let shorePrimitiveCount = 0;

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
    birthOffset = 0,
    channel = "impact",
  ) {
    const i = channel === "wake"
      ? IMPACT_IMPULSES + wakeCursor
      : impactCursor;
    impulse[i].set(x, z, time + birthOffset, amplitude);
    impulseShape[i].set(initialRadius, speed, frequency, decay);
    impulseDirection[i].set(dirX, dirZ, wake, 1);
    if (channel === "wake") {
      wakeCursor = (wakeCursor + 1) % WAKE_IMPULSES;
    } else {
      impactCursor = (impactCursor + 1) % IMPACT_IMPULSES;
    }
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
    crownLifetime[i] = 1.05 + strength * 0.48;
    crownStrength[i] = strength;
    crownCursor = (i + 1) % maxCrowns;
  }

  function emitVisibleRings(position, strength, count) {
    for (let n = 0; n < count; n++) {
      const i = visibleRingCursor;
      const angle = n * 2.17 + random() * 0.32;
      const offset = n === 0 ? 0 : 0.16 + n * 0.09;
      visibleRingPosition[i].set(
        position.x + Math.cos(angle) * offset,
        y + 0.035 + n * 0.002,
        position.z + Math.sin(angle) * offset,
      );
      visibleRingLife[i] = 0.0001;
      visibleRingDelay[i] = n * 0.16;
      visibleRingLifetime[i] = 3.05 + n * 0.42;
      visibleRingStrength[i] = strength * (1 - n * 0.16);
      visibleRingCursor = (i + 1) % maxVisibleRings;
    }
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
      // A landing is not a single mathematical point. Retain a compact history
      // of the leading foot, displaced leaf bowl and trailing foot. Their
      // staggered world-space origins keep two older events visible after the
      // active crown without growing one implausibly large emissive circle.
      const sideX = -direction.y;
      const sideZ = direction.x;
      const along = ring === 0 ? 0 : ring === 1 ? -0.34 : -0.62;
      const across = ring === 0 ? 0 : ring === 1 ? 0.19 : -0.16;
      writeImpulse(
        position.x + direction.x * along + sideX * across,
        position.z + direction.y * along + sideZ * across,
        settings.amplitude * (1 - ring * 0.34),
        0.09 + ring * 0.045,
        0.48 + ring * 0.055,
        10.2 + ring * 1.35,
        1.08 + ring * 0.16,
        direction.x,
        direction.y,
        horizontalSpeed > 1.1 && ring === 0
          ? Math.min(1, horizontalSpeed / 6)
          : 0,
        ring === 0 ? 0 : ring === 1 ? 0.11 : 0.24,
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
    emitVisibleRings(position, settings.amplitude, settings.rings);
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
      0,
      "wake",
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
          0.58 + phase * 1.82,
          Math.pow(fade, 0.72) * crownStrength[i] * 1.12,
          0.58 + phase * 1.82,
        );
      }
      particleQuaternion.identity();
      matrix.compose(crownPosition[i], particleQuaternion, scale);
      crowns.setMatrixAt(i, matrix);
    }
    crowns.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < maxVisibleRings; i++) {
      const life = visibleRingLife[i];
      scale.setScalar(0);
      if (life > 0) {
        const nextLife = life + dt;
        visibleRingLife[i] = nextLife >= visibleRingLifetime[i] ? 0 : nextLife;
        const age = Math.max(0, nextLife - visibleRingDelay[i]);
        if (nextLife >= visibleRingDelay[i]) {
          const phase = Math.min(1, age / Math.max(0.1,
            visibleRingLifetime[i] - visibleRingDelay[i]));
          const radius = 0.16 + age * (0.38 + i % 3 * 0.035);
          const fade = Math.pow(1 - phase, 0.58) * visibleRingStrength[i];
          // Slightly elliptical, independently rotated rings avoid a graphic
          // target symbol while remaining readable after 25% downsampling.
          scale.set(radius, Math.max(0.28, fade * 0.72),
            radius * (0.88 + (i % 5) * 0.025));
        }
      }
      particleQuaternion.setFromAxisAngle(UP, (i * 2.399963) % Math.PI);
      matrix.compose(visibleRingPosition[i], particleQuaternion, scale);
      visibleRings.setMatrixAt(i, matrix);
    }
    visibleRings.instanceMatrix.needsUpdate = true;
  }

  function setHeroReflection(position, yaw = 0, enabled = true) {
    if (!position) {
      heroReflection.w = 0;
      return;
    }
    heroReflection.set(position.x, position.z, yaw, enabled ? 1 : 0);
  }

  function registerSceneFeature({ position, radius = 1, type = "bank" } = {}) {
    if (!position || sceneFeatureCount >= MAX_SCENE_FEATURES) return false;
    const classes = { bank: 1, vegetation: 2, lantern: 3, karst: 4 };
    const klass = classes[type] ?? classes.bank;
    sceneFeature[sceneFeatureCount].set(position.x, position.z, radius, klass);
    sceneFeatureCount += 1;
    return true;
  }

  function registerShorePrimitive({ center, radii, yaw = 0, role = "toe" } = {}) {
    if (!center || !radii || shorePrimitiveCount >= MAX_SHORE_PRIMITIVES) return false;
    const roles = { wet: 1, toe: 2, reed: 3 };
    shorePrimitive[shorePrimitiveCount].set(center.x, center.z, radii.x, radii.y);
    shoreMeta[shorePrimitiveCount].set(Math.cos(yaw), Math.sin(yaw), roles[role] ?? 2, 1);
    shorePrimitiveCount += 1;
    return true;
  }

  function setShoreDebug(mode = 0) {
    const modes = { beauty: 0, union: 1, wet: 2, submerged: 3, foam: 4 };
    uniforms.uShoreDebug.value = typeof mode === "string" ? (modes[mode] ?? 0) : mode;
  }


  function dispose() {
    scene.remove(mesh, droplets, crowns, visibleRings);
    mesh.geometry.dispose();
    material.dispose();
    dropletGeometry.dispose();
    dropletMaterial.dispose();
    crownGeometry.dispose();
    crownMaterial.dispose();
    ringGeometry.dispose();
    ringMaterial.dispose();
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
    setHeroReflection,
    registerSceneFeature,
    registerShorePrimitive,
    setShoreDebug,
    classifyTier: tierFromImpact,
    dispose,
    stats: { maxImpulses: MAX_IMPULSES, maxDroplets, maxCrowns, drawCalls: 3 },
  };
}

export { tierFromImpact as classifyWaterImpact };
