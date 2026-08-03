# Web Cockpit Bridge

**The cockpit bridge is the only network surface the web cockpit talks to, there is
no authentication on it, and its topic whitelist is the only thing that keeps a
browser off `/cmd_vel`.**

The cockpit lives in this monorepo's web surface (route `/cockpit`). It speaks the
**rosbridge protocol** over a WebSocket. This page is the independently deployed robot
side: what it admits, why, and how to prove the boundary is real.

Package layout, node parameters and day-to-day operation:
[`src/ugv_main/ugv_cockpit/README.md`](../src/ugv_main/ugv_cockpit/README.md).

!!! danger "Disabled by default — enabling it is an operator decision"
    `beast-cockpit.service` ships **not enabled**. Bringing the robot up does not open
    a control socket: `bringup_lidar.launch.py` includes the twist_mux spine but never
    `cockpit.launch.py`, and `beast-ros-base.service` does not pull this unit in.

---

## Where the safety actually comes from

Four things, and none of them is an access-control list:

1. **`address: 127.0.0.1`.** The socket is not on the LAN or the tailnet at all.
   rosbridge's own default binds every interface — overriding that default is most of
   what `launch/rosbridge.launch.py` exists to do. It is not a launch argument, so
   `address:=0.0.0.0` is not one typo away.
2. **The topic whitelist.** A closed list of the five topics the shipped cockpit
   advertises. `/cmd_vel` and every mux rung above `cmd_vel_ui` are absent.
3. **`tailscale serve`** fronts `127.0.0.1:9090` as `wss` on the tailnet — the only
   *network* path in, terminating TLS with a real cert so an HTTPS page can open the
   socket without tripping mixed-content rules.
4. **The origin allowlist** (`COCKPIT_ALLOWED_ORIGINS`), because reachability gates the
   network but **not** the page — see the correction immediately below.

`authenticate: false` stays, because rosbridge's built-in authentication is a custom
service handshake the shipped client does not implement. Saying the socket is
unauthenticated is honest; calling it an ACL is not.

!!! danger "Correction: tailnet reachability does NOT gate a browser"
    An earlier version of this page said the socket was gated by reachability. **That
    is false for browser-originated connections, and it was the load-bearing claim in
    the threat model.**

    Verified in `rosbridge_suite`'s `humble` branch,
    `rosbridge_server/src/rosbridge_server/websocket_handler.py`:

    ```python
    @log_exceptions
    def check_origin(self, origin: str) -> bool:  # noqa: ARG002
        return True
    ```

    Tornado calls `check_origin` on every WebSocket handshake and upstream accepts
    unconditionally. WebSocket handshakes are **also exempt from the same-origin
    policy** — there is no CORS preflight, and a cross-origin `new WebSocket(...)` is
    not blocked. So *any web page open in any tab* on a tailnet-joined machine could
    connect to the robot and start publishing. The operator never has to visit anything
    related to the cockpit; an ad iframe would do.

    **What that bought an attacker was bounded, and the ladder held.** The publish glob
    admits only `/cmd_vel_ui` — mux rung 50, outranked by the robot-side pad (150) and
    the operator pad (100) — plus `/cmd_vel_estop_lock`. Motion is still gated by
    `allow_motion` and still stopped by the watchdog. This was never an arbitration
    bypass. It was a drive-by command surface the documented model did not cover.

    **Now closed** by `cockpit_rosbridge.py`, which replaces `check_origin` with an
    allowlist read from `COCKPIT_ALLOWED_ORIGINS`.

### Configuring the origin allowlist

`COCKPIT_ALLOWED_ORIGINS` is a comma-separated list of the origins **serving the
cockpit page** — the RobotOverview deployment, not the robot's own hostname. The
`Origin` header carries the page's origin, so this is the app's URL:

```bash
# /etc/beast/ugv.env  (already read by beast-cockpit.service)
COCKPIT_ALLOWED_ORIGINS=https://hangar.example.ts.net
```

Comparison is exact on `scheme://host[:port]`, case-insensitive, trailing slash
ignored. `http://` does **not** inherit an `https://` entry's trust, and subdomains do
not match.

!!! warning "Unset means every browser is denied — deliberately"
    Leave it unset and the cockpit page cannot connect at all. That is the intended
    failure direction: this whole file exists because *rosbridge's unset globs mean
    allow-all*, and repeating that mistake in the control written to fix it would be
    indefensible. The startup log says exactly what to set, and the service ships
    disabled, so an operator enabling it is already reading these docs.

