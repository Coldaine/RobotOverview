# BEAST-01 NVMe storage implementation

> **Execution-skill header:** Execute in small, reviewable batches. Run standard-library tests
> before implementation changes, inspect every systemd unit with `systemd-analyze verify`, and do
> not mutate the Jetson until the documentation/design PR is merged and the stacked workspace PR
> is reviewed.

**Status:** PROPOSED — NOT APPLIED as of 2026-07-11.

## Scope and interfaces

Implement the dependency-free Python 3.10+ storage utility in `ugv_ws` at
`deploy/storage/beast_storage.py`, with `beast-storage status`, `status --json`,
`maintain --dry-run`, and `maintain`. Use `/usr/bin/python3`; this does not change the ROS Humble
Python 3.10 ABI requirement. CI runs this storage-only suite on Python 3.10 and 3.12; it does not
run the ROS workspace on Python 3.12.

Install the following exact shape:

```text
/data/beast/{recordings/{blackbox,missions},datasets,maps,models,recovery-staging}  beast:beast 0750
/var/lib/beast/storage                                                        root:beast 0750
/var/lib/beast/storage/status-v1.json                                         root:beast 0640
/etc/beast/storage.env and /etc/beast/recording/*.topics                      root:root 0644
```

Defaults are `MIN_FREE_GIB=300`, `TARGET_FREE_GIB=350`,
`BLACKBOX_SESSION_SECONDS=900`, `MISSION_SPLIT_SECONDS=900`, `MISSION_SPLIT_GIB=4`,
`NVME_WARN_TEMP_C=65`, `NVME_CRITICAL_TEMP_C=70`, and `NVME_WARN_PERCENT_USED=80`.
There are no category-size caps. Below the minimum, prune only eligible closed black-box sessions
until the target is reached; do not automatically delete missions. If black-box cleanup cannot
recover the target, report recording unavailable.

## Exact implementation work

1. Add strict environment parsing, rooted path validation, category accounting, SMART parsing,
   retention, and atomic schema-v1 status JSON in `deploy/storage/beast_storage.py`.
2. Add `deploy/storage/beast_record`: sanitized timestamped output directories, lifetime advisory
   locks, recorder preflight, and SIGINT forwarding to `ros2 bag`.
3. Add `deploy/storage/install.sh`: dry-run by default, `--apply` required, idempotent creation,
   managed-file diffs before replacement, and no recorder enablement.
4. Add managed defaults, black-box and mission topic allowlists, and five units under
   `deploy/systemd/`: prepare, five-minute maintenance timer/service, disabled black-box service,
   and operator-triggered mission template. Limit maintenance writes to `/data/beast` and
   `/var/lib/beast/storage`; recorders run `beast:beast`, `UMask=0027`, and write only
   `/data/beast`.
5. Black box uses SQLite3 with Zstd, two threads, and 15-minute sessions. Missions use SQLite3
   without bag compression and split at 4 GiB or 15 minutes. Never use `ros2 bag record --all`.
   Reconcile OAK aliases with the physical graph before enabling either camera topic.
6. Add standard-library unit tests for invalid configuration, preparation idempotence, oldest-first
   pruning, lock/`.keep` protection, hysteresis, traversal and symlink rejection, labels, atomic
   replacement, SMART failures/transitions, recorder shutdown, and no third-party imports.
7. Add a storage-only GitHub Actions matrix for Python 3.10 and 3.12.

## Deployment, acceptance, and rollback

Merge this repository’s documentation/design PR first; review the stacked `ugv_ws` PR against the
Jetson branch; update the Jetson only to that reviewed commit. Run `install.sh` dry-run, inspect
all output, then run `sudo install.sh --apply`. Verify only documented paths exist, maintenance
dry-run behavior with disposable recording trees, then enable only
`beast-storage-maintenance.timer`. Black-box, mission, and motion services remain disabled.

Capture status JSON, unit state, disk use, SMART state, and logs; reboot and repeat. Following
physical attachment, capture the topic graph, reconcile documented aliases, record/replay short
black-box and full-sensor missions, measure GiB/hour and CPU, and enable black box only after replay
and space guards pass. Do not introduce category budgets without a reviewed measurement.

Rollback: stop and disable storage units, remove installed executables and managed configuration,
run `systemctl daemon-reload`, and preserve `/data/beast` and every recording. A later RobotOverview
PR changes this plan/runbook/dossier to VERIFIED with deployed commit, enabled units, rates, SMART
deltas, retention evidence, and rollback command.
