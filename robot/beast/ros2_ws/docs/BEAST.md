# BEAST-01 ↔ Hangar (Coldaine fork notes)

This repository is the **robot brain** for Patrick's Waveshare UGV Beast (BEAST-01)
on a Jetson Orin Nano. It is **not** the Hangar web app.

## Sibling repos (Windows PC)

| Role | Path | GitHub |
| --- | --- | --- |
| **This repo** (ROS 2 Humble) | `D:\_projects\ugv_ws` | [Coldaine/ugv_ws](https://github.com/Coldaine/ugv_ws) |
| Feature worktrees | `D:\_projects\.worktrees\ugv_ws-*` | same remote |
| Hangar (UI / plans / ops docs) | `D:\_projects\RobotOverview` | Coldaine/RobotOverview |
| On the robot | `~/beast/ugv_ws` | same remote |

`ugv_ws` does **not** live inside the Hangar folder. If you opened RobotOverview in
Cursor and cannot find ROS packages, open `D:\_projects\ugv_ws` (or a worktree).

List worktrees: `git -C D:\_projects\ugv_ws worktree list`.

## Who owns what

| Concern | Owner |
| --- | --- |
| Drivers, twist_mux, lidar, Nav2 behaviors, systemd, rosbridge | **this repo** |
| `/cockpit`, `/agent`, inventory, Datacore, beast-ops stamps | **RobotOverview** |
| Dated live HEAD / voltage / boot args | RobotOverview [`docs/beast-ops.md`](../../RobotOverview/docs/beast-ops.md) Quick connect (sibling path) |
| Dual-repo authority / topic map | RobotOverview [`docs/beast-control-topology.md`](../../RobotOverview/docs/beast-control-topology.md) |

Hangar never deploys here. Sync is: push from PC → `git pull` on Jetson → `colcon build`
→ restart units → stamp beast-ops.

## Upstream

Fork of [waveshareteam/ugv_ws](https://github.com/waveshareteam/ugv_ws). The root
`README.md` is still largely Waveshare's Pi/VM guide — prefer this file and Hangar
`docs/beast-ops.md` for Coldaine/BEAST-01 operating truth.