!!! note "Clients with no `Origin` header are still admitted — a documented residual"
    Browsers always send `Origin` on a WebSocket handshake; page JavaScript can neither
    forge nor suppress it. A **missing** `Origin` therefore means a non-browser client
    — `roslibpy`, a native app, CLI tooling — and those are admitted, because refusing
    them breaks legitimate tooling without closing the drive-by hole, which is the
    actual gap.

    The residual is real and accepted: **a native (non-browser) client on a
    tailnet-joined machine can still reach this socket.** That is the same trust level
    the old reachability-only model extended to everyone; the change is that a web page
    no longer gets it for free.

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
| `/ugv/led_ctrl` | `std_msgs/Float32MultiArray` | Lights |
| `/pt_joint_position_controller/commands` | `std_msgs/Float64MultiArray` | Pan-tilt |
| `/ugv/pt_steady_ctrl` | `std_msgs/Float32MultiArray` | Pan-tilt levelling |

**Not admitted, deliberately:** `/cmd_vel` (the mux output), `/cmd_vel_joy_robot`,
`/cmd_vel_joy_operator`, `/cmd_vel_nav`, `/cmd_vel_nav_raw`, `/cmd_vel_smoothed`. A
client that could reach any of those could bypass the ladder or impersonate a source
that outranks the person standing next to the robot.

### Robot → client (`topics_sub_glob`)

`/ugv/voltage`, `/scan`, `/odom`, `/imu/raw`, `/diagnostics`, `/cockpit/status`,
`/ugv/allow_motion`, `/ugv/watchdog_state`, `/cockpit/overhead_clearance`, `/cockpit/depth/compressed`,
`/oak/rgb/image_raw/compressed`. Telemetry only — nothing here can move anything — but
the list stays closed so a client cannot enumerate and read whatever a later PR adds.

!!! note "`/imu/raw`, not `/imu/data`"
    `ugv_bringup` publishes `sensor_msgs/Imu` on **`imu/raw`**; its `imu/data_raw`
    publisher is commented out and no filter node republishes as `imu/data`. Nothing on
    this robot publishes `/imu/data`, so whitelisting it would be dead config that
    reads as a working feed.

    RobotOverview #148 landed the matching `/imu/raw` subscription and corrected
    `/ugv/led_ctrl` plus `/ugv/pt_steady_ctrl` to the robot's `Float32MultiArray`
    contract. The bridge also admits the client's direct allow-motion and watchdog
    subscriptions so safety state does not depend only on the 1 Hz aggregator.

### Services and actions

Both are `[]`. The `cockpit_rosbridge` wrapper also removes service and action
capabilities from the protocol entirely, and `rosapi_node` is **not launched**.
rosbridge 2.0.7 force-appends `/rosapi/*` to any non-empty `services_glob`, so
refusing rosapi by configuration alone is impossible; that append would otherwise
admit graph and parameter services outside this cockpit's required surface. The
topic-only wrapper is the real denial, while omitting rosapi avoids publishing an
unneeded sensitive service surface in the first place. This closes the service and
action API; it does **not** make the bridge read-only. The reviewed topic-publish globs
remain an intentional remote command ingress through the existing mux/gate/watchdog
path. The shipped cockpit uses only advertise / publish / subscribe, so nothing is lost.

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

!!! warning "NOT YET RUN on hardware (2026-07-31)"
    This check has never been executed on BEAST-01. **The whitelist boundary is
    unproven until it passes there.** Everything above is read from rosbridge's source
    and asserted by `test/test_cockpit_bridge.py`, which is a static check of the
    config — it cannot observe a running server rejecting a real publish. Treat the
    bridge as unverified in the meantime. **Strike this warning when the check has been
    run and passed.**

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
- **`armed`** answers exactly one question: *will the automatic stop happen?* True when
  the stop-on-silence timer exists, is not cancelled, and `cmd_vel_timeout > 0` —
  **independent of `allow_motion`**. A locked robot with a live watchdog reports
  `armed: true`, and the entry level is `OK`. It used to AND in `allow_motion`, which
  made amber "not armed" the resting state of a parked robot; a warning seen every day
  is a warning nobody reads, and a real watchdog failure would have arrived looking
  exactly like normal. `allow_motion` has its own topic and its own field in the strip.
- **`watching`** is the transient internal flag — a non-zero command is in flight and
  the next tick will time it. It flips on every zero command, which is why `armed` is
  the stable value the UI reads.
