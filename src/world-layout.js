// Mistwater Shrine authored 50 m vertical-slice layout.
//
// Data only: this module creates no geometry and intentionally contains no
// random scatter. `asset` values beginning `./assets/` already exist. Values
// beginning `./assets/required/` are explicit 404 production requirements;
// do not substitute boxes, spheres, planes, or scaled copies of another prop.

export const WORLD_BOUNDS = Object.freeze({
  waterLevel: 0,
  startZ: 4.5,
  finishZ: -47.5,
  playableHalfWidth: 8.5,
});

export const SPATIAL_CHUNKS = Object.freeze([
  { id: "arrival", zMin: -11, zMax: 8, preloadAtZ: 8, retireAtZ: -15 },
  { id: "green_tunnel", zMin: -29, zMax: -8, preloadAtZ: -3, retireAtZ: -34 },
  {
    id: "shrine_reveal",
    zMin: -51,
    zMax: -26,
    preloadAtZ: -19,
    retireAtZ: -55,
  },
  { id: "far_composition", zMin: -96, zMax: 20, preloadAtZ: 8, retireAtZ: -60 },
]);

// The critical route is a sequence of three readable phrases, not a pad field.
// Radius is the gameplay landing radius in metres. `scale` is relative to the
// canonical 2.70 x 0.38 x 2.55 m traversal lotus.
export const TRAVERSAL = Object.freeze([
  // Phrase 1 — establish the verb in a broad, bright opening (4 easy contacts).
  {
    id: "p1_start",
    phrase: 1,
    x: -1.15,
    y: 0.06,
    z: 2.65,
    scale: 1.1,
    yaw: 0.31,
    radius: 1.27,
    rest: true,
  },
  {
    id: "p1_left",
    phrase: 1,
    x: -3.0,
    y: 0.04,
    z: -1.15,
    scale: 1.03,
    yaw: 2.18,
    radius: 1.19,
  },
  {
    id: "p1_center",
    phrase: 1,
    x: -0.6,
    y: 0.03,
    z: -5.15,
    scale: 0.96,
    yaw: 5.21,
    radius: 1.11,
  },
  {
    id: "p1_rest",
    phrase: 1,
    x: 2.05,
    y: 0.05,
    z: -9.05,
    scale: 1.18,
    yaw: 1.14,
    radius: 1.36,
    rest: true,
  },

  // Phrase 2 — enclosed S-turn. Near foliage narrows the image, while pad
  // lateral alternation stays below the camera's ambiguity threshold.
  {
    id: "p2_entry",
    phrase: 2,
    x: 3.7,
    y: 0.03,
    z: -13.05,
    scale: 0.98,
    yaw: 3.79,
    radius: 1.13,
  },
  {
    id: "p2_cross",
    phrase: 2,
    x: 0.55,
    y: 0.02,
    z: -16.9,
    scale: 0.91,
    yaw: 0.72,
    radius: 1.05,
  },
  {
    id: "p2_left",
    phrase: 2,
    x: -3.35,
    y: 0.04,
    z: -20.45,
    scale: 1.04,
    yaw: 4.58,
    radius: 1.2,
  },
  {
    id: "p2_hook",
    phrase: 2,
    x: -1.05,
    y: 0.03,
    z: -24.55,
    scale: 0.89,
    yaw: 2.65,
    radius: 1.03,
  },
  {
    id: "p2_rest",
    phrase: 2,
    x: 2.25,
    y: 0.05,
    z: -28.25,
    scale: 1.22,
    yaw: 5.73,
    radius: 1.41,
    rest: true,
  },

  // Phrase 3 — three committed jumps across widening negative space. The last
  // leaf aims directly at the platform steps, so the gate—not another pad—is
  // the destination.
  {
    id: "p3_launch",
    phrase: 3,
    x: 4.1,
    y: 0.03,
    z: -32.2,
    scale: 0.96,
    yaw: 1.91,
    radius: 1.11,
  },
  {
    id: "p3_long",
    phrase: 3,
    x: 0.75,
    y: 0.02,
    z: -36.55,
    scale: 0.86,
    yaw: 4.97,
    radius: 0.99,
  },
  {
    id: "p3_final",
    phrase: 3,
    x: -1.05,
    y: 0.04,
    z: -40.2,
    scale: 1.09,
    yaw: 0.47,
    radius: 1.26,
  },
]);

