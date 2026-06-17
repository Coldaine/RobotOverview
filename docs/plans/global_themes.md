# Global Theming Architecture: The Hangar

## Objective
Implement three distinct, app-wide UI themes that fundamentally transform the Hangar experience. These are not just color palettes; they are calibrated visual paradigms designed specifically for managing robotics, network gear, mission constraints, and base-building. 

## The Three Paradigms

### 1. "Blueprint" (The Dark Engineering HUD)
* **Calibration:** The default view. Designed for deep technical analysis, base-building, and wiring. It feels like staring into a high-fidelity terminal.
* **Palette:** Void black (`#050505`) backgrounds, deep navy paneling. Primary actions are glowing cyan (`#00f0ff`); warnings are stark amber (`#ffb000`). 
* **Typography:** Monospaced dominance (e.g., JetBrains Mono). Highly rigid, tabular text alignment.
* **Data Presentation (Loadouts & Missions):** 
  - Loadout tables look like raw terminal readouts or hex editors.
  - Mission constraints (Payload, Power Budget) are rendered as horizontal, segmented progress bars with hard numeric cutoffs.
* **Schematics:** Wireframe stroke-art. Pulsing data nodes, glowing data paths, and grid backgrounds.

### 2. "Industrial" (The Clean Room / Operations Desk)
* **Calibration:** Designed for rapid, high-visibility operational overview. It drops the "hacker" aesthetic for stark, utilitarian clarity—like an instruction manual or a physical clipboard.
* **Palette:** Stark off-white or light gray backgrounds. High-contrast matte black text (`#111`). Action colors are solid, non-glowing primary red (`#e11d48`) and industrial blue (`#2563eb`).
* **Typography:** Highly legible, dense neo-grotesque sans-serif (e.g., Inter).
* **Data Presentation (Loadouts & Missions):**
  - Loadouts render as crisp, physical ledgers with strict borders and alternating row colors.
  - Mission constraints render as physical, gauge-like blocks or solid meters. 
* **Schematics:** Drops glowing outlines for solid, filled geometric shapes with hard drop-shadows. Clear, literal silhouettes of the hardware (e.g., a solid gray Pi 5 shape, rather than a wireframe).

### 3. "Topology" (The Command & Control Network)
* **Calibration:** Designed for conceptual networking, capability mapping, and high-level routing. It abstracts away the physical metal and focuses purely on data flows and connections.
* **Palette:** Deep slate or muted purple-gray backgrounds. Soft, translucent data lines with bright neon accents only on active paths.
* **Typography:** Ultra-modern, wide sans-serif (e.g., Outfit or Space Grotesk) for a sleek, spacious feel.
* **Data Presentation (Loadouts & Missions):**
  - Drops literal table rows in favor of floating node-cards or minimalist grids.
  - Mission constraints are rendered as sleek, abstract radial rings.
* **Schematics:** Completely abandons physical hardware geometry. The "Rover" is no longer a box with tracks; it is a topological map of connection points, data flows, and active radar rings, showing how the loadout slots talk to each other.

## Implementation Architecture

### Step 1: Global State (Theme Provider)
- Build a React Context `ThemeProvider` in `src/lib/ThemeProvider.tsx`.
- The provider will hold the active theme state (`blueprint` | `industrial` | `topology`) and dynamically inject the corresponding `.theme-*` class into the `<body>` tag.

### Step 2: Deep CSS Variables (Tailwind v4)
- Define massive global theme roots in `src/app/globals.css`.
- Instead of just swapping background colors, we will redefine:
  - `--font-mono` vs `--font-sans` based on the theme.
  - `--table-border-style` (dashed vs solid).
  - `--schematic-render-mode` (stroke vs fill).

### Step 3: Component-Level Hooks
- Because a CSS variable cannot change a component's actual DOM structure (e.g., turning a table into a node graph), we will expose a `useTheme()` hook.
- Deep components (like `UnitDetail` or `RoverSchematic`) will read `useTheme()` and render entirely different React sub-components based on the active paradigm.

## Hardware States & The Inventory Model

