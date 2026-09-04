# Goal 7 — playable-world upgrade

The shoreline/reflection candidate loop is frozen until all five checkpoints
below have shipped. Each checkpoint requires a deployed, browser-verified build.

| Checkpoint | State | Validation |
| --- | --- | --- |
| 1. Camera and directional movement | Complete | Player orbit (drag/Q/E), camera-relative movement, idle recenter, collision pull-in, and speed-scaled look-ahead verified in a deterministic Chromium run. Evidence: `outputs/goal7-checkpoint1-camera.png` and `outputs/goal7-checkpoint1-camera-report.json`. |
| 2. Enemy gameplay | Complete | Three crocodile wardens: melee pursuit/windups and ranged telegraphed arcing bombs; staff attack, health, guard/dodge, knockback, hit-stop, reactions, defeat state, and shrine objective gate. Deterministic Chromium assertions and visual evidence: `outputs/goal7-checkpoint2-combat.png` and `outputs/goal7-checkpoint2-combat-report.json`. |
| 3. Lighting and atmosphere | Complete | Warm directional sunlight, cool mist, three lantern pools, contact shadows, eight localized fog banks, and stronger reflected highlights. Deterministic local and permanent-URL verification passed. Evidence: `outputs/goal7-checkpoint3-atmosphere.png` and report. |
| 4. Sky and horizon | Complete | Five layered cloud banks, two atmospheric mountain ranges, 18 bamboo silhouettes, four submerged ruin gates, seven birds, and three drifting horizon-mist bands. Deterministic browser assertions and visual evidence: `outputs/goal7-checkpoint4-horizon.png` and report. |
| 5. Branching flooded rescue hub | Complete | Six solid islands form four named links: two reconnecting rescue loops, a far loop, and one combat-gated shortcut. Three rescue beacons, three authored enemy posts, and a central three-tier pagoda are browser verified. Evidence: `outputs/goal7-checkpoint5-rescue-hub.png` and report. |

Checkpoint 1 browser assertions: orbit changed by more than 0.5 radians,
forward input produced lateral world movement while orbited, camera target yaw
returned below 0.25 radians after release, obstacle detection engaged, look-ahead
grew from 1.55 m to 3.95 m at speed, and no runtime errors were reported.

Checkpoint 2 browser assertions: both enemy roles spawned, a production-input
staff strike defeated a primed melee enemy, the ranged bomb existed visibly in
flight and resolved, bomb impact damaged the player, moving guard input entered
the invulnerable dodge state, and no browser runtime errors were reported.
