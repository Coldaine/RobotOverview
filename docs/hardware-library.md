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
`docs/history/reference/beast-source-evidence-manifest.md`. That file is historical evidence
(the `docs/history/` graveyard) — use it to check provenance, not as live guidance.
