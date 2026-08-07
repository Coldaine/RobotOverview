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

Defaults are `BLACKBOX_MAX_GIB=150`, `MISSIONS_MAX_GIB=900`, `MIN_FREE_GIB=300`,
`TARGET_FREE_GIB=350`, `BLACKBOX_SESSION_SECONDS=900`, `MISSION_SPLIT_SECONDS=900`,
`MISSION_SPLIT_GIB=4`, `NVME_WARN_TEMP_C=65`, `NVME_CRITICAL_TEMP_C=70`, and
`NVME_WARN_PERCENT_USED=80`.

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
and space guards pass. Initial budgets do not change without a reviewed measurement.

Rollback: stop and disable storage units, remove installed executables and managed configuration,
run `systemctl daemon-reload`, and preserve `/data/beast` and every recording. A later RobotOverview
PR changes this plan/runbook/dossier to VERIFIED with deployed commit, enabled units, rates, SMART
deltas, retention evidence, and rollback command.


---

## Policy and rejected alternatives (moved from `beast-ops.md`, 2026-08-07)

This planning prose lived in the operating doc, which is reserved for how BEAST-01 runs
now. It is planning, so it belongs with the implementation plan it governs.


**Measured 2026-07-11:** the installed Micron 2400 has a 1.9 TiB ext4 `APP` partition with 28 GB
used and approximately 1.8 TiB available. SMART reported 44 °C, 1% lifetime used, 100% available
spare, and zero media errors. The existing unsafe-shutdown (62) and error-log (91) counters are
comparison baselines; weekly TRIM is already enabled.

Keep the 2 TB drive and leave the partition, Docker, journald, mount options, and filesystem
unchanged. A 512 GB replacement would offer no useful weight or power reduction, would cut rated
endurance from 600 TBW to 150 TBW, and would unnecessarily constrain sensor recording.
`/data/beast` will be the stable data interface for recordings, datasets, maps, models, and
recovery staging. It initially resides on `APP`; it may become a distinct mount later without
changing recorder, dataset, map, model, or recovery consumers. Proposed recording budgets are
150 GiB black-box, 900 GiB missions, a 300 GiB minimum free floor, and 350 GiB target free.
Automated retention is limited to eligible closed recordings and never deletes datasets, maps,
models, recovery staging, Docker data, or unrelated paths. Onboard recovery staging is not an
independent backup.

Planned layout and maintenance policy:

```text
/data/beast/
├── recordings/blackbox/        rolling telemetry and sensor context
├── recordings/missions/        operator-started full-sensor captures
├── datasets/  maps/  models/   never automatically pruned
└── recovery-staging/           recovery transfer area, not a backup
```

Maintenance first skips active advisory locks and `.keep` recordings, never follows symlinks,
caps black box then missions oldest-first, and below the floor restores the target by pruning
black box before missions. If protected or eligible data cannot restore the floor, recording
stops or is rejected. SMART is `unknown` when absent or malformed; `warning` at 65 °C, 80%
lifetime used, 10% or less spare, or a counter increase; `critical` for a critical-warning bit,
70 °C, 100% lifetime used, exhausted spare, or increased media errors. Illustrative planning
rates (not measurements): black box 1–5 GiB/hour, full camera/depth mission 30–100 GiB/hour;
actual rates must be measured after the physical topic graph is known.

Rejected approaches, recorded so they are not re-litigated: repartitioning now (flash/recovery
risk without a present capacity benefit), dual-root / A-B rootfs (complexity unrelated to
retention; reconsider only as a separate recovery project), quotas or Docker relocation
(adds behavior to a healthy filesystem while leaving retention unsolved; the directory-level
policy has a smaller blast radius). Offload selected missions and recovery artifacts before any
destructive device work; a future separate-volume mount at `/data/beast` requires a reviewed
maintenance window and a tested rollback.

Do not provision or enable storage units from this section yet. Follow the [command-level implementation plan](plans/2026-07-11-beast-nvme-storage-implementation.md). Once that implementation plan is approved and its dry-run checks pass, only `beast-storage-maintenance.timer` may be enabled. Keep black-box, mission, and motion storage units disabled until the documentation PR is merged, the stacked workspace change is reviewed, and physical recording/replay validation succeeds. An interactive [storage dossier](../design/beast-storage/index.html) walks the same policy visually.
