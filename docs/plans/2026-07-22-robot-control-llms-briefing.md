# Robot Control LLMs — Hangar Briefing

**Status:** RESEARCH BRIEF — sourced 2026-07-22. No robot behavior, deploy, or inventory
purchase decisions are changed by this document.

**Codename:** `RND-ROBOT-LLM`

**Audience:** Hangar operator + agents planning BEAST-01 control and autonomy.

**North Star:** Autonomy is in scope (**G7**, decided 2026-07-22). The old AG2 ban on
unattended / autonomous operation is repealed. Onboard fail-safes (e-stop, stale-command
watchdog, motor PID) remain engineering requirements — they do not forbid self-driving.

---

## Verdict for BEAST-01

Treat “robot control LLMs” as **three different products**, not one:

| Lane | What it does | Hangar fit now |
| --- | --- | --- |
| **A. Language orchestrator** | NL / voice → structured teleop or Nav2 goals | Near-term after Socket.IO / ROS2 cutover; runs offboard on CORE-PRIME |
| **B. VLA / imitation policy** | Camera (+ language) → continuous actions | Self-driving path after Orin cutover + demo recording; LeRobot / SmolVLA / ACT first |
| **C. World action model (WAM)** | Shared world model that reasons, simulates, and emits actions | Autonomy research + post-train; NVIDIA Cosmos 3 Edge is the headline open edge checkpoint |

**Current physical gate:** Pi is **out**, Orin is being fitted — no upper computer on the
chassis until that install lands (OP-ORIN-GAP). That is a host-swap blocker, not a policy ban.

**Dynamics correction (operator, 2026-07-22):** Beast is slow, hard-stops, and **stops in
time** for terrain/obstacle reactions. Remote closed-loop from CORE-PRIME is fine.
Lightweight on-device Orin inference for **terrain alignment / avoidance** is fine.
Rejected: "won't stop in time," "avoidance must stay classical-only," WiFi-tail vetoes.
Keep ESP32 PID + watchdog.

---

## What we would actually have it do on BEAST-01

The Beast is a tracked rover with pan-tilt camera (and later depth/LiDAR), not an arm.
Operator fact: the Beast is **slow and hard-stops** — remote control is not exotic.
The end state is **self-driving on missions** — crawlspace cable haul, perimeter runs,
deck lanes — with Hangar as the command portal that starts, monitors, and aborts policies.

Build in stages so autonomy is earned, not wished:

### Jobs worth building (ordered)

| # | Job on the Beast | Lane | Concrete behavior |
| --- | --- | --- | --- |
| 1 | **Phrase driving** for Undercroft | A | “Creep forward under the duct”, “nudge left past the pillar”, “spin 90°”, “stop” → clamped `{L,R,duration}` / `/cmd_vel`. Hard speed caps; unknown verbs rejected. First autonomy-shaped interface. |
| 2 | **Look-where-I-mean** gimbal | A (+ VLM) | “Look at the cable end”, “tilt up at the joists”, “scan left for the orange conduit” → pan-tilt setpoints from FPV + phrase. |
| 3 | **Scene coach / HUD** | A (VLM) | Stream FPV to CORE-PRIME; narrate clearances into Hangar while driving or while a policy runs. |
| 4 | **Terrain alignment / avoidance** | onboard light | Lightweight Orin inference (depth/LiDAR/CV) for terrain alignment and obstacle avoidance — chassis stops in time; normal onboard job. |
| 5 | **Cable-haul autonomy** | A→B | MSN-01: approach corridor, optional human cable attach, then autonomous reverse haul with live abort. |
| 6 | **Taught crawl / patrol policies** | B | Closed-loop ACT/SmolVLA or Cosmos Edge post-train — remote and/or on-device. |
| 7 | **Cosmos-class world model** | C | Train/eval on 5090; post-train for Beast tracks (stock DROID arms do not transfer). |

### Mission fit

- **Undercroft (MSN-01):** phrase drive → taught crawl → autonomous cable haul is the
  flagship autonomy story.
- **Perimeter mapping (MSN-02):** classical SLAM/Nav plus language goals (“inspect that
  fence line”); later a patrol policy on the map.
