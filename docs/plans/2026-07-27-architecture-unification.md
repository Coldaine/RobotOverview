# Unite the wiring architecture — one spine, two eyes

**Status:** PROPOSED — 2026-07-27. Written to be executed by an agent that has none of the
conversation that produced it.

**This plan does not merge The Board and the BEAST Console.** Both views stay. They are different
eyes on the same robot and the owner has decided both are worth keeping. What unites is the *data
underneath them*, so that a fact learned once is written once and appears in both.

---

## Done condition

1. A newly learned hardware fact is added in **one** place, and both views reflect it.
2. Nothing in either view asserts something the other contradicts, and CI says so **by name** if it
   ever does.
3. The console's data is typed and integrity-checked to the same standard as the spine.
4. There is no half-built infrastructure left ambiguous — every table either has a read path or is
   explicitly marked unread.

---

## Part 1 — What is actually there

Three data paths, in decreasing order of rigor. This is the finding that matters.

| | **Hangar spine** | **The Board** (twin) | **BEAST Console** |
| --- | --- | --- | --- |
| Route | `/`, `/items`, `/unit/[id]` | `/board` | `/datacore` |
| Data | `src/data/hangar.ts` — units, items, missions | `hangar.ts` — terminals, nets, documents | `beast-console/*-data.ts` |
| Records | 40+ units/items | **25 terminals · 11 nets · 16 documents** | **5 boards · 39 ports · 16 peripherals · 29 cables** |
| Types | `src/data/types.ts` | `src/data/types.ts:296–350` | **local interfaces in `bench-data.ts`** |
| SQL schema | ✅ `db/hangar/schema.sql` | ✅ tables at `schema.sql:253–296` | ❌ none |
| Seed emitted | ✅ | ✅ `gen-seed.ts:306+` | ❌ none |
| Integrity test | ✅ ~30 assertions | ✅ 4 assertions | ❌ **none** |
| Postgres read path | ✅ items only | ❌ **tables exist, nothing reads them** | ❌ none |

Reading down the columns, rigor falls off a cliff. **The least-governed model is the one actually
being used** — the console is what the Jetson conversion is being driven from, and it is the only
data in the repo with no shared types, no schema, and no test.

### Four concrete problems

**P1 — A fact has no single home, and no rule says which to pick.** On 2026-07-27 the verified
findings (driver-board connector 6 is the ESP32 host link; the D500 rides the Audio HAT's LiDAR
socket; the Orin DC input is 9–20 V not 9–19 V) were written into the console because that was the
file open at the time. The twin still contradicts all three. Nothing caught it.

**P2 — The console's types are private.** `PortDef`, `CableDef`, `PeripheralDef`, `BoardDef` are
declared inside `bench-data.ts` rather than `types.ts`. There is no structural relationship between
a `CableDef` and a `Net`, so nothing stops them describing the same wire differently forever.

**P3 — The twin's database tables are built and unread.** Migration
`db/hangar/migrations/2026-07-03-connected-twin.sql` created `terminals`, `nets`, `net_terminals`,
`documents`, `net_documents`. `gen-seed.ts` emits rows for all of them. `readWithStaticFallback` in
`src/server/hangar/read-model.ts` is the established pattern and `items.ts` proves it works. But
there is no nets repository and no API route — so the twin reads static data exclusively, and the
tables are dead weight that looks alive.

**P4 — Grain mismatch is the real blocker.** The spine models **11 inter-module nets**; the console
models **29 connector-level cables**. Same physical robot, ~2.5× resolution difference. This is why
nobody has unified them: neither is wrong, and neither contains the other.

---

## Part 2 — The design

**One net table, tagged by grain. Each view filters to the grain it renders.**

Add a `grain` discriminator to `Net`:

| Grain | Meaning | Count today | Rendered by |
| --- | --- | --- | --- |
| `module` | Board-to-board / subsystem wiring | 11 | The Board |
| `connector` | Specific cable between two named sockets | 29 (in console) | Live Plug |
| `internal` | Intra-board rail (`VDD5V`, the M2 gate) | 0 — future | Net inspector detail, on demand |

A `connector` net names its parent `module` net. That makes the relationship explicit and
queryable: The Board shows the trunk, Live Plug shows the strands, and asking "which cables make up
`net-host-uart`?" becomes a filter rather than a guess.

**Adding a fact becomes one operation:** write one net at the correct grain. It appears in whichever
view renders that grain, with no second edit and no chance of divergence — because there is no
second copy.

### What each view keeps

Unification is at the data layer only. Everything below stays exactly where it is:

| Stays console-owned | Why |
| --- | --- |
| `PortDef` x/y/side, `BoardDef` chips | Diagram layout coordinates — presentation, not fact |
| Plug state, `console-store.ts` | Session state, not hardware truth |
| `CONVERSION_STEPS` | An ordered procedure; genuinely not a wiring model |
| `PINS40` pin tables | Reference material with no spine equivalent yet |

| Stays twin-owned | Why |
| --- | --- |
| `buildBoardLayout` / `buildIsoLayout` / `buildBusLayout` | Three view projections — presentation |
| `resolveActive` host filtering | The Pi↔Orin toggle |
| `palette.ts`, layer bar | Presentation |

**The split is: facts move to the spine, presentation stays local.** A coordinate is not a fact. A
voltage is.

### Alternative considered and rejected

