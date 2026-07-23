# Compute Workload Sizing — Orin NX vs AGX Orin

**Status:** RESEARCH BRIEF — sourced 2026-07-23. Documents how teams prove edge-module fit. Does not by itself force a purchase.

**Codename:** `RND-COMPUTE-SIZING`

**Audience:** Hangar operator + agents planning BEAST-01 / Jetson tier decisions.

---

You were asking **how engineers formally represent the workload that leads to Orin NX versus AGX Orin**, not for another list of deployments.

The clearest answer from current robotics courses, class projects, ROS discussions, and 2026 Jetson engineering threads is:

> **They do not make one “AI compute requirements diagram.”**
> They use several linked views: operational requirements → functional dataflow → cyber-physical allocation → timing/interfaces/resources → measured runtime traces.

That distinction matters because an apparently impressive “275 TOPS” requirement can actually be caused by **camera ingress, ISP, memory, encoding, synchronization, or concurrent CPU work**, rather than neural inference.

## 1. Start with an objective tree and quantified requirements

The first visual is normally not a ROS graph. It is an **objective or requirement hierarchy** showing:

* What the robot must accomplish.
* Mandatory threshold versus desirable target.
* Performance, functional, safety, and nonfunctional requirements.
* How success will be measured.

The Spring 2026 Johns Hopkins **System Conceptual Design** course explicitly progresses from stakeholder needs and scenarios through requirements, traceability, functional allocation, physical allocation, resource allocation, and validation. It teaches context diagrams, block-definition diagrams, activity diagrams, timeline diagrams, N² diagrams, internal-block diagrams, concurrency, and resource allocation. ([JHU Application Portal][1])

CMU’s robotics systems-engineering sequence similarly has students move through conceptualization, specification, design, prototyping, requirements tracking, cyber-physical architecture, testing, and system-performance validation. ([CMU Course Catalog][2])

Two actual CMU project examples show what this looks like:

* **VectorRobotics, 2026:** system performance requirements, functional architecture, cyber-physical architecture, and both general and detailed objective trees. ([MRSD Projects][3])
* **NightWalker:** separate mandatory and desirable functional, performance, and nonfunctional requirements, followed by functional and cyber-physical architectures. ([MRSD Projects][4])

This part answers **what performance is needed**. It does not yet select the Jetson.

## 2. Draw a functional architecture as concurrent data pipelines

The functional view contains **functions and information flows**, not particular computers.

A serious autonomy diagram would look conceptually like:

```text
Cameras ──→ rectify/dewarp ──→ depth/inference ─┐
                                                │
LiDAR ────→ filtering ───────→ lidar odometry ──┼→ localization/map
                                                │
IMU ──────→ preprocessing ───→ state estimate ──┘
                                                     ↓
                                               planning/control
```

What matters is that the diagram shows:

* Which paths execute continuously.
* Which paths execute concurrently.
* Their input and output rates.
* Which results are dependencies for other functions.
* Which paths are safety-critical.
* Which paths can be degraded or dropped.

NightWalker’s functional architecture, for example, explicitly separates three concurrent pipelines:

1. Perception-based planning.
2. SLAM and state estimation.
3. Human detection and localization.

Its SLAM path consumes lidar, IMU, and stereo data; the resulting map and robot pose feed both exploration and human localization. ([MRSD Projects][4])

That is much more useful for compute sizing than writing “SLAM + YOLO + navigation” in a feature list.

## 3. Map the functions onto a cyber-physical architecture

The next diagram answers:

> **Which processor, controller, accelerator, sensor, and interface performs each function?**

This is where the difference between Orin NX and AGX Orin becomes visible.

### Actual Orin NX class-project example

The University of Texas at Arlington’s 2025 IGVC senior-design rover documents three layers:

```text
Input
  Cameras, lidar, GPS, encoders, emergency switches

Processing
  Orin NX: vision, lidar perception, decisions
  TM4C: low-level communication and motor control

Output / safety
  Motor driver and wheels
  Separate STM32 wireless emergency-stop path
```

Its project package includes a project charter, system-requirements specification, architecture-design specification, detailed-design specification, wiring schematic, and logic block diagram. ([UT Arlington Websites][5])

That is a proper allocation diagram, although the published evidence does **not** demonstrate that Orin NX was the minimum compute necessary. It establishes responsibilities and safety isolation, not utilization.

### Actual AGX Orin class-project example

