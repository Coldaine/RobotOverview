// ─────────────────────────────────────────────────────────────────────────────
// Connected-twin core — pure graph + layout math for "THE BOARD".
//
// This module is deliberately React-free and deterministic (no Date/Math.random)
// so the whole wiring model is unit-testable and snapshot-stable. It renders the
// terminals/nets/documents authored in the data spine into three interchangeable
// layouts (board / iso / bus) over one normalized shape.
//
// Layout constants live at the top as named exports: design-mode tuning is a
// single-value edit here, not a component rewrite.
// ─────────────────────────────────────────────────────────────────────────────
import type { DocumentRef, Net, NetKind, Terminal, Unit } from '../data/types';
import type {
  SchematicBusLayout,
  SchematicEdge,
  SchematicFreeformLayout,
  SchematicGraph,
  SchematicHost,
  SchematicView,
  SchematicViewLayouts,
} from '../data/schematic-types';

export const VIEW_MODES = ['board', 'iso', 'bus'] as const satisfies readonly SchematicView[];
export type ViewMode = SchematicView;

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  board: 'Board',
  iso: 'Cutaway',
  bus: 'Bus',
};

export const ACTIVE_HOSTS = ['pi5', 'orin'] as const;
export type ActiveHost = (typeof ACTIVE_HOSTS)[number];

export const ACTIVE_HOST_LABELS: Record<ActiveHost, string> = {
  pi5: 'Raspberry Pi 5',
  orin: 'Jetson Orin',
};

export type Edge = SchematicEdge;

/** Semantic color key per net kind; the UI maps this to CSS vars. */
export type NetColorKey = 'amber' | 'cyan' | 'mixed' | 'idle';

