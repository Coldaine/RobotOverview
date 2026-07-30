# 04: LiDAR Open Decision

Status: **OPEN.** Livox Mid-360S vs RoboSense Airy 96.

## The comparison as supplied

| Metric | RoboSense Airy 96 | Livox Mid-360S |
|---|---|---|
| Listed price | $999 manufacturer-direct | $789 SensorLidar |
| Vertical FoV | 90° | 59°, -7° to +52° |
| Point rate, single return | 856,320 pts/s | 200,000 pts/s |
| Scan pattern | Repetitive, structured, 0.4° x 0.947° grid | Non-repetitive rotating mirror |
| Range at 10% reflectivity | 30 m | 40 m |
| Typical power | <8 W | 6.5 W |
| Weight | <240 g | 265 g |
| IMU | Yes | ICM40609 |
| Protection | IP67 / IP6K9K claimed | IP67 |
| Stock | "Consult customer service" / "notify me" | In stock, five remaining |

## Considerations the table does not capture

| Consideration | Detail | Leans |
|---|---|---|
| **Software lineage** | The Build A tooling lineage (FAST-LIO2, FAST-LIVO2, Gaussian-LIC) is HKU MARS lab and Livox-native. Upstream FAST-LIO requires livox_ros_driver installed and sourced before any launch file runs, even for non-Livox sensors. RoboSense ships official ROS/ROS2 drivers via rslidar_sdk and community forks add Airy support to FAST-LIO, but that is a fork rather than the reference path | **Mid**, strongly |
| **Vertical FoV shape** | Airy's 90° is a hemispherical dome **above** the mounting plane: 360° horizontal, 90° vertical upward. Verify how much it sees below horizontal before assuming 90° means more useful coverage on a low rover | **Verify first** |
| **Compute** | 856k pts/s is 4.28x the Livox rate into an Orin Nano already budgeted 1 to 2 of 6 cores at Livox rates. Likely needs decimation, which partly negates the density advantage | **Mid** |
| **Scan pattern vs mission** | Non-repetitive accumulates coverage with dwell time, suiting Build A's capture-then-train pattern. Repetitive structured grid gives frame-to-frame predictability, suiting Build B nav | **Split** |
| **Outdoor range** | Mid reaches 40m at 10% reflectivity vs Airy's 30m. RoboSense positions the Airy primarily for indoor and semi-outdoor use | **Mid** |
| **Availability and price** | Airy shows "consult customer service" against an in-stock Mid at $210 less | **Mid** |

Nitpicks on the source table: the precision figures are not comparable (1.5cm accuracy vs ≤2cm at 10m are different measurements).

## Current read

The Airy is the better sensor on paper and likely the worse choice for this specific pipeline. The 4.28x point rate is the headline number and helps least: the Orin cannot fully consume it, and splatting geometry comes from dwell time rather than instantaneous density.

Confidence: medium. Not a ruling.

## Separate unresolved question: mounting

Whether the LiDAR goes on the servo head or rigid to the chassis is **not settled.**

Argument against servo-mounting the LiDAR: FAST-LIO2 assumes a fixed LiDAR-to-IMU extrinsic. The Mid-360's IMU is internal, so a gimbal-mounted assembly would track the gimbal rather than the chassis, and servo backlash becomes odometry noise directly.

This concern applies to Build B navigation SLAM. Under the Architecture B ruling in `01`, it does not affect Build A capture quality.