CMU’s 2026 **FireSense** project uses an objective tree, requirements diagrams, functional architecture, and cyber-physical architecture. Each firefighter-carried payload contains thermal stereo cameras, mmWave radar, IMU, battery, communications, and an **AGX Orin**. The AGX performs front-end SLAM and point-of-interest detection; lightweight constraints are transmitted over a 915 MHz link to a command station that performs centralized collaborative-SLAM optimization. ([MRSD Projects][6])

That architecture communicates something important:

* High-volume sensor processing stays local.
* Low-bandwidth constraints traverse the radio.
* Global optimization is offloaded.
* The compute requirement is divided between edge and command station.

Again, the public project page documents the allocation well, but it does not publish enough profiling to prove that AGX Orin is the smallest acceptable module.

## 4. Use an N² or interface matrix

A block diagram tells you **what connects**. An N² matrix or interface-control table tells you whether the connections can actually support the workload.

Typical fields are:

| Producer  | Consumer          | Data         |  Rate |           Payload size | Interface | Required latency | Timebase      |
| --------- | ----------------- | ------------ | ----: | ---------------------: | --------- | ---------------: | ------------- |
| Camera 1  | Rectifier         | RAW Bayer    | 30 Hz | Resolution × bit depth | CSI-2     |         Deadline | Camera clock  |
| Rectifier | Detector          | Tensor/image | 30 Hz |               Measured | CUDA/NVMM |         Deadline | Jetson clock  |
| Lidar     | LIO               | Point cloud  | 10 Hz |           Points/frame | Ethernet  |         Deadline | PTP/GNSS      |
| Jetson    | Flight controller | Setpoint     | 50 Hz |          Bytes/message | UART/CAN  |         Deadline | Synced clocks |

JHU’s 2026 course explicitly teaches **N² diagrams**, requirements-to-function traceability, function-to-physical traceability, timeline diagrams, physical concurrency, and resource allocation. ([JHU Application Portal][1])

This is especially important for Jetson selection because **the carrier board and physical interfaces can invalidate the SoC choice**.

A May 2026 forum discussion comparing Orin NX 16GB with AGX Orin 64GB specified:

* Three cameras.
* 100 FPS each.
* 300 FPS total.
* 67 FPS as the strict minimum.
* Cable movement at 160 m/min.
* Near-immediate processing.
* Concern over memory and input bandwidth.

The user selected AGX Orin and a dedicated PCIe multiport interface after the discussion identified the NX development carrier’s 1GbE PHY as an input bottleneck. The decision was therefore partly an **I/O architecture decision**, not a 100-versus-275-TOPS decision. ([NVIDIA Developer Forums][7])

## 5. Build a timeline and end-to-end latency budget

Averages alone are not sufficient. Robotics designers need the **critical path** from physical event to actuator response.

```text
Exposure
  → camera transfer
  → ISP/debayer
  → preprocessing
  → inference
  → tracking/fusion
  → planner
  → controller communication
  → actuator update
```

For every stage they track:

* Nominal time.
* Worst-case or high-percentile time.
* Jitter.
* Queueing delay.
* Deadline.
* Whether frames may be skipped.
* Whether stale output is usable.

A 2026 DJI Matrice 300 tracking implementation using Orin NX drew both a system framework and physical interconnection architecture, then defined end-to-end latency from image acquisition through PSDK command execution. It measured a mean of **29.13 ms** with **0.76 ms standard deviation** under dynamic load. ([PMC][8])

A November 2025 PX4 discussion involving AGX Orin and Pixhawk shows why clock architecture belongs in the same document. The user plotted Jetson/Pixhawk clock offset, NTP-induced jumps, steady drift, and timestamp errors reaching approximately 20 ms—unacceptable for the sensor-fusion requirement. ([Dronecode Forum][9])

So the timing view must include both:

1. **Compute latency**, and
2. **Timestamp validity and synchronization error**.

## 6. Make a resource-allocation matrix by hardware engine

A Jetson is not one homogeneous bucket of TOPS.

A useful allocation table separates:

| Function        | CPU |      GPU |    DLA 0 |    DLA 1 | ISP | NVENC | NVDEC |              RAM |          I/O |
| --------------- | --: | -------: | -------: | -------: | --: | ----: | ----: | ---------------: | -----------: |
| Camera ingest   |     |          |          |          |   ✓ |       |       |          buffers |  CSI/USB/GbE |
| Rectification   |   ✓ |        ✓ |          |          |     |       |       |          buffers |     internal |
| Detection model |     |        ✓ | possibly | possibly |     |       |       | engine + tensors |     internal |
| Recording       |   ✓ |          |          |          |     |     ✓ |       |           queues |         NVMe |
| VIO/SLAM        |   ✓ | possibly |          |          |     |       |       |        map/state | camera + IMU |
| Dense depth     |   ✓ |        ✓ | possibly | possibly |     |       |       |    large tensors |       camera |

