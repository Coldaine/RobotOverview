# THE BOARD — design-system handoff

These are static preview cards for the wiring board's visual primitives, mirrored
so **design mode** (`/design-sync` → the Claude Design project) can iterate on the
look without touching the live React. Each `.html` file is self-contained (inline
tokens copied from `src/app/globals.css`) and carries a first-line
`<!-- @dsCard group="…" -->` marker so it renders as a card in the Design System
pane.

The live components these mirror:

| Card | Component | Tuning surface |
|------|-----------|----------------|
| `wire.html` | `src/components/board/Wire.tsx` | `WIRE` constants in `palette.ts` |
| `module.html` | `src/components/board/Module.tsx` | module fill/stroke/glow |
| `port-and-legend.html` | `Port.tsx` + `Controls.tsx` | `PORT` constants, layer chips |
| `net-inspector.html` | `NetInspector.tsx` | `.panel` / `.chip` / doc rows |

**Loop:** refine a card here → `DesignSync` it up → review in Claude Design →
port the token/class changes back into the component + `globals.css`. Geometry and
interaction stay in `src/lib/twin.ts` and the components; these cards are the skin.