*Keep both models fully separate; add a consistency test asserting overlapping claims agree.* Cheap
— maybe an hour — and it does make divergence loud. Rejected as the destination because it does not
make facts **easily addable**: you still write every fact twice and the test only tells you when you
forgot. It is, however, the right **first step** (S2 below), because it delivers the safety benefit
immediately and its mapping table is exactly the input the migration needs.

---

## Part 3 — The work

Staged so each step is valuable alone. **Stop after any stage and the repo is better than it was.**

### S1 — Backfill the known divergences *(do first, small)*

- **Do:** propagate the three verified 2026-07-27 findings into `hangar.ts` — connector 6 as the
  ESP32 host link, the D500 on the Audio HAT socket, 9–20 V on `orin-dc-in`. Commit the uncommitted
  voltage corrections sitting in the working tree.
- **Done when:** `task check` passes and the two views no longer contradict each other on any known
  fact.
- **Why first:** the models currently disagree on live safety-relevant data. Fix the facts before
  building machinery to keep facts in sync.

### S2 — Make divergence loud

- **Do:** add `src/__tests__/wiring-consistency.test.ts` with an explicit correspondence map, then
  assert the paired claims agree. Known pairs: `gdb-usb-esp32` ↔ `drv-esp32-usb`, `orin-dc-in` ↔
  `jet-barrel`, `net-d500-lidar` ↔ the HAT lidar route, `net-5v-host` ↔ `drv-5v`, `net-host-uart` ↔
  the USB host link.
- **Done when:** editing one side alone fails CI with a message naming the fact that drifted.
- **Note:** the correspondence map written here is the migration table S4 consumes. Write it as data,
  not as inline assertions.

### S3 — Give the console the same rigor as the spine

- **Do:** move `PortDef`, `CableDef`, `PeripheralDef`, `BoardDef` into `src/data/types.ts`. Add
  `src/__tests__/bench-data-integrity.test.ts` covering what `hangar-integrity.test.ts` already
  covers for the spine: no duplicate IDs, every cable endpoint resolves to a real port or peripheral,
  every port belongs to a real board, every build variant is valid.
- **Done when:** the console cannot ship a cable pointing at a port that does not exist.
- **Why:** this is the model driving a physical hardware conversion and it currently has less
  protection than `nav.ts`.

### S4 — Introduce grain

- **Do:** add `grain: 'module' | 'connector' | 'internal'` to `Net` and `parentNet?: string`. Tag the
  existing 11 nets `module`. Migrate the 29 console cables into `nets[]` as `connector` grain, each
  naming its parent, using S2's correspondence map. `bench-data.ts` keeps `PortDef` layout data and
  derives its cable list from the spine.
- **Also:** extend `Net.documents[]` citations to accept a zone suffix (`doc-ros-driver#C6`) so the
  netlist extraction plan has somewhere to land. A citation naming a 1 MB PDF proves nothing.
- **Done when:** `EXPECTED_CABLES` is derived, not authored; both views render unchanged; S2's test
  becomes trivially true and can be simplified to a grain-coverage check.
- **Care required:** this is the only stage that can regress a working UI. Both views must render
  identically before and after — screenshot or snapshot them first.

### S5 — Resolve the dead database tables

- **Do:** pick one, explicitly. Either (a) add a nets/terminals repository following `items.ts` and
  wire it through `readWithStaticFallback`, or (b) record in `db/hangar/standup.md` that the twin
  tables are seeded-but-unread by design, with the reason.
- **Done when:** no reader has to guess whether the Postgres twin path works.
- **Recommendation:** (a). The pattern exists, `items.ts` proves it, and the seed is already being
  generated — the remaining work is one repository and one route.

### S6 — Surface it

- **Do:** the operator-facing material — the vacated Pi dock, 40-pin numbering, which USB-C is which
  — goes on screen. `OPEN_ITEMS` should be visible from both views, not only the Reference tab.
- **Done when:** an operator can answer "where do the UART jumpers go" from the running app without
  opening a markdown file.
- **Why:** `AGENTS.md` — *"The UI is the product... docs exist to serve the visible experience, never
  the other way around."* S1–S5 are all plumbing. This is the stage that makes them product.

---

## Part 4 — Rules for whoever adds the next fact

Once S4 lands:

- **A wiring fact is a net.** Pick the grain, write one record, cite the zone or image region that
  proves it.
- **Layout coordinates are not facts.** They live with the view that draws them.
- **A disagreement between sources is never resolved by editing one to match.** Both claims stay;
  the conflict goes to `OPEN_ITEMS` naming both. Silent convergence turns one wrong fact into two.
- **Source precedence for hardware claims:** firmware source > schematic > vendor callout diagram >
  wiki > inference. For *physical identification* (which connector is which), the callout diagram
  outranks the schematic — they answer different questions.
- **New views are new projections, not new stores.** A third eye is welcome. A third copy of the
  facts is not.

---

## Companion plans

- [2026-07-27-schematic-netlist-extraction-plan.md](2026-07-27-schematic-netlist-extraction-plan.md)
  — what to extract from the documents we hold. Depends on this plan for its persistence target;
  `internal` grain and zone-level citations are the hooks it needs.
- [2026-07-27-cad-assets-usage-and-discoverability.md](2026-07-27-cad-assets-usage-and-discoverability.md)
  — the CAD archives. Its **X1 gates drilling** and is independent of this work.