Current engineering discussions show why this breakdown is mandatory:

* A December 2025 Orin NX design listed **three camera inputs, two primary models, three secondary models, and six simultaneous encoding outputs**—one recording and one streaming encode for each camera. ([NVIDIA Developer Forums][10])
* A June 2026 Orin NX evaluation separately asked about **four 4K30 RAW camera streams, ISP processing, real-time inference, encoding, and decoding**, rather than treating them as one generic AI workload. ([NVIDIA Developer Forums][11])
* An April 2026 AGX Orin deployment with seven camera channels experienced simultaneous frame drops and NVMe I/O failures while packaging and transmitting the streams, showing that camera, memory, storage, and network concurrency must be tested together. ([NVIDIA Developer Forums][12])

### GPU and DLA need explicit allocation

A 2025 Orin NX discussion measured:

* GPU-only YOLOv7-Tiny: 238 FPS.
* GPU plus both DLAs: 141 FPS GPU plus 42 FPS per DLA, 225 FPS total.

Unsupported layers fell back to the GPU, and transfers reduced aggregate performance. NVIDIA’s advice was to minimize intermediate transfers and, where possible, place an entire model on one engine. ([NVIDIA Developer Forums][13])

Therefore a diagram saying **“model runs on GPU/DLA”** is inadequate. It needs to show:

* Model partition boundaries.
* Unsupported operators.
* Fallback paths.
* Tensor copies.
* Shared preprocessing.
* Concurrent engines.

## 7. Visualize the implemented ROS graph separately

The design architecture and the runtime architecture are not the same artifact.

In a ROS Discourse discussion specifically asking how people visualize ROS 2 architectures, participants recommended:

* `rqt_graph` for node/topic structure.
* `ros2_graph` and Mermaid for documentation.
* `ros_network_viz`.
* Message-flow analysis using `ros2_tracing` and Trace Compass to show messages moving between nodes over time. ([Open Robotics Discourse][14])

Kiwibot created `ros2_graph` because its delivery-robot stack had become too complex to maintain with screenshots from `rqt_graph`; it generates simplified Mermaid architecture documentation, including services and actions, directly from a running ROS 2 graph. ([Open Robotics Discourse][15])

The practical split is:

| Artifact                    | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| Functional architecture     | What the system is supposed to do              |
| Cyber-physical architecture | Where each function is deployed                |
| ROS graph                   | What nodes/topics/services actually exist      |
| Message-flow trace          | What executes, in what order, and for how long |

## 8. Validate complete graphs, not isolated model benchmarks

The ROS benchmarking discussions are unusually explicit about this.

The REP-2014 debate and RobotPerf discussions argue for:

* Testing individual nodes **and complete computational graphs**.
* Reproducible live, recorded, or synthetic input data.
* Output correctness checks.
* Configurable input sizes and publishing rates.
* Defined acceptable drop rates.
* Latency, throughput, power, and energy metrics.
* Tracing to locate internal bottlenecks after an external benchmark identifies failure. ([Open Robotics Discourse][16])

This is the decisive distinction:

> A detector achieving 60 FPS in isolation does not establish that the rover can run the detector, four camera pipelines, lidar odometry, dense reconstruction, recording, networking, and planning concurrently within the mission deadline.

## A particularly good Orin NX visualization: OmniNxt

OmniNxt is one of the few next-tier systems whose published material includes both a **system architecture diagram and resource-allocation/performance charts**.

Its workload includes:

* Four synchronized fisheye cameras at 20 Hz.
* A flight-controller IMU at 500 Hz.
* Omnidirectional VIO.
* Four virtual stereo depth pipelines.
* HITNET disparity inference.
* Real-time dense point-cloud generation.
* Navigation and planning.

The team intentionally replaced a more GPU-intensive feature matcher with Lucas–Kanade tracking to conserve GPU capacity. It then used four concurrent inference streams, FP16, and Tensor Cores to reduce the four-stereo-pair depth workload from approximately 200 ms to 62 ms, producing dense output at 15 Hz onboard the Orin NX. ([alphaXiv][17])