export const OPTIONAL_ROUTE = Object.freeze([
  // Visible from p2_rest, reconnecting at p3_long. It creates a readable
  // reward arc without contaminating the primary silhouette.
  {
    id: "opt_a",
    x: 5.65,
    y: 0.02,
    z: -27.0,
    scale: 0.76,
    yaw: 2.36,
    radius: 0.88,
    reward: "spark",
  },
  {
    id: "opt_b",
    x: 6.55,
    y: 0.03,
    z: -31.0,
    scale: 0.72,
    yaw: 5.44,
    radius: 0.83,
    reward: "spark",
  },
  {
    id: "opt_c",
    x: 4.55,
    y: 0.02,
    z: -34.7,
    scale: 0.78,
    yaw: 0.96,
    radius: 0.9,
    reward: "spark",
  },
]);

export const LANDMARKS = Object.freeze([
  {
    id: "shrine_footing",
    chunk: "shrine_reveal",
    asset: "./assets/shrine_footing.js",
    // Keep the irregular apron at the waterline instead of burying the
    // platform's authored central stair descent.
    position: [0.45, -0.58, -45.35],
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
  },
  {
    id: "shrine_landing",
    chunk: "shrine_reveal",
    asset: "./assets/shrine_platform.js",
    position: [0.45, -0.35, -45.35],
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
    collision: {
      type: "box",
      center: [0.45, 0.55, -45.35],
      size: [10.7, 1.1, 7.7],
    },
  },
  {
    id: "hero_gate",
    chunk: "shrine_reveal",
    asset: "./assets/shrine_gate_hero.js",
    position: [0.45, 0.74, -47.25],
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
  },
  {
    id: "spirit_reward",
    chunk: "shrine_reveal",
    asset: "./assets/spirit_reward_tree.js",
    position: [0.45, -0.04, -53.4],
    scale: [1, 1, 1],
    rotation: [0, -0.08, 0],
    keepHierarchy: true,
    practical: {
      color: 0xffc45e,
      intensity: 12.5,
      range: 9.5,
      yOffset: 2.8,
    },
  },
  {
    id: "landing_lantern_left",
    chunk: "shrine_reveal",
    asset: "./assets/stone_lantern.js",
    position: [-3.55, 0.74, -43.65],
    scale: [0.94, 0.94, 0.94],
    rotation: [0, 0.19, 0],
    practical: { color: 0xf1bd63, intensity: 7.5, range: 7.0 },
  },
  {
    id: "landing_lantern_right",
    chunk: "shrine_reveal",
    asset: "./assets/stone_lantern.js",
    position: [4.3, 0.74, -45.55],
    scale: [0.82, 0.82, 0.82],
    rotation: [0, -0.43, 0],
    practical: { color: 0xf1bd63, intensity: 5.8, range: 6.0 },
  },
]);