To support the base-builder loop, the UI must strictly differentiate gear into three distinct states, visually altering their presentation depending on the active theme:

### 1. Equipped (The Active Chassis)
* **Data Condition:** Any Unit ID that currently exists inside a parent unit's `LoadoutSlot.filledBy` array.
* **Display (Blueprint):** Snapped into the glowing SVG wireframe; appears as a solid line-item in the parent's hex-editor table.
* **Display (Topology):** Hardwired as a permanent child-node attached to the main chassis node.

### 2. The Workbench (Unassigned Inventory)
* **Data Condition:** Units where `owned: true` but their ID is NOT found in any `LoadoutSlot` anywhere in the fleet.
* **Display:** A dedicated "Unassigned Gear" staging panel. 
  - *Blueprint:* Looks like a staging log of offline hardware or disconnected IPs.
  - *Industrial:* Renders like a physical "Parts Bin" or shelf ledger.
  - *Topology:* Appears as isolated, floating nodes with dashed red borders (indicating they are disconnected from the network graph).
* **Interaction:** Clicking an `UNFILLED` slot on an active chassis opens the Workbench panel. Selecting a compatible unit updates the database, instantly yanking the unit out of the "Parts Bin" and snapping it into the "Equipped" schematic, deducting from available mass/power budgets.

### 3. Requisition (The Wishlist)
* **Data Condition:** Units tagged with `status: 'buy-next'` or `status: 'research'`.
* **Display:** Renders exclusively in the Mission constraints projection panel, showing how equipping these theoretical items will impact the active mission budgets before the money is spent.

## The Deep Visualization Strategy

Beyond the primary chassis schematic, the Hangar will leverage programmatic SVG drawing to visually communicate complex, multi-dimensional relationships across the entire database:

### 1. Power Routing & Pinouts (The Wiring Diagram)
* **Purpose:** Hardware isn't just bolted on; it's electrically wired. We need to visualize power budgets and data paths, not just physical locations.
* **Execution:** We will draw dynamic wiring diagrams radiating from the power supply. For example, an SVG spline connects the `Stock UPS` (Battery) to the `Pi 5` (5V rail) and out to the `Depth Camera` (USB). 
* **Thematic Rendering:** 
  - *Blueprint:* Glowing traces that animate (pulse) along the path, moving faster as power draw nears the redline.
  - *Industrial:* Strict, color-coded right-angle schematic traces (like an electrical engineering CAD drawing).
  - *Topology:* Thick abstract flow-lines where path thickness directly represents wattage or bandwidth.

### 2. The Capability "Tech Tree" (Unlocks)
* **Purpose:** Equipping gear unlocks capabilities (e.g., adding a Depth Camera unlocks `rgbd-perception`).
* **Execution:** A directed acyclic graph (DAG) drawn entirely in SVG. The root nodes are hardware items, which connect via bezier curves to Capability nodes, showing exactly what hardware enables what functionality.
* **Thematic Rendering:** This becomes a literal video-game tech tree. Equipped/Unlocked nodes are brightly illuminated; theoretical/wishlist nodes are low-opacity with dashed borders to show potential upgrade paths.

### 3. Non-Linear Constraint Gauges (Budgets)
* **Purpose:** Mass, Cost, and Power are not just flat numbers; they have critical redlines that determine mission failure.
* **Execution:** SVG arc-based gauges replacing flat HTML progress bars. They will map the `current` loadout against the `budget` constraint.
* **Thematic Rendering:**
  - *Blueprint:* Sleek, segmented neon arcs (like a sci-fi cockpit HUD) that shift from cyan to amber at 85% capacity.
  - *Industrial:* Heavy analog-style physical dials with literal red-painted high-water marks and needle indicators.
  - *Topology:* Minimalist, data-dense concentric radial rings (mapping mass, power, and cost simultaneously on one axis).

### 4. The Mission Deployment Board (Theater View)
* **Purpose:** Units are assigned to active missions (e.g., Perimeter Mapping).
* **Execution:** A geometric theater-of-operations map. Units assigned to an active mission are visually pulled out of the "Hangar" layout and drawn hovering over a mission objective zone, giving a global view of where the fleet is deployed.
