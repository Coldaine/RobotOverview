# Robot Control LLMs — Hangar Briefing

**Status:** RESEARCH BRIEF — sourced 2026-07-22. No robot behavior, deploy, or inventory
purchase decisions are changed by this document.

**Codename:** `RND-ROBOT-LLM`

**Audience:** Hangar operator + agents planning supervised BEAST-01 control upgrades.

**North Star constraint:** Hangar is never unattended autonomy (AG2). Any LLM / VLA path
must stay human-supervised, with e-stop / stale-command watchdog / motor PID remaining
onboard reflexes.

---

## Verdict for BEAST-01

Treat “robot control LLMs” as **three different products**, not one:

| Lane | What it does | Hangar fit now |
| --- | --- | --- |
| **A. Language orchestrator** | NL / voice → structured teleop or Nav2 goals | Near-term after Socket.IO / ROS2 cutover; runs offboard on CORE-PRIME |
| **B. VLA / imitation policy** | Camera (+ language) → continuous actions | Research after Orin cutover + demo recording; LeRobot / SmolVLA / ACT first |
| **C. World action model (WAM)** | Shared world model that reasons, simulates, and emits actions | Horizon research; NVIDIA Cosmos 3 Edge is the headline open edge checkpoint |

**Do not** put a closed-loop VLA or WAM on the motion path until Orin physical cutover,
watchdog validation, and a supervised “propose → confirm → execute” gate exist in the
Hangar portal. Current Pi stack remains teleop + Socket.IO.

---

## 1. Why this briefing exists

BEAST-01’s operating progression already ends with “ROS2 … even LLM-driven natural-language
control” (`docs/beast-ops.md`). The fleet also already encodes an offload doctrine:

- CORE-PRIME (RTX 5090): train + VLM/LLM reasoning + heavy perception
- EDGE-PI / future BEAST-JETSON: teleop, stream, watchdog, dropout-proof reflexes
- WiFi tail is the enemy; median latency is not (`wifi-tail`, `offload-split`, `watchdog`)

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

- Strength: cheap to stand up; reuses classical stacks; easy to keep a human confirm step.
- Weakness: not continuous closed-loop control; grounding fails without vision or a map;
  latency is turn-based (hundreds of ms to seconds), so it is a **supervisor**, not a
  servo.
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
3. North Star AG2 forbids unattended closed-loop control. Even a perfect Edge policy would
   enter Hangar as a **supervised proposer**, never as silent autonomy.
4. Existing Hangar insights already say Thor is industrial-tier for large onboard VLAs
   (`thor-tier`). T2000/T3000 soften the price/power curve later; they do not erase the
   “hobby rover within AP range” offload doctrine.

**Where Edge *does* fit Hangar compute:**

- **CORE-PRIME (5090):** fine-tune / distill / evaluate Cosmos Edge or Nano; generate
  synthetic trajectories; run heavier reasoner modes with human confirm.
- **BEAST-JETSON (Orin Nano Super):** after cutover, candidate for **smaller** LeRobot
  policies (ACT / SmolVLA class) and classical Isaac / ROS perception — not assumed to
  host full Edge 15 Hz claims.
- **Thor research row:** keep as horizon hardware if/when an onboard WAM is required
  outside WiFi coverage; revisit when T2000 street availability and power budget are real.

---

## 4. Map onto Hangar architecture

```text
 Operator (Hangar UI / voice)
        │  propose / confirm
        ▼
 ┌──────────────────────────────┐
 │ CORE-PRIME  RTX 5090         │  Lane A LLM planner
 │  + optional VLA / Cosmos     │  Lane B/C training & heavy infer
 └─────────────┬────────────────┘
               │ WiFi 6 (design for tail)
               ▼
 ┌──────────────────────────────┐
 │ Onboard host (Pi now / Orin) │  stream · watchdog · validate
 │  never silent autonomy       │
 └─────────────┬────────────────┘
               │ UART JSON
               ▼
         ESP32 PID / stop
```