That is what a defensible NX selection looks like:

1. Sensor topology.
2. Functional graph.
3. Engine allocation.
4. Optimization choices.
5. Measured end-to-end processing time.
6. Remaining resource headroom.

## The concrete artifact set I would trust

For an Orin NX/AGX rover design, I would reject a proposal that contains only a block diagram and model-FPS table. The minimum credible package is:

1. **Objective tree and requirement matrix**
   Threshold, target, verification method, and criticality.

2. **Functional dataflow diagram**
   Every continuous and event-driven pipeline, including concurrency.

3. **Cyber-physical allocation diagram**
   Jetson, MCU, flight controller, sensors, storage, network, and safety systems.

4. **Interface/N² matrix**
   Data format, rate, size, bus, bandwidth, synchronization, and ownership.

5. **End-to-end timing diagram**
   Deadlines, jitter, queues, stale-data policy, and worst-case latency.

6. **Jetson engine/resource matrix**
   CPU, GPU, DLA, ISP, encoder, decoder, RAM, storage I/O, and power.

7. **Runtime ROS graph and trace**
   Actual nodes, topics, message causality, and scheduling behavior.

8. **Graph-level validation report**
   Reproducible inputs, correctness checks, drop rate, latency percentiles, memory peak, power, temperatures, and sustained-run stability.

That is the actual machinery by which a team establishes **“NX fits with margin”** or **“this crosses into AGX”**—not rover weight, camera count by itself, or advertised TOPS.

## Sources

[1]: https://apps.ep.jhu.edu/syllabus/spring-2026/645.767.83 "Spring 2026 Syllabus for 645.767.83"
[2]: https://coursecatalog.web.cmu.edu/schools-colleges/schoolofcomputerscience/robotics/ "Robotics Program — Carnegie Mellon University"
[3]: https://mrsdprojects.ri.cmu.edu/2026teama/design-documentation/ "System Design – VectorRobotics"
[4]: https://mrsdprojects.ri.cmu.edu/2023teamb/system-design/ "System Design – NightWalker"
[5]: https://websites.uta.edu/cseseniordesign/2025/12/08/igvc-f25/ "IGVC – CSE Senior Design"
[6]: https://mrsdprojects.ri.cmu.edu/2026teamf/system-design/ "System Design – FireSense"
[7]: https://forums.developer.nvidia.com/t/subject-hardware-advice-jetson-orin-nx-16gb-vs-agx-orin-64gb-for-triple-100-fps-video-processing/369423 "Hardware Advice: Jetson Orin NX (16GB) vs. AGX Orin (64GB) for Triple 100 FPS Video Processing"
[8]: https://pmc.ncbi.nlm.nih.gov/articles/PMC13074940/ "Design and Implementation of a Real-Time Visual Tracking System for UAVs Based on PSDK"
[9]: https://discuss.px4.io/t/time-sync-drift-between-jetson-and-pixhawk-using-micro-xrce-dds/47961 "Time-sync drift between Jetson and Pixhawk using micro-XRCE-DDS"
[10]: https://forums.developer.nvidia.com/t/planning-to-switch-orin-nano-to-orin-nx/354137 "Planning to switch orin nano to orin nx"
[11]: https://forums.developer.nvidia.com/t/jetson-orin-nx-maximum-concurrent-4-camera-isp-encode-and-decode-capability/372616 "Jetson Orin NX: Maximum concurrent 4-camera ISP, encode and decode capability"
[12]: https://forums.developer.nvidia.com/t/agx-orin-camera-experiencing-unexpected-frame-drops/366865 "AGX Orin Camera Experiencing Unexpected Frame Drops"
[13]: https://forums.developer.nvidia.com/t/how-to-use-dla-correctly/322765 "How to use DLA correctly?"
[14]: https://discourse.ros.org/t/ros-2-visualization-tools-for-architecture/41170 "ROS 2 Visualization Tools for Architecture"
[15]: https://discourse.ros.org/t/introducing-ros2_graph/29391 "Introducing ros2_graph"
[16]: https://discourse.ros.org/t/rep-2014-rfc-benchmarking-performance-in-ros-2/27770 "[REP-2014] RFC - Benchmarking performance in ROS 2"
[17]: https://www.alphaxiv.org/overview/2403.20085v1 "OmniNxt: A Fully Open-source and Compact Aerial Robot with Omnidirectional Visual Perception"
