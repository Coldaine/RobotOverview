---
title: Connected Twin — Wiring Model
audience: AI agents and operators extending the Hangar hardware model
status: historical proposal
last_updated: 2026-07-01
---

# Connected Twin — Wiring Model

> Historical proposal. Current BEAST-01 operating facts belong in `docs/beast-ops.md`; current
> data/backend shape belongs in `db/hangar/standup.md`. Use this page only as design evidence after
> checking current code, schema, and owner docs.

The connected twin is the Hangar's hardware/electrical layer for BEAST-01: components, terminals, nets, rail budgets, and provenance back to schematics. It is **not** a software/control twin and it does not operate the robot. That boundary preserves `NORTH_STAR.md` AG2: the Hangar may surface supervised knowledge and links, but it is not an autonomous control plane.

## Why this exists

The existing Hangar model already knows about units, loadout sockets, hotspots, missions, and compatibility. That answers “what can mount here?” and “what is equipped?” It does **not** yet answer the lower-level hardware questions Patrick wants preserved:

- what named lead/header/pin exists on each board or module;
- what is physically wired to what;
- what signal or rail the connection carries;
- what source schematic/wiki/manual proves the connection;
- how the Pi vs Jetson Orin host path changes power and UART wiring.

The twin layer fills that gap without replacing the loadout model.

## Current artifact status

- `docs/history/twin-prototypes/` contains standalone review prototypes from the first wiring-model pass:
  - `base-harness.html`
  - `base-harness.model.json`
  - `board-review.html`
  - `twin-model.json`
- These prototypes are reference artifacts, not app code and not the current route surface.
- The old `docs/twin/` silo was deliberately retired before this page was archived.
- Bulk BEAST-01 source files are intentionally **not tracked** in git. Historical digest and
  object-storage notes are under `docs/history/reference/`.

## Model extension

The Postgres master-inventory spine from `db/hangar/schema.sql` can grow two tables underneath the existing loadout model:

| Table | Purpose |
|---|---|
| `terminals` | A named electrical/mechanical port on an asset: board header, motor lead, UART pin, power rail, servo bus, USB port, or mechanical attach point. |
| `nets` | A physical/logical connection between two terminals: wire, jumper, trace, header, bus, or harness segment, with signal, medium, note, and source provenance. |

Relationship to existing concepts:

- `sockets` / `interface_types` / `socket_accepts` / `asset_interfaces` answer compatibility and loadout candidacy.
- `loadout_assignments` records what is equipped.
- `terminals` / `nets` answer what is physically connected and where that claim came from.

## Persistence target

RobotOverview owns the schema, seed inputs, and app behavior for this model. The deployment target is the logical Hangar database in `coldaine-k8cluster`'s `pg18` CloudNativePG cluster, not a new database server and not the local proof container.

Source-document metadata should live in the Hangar schema. Large source binaries (PDF/CAD/firmware/wiki captures) should live in S3-compatible object storage and be referenced by key/URL. Do not assume Garage's default database-backup bucket is also the app document store. The app archive bucket needs its own explicit decision about bucket name, access key/policy, retention/offsite mirror, and whether it uses Garage first or R2/offsite first.

## App integration path

Smallest coherent implementation slice:

1. Add `Terminal` and `Net` types beside the existing Hangar data types.
2. Add a JSON seed source for BEAST-01 nets while `src/data/hangar.ts` remains the bootstrap/fallback source for surfaces that have not moved to Postgres.
3. Replace the hardcoded `WiringDiagram.tsx` splines with data-driven nets, keeping the same visual language.
4. Add a board/terminal dossier panel using the existing drawer pattern.
5. Add provenance chips that link to source documents once object storage URLs exist.
6. Extend the DB schema/seed generator with `terminals`, `nets`, and source-document metadata after the master-inventory DB branch lands cleanly.

Do not build a parallel app, standalone HTML page, or second state system. The wiring view should reuse the existing Hangar shell, theme system, store, loadout compatibility, and unit routes.

## Host-swap rule

The base harness is true with no Pi and no Orin. A host is a loadout choice that attaches at known terminals:

- Raspberry Pi path: 40-pin header carries power plus UART/I2C.
- Jetson Orin path: power comes from the 3S battery rail / barrel input, while UART still uses TX/RX/GND jumpers to the driver board header. Before final wiring, refresh the citation against the current NVIDIA Orin Nano carrier-board specification; the current DC-input citation to check is 9-20V for the carrier board, not the older 9-19V shorthand.

The UI should make that difference visible as a supervised build/diagnostic view, especially the 5V host-rail vs Orin barrel-input issue.

## What not to do

- Do not treat this as autonomous robot control.
- Do not commit the 100+ MB source archive binaries into the app repo.
- Do not create a RobotOverview-owned Postgres server; target the cluster repo's `pg18` logical DB pattern.
- Do not keep standalone HTML as the product surface; use it only as reference for the in-app implementation.