- **Pool deck (MSN-03):** autonomy only inside marked exclusion zones and low-speed
  profiles — self-driving with hard geofence, not a free roam near water.

### Explicit non-jobs on this chassis

- Replacing ESP32 PID / stale-command stop with a transformer (fail-safes stay)
- Running stock Cosmos Edge Policy-DROID (arm pick-and-place) as if it were UGV drive

### Explicitly rejected agent conclusions

- "Won't stop in time" on this chassis
- "Collision / terrain avoidance can't be lightweight onboard inference"
- "Remote visual steering is too dangerous because of WiFi tails"

### One-sentence product picture

**Hangar launches a Beast policy (or phrase goal); the rover drives the mission closed-loop;
silence, abort, or geofence breach → stop.**

---

## 1. Why this briefing exists

BEAST-01’s operating progression already ends with “ROS2 … even LLM-driven natural-language
control” (`docs/beast-ops.md`). The fleet also already encodes an offload doctrine:

- CORE-PRIME (RTX 5090): train + heavy VLM/VLA when useful; remote Beast control OK
- BEAST-JETSON (Orin, fitting): teleop, stream, lightweight terrain avoidance, onboard policies
- Watchdog/PID stay; WiFi-tail lore is not a Beast teleop veto (`beast-slow-hard-stop`)

July 2026 NVIDIA / Hugging Face releases (Cosmos 3 family, Cosmos 3 Edge, LeRobot ↔ GR00T /
Cosmos integrations) make the research horizon concrete enough to map onto that doctrine
instead of collecting model names.

Context7 checked: Context7 MCP unavailable in this environment; facts below are from
Hugging Face model cards / blogs, NVIDIA blogs, GitHub repos (live star counts), and
existing Hangar owner docs.

---

## 2. Taxonomy — stop conflating these

### Lane A — Language orchestrators (LLM as planner / coder)

Pipeline: speech or text → LLM → **validated** JSON / ROS messages / short action scripts →
existing controllers (Socket.IO `{"T":1,"L","R"}`, `/cmd_vel`, Nav2).

- Strength: cheap to stand up; reuses classical stacks; good for goal-level autonomy and
  scripted mission segments.
- Weakness: not continuous closed-loop control; grounding fails without vision or a map;
  latency is turn-based (hundreds of ms to seconds), so it plans / sequences rather than
  servoing.
- UGV-relevant pattern: multimodal planner that returns a short validated action plan from
  a voice command + camera frame, then clamps speeds before driving (see Cyberwave UGV
  voice tutorial pattern — plan verbs, not learned continuous control).

### Lane B — Vision-Language-Action (VLA) policies

Pipeline: image(s) + language instruction → model → **motor actions** (discrete tokens or
continuous chunks / flow matching).

Landmark families (2024–2026):

