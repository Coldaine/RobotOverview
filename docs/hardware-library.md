# Hardware Library

The source-of-truth CAD, schematics, datasheets, firmware, and captured wiki pages for the
UGV Beast — surfaced in-app as the **Hardware Library** tab of Datacore (`/datacore`), and the
place to look when you need the real board/mechanical reference while designing. The catalog is
data; the bytes live outside the repo. Verify against `src/` before relying on anything here.

## What it is

- **In-app surface:** `/datacore` → **Hardware Library** tab. Documents are grouped by subsystem
  (Driver Board, Power/UPS, Servos, Chassis CAD, Jetson Orin, Code/Firmware, Wiki). Each card
  links to a detail page `/datacore/<docId>`.
- **Interactive driver-board pinout explorer:** the driver-board schematic doc
  (`/datacore/doc-gdb-schematic`) embeds an animated board map — click a port to see what the
  Beast has slotted there. It reads the live `beast` loadout, mirroring the rover schematic.
- **Connected-twin evidence:** a document's detail page lists the wiring `nets[]` that cite it as
  proof, so a schematic is one click from the connections it explains.

## Where the data lives (catalog)

- **Records:** `src/data/hangar.ts` → `documents[]`, typed by `DocumentRef` in
  `src/data/types.ts` (`kind`: schematic | manual | cad | firmware | wiki | datasheet | image).
- **Stable key:** each record's `libraryPath` is a path under `beast/<NN-Subsystem>/…`.
  `hangar-integrity.test.ts` enforces the `beast/` prefix; the UI derives the
  subsystem grouping from the `<NN-Subsystem>` folder, so the numeric prefix sets the order.

## Where the bytes live (hosting)

The binaries are **not** in the repo or the container image. They are served from the Datacore
library store (the homelab's cluster S3 / Garage), resolved via the plain runtime env var
`DATACORE_LIBRARY_URL`. See `docs/deploy.md`.

- **Deliberately not `NEXT_PUBLIC_*`.** A `NEXT_PUBLIC_` var is string-inlined into the client
  bundle at `next build` time — the cluster could never set it after the image is built without a
  rebuild. `DATACORE_LIBRARY_URL` is instead read server-side at request time in
  `src/app/layout.tsx` (which is `force-dynamic`) and threaded through `HangarProvider` into the
  store as `libraryBaseUrl`, so the cluster can set/change it as an ordinary Deployment env var —
  no rebuild required.
- The app resolves a document to a URL at render time: `resolveDocumentUrl(doc, libraryBaseUrl)` in
  `src/lib/documents.ts` returns an explicit `url` if set, else `${libraryBaseUrl}/` + the
  library-relative key.
- **Offline-safe when unset:** when `DATACORE_LIBRARY_URL` is unset, the catalog stays fully
  browsable and open links show "library offline" — never a broken link. There is currently no
  reachability probe: if the var is set but the store is actually unreachable, "Open" still
  renders a link, which may 404/time out when clicked.

## Adding a document

1. Copy the file into the library store under the right subsystem folder, keeping the
   `<NN-Subsystem>/` layout.
2. Add a `DocumentRef` to `documents[]` in `src/data/hangar.ts` with a matching
   `libraryPath: 'beast/<NN-Subsystem>/<file>'`, its `kind`, and related `units`.
3. If the file proves a wiring connection, cite its id in the relevant `nets[]` entry.
4. Run `npm run test:run` (integrity) and `npm run typecheck`.

## Provenance

Per-file source URLs and SHA256 hashes are recorded in
`keyArtifactstosort/reference/EVIDENCE-MANIFEST.md` — the hash register that lives with the
artifacts themselves. Use it to check provenance.

## CAD archives (LFS branch)

Seven Waveshare CAD archives live as Git LFS objects on the `data/hardware-cad-assets` branch —
deliberately **not** on `main`, so an agent working in `main` sees no CAD and must not conclude
the project has none. Fetch with:

```bash
git fetch origin data/hardware-cad-assets
git checkout data/hardware-cad-assets -- <path>
```

| Archive | Contents | Trap |
| --- | --- | --- |
| `UGV_Beast_PI4B_AI_Kit_3D.zip` | **2D drawings** (despite the name) | Title block reads "UGV Beast PT" — upstream mislabel; contents are genuinely the Pi kit |
| `UGV_Beast_PI4B_AI_Kit_step.zip` | STEP geometry | — |
| `UGV_Beast_PT_AI_Kit_3D.zip` | **2D drawings** (despite the name) | — |
| `UGV_Beast_PT_AI_Kit_step.zip` | STEP geometry | — |
| `UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip` | 2D drawings | **Rover, not Beast** |
| `UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip` | STEP geometry | **Rover, not Beast** |
| `UGV_Beast_PT_Jetson_Orin-3D.zip` | Beast Orin CAD, LFS oid `56615c77…` | The only true Beast Orin archive; was absent from the 2026-07-27 intake |

**Three naming traps, verified 2026-07-27:** `_3D.zip` archives contain 2D drawings (3D geometry
is in `_step.zip`); both "Jetson Orin" archives are Rover kits; the PI4B `_3D.zip` title block
says "PT". One archive uses non-ASCII internal paths (`尺寸图纸`) — extract with explicit UTF-8
handling.

Per-file SHA-256 values, verified archive contents, and duplicate status are in
`keyArtifactstosort/INTAKE-REGISTER.md`; upstream hashes are independently in
`keyArtifactstosort/reference/EVIDENCE-MANIFEST.md`. The 2026-07-27 pruning (six archives removed
from the working tree as byte-identical LFS duplicates, plus the redistributable
`flash_download_tool_3.9.5.exe`) is safe because of those two hash records; unmodified originals
are also at `D:\_projects\_artifact-backups\RobotOverview-keyArtifactstosort-2026-07-27\`
(same-volume deletion protection, **not** an off-volume backup).

What the CAD is *for* (mounting holes, mast planning, URDF, twin geometry) is tracked as work in
[`docs/plans/archived/2026-07-30-wiring-model-completion.md`](./plans/archived/2026-07-30-wiring-model-completion.md).