// ── Normalized layout shape (identical across all three view modes) ──────────
export interface ModuleBox {
  unitId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PortNode {
  /** Unique per node. In bus mode a terminal taps once per net, so key !== terminalId. */
  key: string;
  terminalId: string;
  /** Set only in bus mode, where a tap belongs to a specific net row. */
  netId?: string;
  x: number;
  y: number;
  /** Outward unit normal — control-point direction for wires and label offset. */
  nx: number;
  ny: number;
}

export interface WirePath {
  netId: string;
  kind: NetKind;
  /** SVG path data. */
  d: string;
  /** Anchor for a net label / traveling pulse origin. */
  midX: number;
  midY: number;
  terminalIds: string[];
}

export interface TwinLayout {
  width: number;
  height: number;
  modules: ModuleBox[];
  ports: PortNode[];
  wires: WirePath[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph helpers
// ─────────────────────────────────────────────────────────────────────────────

export function netKindColor(kind: NetKind): NetColorKey {
  switch (kind) {
    case 'power':
      return 'amber';
    case 'data':
      return 'cyan';
    case 'mixed':
      return 'mixed';
    case 'mechanical':
      return 'idle';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function terminalById(terminals: Terminal[], id: string): Terminal | undefined {
  return terminals.find((t) => t.id === id);
}

export function unitById(units: Unit[], id: string): Unit | undefined {
  return units.find((u) => u.id === id);
}

/** Every net that includes the given terminal. */
export function netsForTerminal(nets: Net[], terminalId: string): Net[] {
  return nets.filter((n) => n.terminals.includes(terminalId));
}

/** The documents that prove a net's wiring, resolved in order. */
export function documentsForNet(documents: DocumentRef[], net: Net): DocumentRef[] {
  const byId = new Map(documents.map((d) => [d.id, d]));
  return (net.documents ?? []).map((id) => byId.get(id)).filter((d): d is DocumentRef => Boolean(d));
}

export interface TraceSet {
  netIds: Set<string>;
  terminalIds: Set<string>;
}

/** Hover a port → light every net it touches and all their sibling terminals. */
export function traceFromTerminal(nets: Net[], terminalId: string): TraceSet {
  const netIds = new Set<string>();
  const terminalIds = new Set<string>([terminalId]);
  for (const net of nets) {
    if (net.terminals.includes(terminalId)) {
      netIds.add(net.id);
      net.terminals.forEach((t) => terminalIds.add(t));
    }
  }
  return { netIds, terminalIds };
}

/** Hover a wire → light that net and its terminals. */
export function traceFromNet(nets: Net[], netId: string): TraceSet {
  const net = nets.find((n) => n.id === netId);
  return {
    netIds: new Set(net ? [net.id] : []),
    terminalIds: new Set(net ? net.terminals : []),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Host swap — the Jetson-vs-Pi hero interaction, as data.
//
// A terminal is "owned" by a host if it only exists when that host is installed.
// A net stays energized while ≥2 of its terminals are active, so flipping the
// host re-lights and drops nets exactly the way the physical swap does:
//   • 5V host rail   → dies on Orin (Orin can't draw header 5V)
//   • host↔ESP32 UART→ Pi stacks the 40-pin; Orin uses TX/RX/GND jumpers
//   • battery rail   → Orin taps the barrel jack (extra live terminal)
//   • UPS telemetry / Pi-USB camera → follow the Pi, dark on Orin
// ─────────────────────────────────────────────────────────────────────────────
export interface ActiveSet {
  terminalIds: Set<string>;
  netIds: Set<string>;
}

export function resolveActive(
  terminals: Terminal[],
  nets: Net[],
  host: string,
  hosts: SchematicHost[],
): ActiveSet {
  const terminalOwners = new Map<string, string>();
  for (const candidate of hosts) {
    for (const terminalId of candidate.terminalIds) terminalOwners.set(terminalId, candidate.id);
  }
  const terminalIds = new Set<string>();
  for (const t of terminals) {
    const owner = terminalOwners.get(t.id);
    if (!owner || owner === host) terminalIds.add(t.id);
  }
  const netIds = new Set<string>();
  for (const net of nets) {
    const live = net.terminals.filter((t) => terminalIds.has(t));
    if (live.length >= 2) netIds.add(net.id);
  }
  return { terminalIds, netIds };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared layout primitives
// ─────────────────────────────────────────────────────────────────────────────

function wiredUnitIds(terminals: Terminal[]): Set<string> {
  return new Set(terminals.map((t) => t.unitId));
}

interface Anchor {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

/** Evenly place the i-th of `count` ports along a module edge. */
function edgeAnchor(m: ModuleBox, edge: Edge, i: number, count: number): Anchor {
  const t = (i + 1) / (count + 1);
  switch (edge) {
    case 'top':
      return { x: m.x + t * m.w, y: m.y, nx: 0, ny: -1 };
    case 'bottom':
      return { x: m.x + t * m.w, y: m.y + m.h, nx: 0, ny: 1 };
    case 'left':
      return { x: m.x, y: m.y + t * m.h, nx: -1, ny: 0 };
    case 'right':
      return { x: m.x + m.w, y: m.y + t * m.h, nx: 1, ny: 0 };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Route a net through its (positioned) terminals. Two terminals → a single
 * cubic bowed along their normals; three+ → a star through the centroid so a
 * shared rail/bus reads as one junction rather than a tangle.
 */
function routeWire(net: Net, positions: Map<string, Anchor>, bow: number): WirePath | null {
  const pts = net.terminals
    .map((id) => {
      const anchor = positions.get(id);
      return anchor ? { id, ...anchor } : null;
    })
    .filter((p): p is Anchor & { id: string } => Boolean(p));
  if (pts.length < 2) return null;
  const terminalIds = pts.map((p) => p.id);

  if (pts.length === 2) {
    const [a, b] = pts;
    const c0x = a.x + a.nx * bow;
    const c0y = a.y + a.ny * bow;
    const c1x = b.x + b.nx * bow;
    const c1y = b.y + b.ny * bow;
    const d = `M ${round(a.x)} ${round(a.y)} C ${round(c0x)} ${round(c0y)} ${round(c1x)} ${round(c1y)} ${round(b.x)} ${round(b.y)}`;
    // Cubic midpoint at t=0.5.
    const midX = 0.125 * a.x + 0.375 * c0x + 0.375 * c1x + 0.125 * b.x;
    const midY = 0.125 * a.y + 0.375 * c0y + 0.375 * c1y + 0.125 * b.y;
    return { netId: net.id, kind: net.kind, d, midX: round(midX), midY: round(midY), terminalIds };
  }

  const jx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const jy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const legs = pts
    .map((p) => {
      const cx = p.x + p.nx * bow;
      const cy = p.y + p.ny * bow;
      return `M ${round(p.x)} ${round(p.y)} Q ${round(cx)} ${round(cy)} ${round(jx)} ${round(jy)}`;
    })
    .join(' ');
  return { netId: net.id, kind: net.kind, d: legs, midX: round(jx), midY: round(jy), terminalIds };
}

function buildEdgeGroupedPorts(
  terminals: Terminal[],
  moduleById: Map<string, ModuleBox>,
  terminalEdges: Record<string, Edge>,
) {
  // Group each unit's terminals by the edge they exit, preserving spine order.
  const byUnitEdge = new Map<string, Terminal[]>();
  for (const t of terminals) {
    if (!moduleById.has(t.unitId)) continue;
    const edge = terminalEdges[t.id];
    if (!edge) throw new Error(`Missing terminal edge for "${t.id}"`);
    const key = `${t.unitId}|${edge}`;
    const list = byUnitEdge.get(key);
    if (list) list.push(t);
    else byUnitEdge.set(key, [t]);
  }

  const ports: PortNode[] = [];
  const positions = new Map<string, Anchor>();
  for (const [key, ts] of byUnitEdge) {
    const [unitId, edge] = key.split('|') as [string, Edge];
    const m = moduleById.get(unitId)!;
    ts.forEach((t, i) => {
      const a = edgeAnchor(m, edge, i, ts.length);
      positions.set(t.id, a);
      ports.push({ key: t.id, terminalId: t.id, x: round(a.x), y: round(a.y), nx: a.nx, ny: a.ny });
    });
  }

  return { ports, positions };
}

export function buildBoardLayout(graph: SchematicGraph, definition: SchematicFreeformLayout): TwinLayout {
  const wired = wiredUnitIds(graph.terminals);
  const modules: ModuleBox[] = definition.moduleOrder.filter((id) => wired.has(id)).map((id) => {
    const placement = definition.modules[id];
    if (!placement) throw new Error(`Missing ${definition.kind} placement for "${id}"`);
    return { unitId: id, ...placement };
  });
  const moduleById = new Map(modules.map((m) => [m.unitId, m]));
  const { ports, positions } = buildEdgeGroupedPorts(graph.terminals, moduleById, definition.terminalEdges);

  const wires = graph.nets
    .map((n) => routeWire(n, positions, definition.wireBow))
    .filter((w): w is WirePath => Boolean(w));

  return { width: definition.width, height: definition.height, modules, ports, wires };
}
export function buildIsoLayout(graph: SchematicGraph, definition: SchematicFreeformLayout): TwinLayout {
  return buildBoardLayout(graph, definition);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bus layout — nets become horizontal spines; units are columns that tap in.
// A terminal on N nets taps N rows in its column (the metro-map read).
// ─────────────────────────────────────────────────────────────────────────────
export function buildBusLayout(graph: SchematicGraph, definition: SchematicBusLayout): TwinLayout {
  const wired = wiredUnitIds(graph.terminals);
  const columns = definition.columnOrder.filter((id) => wired.has(id));
  const colX = new Map(columns.map((id, i) => [id, definition.x0 + i * definition.columnGap]));

  const modules: ModuleBox[] = columns.map((id) => ({
    unitId: id,
    x: round((colX.get(id) as number) - definition.moduleWidth / 2),
    y: definition.top,
    w: definition.moduleWidth,
    h: definition.bottom - definition.top,
  }));

  const termUnit = new Map(graph.terminals.map((t) => [t.id, t.unitId]));
  const orderedNets = definition.rowOrder.map((id) => graph.nets.find((n) => n.id === id)).filter(
    (n): n is Net => Boolean(n),
  );
  // Any net not in the explicit order still gets a row appended.
  for (const n of graph.nets) if (!definition.rowOrder.includes(n.id)) orderedNets.push(n);

  const ports: PortNode[] = [];
  const wires: WirePath[] = [];

  orderedNets.forEach((net, rowIdx) => {
    const rowY = definition.y0 + rowIdx * definition.rowGap;
    const taps = net.terminals
      .map((tid) => {
        const unitId = termUnit.get(tid);
        const x = unitId ? colX.get(unitId) : undefined;
        return x === undefined ? null : { tid, x };
      })
      .filter((t): t is { tid: string; x: number } => Boolean(t));
    if (taps.length < 2) return;

    taps.forEach(({ tid, x }) => {
      ports.push({ key: `${net.id}:${tid}`, terminalId: tid, netId: net.id, x: round(x), y: rowY, nx: 0, ny: -1 });
    });

    const xs = taps.map((t) => t.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    wires.push({
      netId: net.id,
      kind: net.kind,
      d: `M ${round(minX)} ${rowY} L ${round(maxX)} ${rowY}`,
      midX: round((minX + maxX) / 2),
      midY: rowY,
      terminalIds: taps.map((t) => t.tid),
    });
  });

  return { width: definition.width, height: definition.height, modules, ports, wires };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────
export function buildLayout(
  mode: ViewMode,
  graph: SchematicGraph,
  definition: SchematicViewLayouts[ViewMode],
): TwinLayout {
  switch (mode) {
    case 'board':
      return buildBoardLayout(graph, definition as SchematicFreeformLayout);
    case 'iso':
      return buildIsoLayout(graph, definition as SchematicFreeformLayout);
    case 'bus':
      return buildBusLayout(graph, definition as SchematicBusLayout);
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