- **`fired`** latches the watchdog's own stop until something drives again, and is
  republished immediately on the transition rather than waiting for the next tick.
  Nothing outside `ugv_bringup` could observe this: the stop the watchdog sends is
  byte-identical to an operator's, so no external watcher could tell them apart.

!!! danger "Unknown is published as an ABSENT key, never as `false`"
    `cockpit_status` ages both topics out after 3 s — but what it does at the end of
    that window is **omit `allow_motion`, `armed` and `fired` entirely**, not publish
    them as `false`. They are equally absent *before* the first message ever arrives.

    The client renders a missing key as **unknown** and a present key as a reading it
    can trust. `false` is the conservative-looking rendering, and that is exactly what
    makes it the wrong one: on a robot where these publishers are not deployed yet, a
    published `false` shows a confident **LOCKED / OFF-LINE** that never once says *I
    cannot see the robot* — and nobody investigates a panel that looks correct.

    The `bringup` and `cockpit_safety_watchdog` entries themselves stay in the array
    either way, at **WARN**, with a message naming the silent topic, so the gap is
    legible in `ros2 topic echo /cockpit/status` as well as in the UI. Same rule the
    host metrics follow (an unreadable thermal zone must not render as a cold SoC).

!!! warning "These two halves must stay in lockstep — cross-repo"
    Omitting a key is only honest if the consumer renders absence as **UNKNOWN**. A
    client that defaulted a missing key to `false` would reintroduce the same confident
    lie by another route; one that defaulted it to `true` would be far worse.

    The matching client behaviour — absent key → UNKNOWN, and the drive gate keyed on
    the robot-reported `allow_motion` — is **merged** on RobotOverview main (#148,
    #149). Do not change the omission rule on either side alone, and do not "simplify"
    this back to always emitting the keys.

---

## What `/cockpit/status` reports

`cockpit_status` is an observer: it publishes no velocity, holds no lock, and changes
no parameter.

| Entry | Key | Where it comes from |
|---|---|---|
| `cockpit_safety_watchdog` | `armed`, `fired` | `/ugv/watchdog_state`. **Keys omitted** before the first message and again once it is 3 s stale |
| `twist_mux` | `active_source` | Derived by mirroring the ladder over the four rung topics + the lock |
| | `command_age` | Seconds since the winning source's last message; `-1` when nothing is driving |
| | `publisher_count` | Publishers on `/cmd_vel`. Healthy is exactly 1 |
| `bringup` | `allow_motion` | `/ugv/allow_motion`. **Key omitted** before the first message and again once it is 3 s stale |
| `system_metrics` | `wifi_rssi`, `disk_free`, `cpu_temp`, `gpu_temp` | `/proc/net/wireless`, `statvfs`, Jetson thermal zones |

`active_source` is an **outside reconstruction** of twist_mux's rule (highest
non-expired rung, 0.5 s expiry, an engaged lock masks everything). The published
message is suffixed `(mirrored)` so `ros2 topic echo` discloses that an entry named
`twist_mux` is not published by twist_mux.

!!! note "Why not just read twist_mux's own `/diagnostics`?"
    Checked against `ros-teleop/twist_mux`, `humble` branch. Two things an earlier
    draft of this page asserted are **false**, and are corrected here:
    `updateDiagnostics` runs on a **1 Hz wall timer** (`DIAGNOSTICS_PERIOD = 1s`), not
    only when a command arrives, so it does *not* go stale on silence; and
    `getLockPriority()` returns **255** while the e-stop lock is engaged and 0
    otherwise, so lock-engaged and idle *are* distinguishable.

    The actual reasons it cannot drive this strip:

    - `current priority` is the **lock** priority, not the winning source's. It says
      nothing about *which rung holds the floor* — the one fact `active_source` exists
      to report. All four rungs publish the same number.
    - The per-topic `velocity <name>` keys do expose masked/unmasked, but only at 1 Hz
      and only as formatted human-readable strings. That is half this node's 2 Hz
      publish rate, and it would make the cockpit's arbitration display depend on
      parsing upstream's diagnostic prose — not a wire contract, and rewordable in any
      release.

    Mirroring the documented arbitration rule over the same topics is coarser in no
    dimension and does not depend on upstream's presentation strings.

Unreadable host metrics still emit the client's own fallback value (so the string
parses), but the entry level goes to **WARN** and its message names them, so the gap is
visible in `ros2 topic echo` rather than rendering as a cold SoC.
