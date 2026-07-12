# BEAST-01 2 TB NVMe storage design

**Status:** PROPOSED — measured baseline captured 2026-07-11. This document makes no change to
the Jetson or its filesystem.

## Decision

Retain the installed 2 TB Micron 2400 NVMe. The current 1.9 TiB ext4 `APP` partition remains
unchanged: no reflash, repartition, dual-root scheme, ext4 quotas, Docker relocation, or mount
option change. A 512 GB replacement would offer no useful weight or power reduction, would reduce
rated endurance from 600 TBW to 150 TBW, and would unnecessarily constrain sensor recording.

`/data/beast` is the stable application-facing interface. It initially resides on `APP`; it can
become a distinct mount later without changing recorder, dataset, map, model, or recovery
consumers.

## Measured storage and health baseline

| Fact | Baseline |
| --- | --- |
| Capacity | 1.9 TiB ext4 `APP` partition — **MEASURED 2026-07-11** |
| Used / available | 28 GB used / approximately 1.8 TiB available — **MEASURED 2026-07-11** |
| Temperature | 44 °C — **MEASURED 2026-07-11** |
| NVMe lifetime used / spare | 1% / 100% — **MEASURED 2026-07-11** |
| Media errors | 0 — **MEASURED 2026-07-11** |
| Unsafe shutdowns / error-log entries | 62 / 91 — comparison baselines, **MEASURED 2026-07-11** |
| TRIM | weekly timer already enabled — **MEASURED 2026-07-11** |

Docker and journald stay as installed. The prior unsafe-shutdown and NVMe error-log counts are not
treated as a current failure; an increase is a warning signal, and a media-error increase is
critical.

## Why the capacity is useful

The space supports a rolling black box plus deliberate missions and still leaves a substantial
floor for package updates and operator work. Illustrative rates are planning examples, not physical
measurements: a telemetry/LiDAR black box at 1–5 GiB/hour consumes 150 GiB in roughly 30–150 hours;
a full camera/depth mission at 30–100 GiB/hour consumes the 900 GiB mission budget in roughly
9–30 hours. Actual GiB/hour and CPU load must be measured after the physical topic graph is known.

## Data layout and policy

```text
/data/beast/
├── recordings/blackbox/        rolling telemetry and sensor context
├── recordings/missions/        operator-started full-sensor captures
├── datasets/  maps/  models/   never automatically pruned
└── recovery-staging/           recovery transfer area, not a backup
```

The proposed budgets are 150 GiB black box, 900 GiB missions, 300 GiB minimum free, and 350 GiB
target free. Maintenance first skips active advisory locks and `.keep` recordings, never follows
symlinks, caps black box then missions oldest-first, and below the floor restores the target by
pruning black box before missions. If protected or eligible data cannot restore the floor,
recording stops or is rejected. Datasets, maps, models, recovery staging, Docker, and unrelated
paths are never automatic-delete targets.

SMART is `unknown` when absent or malformed. It is `warning` at 65 °C, 80% lifetime used, 10% or
less spare, or a counter increase; it is `critical` for a critical-warning bit, 70 °C, 100%
lifetime used, exhausted spare, or increased media errors. Status is atomically published for
operators and later portal integration.

## Recovery and migration

Recordings are disposable according to retention policy; operator-pinned work is not a backup.
`recovery-staging` is only an onboard transfer staging area and is not independent backup storage.
Offload selected missions and recovery artifacts before destructive device work. A future migration
may mount a separate volume at `/data/beast` only after a reviewed maintenance window and a tested
rollback; consumers must continue to use the stable interface.

## Rejected approaches

- **Repartitioning now:** introduces flash and recovery risk without a present capacity benefit.
- **Dual-root / A-B rootfs:** increases operational complexity and is unrelated to recording
  retention; reconsider only as a separate recovery project.
- **Quotas or Docker relocation:** adds behavior to a healthy filesystem while leaving recording
  retention unsolved. The directory-level policy has a smaller blast radius.

See the command-level [implementation plan](2026-07-11-beast-nvme-storage-implementation.md) and
the interactive [storage dossier](/design/beast-storage/index.html).
