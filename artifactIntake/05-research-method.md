# 05: Research Method Post-Mortem

Read before doing further research on this project. The method used for most of this exploration was wrong in a specific, repeatable way.

## What went wrong

Roughly sixteen searches were run, nearly all shaped `[product] [spec] [price] [year]`:

- `Arducam IMX291 IMX462 low light USB camera robot price Amazon 2026`
- `ELP AR0234 global shutter USB camera 90fps 1080p price Amazon 2026`
- `small thermal camera module USB Jetson robot FLIR Lepton Boson InfiRay price`
- `IMX585 IMX678 STARVIS 2 Jetson Orin camera module 4K low light MIPI CSI price`

That shape returns manufacturer pages, distributor listings, and SEO aggregators. It tells you what a thing claims to be. It never tells you what broke when someone tried it.

**The tell:** the single most decision-changing finding of the whole exploration, the nerfstudio 1600px downscale default, came from a GitHub issue where someone was frustrated a flag would not work. It surfaced by accident. Everything found by design was a spec sheet.

Consequences: calibration, time synchronization, the moving-mount problem, and ultimately the entire Architecture A vs B question never surfaced until challenged directly.

## A second failure mode: self-citation

At one point the depth-supervised splatting workflow was recalled from prior conversation history and presented as knowledge. That was circular: it was a previous assistant output being cited back as evidence. It happened to hold up when verified against primary sources, but the verification was the thing that mattered, not the recall.

**Rule: prior conversation content is a lead, not a source. Verify it.**

## Query shapes that work

| Goal | Shape |
|---|---|
| Practitioner experience | Add failure wording: "doesn't work", "problem", "anyone tried", "lessons learned", "gotcha" |
| Platform-specific reality | Site-scoped: `site:forums.developer.nvidia.com IMX678 Orin Nano` |
| What actually breaks | Search issues, not products: `FAST-LIO camera sync github issue` |
| How people build | `built a lidar camera rig` rather than `lidar camera rig price` |
| Ground truth on a method | Go to the paper's own implementation details section, not a summary |

Price verification against live retail pages is still correct **for the buying step**. The error was running it as the entire method.

## Where the communities are

| Community | Answers |
|---|---|
| **NVIDIA Developer Forums**, Jetson subforums | Camera drivers, CSI, sync, calibration on Orin. The DRIVE subforums carry years of threads on camera-LiDAR PTP alignment, GMSL frame sync, and triggering other sensors from cameras |
| **ROS Discourse** (discourse.openrobotics.org) | Multi-sensor sync and calibration as a systems problem |
| **radiancefields.com** and its Radiant newsletter | Splatting industry and research, monthly wrap-ups of platform updates, code releases, research |
| **awesome-3d-splatting-survey** (GitHub, w-m) | Unusual format: every publication and implementation gets its own GitHub issue for discussion, feeding a living survey |
| **hku-mars GitHub issues** | FAST-LIO, FAST-LIVO2, livox_camera_calib. Where people report what fails on real rigs |
| **nerfstudio GitHub issues and Discord** | splatfacto behavior, VRAM, resolution |
| **Arducam forum** (forum.arducam.com) | Module-specific quirks |
| **Livox-SDK GitHub** | Drivers and the chessboard calibration tool verified on Mid-40, Horizon, Tele-15 |

## Calibration tooling, if ever needed

Not load-bearing under the Architecture B ruling, but recorded so it does not need re-finding:

- **Koide's direct_visual_lidar_calibration.** Targetless, single-shot, no manual initialization, and does not require overlapping FOV in a single frame provided the robot rotates to observe common areas. Uses scan accumulation via KISS-ICP, SuperGlue keypoint matching for an initial guess, then Ceres optimization minimizing Normalized Information Distance between LiDAR reflectivity and camera intensity. Better fit than the alternatives for a small rig.
- **hku-mars/livox_camera_calib.** Targetless, edge-information based, reports pixel-level accuracy. Demonstrated on denser Avia and Horizon clouds; whether it works with the Mid-360's sparser 200k pts/s non-repetitive pattern is unverified.
- **Livox-SDK/livox_camera_lidar_calibration.** Chessboard-based, verified on Mid-40, Horizon, Tele-15.

## On external research passes

Two agent-produced research documents were reviewed during this exploration. Both were useful as problem inventories and wrong in the same way: **both assumed the rover is moving while capturing, and one assumed the camera does the tracking.** Neither assumption holds here.

Specific value extracted:
- The **planar motion observability trap**: Kalibr-style continuous-time calibration needs aggressive 6-DoF excitation to decouple accelerometer bias from gravity, which a tracked rover cannot produce. Worth knowing if IMU-based calibration is ever attempted.
- The **triggered exposure floor**: minimum exposure on some industrial cameras jumps by an order of magnitude once hardware triggering is enabled. Classic spec-sheet-invisible integration surprise.
- Koide's toolbox, above.

Specific misses:
- One assumed an Ouster LiDAR throughout, building its whole timing plan on a spinning-LiDAR encoder-angle trigger output. Neither candidate LiDAR advertises a camera trigger output, and the document never noticed.
- One conceded in its own text that when the robot is stationary, temporal misalignment has no effect, which undercuts its own headline recommendation for parked capture.
- Both scaled mounting and camera recommendations for a much larger vehicle.
- All citation markers in both were unresolvable, so the specific figures cannot be checked.

**If commissioning another pass:** state the platform scale, the offline-capture assumption, and the parked-capture assumption up front, or it will return the moving-vehicle answer again.
