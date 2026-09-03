/**
 * Allocation-free procedural performance controller for forest_guardian.js.
 *
 * Creation may allocate. beginJump(), land(), update(), and takeEvents() do not.
 * All angles are radians. The controller preserves every joint's authored bind
 * rotation and layers animation offsets over it.
 */

export const GUARDIAN_ANIM_EVENT = Object.freeze({
  NONE: 0,
  LAUNCH: 1,
  APEX: 2,
  LAND_RECOVERED: 4,
});

export const GUARDIAN_ANIM_STATE = Object.freeze({
  IDLE: 0,
  RUN: 1,
  ANTICIPATION: 2,
  RISE: 3,
  APEX: 4,
  FALL: 5,
  DOUBLE_ANTICIPATION: 6,
  LAND_NORMAL: 7,
  LAND_HARD: 8,
});

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const damp = (from, to, rate, dt) =>
  from + (to - from) * (1 - Math.exp(-rate * dt));
const smooth01 = (v) => {
  const x = clamp(v, 0, 1);
  return x * x * (3 - 2 * x);
};

export function createGuardianAnimation(joints) {
  const names = [
    "root",
    "spine",
    "head",
    "leftShoulder",
    "leftElbow",
    "leftWrist",
    "rightShoulder",
    "rightElbow",
    "rightWrist",
    "leftHip",
    "leftKnee",
    "leftAnkle",
    "rightHip",
    "rightKnee",
    "rightAnkle",
    "tail0",
    "tail1",
    "tail2",
  ];
  const nodes = new Array(names.length);
  const bindX = new Float32Array(names.length);
  const bindY = new Float32Array(names.length);
  const bindZ = new Float32Array(names.length);
  for (let i = 0; i < names.length; i++) {
    const node = joints[names[i]] || null;
    nodes[i] = node;
    if (node) {
      bindX[i] = node.rotation.x;
      bindY[i] = node.rotation.y;
      bindZ[i] = node.rotation.z;
    }
  }

  let state = GUARDIAN_ANIM_STATE.IDLE;
  let stateTime = 0;
  let gaitPhase = 0;
  let events = 0;
  let landingWeight = 0;
  let lastImpact = 0;

  function beginJump(isDoubleJump = false) {
    // Returning false lets gameplay avoid consuming a jump twice.
    if (
      state === GUARDIAN_ANIM_STATE.ANTICIPATION ||
      state === GUARDIAN_ANIM_STATE.DOUBLE_ANTICIPATION
    )
      return false;
    state = isDoubleJump
      ? GUARDIAN_ANIM_STATE.DOUBLE_ANTICIPATION
      : GUARDIAN_ANIM_STATE.ANTICIPATION;
    stateTime = 0;
    return true;
  }

  function land(impactSpeed) {
    lastImpact = Math.abs(impactSpeed);
    const hard = lastImpact >= 7.2;
    state = hard
      ? GUARDIAN_ANIM_STATE.LAND_HARD
      : GUARDIAN_ANIM_STATE.LAND_NORMAL;
    stateTime = 0;
    landingWeight = clamp((lastImpact - 2.5) / 7, 0.35, 1);
  }

  function reset() {
    state = GUARDIAN_ANIM_STATE.IDLE;
    stateTime = 0;
    gaitPhase = 0;
    events = 0;
    landingWeight = 0;
  }

  function takeEvents() {
    const result = events;
    events = 0;
    return result;
  }

  function setJoint(index, x, y, z, rate, dt) {
    const node = nodes[index];
    if (!node) return;
    node.rotation.x = damp(node.rotation.x, bindX[index] + x, rate, dt);
    node.rotation.y = damp(node.rotation.y, bindY[index] + y, rate, dt);
    node.rotation.z = damp(node.rotation.z, bindZ[index] + z, rate, dt);
  }

  /**
   * @param {number} dt clamped frame delta in seconds
   * @param {number} speed horizontal speed in world units/sec
   * @param {boolean} grounded authoritative physics grounded state
   * @param {number} verticalSpeed authoritative vertical velocity
   * @param {number} turnLean signed local/camera-relative lean, normally -1..1
   */
  function update(dt, speed, grounded, verticalSpeed, turnLean = 0) {
    stateTime += dt;
    const run = smooth01(speed / 5.2);
    gaitPhase = (gaitPhase + dt * (2.25 + speed * 1.18)) % TAU;

    if (state === GUARDIAN_ANIM_STATE.ANTICIPATION && stateTime >= 0.065) {
      events |= GUARDIAN_ANIM_EVENT.LAUNCH;
      state = GUARDIAN_ANIM_STATE.RISE;
      stateTime = 0;
    } else if (
      state === GUARDIAN_ANIM_STATE.DOUBLE_ANTICIPATION &&
      stateTime >= 0.038
    ) {
      events |= GUARDIAN_ANIM_EVENT.LAUNCH;
      state = GUARDIAN_ANIM_STATE.RISE;
      stateTime = 0;
    } else if (state === GUARDIAN_ANIM_STATE.RISE && verticalSpeed <= 1.15) {
      events |= GUARDIAN_ANIM_EVENT.APEX;
      state = GUARDIAN_ANIM_STATE.APEX;
      stateTime = 0;
    } else if (state === GUARDIAN_ANIM_STATE.APEX && stateTime >= 0.11) {
      state = GUARDIAN_ANIM_STATE.FALL;
      stateTime = 0;
    } else if (
      (state === GUARDIAN_ANIM_STATE.IDLE ||
        state === GUARDIAN_ANIM_STATE.RUN) &&
      !grounded
    ) {
      state =
        verticalSpeed > 0.8
          ? GUARDIAN_ANIM_STATE.RISE
          : GUARDIAN_ANIM_STATE.FALL;
      stateTime = 0;
    }

    const recoveryDuration =
      state === GUARDIAN_ANIM_STATE.LAND_HARD ? 0.36 : 0.22;
    if (
      (state === GUARDIAN_ANIM_STATE.LAND_NORMAL ||
        state === GUARDIAN_ANIM_STATE.LAND_HARD) &&
      stateTime >= recoveryDuration
    ) {
      events |= GUARDIAN_ANIM_EVENT.LAND_RECOVERED;
      state = speed > 0.18 ? GUARDIAN_ANIM_STATE.RUN : GUARDIAN_ANIM_STATE.IDLE;
      stateTime = 0;
    } else if (
      (state === GUARDIAN_ANIM_STATE.IDLE ||
        state === GUARDIAN_ANIM_STATE.RUN) &&
      grounded
    ) {
      state = speed > 0.18 ? GUARDIAN_ANIM_STATE.RUN : GUARDIAN_ANIM_STATE.IDLE;
    }

    let hipL = 0,
      hipR = 0,
      kneeL = 0,
      kneeR = 0;
    let ankleL = 0,
      ankleR = 0,
      shoulderL = 0,
      shoulderR = 0;
    let elbowL = -0.1,
      elbowR = -0.1,
      wristL = 0,
      wristR = 0;
    let spineX = 0,
      spineY = 0,
      spineZ = 0,
      headX = 0,
      headY = 0;
    let tailLift = 0,
      poseRate = 13;

    if (state === GUARDIAN_ANIM_STATE.IDLE) {
      const breath = Math.sin(gaitPhase * 0.72);
      spineX = -0.018 + breath * 0.024;
      headX = -breath * 0.018;
      shoulderL = -0.05 - breath * 0.018;
      shoulderR = -0.05 - breath * 0.018;
      elbowL = -0.13;
      elbowR = -0.13;
      tailLift = Math.sin(gaitPhase * 0.43) * 0.055;
      poseRate = 6;
    } else if (state === GUARDIAN_ANIM_STATE.RUN) {
      const stride = Math.sin(gaitPhase);
      const liftL = Math.max(0, -stride),
        liftR = Math.max(0, stride);
      hipL = stride * 0.66 * run;
      hipR = -stride * 0.66 * run;
      kneeL = -liftL * 0.72 * run;
      kneeR = -liftR * 0.72 * run;
      ankleL = liftL * 0.24 * run;
      ankleR = liftR * 0.24 * run;
      shoulderL = -stride * 0.54 * run;
      shoulderR = stride * 0.54 * run;
      elbowL = -0.12 - Math.max(0, stride) * 0.28 * run;
      elbowR = -0.12 - Math.max(0, -stride) * 0.28 * run;
      spineX = 0.035 + run * 0.055 + Math.sin(gaitPhase * 2) * 0.018 * run;
      spineY = -turnLean * 0.075;
      spineZ = -turnLean * 0.11;
      headY = turnLean * 0.06;
      tailLift = Math.sin(gaitPhase - 0.45) * 0.13 * run;
      poseRate = 16;
    } else if (state === GUARDIAN_ANIM_STATE.ANTICIPATION) {
      const a = smooth01(stateTime / 0.065);
      hipL = 0.29 * a;
      hipR = 0.29 * a;
      kneeL = -0.78 * a;
      kneeR = -0.78 * a;
      ankleL = 0.2 * a;
      ankleR = 0.2 * a;
      shoulderL = 0.42 * a;
      shoulderR = 0.42 * a;
      elbowL = -0.4 * a;
      elbowR = -0.4 * a;
      spineX = 0.24 * a;
      headX = -0.12 * a;
      tailLift = -0.18 * a;
      poseRate = 28;
    } else if (state === GUARDIAN_ANIM_STATE.DOUBLE_ANTICIPATION) {
      const a = smooth01(stateTime / 0.038);
      hipL = -0.12;
      hipR = 0.42;
      kneeL = -0.62;
      kneeR = -0.82;
      shoulderL = -0.65 - 0.28 * a;
      shoulderR = 0.18 - 0.35 * a;
      elbowL = -0.62;
      elbowR = -0.5;
      spineX = 0.08;
      spineZ = 0.17;
      tailLift = 0.24;
      poseRate = 30;
    } else if (state === GUARDIAN_ANIM_STATE.RISE) {
      hipL = -0.48;
      hipR = 0.28;
      kneeL = -0.54;
      kneeR = -0.35;
      shoulderL = -1.02;
      shoulderR = -0.73;
      elbowL = -0.5;
      elbowR = -0.42;
      wristL = -0.12;
      wristR = 0.12;
      spineX = -0.2;
      headX = 0.08;
      tailLift = 0.18;
      poseRate = 18;
    } else if (state === GUARDIAN_ANIM_STATE.APEX) {
      const float = Math.sin(clamp(stateTime / 0.11, 0, 1) * Math.PI);
      hipL = 0.38;
      hipR = 0.38;
      kneeL = -0.88;
      kneeR = -0.88;
      ankleL = 0.2;
      ankleR = 0.2;
      shoulderL = -0.35;
      shoulderR = -0.35;
      elbowL = -0.68;
      elbowR = -0.68;
      spineX = 0.08 + float * 0.05;
      headX = -0.06;
      tailLift = 0.28;
      poseRate = 12;
    } else if (state === GUARDIAN_ANIM_STATE.FALL) {
      const spread = smooth01(clamp(-verticalSpeed / 7, 0, 1));
      hipL = 0.34 - spread * 0.18;
      hipR = 0.34 - spread * 0.18;
      kneeL = -0.5 - spread * 0.18;
      kneeR = -0.5 - spread * 0.18;
      shoulderL = -0.18 + spread * 0.5;
      shoulderR = -0.18 + spread * 0.5;
      elbowL = -0.44;
      elbowR = -0.44;
      spineX = 0.16 + spread * 0.1;
      headX = -0.1;
      tailLift = -0.2;
      poseRate = 11;
    } else {
      const duration = state === GUARDIAN_ANIM_STATE.LAND_HARD ? 0.36 : 0.22;
      const p = clamp(stateTime / duration, 0, 1);
      const compression = (1 - smooth01(p)) * landingWeight;
      hipL = 0.3 * compression;
      hipR = 0.3 * compression;
      kneeL = -0.92 * compression;
      kneeR = -0.92 * compression;
      ankleL = 0.26 * compression;
      ankleR = 0.26 * compression;
      shoulderL = 0.48 * compression;
      shoulderR = 0.48 * compression;
      elbowL = -0.2 - 0.32 * compression;
      elbowR = elbowL;
      spineX = 0.34 * compression;
      headX = -0.17 * compression;
      tailLift = -0.24 * compression;
      poseRate = state === GUARDIAN_ANIM_STATE.LAND_HARD ? 24 : 19;
    }

    setJoint(1, spineX, spineY, spineZ, poseRate, dt);
    setJoint(2, headX, headY, -spineZ * 0.35, poseRate * 0.75, dt);
    setJoint(3, shoulderL, 0, 0, poseRate, dt);
    setJoint(4, elbowL, 0, 0, poseRate, dt);
    setJoint(5, wristL, 0, 0, poseRate, dt);
    setJoint(6, shoulderR, 0, 0, poseRate, dt);
    setJoint(7, elbowR, 0, 0, poseRate, dt);
    setJoint(8, wristR, 0, 0, poseRate, dt);
    setJoint(9, hipL, 0, 0, poseRate, dt);
    setJoint(10, kneeL, 0, 0, poseRate, dt);
    setJoint(11, ankleL, 0, 0, poseRate, dt);
    setJoint(12, hipR, 0, 0, poseRate, dt);
    setJoint(13, kneeR, 0, 0, poseRate, dt);
    setJoint(14, ankleR, 0, 0, poseRate, dt);
    const tailWave = Math.sin(gaitPhase * 0.62);
    setJoint(15, tailLift + tailWave * 0.07, 0, 0, 7, dt);
    setJoint(
      16,
      tailLift * 0.62 + Math.sin(gaitPhase * 0.62 - 0.65) * 0.09,
      0,
      0,
      6,
      dt,
    );
    setJoint(
      17,
      tailLift * 0.35 + Math.sin(gaitPhase * 0.62 - 1.2) * 0.11,
      0,
      0,
      5,
      dt,
    );
  }

  return {
    beginJump,
    land,
    reset,
    takeEvents,
    update,
    get state() {
      return state;
    },
    get lastImpact() {
      return lastImpact;
    },
  };
}
