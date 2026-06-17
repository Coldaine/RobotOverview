# Global Theming Architecture: Technical Execution Plan

This document outlines the exact, file-by-file technical modifications required to implement the three global UI paradigms (Blueprint, Industrial, Topology), the strict inventory states (Equipped vs Workbench), and the deep visualization strategy.

## User Review Required
> [!IMPORTANT]
> - Are you comfortable with replacing hardcoded Tailwind utility colors (e.g., `text-[#00f0ff]`) across all existing components with semantic CSS variables (e.g., `text-primary`) to allow the global themes to work?
> - For the `InventoryDrawer`, do you prefer a bottom-sheet slide-up, or a right-side panel slide-out?

## Open Questions
- We will be heavily utilizing Tailwind CSS v4 variables in `globals.css` to manage the massive palette shifts. Do you have any specific Google Fonts you want imported for the three distinct typography styles (Mono, Neo-Grotesque, Wide Modern)?

## Proposed Changes

### 1. Global CSS Architecture (Tailwind v4)

#### [MODIFY] `src/app/globals.css`
We will rewrite the root layer to support semantic theming. The hardcoded hex values in the components must be replaced by these variables.
- **Base/Blueprint (`:root, .theme-blueprint`)**:
  - `--color-bg: #050505;`
  - `--color-panel: #0a101d;`
  - `--color-primary: #00f0ff;` (Cyan)
  - `--color-warning: #ffb000;` (Amber)
  - `--font-sans: 'JetBrains Mono', monospace;`
  - `--schematic-stroke: var(--color-primary);`
  - `--schematic-fill: transparent;`
- **Industrial (`.theme-industrial`)**:
  - `--color-bg: #f8f9fa;`
  - `--color-panel: #ffffff;`
  - `--color-primary: #2563eb;` (Flat Blue)
  - `--color-warning: #e11d48;` (Red)
  - `--font-sans: 'Inter', sans-serif;`
  - `--schematic-stroke: transparent;`
  - `--schematic-fill: #334155;`
- **Topology (`.theme-topology`)**:
  - `--color-bg: #1e1e24;`
  - `--color-panel: #2b2b36;`
  - `--color-primary: #a78bfa;` (Neon Purple)
  - `--color-warning: #fbbf24;`
  - `--font-sans: 'Outfit', sans-serif;`
  - `--schematic-stroke: var(--color-primary);`

### 2. Global State Management

#### [NEW] `src/lib/ThemeProvider.tsx`
- Build a React Context `ThemeContext` and a `ThemeProvider` component.
- State: `const [theme, setTheme] = useState<'blueprint' | 'industrial' | 'topology'>('blueprint')`.
- Effect: Syncs the active theme string to `document.body.className`.
- Export a custom `useTheme()` hook for deep component consumption.

#### [MODIFY] `src/app/layout.tsx`
- Wrap the entire `{children}` payload in the new `<ThemeProvider>`.

#### [NEW] `src/components/ThemeSwitcher.tsx`
- A global toggle component mounted in the top navigation bar.
- Uses `useTheme()` to display 3 buttons, allowing instant global re-rendering.

### 3. Component Reactivity & Data Presentation

#### [MODIFY] `src/components/RoverSchematic.tsx`
- Remove the localized SVG toggle created in the scrapped PR 10.
- Consume the `useTheme()` hook.
- Modify the SVG `<g>` elements. Instead of just changing colors, dynamically render entirely different structural elements based on the theme.
  - `if (theme === 'topology') return <TopologyNodeMap />`
  - `if (theme === 'blueprint') return <WireframeChassis />`

#### [MODIFY] `src/components/LoadoutTable.tsx` (or equivalent data display)
- Refactor the table rendering to obey the theme:
  - Blueprint: Renders as a raw hex-editor grid.
  - Industrial: Renders as a standard HTML `<table>` with alternating `#f1f5f9` backgrounds.
  - Topology: Drops `<table>` entirely, rendering a `flex` grid of floating node cards.

### 4. The Inventory Base-Builder Loop

#### [NEW] `src/components/InventoryDrawer.tsx`
- **Data Hook:** Query `useHangarStore()` for units where `owned === true` AND `id` is not present in any parent's `LoadoutSlot.filledBy`.
- **UI:** A sliding side-panel (or bottom-sheet) listing these unassigned units.
- **Interaction:** Clicking an item in this drawer triggers `updateSlot()`, assigning the unit's ID to the actively selected empty slot, removing it from the drawer.

#### [MODIFY] `src/components/UnitDetail.tsx` (or the component handling slot clicks)
- When a user clicks an `UNFILLED` slot on the schematic, dispatch an action to open the `<InventoryDrawer>` and pass the slot's constraint details so the drawer can filter compatible items.

### 5. Deep Visualization Stubbing

#### [NEW] `src/components/WiringDiagram.tsx`
- A placeholder SVG component that takes `unitId` as props.
- Maps `requires` (power) back to `supplies` to draw Bezier curves representing physical wiring.

#### [NEW] `src/components/ConstraintGauge.tsx`
- A custom SVG arc gauge component.
- Replaces standard HTML `<progress>` bars. Takes `current`, `max`, and `theme` as props. Renders a neon arc for Blueprint, and a physical dial for Industrial.

### 6. Creative Feature Transformations

To ensure the themes are more than just color swaps, we will implement these distinct interactive behaviors using Framer Motion and dynamic SVGs:

#### The "Equip" Interaction Animation
- **Blueprint Mode:** Socketing an item into the `RoverSchematic` triggers a cascade of monospaced hex codes rapidly printing down the Loadout Table, simulating a terminal booting the device, ending with a green `[SYS_OK]`.
- **Industrial Mode:** Socketing an item makes a heavy, visual "clunk" animation, locking a solid gray SVG block into the physical grid layout like snapping a heavy breaker into an electrical panel.
- **Topology Mode:** A glowing node floats into position, and an SVG spline "shoots" out, seeking a connection to the parent node. When it connects, a visual data pulse travels down the spline.

#### The "Power Budget" Overload State
- **Blueprint Mode:** If you exceed the power budget, the entire HUD doesn't just turn red—the background grid and typography subtly flicker and dim, mimicking literal voltage drop in the command center.
- **Industrial Mode:** A literal analog needle gauge on the dashboard pins itself into the red zone and physically "shakes" against the peg, accompanied by stark black-and-yellow hazard stripes across the panel header.
- **Topology Mode:** The overloaded central node turns critical amber and starts "bleeding" concentric wave rings, visually polluting the clean network map.

#### Empty Loadout Slots
- **Blueprint Mode:** A dashed, blinking wireframe bounding box overlaid on the schematic, pulsing slowly to indicate a missing module.
- **Industrial Mode:** Rendered as an empty physical bay with exposed, flat-shaded mounting rails.
- **Topology Mode:** A disconnected, floating "socket" ring that slowly orbits the parent node.

## Verification Plan
1. **Theming:** Toggle between Blueprint, Industrial, and Topology. Verify the entire page background, text colors, fonts, and SVG stroke/fills instantly recalculate.
2. **Inventory:** Unassign the Pi 5 from the Beast. Verify it visually disappears from the schematic and immediately appears in the `InventoryDrawer`. Reassign it, verifying the reverse.
3. **Data:** Verify that dropping a heavy unit into an empty slot instantly increments the overall Mass constraint gauge.