export const DRESSING = Object.freeze([
  {
    id: "sanctuary_basin_shell",
    chunk: "shrine_reveal",
    asset: "./assets/sanctuary_basin_shell.js",
    // Continuous rear terrace and canopy/karst shoulders replace the terminal
    // mist void. It belongs to the static route chunk so its four surface
    // families merge instead of costing one draw per source material.
    position: [0.45, -0.62, -56.3],
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
  },
  // Continuous low waterline courses turn the isolated bank modules into an
  // authored basin. Each pair is baked into its route chunk, so the added
  // continuity costs three shared-material draws rather than prop-per-rock.
  ...[
    ["arrival", -8.55, -3.2, 1.57], ["arrival", 8.7, -4.4, -1.57],
    ["green_tunnel", -8.35, -13.0, 1.57], ["green_tunnel", 8.45, -14.0, -1.57],
    ["green_tunnel", -8.15, -22.4, 1.57], ["green_tunnel", 8.25, -23.4, -1.57],
    ["shrine_reveal", -8.65, -32.0, 1.57], ["shrine_reveal", 8.8, -33.0, -1.57],
    ["shrine_reveal", -8.9, -41.1, 1.57], ["shrine_reveal", 9.0, -42.0, -1.57],
  ].map(([chunk, x, z, yaw], index) => ({
    id: `basin_edge_${index}`,
    chunk,
    asset: "./assets/shore_transition.js",
    position: [x, -0.3, z],
    scale: [1, 1, 1],
    rotation: [0, yaw, 0],
  })),
  // Arrival framing: asymmetrical and close enough to break the frame edge.
  {
    id: "arr_bank_l",
    chunk: "arrival",
    asset: "./assets/required/bank_rock_large_a.js",
    position: [-8.35, -0.36, 2.1],
    scale: [1, 1, 1],
    rotation: [0, 0.28, 0],
  },
  {
    id: "arr_bamboo_l",
    chunk: "arrival",
    asset: "./assets/bamboo_cluster.js",
    position: [-7.05, -0.18, 0.8],
    scale: [1.12, 1.12, 1.12],
    rotation: [0, 0.63, -0.035],
  },
  {
    id: "arr_bank_r",
    chunk: "arrival",
    asset: "./assets/required/bank_rock_low_b.js",
    position: [8.05, -0.28, -3.2],
    scale: [1, 1, 1],
    rotation: [0, -0.51, 0],
  },
  {
    id: "arr_reeds_r",
    chunk: "arrival",
    asset: "./assets/required/reed_fern_cluster_b.js",
    position: [6.55, -0.04, -2.15],
    scale: [0.91, 0.91, 0.91],
    rotation: [0, 2.06, 0],
  },
  // Green tunnel: alternating banks occlude the gate completely until p2_left.
  {
    id: "tun_bank_r",
    chunk: "green_tunnel",
    asset: "./assets/required/bank_rock_large_c.js",
    position: [8.4, -0.33, -13.9],
    scale: [1, 1, 1],
    rotation: [0, 2.62, 0],
  },
  {
    id: "tun_bamboo_r",
    chunk: "green_tunnel",
    asset: "./assets/bamboo_cluster.js",
    position: [7.1, -0.12, -14.75],
    scale: [0.89, 0.89, 0.89],
    rotation: [0, 2.81, 0.028],
  },
  {
    id: "tun_root_l",
    chunk: "green_tunnel",
    asset: "./assets/required/root_bank_arch_a.js",
    position: [-8.15, -0.31, -19.1],
    scale: [1, 1, 1],
    rotation: [0, 0.12, 0],
  },
  {
    id: "tun_bamboo_l",
    chunk: "green_tunnel",
    asset: "./assets/bamboo_cluster.js",
    position: [-6.95, -0.14, -20.55],
    scale: [1.21, 1.21, 1.21],
    rotation: [0, 1.34, -0.044],
  },
  {
    id: "tun_fern_l",
    chunk: "green_tunnel",
    asset: "./assets/required/reed_fern_cluster_a.js",
    position: [-5.85, -0.03, -18.35],
    scale: [1.08, 1.08, 1.08],
    rotation: [0, 4.26, 0],
  },
  {
    id: "tun_bank_r2",
    chunk: "green_tunnel",
    asset: "./assets/required/bank_rock_shelf_a.js",
    position: [8.15, -0.27, -25.15],
    scale: [1, 1, 1],
    rotation: [0, -0.76, 0],
  },
  {
    id: "tun_lantern",
    chunk: "green_tunnel",
    asset: "./assets/stone_lantern.js",
    position: [6.2, 0.52, -24.1],
    scale: [0.76, 0.76, 0.76],
    rotation: [0, -0.34, 0],
    practical: { color: 0xf1bd63, intensity: 4.7, range: 5.5 },
  },

  // Reveal curtains: the left gap opens first, then the gate is centered as
  // the player crosses p3_long. Right mass is deliberately taller/darker.
  {
    id: "rev_rock_l",
    chunk: "shrine_reveal",
    asset: "./assets/required/bank_rock_tall_b.js",
    position: [-8.75, -0.42, -31.6],
    scale: [1, 1, 1],
    rotation: [0, 0.57, 0],
  },
  {
    id: "rev_bamboo_l",
    chunk: "shrine_reveal",
    asset: "./assets/bamboo_cluster.js",
    position: [-7.55, -0.11, -32.7],
    scale: [0.96, 0.96, 0.96],
    rotation: [0, 5.53, 0.032],
  },
  {
    id: "rev_rock_r",
    chunk: "shrine_reveal",
    asset: "./assets/required/bank_rock_large_b.js",
    position: [9.1, -0.38, -35.1],
    scale: [1, 1, 1],
    rotation: [0, 2.18, 0],
  },
  {
    id: "rev_bamboo_r",
    chunk: "shrine_reveal",
    asset: "./assets/bamboo_cluster.js",
    position: [7.75, -0.16, -36.05],
    scale: [1.27, 1.27, 1.27],
    rotation: [0, 3.47, -0.052],
  },
  {
    id: "platform_vines",
    chunk: "shrine_reveal",
    asset: "./assets/required/shrine_vine_dressing_a.js",
    position: [-2.1, 0.69, -46.55],
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
  },
]);

