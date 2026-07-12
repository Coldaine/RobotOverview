import type { BayId, Net, Terminal } from './types';

export const SCHEMATIC_VIEWS = ['board', 'iso', 'bus'] as const;
export type SchematicView = (typeof SCHEMATIC_VIEWS)[number];

export type SchematicNodeState = 'installed' | 'available' | 'preview';

export interface SchematicNode {
  id: string;
  unitId?: string;
  label: string;
  callsign?: string;
  className: string;
  bay: BayId;
  state: SchematicNodeState;
}

export interface SchematicHotspot {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface SchematicGraph {
  nodes: SchematicNode[];
  terminals: Terminal[];
  nets: Net[];
}

export interface SchematicGraphPatch {
  addNodes?: SchematicNode[];
  addTerminals?: Terminal[];
  addNets?: Net[];
  extendNets?: Array<{ netId: string; terminalIds: string[] }>;
}

export interface SchematicConfiguration {
  id: string;
  label: string;
  badge?: string;
  description?: string;
  patch?: SchematicGraphPatch;
}

export interface SchematicHost {
  id: string;
  label: string;
  terminalIds: string[];
}

export type SchematicEdge = 'top' | 'right' | 'bottom' | 'left';

export interface SchematicModulePlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SchematicFreeformLayout {
  kind: 'board' | 'cutaway';
  width: number;
  height: number;
  wireBow: number;
  moduleOrder: string[];
  modules: Record<string, SchematicModulePlacement>;
  terminalEdges: Record<string, SchematicEdge>;
}

export interface SchematicBusLayout {
  kind: 'bus';
  width: number;
  height: number;
  moduleWidth: number;
  columnOrder: string[];
  rowOrder: string[];
  x0: number;
  columnGap: number;
  y0: number;
  rowGap: number;
  top: number;
  bottom: number;
}

export interface SchematicViewLayouts {
  board: SchematicFreeformLayout;
  iso: SchematicFreeformLayout;
  bus: SchematicBusLayout;
}

export interface SchematicDefinition {
  id: string;
  name: string;
  defaultConfiguration: string;
  defaultView: SchematicView;
  defaultHost: string;
  hosts: SchematicHost[];
  coreNodeId?: string;
  hotspots: SchematicHotspot[];
  graph: SchematicGraph;
  configurations: SchematicConfiguration[];
  views: SchematicViewLayouts;
}