| Model | Params (approx.) | Action style | Open weights | Notes |
| --- | ---: | --- | --- | --- |
| RT-2 / RT-2-X | up to ~55B | Discrete action tokens | No | Established the VLA paradigm (DeepMind, 2023) |
| OpenVLA | ~7B | Discrete bins as tokens | Yes | Default open baseline; [openvla/openvla](https://github.com/openvla/openvla) (6.7k stars) |
| π0 / π0.5 / openpi | ~3B class | Flow matching continuous | Partial (openpi) | Dexterity / smoothness leader; [Physical-Intelligence/openpi](https://github.com/Physical-Intelligence/openpi) (12.9k stars) |
| SmolVLA | ~0.45–2B | Continuous / chunked | Yes | Consumer-GPU friendly; lives in LeRobot |
| Octo / TinyVLA | small | Diffusion / discrete | Yes | Lightweight / embedded experiments |
| Isaac GR00T N1.x | ~2B+ | Dual-system VLM + DiT actions | Yes (code Apache 2.0; weights NVIDIA open model license) | Humanoid / cross-embodiment focus; [NVIDIA/Isaac-GR00T](https://github.com/NVIDIA/Isaac-GR00T) (7.6k stars) |

LeRobot ([huggingface/lerobot](https://github.com/huggingface/lerobot), **26.0k stars**) is
the practical open software spine: ACT, Diffusion, SmolVLA, π0 family bindings, GR00T
policy type, datasets, and rollout tooling. Hangar already records this as optional
software, not platform branding (`lerobot-optional`).

### Lane C — World foundation / world action models

Pipeline: multimodal world state → shared representation → **reason and/or generate**
future video **and** actions (forward / inverse dynamics + policy).

This is where **NVIDIA Cosmos 3** sits. Earlier Cosmos pieces were separate Predict /
Transfer / Reason / Policy models; Cosmos 3 unifies them as an omni-model
(Mixture-of-Transformers: autoregressive tower for understanding + diffusion tower for
generation). Cosmos 3 Edge is the compact edge post-train of that family aimed at
on-device robot control.

---

## 3. Deep dive — Cosmos 3 Edge (required source)

Primary announcement: [Introducing Cosmos 3 Edge](https://huggingface.co/blog/nvidia/cosmos3edge)
(Hugging Face community article, NVIDIA authors, published **2026-07-20**).

Model card: [`nvidia/Cosmos3-Edge`](https://huggingface.co/nvidia/Cosmos3-Edge)
(~6.6k downloads / 75 likes at briefing time; OpenMDW 1.1).

Sibling framing: [Welcome NVIDIA Cosmos 3](https://huggingface.co/blog/nvidia/cosmos-3-for-physical-ai)
(2026-05-31) and NVIDIA’s Jetson Thor edge blog covering Edge deployment on Thor
platforms.

### What shipped

- **Cosmos 3 Edge** — 4B-parameter open world / world-action model for edge Physical AI.
- Positioned as a compact VLM **and** a post-trained **world action model (WAM)** that can
  understand scenes, reason in real time, and generate robot actions on-device.
- Claimed robot-control operating point: **640×360** observations, **32 actions per
  inference**, real-time control about **15 Hz on Jetson Thor**.
- Hardware targets called out: RTX PRO / DGX / GeForce RTX, and Jetson including newly
  announced **Thor T2000 / T3000** modules (mainstream Thor SKUs; modules themselves
  called for **Q1 2027** availability in NVIDIA’s Thor blog).
- Companion checkpoint: **Cosmos 3 Edge Policy (DROID)** — manipulation policy post-trained
  on DROID pick-and-place, with post-training scripts ([NVIDIA/cosmos-framework](https://github.com/NVIDIA/cosmos-framework),
  397 stars; umbrella [NVIDIA/cosmos](https://github.com/NVIDIA/cosmos), **11.2k stars**).
- Among ~4B peers, NVIDIA claims #1 on **VANTAGE-Bench** (vision analytics) and SOTA for
  robot policy learning at that size — treat as vendor benchmark until Hangar reproduces
  anything locally.

### Architecture that matters for operators

Two transformer towers, one shared multimodal attention:

1. **Autoregressive tower** — vision/text tokens → understanding / reasoning.
2. **Diffusion tower** — vision / audio / action tokens → prediction, generation, neural
   simulation.

Actions are mapped into a **common geometric action representation** (translation,
rotation, manipulation state) so different embodiments (camera ego-motion, AV pose, arm
EEF + grasp, etc.) share structure. Policy mode emits **action + expected visual
consequence** — useful for training / evaluation, not only open-loop command spit.

Cosmos 3 family sizes for context:

| Checkpoint | Approx. size | Role |
| --- | ---: | --- |
| Cosmos 3 Edge (+ Policy-DROID) | 4B | Edge reasoner / action generator |
| Cosmos 3 Nano (+ Policy-DROID) | 16B | Workstation-class omni WFM |
| Cosmos 3 Super (+ distilled 4-step gens) | 64B | Large SDG / research generation |

### Hangar read on Cosmos 3 Edge specifically

**Useful as research and future post-train substrate. Not a BEAST buy trigger.**

Reasons it does **not** move Thor onto the buy list today:

1. Vendor real-time numbers are for **Jetson Thor**, not Orin Nano Super (the owned edge
   CUDA target). Edge is “Thor-native marketing,” even if Ampere/Blackwell workstation
   GPUs are listed for inference.
2. Stock policy release is **DROID arm pick-and-place**, not Waveshare tracked UGV
   differential drive. Embodiment transfer requires post-training on Beast demos /
   sim — exactly the Cosmos “post-train in about a day” story, but still unpaid work.
3. Autonomy is in scope (G7); Edge still needs Beast-specific post-train before closed-loop
   UGV deploy — stock DROID is the wrong embodiment, not a policy ban.
4. Existing Hangar insights already say Thor is industrial-tier for large onboard VLAs
   (`thor-tier`). T2000/T3000 soften the price/power curve later; they do not erase the
   “hobby rover within AP range” offload doctrine.

**Where Edge *does* fit Hangar compute:**

- **CORE-PRIME (5090):** fine-tune / distill / evaluate Cosmos Edge or Nano; generate
  synthetic trajectories; run heavier reasoner modes and closed-loop offboard policies.
- **BEAST-JETSON (Orin Nano Super):** after cutover, candidate for **smaller** LeRobot
  policies (ACT / SmolVLA class) and classical Isaac / ROS perception — not assumed to
  host full Edge 15 Hz claims.
- **Thor research row:** keep as horizon hardware if/when an onboard WAM is required
  outside WiFi coverage; revisit when T2000 street availability and power budget are real.

---

## 4. Map onto Hangar architecture

```text
 Operator (Hangar UI / voice)
        │  launch / monitor / abort
        ▼
 ┌──────────────────────────────┐
 │ CORE-PRIME  RTX 5090         │  Lane A LLM planner
 │  + VLA / Cosmos policies     │  Lane B/C train + offboard infer
 └─────────────┬────────────────┘
               │ WiFi 6 (design for tail)
               ▼
 ┌──────────────────────────────┐
 │ Onboard host (Orin — fitting)│  stream · watchdog · onboard policy
 │  Pi removed 2026-07-22       │
 └─────────────┬────────────────┘
               │ UART JSON
               ▼
         ESP32 PID / stop
```

Binding rules (operator-corrected for Beast):

- Train heavy models on CORE-PRIME when convenient (`offload-split`).
- Beast remote closed-loop and onboard lightweight terrain avoidance are both in play.
- Motor PID + stale-command watchdog stay as hard fail-safes (`watchdog`).
- Do not claim the Beast "can't stop in time" or that avoidance is forbidden onboard.

Suggested capability layering (conceptual — not schema changes):

1. **NL goal / teleop** (Lane A) on Socket.IO / later ROS2.
2. **Demo recording** to `/data/beast/datasets` once NVMe storage policy is applied.
3. **LeRobot ACT / SmolVLA** closed-loop on lifted tracks, then floor.
4. **Cosmos Edge / Nano** post-train after (2)–(3) and Beast action adapters exist.

---

## 5. Recommended Hangar progression

Ordered so each step earns more autonomy without skipping fail-safes:

1. **Finish Orin physical install** (Pi already removed) — mount, power, UART to ESP32,
   USB camera/LiDAR, move beast DHCP/DNS identity, heartbeat-stop check. See OP-ORIN-GAP.
2. **Drive remote immediately** — Hangar / browser / CORE-PRIME teleop and closed-loop are
   first-class on this slow hard-stopping chassis; keep watchdog, skip false babysitting rules.
3. **Lane A** — phrase goals → clamped `{L,R,duration}` / Nav2; hard speed caps; abort live.
4. **Record demos** for Undercroft / deck / perimeter once storage layout lands.
5. **Lane B closed-loop** — ACT/SmolVLA on CORE-PRIME and/or Orin; floor autonomy with abort.
6. **Lane C / Cosmos Edge** — 5090 spike + Beast track post-train; on-device when it fits;
   do **not** buy Thor just for the spike.

Still dumb:

- Replacing PID / watchdog with the transformer.
- Assuming stock DROID arm checkpoints drive tracks.
- Claiming the Beast can't stop in time or can't run lightweight onboard avoidance.

---

## 6. Decision matrix (Hangar-specific)

| Question | Answer |
| --- | --- |
| Is Cosmos 3 Edge relevant? | Yes — as the open edge WAM reference and future post-train base. |
| Does it change the Orin buy / cutover? | No. Orin remains the owned CUDA edge host. |
| Does it put Thor on the buy list? | No. Keep researching; T2000/T3000 may revise tiering later. |
| Best first LLM control for Beast? | Lane A over ROS2/Socket once Orin is in; remote closed-loop OK. |
| Best first learned policy stack? | LeRobot (ACT → SmolVLA), trained on CORE-PRIME, closed-loop on Beast. |
| When to touch Cosmos Edge Policy-DROID? | As a 5090 lab spike / recipe reference; UGV needs Beast post-train, not stock DROID. |
| Hangar UI role? | Command portal: telemetry, video, teleop, remote + on-device autonomy. |

---

## 7. Open questions

- Can Cosmos 3 Edge run usefully (even offline / non-real-time) on Orin Nano 8GB, or is
  Thor the honest floor for the 15 Hz claim?
- What action dimensionality / adapter makes Beast differential drive + gimbal fit Cosmos’s
  common action vectors?
- For Undercroft cable haul, how soon does Lane B closed-loop beat Lane A goal scripts?
- Should Hangar grow an explicit `capability` for “NL goal control” separate from
  `teleop` / `onboard-autonomy`?

---

## 8. Sources (accessed 2026-07-22)

### Primary — Cosmos

- [Introducing Cosmos 3 Edge](https://huggingface.co/blog/nvidia/cosmos3edge) — required brief source
- [`nvidia/Cosmos3-Edge` model card](https://huggingface.co/nvidia/Cosmos3-Edge)
- [Welcome NVIDIA Cosmos 3](https://huggingface.co/blog/nvidia/cosmos-3-for-physical-ai)
- [NVIDIA Jetson Thor / Cosmos 3 Edge blog](https://blogs.nvidia.com/blog/jetson-thor-robotics-edge-ai-agent/)
- [NVIDIA/cosmos](https://github.com/NVIDIA/cosmos) (11.2k stars)
- [NVIDIA/cosmos-framework](https://github.com/NVIDIA/cosmos-framework) (397 stars)

### VLA / tooling landscape

- [huggingface/lerobot](https://github.com/huggingface/lerobot) (26.0k stars)
- [NVIDIA ↔ Hugging Face LeRobot / GR00T / Cosmos note](https://blogs.nvidia.com/blog/hugging-face-lerobot-models-frameworks-open-robotics/)
- [NVIDIA/Isaac-GR00T](https://github.com/NVIDIA/Isaac-GR00T) (7.6k stars)
- [openvla/openvla](https://github.com/openvla/openvla) (6.7k stars)
- [Physical-Intelligence/openpi](https://github.com/Physical-Intelligence/openpi) (12.9k stars)
- Wikipedia — [Vision–language–action model](https://en.wikipedia.org/wiki/Vision%E2%80%93language%E2%80%93action_model) (background only)

### Lane A / UGV NLP control patterns

- [Cyberwave — voice-controlled UGV Beast tutorial](https://cyberwave.mintlify.app/tutorials/ugv-voice-controlled) (orchestrator pattern; not Hangar-endorsed stack)
- arXiv — [LLM NL commands for ROS 2 navigation](https://arxiv.org/html/2506.00075v1)

### Hangar owner truth

- `docs/NORTH_STAR.md` — G7 live command portal; autonomy in scope (AG2 repealed 2026-07-22)
- `docs/beast-ops.md` — Pi/Jetson stack, Socket.IO control, operating progression
- `src/data/hangar.ts` — insights `offload-split`, `wifi-tail`, `watchdog`, `thor-tier`,
  `lerobot-optional`, `robot-llm-lanes`, `beast-llm-jobs`

---

## Persistence

- Full brief: this file.
- Codex insights: `robot-llm-lanes`, `beast-llm-jobs` in `src/data/hangar.ts`.
- Activity ticker: researched event for `RND-ROBOT-LLM`.
- `docs/beast-ops.md`: one-line research pointer under operating progression / references.
