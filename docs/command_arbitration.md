# Command Arbitration (twist_mux)

**`twist_mux` is the only publisher of `/cmd_vel`.** Every velocity source in this
workspace publishes to a mux *input* topic instead, and `twist_mux` decides which one
reaches `ugv_bringup` — and therefore the ESP32 and the tracks.

The node is launched by [`ugv_cockpit`](#package) and included unconditionally from
[`bringup_lidar.launch.py`](bringup.md#launch-physical-robot), so the spine is up
whenever the driver is up. There is no argument to switch it off: with every source
rerouted, a bringup without `twist_mux` has no path to the motors at all.

!!! warning "This is arbitration, not a stop"
    `twist_mux` never publishes a stop of its own. When the winning source goes
    silent it simply stops emitting. The thing that makes the robot *stop* is
    `ugv_bringup`'s 0.5 s `cmd_vel_timeout` watchdog, which is independent of
    everything on this page. See [Hardware Driver](bringup.md).

---

## The ladder

Higher priority always wins, unless that source has expired (no message for
`timeout` seconds) or is masked by an active lock.

| Priority | Input topic | Who publishes it |
|---:|---|---|
| **255** | `cmd_vel_estop_lock` (`std_msgs/Bool`, **lock, not a Twist source**) | Emergency stop — masks every source below it |
| **150** | `cmd_vel_joy_robot` | `ugv_tools` `joy_ctrl` — gamepad attached to the robot itself |
| **100** | `cmd_vel_joy_operator` | `ugv_tools` `keyboard_ctrl` over SSH; the operator's remote gamepad |
| **50** | `cmd_vel_ui` | On-screen teleop — Vizanti's teleop widget, and any browser cockpit |
| **10** | `cmd_vel_nav` | Everything autonomous: Nav2's `collision_monitor` output, `behavior_ctrl`, the `ugv_slam` LiDAR demos, the `ugv_vision` tracking demos |

Every Twist source uses a **0.5 s timeout** — the same cadence `ugv_bringup` uses to
decide nobody is talking to it.

**A human always outranks autonomy**, and someone standing at the robot outranks
someone driving it remotely. That ordering is the whole point of the ladder.

Config: `src/ugv_main/ugv_cockpit/config/twist_mux.yaml`.

---

## What changed for you

Before, every teleop node and every demo published `/cmd_vel` directly, so running two
at once meant two publishers fighting over the same topic with no defined winner. The
docs' old advice — "stop every other motion source first" — was the only protection.

Now the ladder resolves it. You can leave a LiDAR demo running and take over with the
keyboard: the keyboard is priority 100, the demo is priority 10, so the keyboard wins
for as long as you keep sending. Stop driving and the demo gets the floor back about
0.5 s later — which means **"I stopped driving" is not the same as "the robot
stopped."** Stop the demo, or engage the lock, if you want it to stay stopped.

Running two sources at the *same* priority (two UI surfaces, say) is still undefined —
they interleave. One source per rung at a time.

### Idle sources let go of the floor

The handover above only works because **an idle teleop source stops publishing.** This
is a real constraint on every velocity source, not an implementation detail:

> twist_mux gives `/cmd_vel` to the highest-priority source that has not expired, and
> **any** message refreshes that source's timer — including a zero Twist. A node that
> streams zeros while idle therefore holds its rung forever and starves everything
> below it, with nothing visibly wrong.

So `keyboard_ctrl` and `joy_ctrl` both send a **bounded tail of zeros** when their
input returns to neutral — `ZERO_TAIL_LIMIT = 5` messages, matching `ugv_bringup`'s own
`zero_vel_limit` — and then **go silent** until you touch the controls again. The tail
is what stops the robot by command; the silence is what releases the rung. `joy_node`
is launched with `autorepeat_rate: 0.0` for the same reason, so a gamepad left plugged
in does not manufacture 20 Hz of zeros on its own.

Any new velocity source must follow the same rule: **stream while commanding, fall
silent while idle.**

## Nav2's path to the mux

Nav2 keeps its own internal chain and its own stop authority; only its final output
goes to the mux:

```
controller_server --(cmd_vel -> cmd_vel_nav_raw)--> velocity_smoother
                  --(cmd_vel_smoothed)-----------> collision_monitor
                  --(cmd_vel_out_topic: cmd_vel_nav)--> twist_mux
                  --(cmd_vel_out -> /cmd_vel)-------> ugv_bringup
```

The controller-to-smoother hop used to be called `cmd_vel_nav`. It is now
`cmd_vel_nav_raw` so `cmd_vel_nav` means exactly one thing: the velocity Nav2 has
finished deciding on. `collision_monitor` stays last inside Nav2 so it can still veto
motion before the mux ever sees it.

## Emergency lock

`cmd_vel_estop_lock` is a `std_msgs/Bool` **lock topic**, not a velocity source.
Publish `true` to engage (every source below 255 is masked), `false` to release.

It ships with `timeout: 0.0` — a pure manual toggle. This is deliberate: `twist_mux`
lock handles initialise their last-received timestamp at epoch zero, so any non-zero
timeout would read as *already expired*, i.e. **engaged from the moment the node
starts**, and stay engaged until something publishes a heartbeat. Nothing publishes
this topic yet, so a non-zero timeout would ship a robot that can never be commanded.

!!! danger "Publish the lock repeatedly — `--once` is not enough"
    `twist_mux` subscribes to lock topics with **volatile** durability (upstream
    behaviour; we cannot change it). Two things follow, and every e-stop client has to
    design around both:

    - **A single `--once` publish can be lost.** Volatile delivery only reaches
      subscriptions that are already matched when the message is sent, so a publisher
      that connects and immediately publishes can lose the race with discovery — and
      the e-stop silently does nothing.
    - **The lock does not survive a `twist_mux` restart.** Nothing is latched, so a mux
      that crashes or is relaunched comes back with the lock **released**, whatever was
      published before.

    **Contract: an e-stop client MUST re-publish the lock state at ≥ 1 Hz for as long
    as the stop is engaged**, not once on the button press. The repetition is what
    makes engagement survive both the matching race and a mux restart.

    This cannot be enforced in config: with `timeout: 0.0`, `twist_mux` never treats
    silence on this topic as engagement.

!!! note "Standing gap"
    Because nothing publishes `cmd_vel_estop_lock` yet, the lock is currently
    **inert** — the topic is wired so the contract is fixed before any client exists.
    When a heartbeat publisher lands, changing `timeout` to `0.5` turns this into a
    fail-locked e-stop with no code change.

## Package

`ugv_cockpit` (`src/ugv_main/ugv_cockpit/`) owns the spine:

| Path | What |
|---|---|
| `config/twist_mux.yaml` | The ladder, timeouts, and the lock |
| `launch/twist_mux.launch.py` | The one node allowed to publish `/cmd_vel` |
| `test/test_twist_mux_spine.py` | Fails if anyone reintroduces a direct `/cmd_vel` publisher |

Requires `ros-humble-twist-mux` (installed by `build_first.sh`).

The node is launched **without `respawn`**, deliberately. If `twist_mux` dies, `/cmd_vel`
has no publisher at all and `ugv_bringup`'s watchdog stops the robot — the fail-closed
direction. Auto-respawning would bring the arbiter back in a fresh state with the
e-stop lock released, which is strictly worse than stopping and making someone look.

```bash
colcon test --packages-select ugv_cockpit
```

!!! danger "What this does not do"
    `twist_mux` cannot *prevent* a direct publish — ROS 2 has no topic ownership, so
    `ros2 topic pub /cmd_vel ...` from a shell still reaches `ugv_bringup`. What the
    spine guarantees is that no **code in this workspace** does it, and that the test
    above fails if that changes. It also does not touch `allow_motion`: that gate
    still decides whether a non-zero command reaches the ESP32 at all.
