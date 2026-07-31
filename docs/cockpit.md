# Web Cockpit Bridge

**The cockpit bridge is the only network surface the web cockpit talks to, there is
no authentication on it, and its topic whitelist is the only thing that keeps a
browser off `/cmd_vel`.**

The cockpit itself lives in a different repository
([Coldaine/RobotOverview](https://github.com/Coldaine/RobotOverview), route `/cockpit`).
It speaks the **rosbridge protocol** over a WebSocket. This page is the robot side:
what it admits, why, and how to prove the boundary is real.

Package layout, node parameters and day-to-day operation:
[`src/ugv_main/ugv_cockpit/README.md`](https://github.com/Coldaine/ugv_ws/blob/beast/jetson-orin-nano-adaptation/src/ugv_main/ugv_cockpit/README.md).

!!! danger "Disabled by default — enabling it is an operator decision"
    `beast-cockpit.service` ships **not enabled**. Bringing the robot up does not open
    a control socket: `bringup_lidar.launch.py` includes the twist_mux spine but never
    `cockpit.launch.py`, and `beast-ros-base.service` does not pull this unit in.

---

## Where the safety actually comes from

Three things, and none of them is an access-control list:

1. **`address: 127.0.0.1`.** The socket is not on the LAN or the tailnet at all.
   rosbridge's own default binds every interface — overriding that default is most of
   what `launch/rosbridge.launch.py` exists to do. It is not a launch argument, so
   `address:=0.0.0.0` is not one typo away.
2. **The topic whitelist.** A closed list of the five topics the shipped cockpit
   advertises. `/cmd_vel` and every mux rung above `cmd_vel_ui` are absent.
3. **`tailscale serve`** fronts `127.0.0.1:9090` as `wss` on the tailnet — the only
   path in, terminating TLS with a real cert so an HTTPS page can open the socket
   without tripping mixed-content rules.

`authenticate: false` stays, because rosbridge's built-in authentication is a custom
service handshake the shipped client does not implement. Saying the socket is
unauthenticated and gated by reachability is honest; calling that an ACL is not.

---

## The whitelist

[`twist_mux`](command_arbitration.md) decides *whose* command wins. It cannot stop a
websocket client from publishing straight onto `/cmd_vel` and skipping arbitration,
because ROS 2 has no notion of topic ownership. **The glob whitelist is what makes the
mux unbypassable from a browser.**

### Client → robot (`topics_pub_glob`)

| Topic | Type | Why it is admitted |
|---|---|---|
| `/cmd_vel_ui` | `geometry_msgs/Twist` | The mux's **priority-50 rung**. A pad at the robot (150) or an operator pad (100) always outranks it |
| `/cmd_vel_estop_lock` | `std_msgs/Bool` | Remote priority-255 lock control: `true` stops; `false` releases the lock and may expose the next live source |
| `/ugv/led_ctrl` | `std_msgs/Int32MultiArray` | Lights |
| `/pt_joint_position_controller/commands` | `std_msgs/Float64MultiArray` | Pan-tilt |
| `/ugv/pt_steady_ctrl` | `std_msgs/Float64MultiArray` | Pan-tilt levelling |

**Not admitted, deliberately:** `/cmd_vel` (the mux output), `/cmd_vel_joy_robot`,
`/cmd_vel_joy_operator`, `/cmd_vel_nav`, `/cmd_vel_nav_raw`, `/cmd_vel_smoothed`. A
client that could reach any of those could bypass the ladder or impersonate a source
that outranks the person standing next to the robot.

### Robot → client (`topics_sub_glob`)

`/ugv/voltage`, `/scan`, `/odom`, `/imu/raw`, `/diagnostics`, `/cockpit/status`,
`/cockpit/overhead_clearance`, `/cockpit/depth/compressed`,
`/oak/rgb/image_raw/compressed`. Telemetry only — nothing here can move anything — but
the list stays closed so a client cannot enumerate and read whatever a later PR adds.

!!! note "`/imu/raw`, not `/imu/data`"
    `ugv_bringup` publishes `sensor_msgs/Imu` on **`imu/raw`**; its `imu/data_raw`
    publisher is commented out and no filter node republishes as `imu/data`. Nothing on
    this robot publishes `/imu/data`, so whitelisting it would be dead config that
    reads as a working feed.

### Services and actions

Both are `[]`. The `cockpit_rosbridge` wrapper also removes service and action
capabilities from the protocol entirely, and `rosapi_node` is **not launched**.
rosbridge 2.0.7 force-appends `/rosapi/*` to any non-empty `services_glob`, so
refusing rosapi by configuration alone is impossible; that append would otherwise
admit graph and parameter services outside this cockpit's required surface. The
topic-only wrapper is the real denial, while omitting rosapi avoids publishing an
unneeded sensitive service surface in the first place. This preserves the "this
package adds no motion path" claim. Not starting the node is the only real denial. The
shipped cockpit uses only advertise / publish / subscribe, so nothing is lost.

---

## How rosbridge actually enforces this

Verified against **rosbridge_suite 2.0.7** (what `ros-humble-rosbridge-suite` resolves
to) by reading its source, not its documentation.

- `topics_pub_glob` is checked in `advertise` **and in every individual `publish`**.
  The per-publish check is the load-bearing one: a `publish` op can create a publisher
  for a topic that was never advertised. `topics_sub_glob` gates `subscribe`.
- Matching is `fnmatch.fnmatch(topic, glob)`, fully anchored. With no wildcards in our
  entries only the exact string matches — `/cmd_vel` cannot match `/cmd_vel_ui`, a
  missing leading slash fails closed, and matching is case-sensitive on Linux.

!!! danger "Three ways to write a glob that silently does the wrong thing"
    Each produces a config that looks fine and behaves catastrophically. All three are
    asserted by `test/test_cockpit_bridge.py`.

    - **An unset glob is ALLOW-ALL.** rosbridge maps an empty string to `None`, and
      every capability reads `None` as "no restriction". Forgetting a glob opens the
      bridge; it does not close it. `"[]"` parses to an empty *list*, which is not
      `None` and does deny everything.
    - **The value must be bracketed.** rosbridge slices `value[1:-1]` before splitting,
      so an unbracketed string silently loses its first and last character —
      `/cmd_vel_ui` becomes `cmd_vel_u` and matches nothing.
    - **Double quotes are not stripped.** Only single quotes are. A double-quoted entry
      keeps its quote characters and becomes a glob that matches no topic at all.

    The legacy `topics_glob` is left unset on purpose: it merges into *both* the pub and
    the sub list, so setting it widens the publish whitelist as a side effect of any
    subscribe change.

!!! warning "Denials are silent to the client"
    A rejected publish logs a warning **on the robot** and returns. The browser gets no
    error, no rejection, no callback — the button appears to work. A broken whitelist
    therefore cannot be detected from the cockpit, which is why the commissioning check
    below exists and why the whitelist has a static test.

---

## Commissioning check — prove the boundary is live

Run once after installing, and again after any change to the globs.

**Terminal 1 — watch the mux output:**

```bash
ros2 topic echo /cmd_vel
```

**Terminal 2 — watch the bridge's own log:**

```bash
journalctl -u beast-cockpit.service -f
```

**Terminal 3 — try to bypass the mux.** From any rosbridge client (the browser console
on the cockpit page will do), send a publish op aimed at the mux output:

```json
{"op": "publish", "topic": "/cmd_vel",
 "msg": {"linear": {"x": 0.1, "y": 0.0, "z": 0.0},
         "angular": {"x": 0.0, "y": 0.0, "z": 0.0}}}
```

**Pass criteria — all three:**

1. Terminal 1 shows **nothing**. Not a zero Twist, nothing at all.
2. Terminal 2 logs `No match found for topic, cancelling publish to: /cmd_vel`.
3. The client reports no error — that is the expected silent denial, not a fault.

Then repeat with `"topic": "/cmd_vel_ui"` and confirm the opposite: the message lands,
`twist_mux` forwards it, and `/cmd_vel` shows it. A whitelist that denies everything is
just as broken as one that denies nothing, and only this second half catches it.

---

## E-stop: the client must republish at ≥ 1 Hz

The lock ships with `timeout: 0.0`, so `twist_mux` never treats silence on
`cmd_vel_estop_lock` as engagement — and it subscribes with **volatile** durability, so
a single `--once` publish can be lost to the discovery race and the lock does not
survive a `twist_mux` restart.

**An e-stop client MUST re-publish `true` at least once per second for as long as the
stop is engaged**, and publish `false` repeatedly to release. This is a contract on the
client because it cannot be enforced in config. Full reasoning:
[Command Arbitration → Emergency lock](command_arbitration.md#emergency-lock).

---

## Deploying

### 1. Dependencies and build

```bash
sudo apt install ros-humble-rosbridge-suite      # also pulled by build_first.sh
colcon build --packages-select ugv_bringup ugv_cockpit --symlink-install
```

`ugv_bringup` is in that list because the cockpit's arming display depends on the two
topics it now publishes — see [Safety state](#safety-state-the-cockpit-gates-on) below.

### 2. Install the unit (still not enabled)

```bash
sudo install -D -m 0644 deploy/systemd/beast-cockpit.service \
  /etc/systemd/system/beast-cockpit.service
sudo systemctl daemon-reload
```

### 3. Expose it over the tailnet

The bridge binds `127.0.0.1:9090` and nothing else. `tailscale serve` terminates TLS
and is the **only** thing that fronts it:

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:9090
sudo tailscale serve status
```

The cockpit then connects to `wss://beast-01.<tailnet>.ts.net/`.

!!! note "No firewall hole is needed"
    Port 9090 is bound to loopback, so it is unreachable from the LAN and from the
    tailnet whether or not UFW is running. Do **not** add a rule for it: a rule for a
    loopback-only port is at best noise, and at worst a licence to move the bind
    address later. `tailscale serve` needs no inbound rule either — the tailnet arrives
    over WireGuard on Tailscale's own UDP port.

### 4. Start it, deliberately

```bash
sudo systemctl start beast-cockpit.service           # this session only
sudo systemctl enable --now beast-cockpit.service    # every boot — think first
sudo systemctl disable --now beast-cockpit.service   # close it again
```

Leaving it enabled means the robot boots with a control socket listening. That is a
reasonable choice for a robot that lives behind a tailnet; it is a choice, and it
should be made on purpose.

---

## Safety state the cockpit gates on

`ugv_bringup` publishes two topics whose only consumer is the cockpit's safety strip.
They exist so the browser can gate its drive controls on what the **robot** reports,
rather than on what the UI last sent.

| Topic | Type | Contents |
|---|---|---|
| `/ugv/allow_motion` | `std_msgs/Bool` | The arming gate value `ugv_bringup` actually enforces |
| `/ugv/watchdog_state` | `diagnostic_msgs/DiagnosticStatus` | `armed`, `fired`, plus `watching` and `timeout` |

Both are published at 2 Hz with `TRANSIENT_LOCAL` durability, so a client connecting
between ticks gets the current state immediately, and the periodic republish is what
lets `cockpit_status` notice that `ugv_bringup` has died.

- **`allow_motion`** is the value the node latched at startup and enforces in
  `cmd_vel_callback` — not the parameter server's current value, which nothing
  re-reads. Publishing the *enforced* value is what makes the gate honest.
- **`armed`** means "the stop-on-silence protection is live on the motion path", i.e.
  motion is allowed *and* `cmd_vel_timeout > 0`. With motion locked there is no motion
  path to protect, and the cockpit shows that separately.
- **`watching`** is the transient internal flag — a non-zero command is in flight and
  the next tick will time it. It flips on every zero command, which is why `armed` is
  the stable value the UI reads.
- **`fired`** latches the watchdog's own stop until something drives again, and is
  republished immediately on the transition rather than waiting for the next tick.
  Nothing outside `ugv_bringup` could observe this: the stop the watchdog sends is
  byte-identical to an operator's, so no external watcher could tell them apart.

`cockpit_status` ages both topics out after 3 s. A dead `ugv_bringup` therefore decays
to "motion locked / watchdog unknown" instead of latching "motion armed" from two
minutes ago.

---

## What `/cockpit/status` reports

`cockpit_status` is an observer: it publishes no velocity, holds no lock, and changes
no parameter.

| Entry | Key | Where it comes from |
|---|---|---|
| `cockpit_safety_watchdog` | `armed`, `fired` | `/ugv/watchdog_state`, aged out after 3 s |
| `twist_mux` | `active_source` | Derived by mirroring the ladder over the four rung topics + the lock |
| | `command_age` | Seconds since the winning source's last message; `-1` when nothing is driving |
| | `publisher_count` | Publishers on `/cmd_vel`. Healthy is exactly 1 |
| `bringup` | `allow_motion` | `/ugv/allow_motion`, aged out after 3 s |
| `system_metrics` | `wifi_rssi`, `disk_free`, `cpu_temp`, `gpu_temp` | `/proc/net/wireless`, `statvfs`, Jetson thermal zones |

`active_source` is an **outside reconstruction** of twist_mux's rule (highest
non-expired rung, 0.5 s expiry, an engaged lock masks everything). twist_mux's own
`/diagnostics` output cannot be used instead: it publishes `current priority` as a bare
integer that only refreshes when a command arrives — so it goes stale rather than
falling to zero on silence — and that collapses to `0` both for "nothing active" and
for "lock engaged", exactly the two states the cockpit most needs to tell apart.

Unreadable host metrics still emit the client's own fallback value (so the string
parses), but the entry level goes to **WARN** and its message names them, so the gap is
visible in `ros2 topic echo` rather than rendering as a cold SoC.