Binding rules already in Hangar memory:

- Offload yes: training, VLM/LLM reasoning, heavy perception.
- Offload risky: tight visual servoing.
- Offload no: collision avoidance, e-stop, motor PID (`offload-split`).
- Stale-command watchdog stays onboard (`watchdog`).

Suggested capability layering (conceptual — not schema changes):

1. **Supervised NL teleop** (Lane A) on top of Socket.IO / later ROS2.
2. **Demo recording** to `/data/beast/datasets` once NVMe storage policy is applied.
3. **LeRobot ACT / SmolVLA** experiments offboard, replay on lifted tracks.
4. **Cosmos Edge / Nano** only after (2)–(3) exist and embodiment adapters are defined.

---

## 5. Recommended Hangar progression

Ordered so each step stays supervised and reversible:

1. **Finish physical Orin cutover gates** already listed in `docs/beast-ops.md`
   (UART, telemetry, camera, LiDAR, lifted-track heartbeat-stop). Without this, every
   “onboard policy” claim is fiction.
2. **Hangar supervised command view** — human confirms every motion chunk; reuse
   `tools/beast-probe.mjs` safety culture (zero-speed default).
3. **Lane A prototype** — multimodal LLM returns clamped `{L,R,duration}` or Nav2 goals;
   reject unknown verbs; hard speed caps; require confirm.
4. **Record teleop demos** for Undercroft / deck lanes once storage layout lands.
5. **Lane B on CORE-PRIME** — train ACT or SmolVLA via LeRobot; evaluate in sim or
   lifted-track before floor contact.
6. **Lane C research spike** — pull `nvidia/Cosmos3-Edge` + Policy-DROID on the 5090;
   measure VRAM / Hz; decide whether UGV post-train is worth a mission; do **not**
   purchase Thor for this spike.

Anti-goals for this research lane:

- No unattended patrol loops driven by an LLM/VLA.
- No “replace PID with the transformer.”
- No assuming DROID arm checkpoints transfer to tracks without data.

---

## 6. Decision matrix (Hangar-specific)

| Question | Answer |
| --- | --- |
| Is Cosmos 3 Edge relevant? | Yes — as the open edge WAM reference and future post-train base. |
| Does it change the Orin buy / cutover? | No. Orin remains the owned CUDA edge host. |
| Does it put Thor on the buy list? | No. Keep researching; T2000/T3000 may revise tiering later. |
| Best first LLM control for Beast? | Lane A orchestrator over Socket.IO/ROS2 with confirm + clamps. |
| Best first learned policy stack? | LeRobot (ACT → SmolVLA), trained on CORE-PRIME. |
| When to touch Cosmos Edge Policy-DROID? | After demo recording exists **or** as a 5090 lab spike for manipulation arms, not as UGV day-one control. |
| Hangar UI role? | Portal for telemetry / video / supervised teleop; LLM outputs are proposals. |

---

## 7. Open questions

- Can Cosmos 3 Edge run usefully (even offline / non-real-time) on Orin Nano 8GB, or is
  Thor the honest floor for the 15 Hz claim?
- What action dimensionality / adapter makes Beast differential drive + gimbal fit Cosmos’s
  common action vectors?
- For Undercroft cable haul, is Lane A + classical CV enough that Lane B never pays off?
- Should Hangar grow an explicit `capability` for “supervised NL control” separate from
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

- `docs/NORTH_STAR.md` — AG2 supervised portal, no unattended autonomy
- `docs/beast-ops.md` — Pi/Jetson stack, Socket.IO control, operating progression
- `src/data/hangar.ts` — insights `offload-split`, `wifi-tail`, `watchdog`, `thor-tier`,
  `lerobot-optional`

---

## Persistence

- Full brief: this file.
- Codex insight: `robot-llm-lanes` in `src/data/hangar.ts`.
- Activity ticker: researched event for `RND-ROBOT-LLM`.
- `docs/beast-ops.md`: one-line research pointer under operating progression / references.