export const BACKGROUND = Object.freeze([
  // Distinct 404 assets are required for the three hero-frame silhouettes;
  // do not non-uniformly scale one spire into a visibly repeated skyline.
  {
    id: "karst_left",
    chunk: "far_composition",
    asset: "./assets/required/karst_massif_a.js",
    position: [-31, -2.2, -66],
    scale: [1, 1, 1],
    rotation: [0, 0.38, 0],
    mistBand: "far",
  },
  {
    id: "karst_center",
    chunk: "far_composition",
    asset: "./assets/mountain_spire.js",
    position: [14.5, -1.1, -79],
    scale: [1.07, 1.07, 1.07],
    rotation: [0, 2.04, 0],
    mistBand: "far",
  },
  {
    id: "karst_right",
    chunk: "far_composition",
    asset: "./assets/required/karst_arch_b.js",
    position: [36, -2.8, -61],
    scale: [1, 1, 1],
    rotation: [0, -0.74, 0],
    mistBand: "far",
  },
  {
    id: "far_roof_left",
    chunk: "far_composition",
    asset: "./assets/required/pagoda_silhouette_a.js",
    position: [-22, 2.3, -70],
    scale: [1, 1, 1],
    rotation: [0, 0.17, 0],
    mistBand: "far",
  },
]);

export const CAMERA_VOLUMES = Object.freeze([
  {
    id: "arrival_establish",
    zFrom: 4.5,
    zTo: -8.5,
    distance: 5.25,
    height: 2.42,
    fov: 50,
    targetLift: 0.62,
    lookAhead: 1.55,
    lateralBias: 0.0,
  },
  {
    id: "tunnel_compress",
    zFrom: -8.5,
    zTo: -27.5,
    distance: 4.85,
    height: 2.32,
    fov: 48,
    targetLift: 0.6,
    lookAhead: 1.75,
    lateralBias: -0.12,
  },
  {
    id: "reveal_open",
    zFrom: -27.5,
    zTo: -41.0,
    distance: 5.65,
    height: 2.62,
    fov: 54,
    targetLift: 0.64,
    lookAhead: 3.15,
    lateralBias: 0.18,
  },
  {
    id: "landing_resolve",
    zFrom: -41.0,
    zTo: -49.0,
    distance: 8.8,
    height: 3.35,
    fov: 51,
    targetLift: 1.7,
    lookAhead: 5.2,
    lateralBias: 0.0,
  },
]);

export const REVEAL_EVENTS = Object.freeze([
  {
    id: "gate_glimpse",
    triggerZ: -20.2,
    duration: 0.55,
    cameraYawBiasDeg: -2.5,
    exposureDelta: 0.03,
  },
  {
    id: "gate_reveal",
    triggerZ: -28.9,
    duration: 1.1,
    cameraYawBiasDeg: 3.0,
    fovDelta: 3.0,
    mistDensityMultiplier: 0.78,
  },
  {
    id: "shrine_arrival",
    triggerZ: -41.4,
    duration: 1.35,
    cameraImpulse: 0.035,
    practicalMultiplier: 1.18,
  },
]);

export const REQUIRED_404_ASSETS = Object.freeze([
  {
    family: "bank_rock",
    variants: ["large_a", "low_b", "large_c", "shelf_a", "tall_b", "large_b"],
    note: "Six authored silhouettes; wet lower course and soil/fern sockets. Candidate selection may consolidate to three assets only if no clone pair is visible in any hero frame.",
  },
  {
    family: "reed_fern_cluster",
    variants: ["a", "b"],
    note: "Low bank-edge framing, not oversized bamboo leaves.",
  },
  {
    family: "root_bank_arch",
    variants: ["a"],
    note: "Enclosed phrase left wall; asymmetrical root silhouette.",
  },
  {
    family: "shrine_vine_dressing",
    variants: ["a"],
    note: "Fits selected gate/platform, never intersects the playable stair.",
  },
  {
    family: "karst",
    variants: ["massif_a", "arch_b"],
    note: "Purpose-built distant silhouettes, desaturated through fog.",
  },
  {
    family: "pagoda_silhouette",
    variants: ["a"],
    note: "Far depth cue only; not a second copy of the hero gate.",
  },
]);

export function allAuthoredPlacements() {
  return [...LANDMARKS, ...DRESSING, ...BACKGROUND];
}
