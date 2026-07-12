'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { NetKind } from '@/data/types';
import type { SchematicDefinition, SchematicGraph, SchematicView } from '@/data/schematic-types';
import { materializeSchematic } from '@/lib/schematic-definition';
import { buildLayout, type TwinLayout } from '@/lib/twin';
import { LAYERS } from '@/components/board/palette';

const ALL_LAYERS = new Set<NetKind>(LAYERS.map((layer) => layer.kind));

export interface SchematicState {
  configuration: string;
  view: SchematicView;
  host: string;
  layers: Set<NetKind>;
  selectedNetId: string | null;
  selectedTerminalId: string | null;
  selectedNodeId: string | null;
  selectedHotspotId: string | null;
  hoveredNetId: string | null;
  hoveredTerminalId: string | null;
  hoveredNodeId: string | null;
  hoveredHotspotId: string | null;
}

export interface SchematicActions {
  setConfiguration: (configuration: string) => void;
  setView: (view: SchematicView) => void;
  setHost: (host: string) => void;
  toggleLayer: (kind: NetKind) => void;
  selectNet: (id: string | null) => void;
  selectTerminal: (id: string | null) => void;
  selectNode: (id: string | null) => void;
  selectHotspot: (id: string | null) => void;
  hoverNet: (id: string | null) => void;
  hoverTerminal: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  hoverHotspot: (id: string | null) => void;
}

export interface SchematicMeta {
  definition: SchematicDefinition;
  graph: SchematicGraph;
  layout: TwinLayout;
  reducedMotion: boolean;
  interactive: boolean;
}

interface SchematicContextValue {
  state: SchematicState;
  actions: SchematicActions;
  meta: SchematicMeta;
}

const SchematicContext = createContext<SchematicContextValue | null>(null);

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return reduced;
}

export function SchematicProvider({
  definition,
  children,
  interactive = true,
  initialConfiguration = definition.defaultConfiguration,
}: {
  definition: SchematicDefinition;
  children: ReactNode;
  interactive?: boolean;
  initialConfiguration?: string;
}) {
  const [configuration, setConfigurationState] = useState(initialConfiguration);
  const [view, setView] = useState(definition.defaultView);
  const [host, setHost] = useState(definition.defaultHost);
  const [layers, setLayers] = useState<Set<NetKind>>(() => new Set(ALL_LAYERS));
  const [selectedNetId, selectNet] = useState<string | null>(null);
  const [selectedTerminalId, selectTerminalState] = useState<string | null>(null);
  const [selectedNodeId, selectNode] = useState<string | null>(null);
  const [selectedHotspotId, selectHotspot] = useState<string | null>(definition.hotspots[0]?.id ?? null);
  const [hoveredNetId, hoverNet] = useState<string | null>(null);
  const [hoveredTerminalId, hoverTerminal] = useState<string | null>(null);
  const [hoveredNodeId, hoverNode] = useState<string | null>(null);
  const [hoveredHotspotId, hoverHotspot] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  const graph = useMemo(() => materializeSchematic(definition, configuration), [configuration, definition]);
  const layout = useMemo(() => buildLayout(view, graph, definition.views[view]), [definition, graph, view]);

  const setConfiguration = useCallback((nextConfiguration: string) => {
    const nextGraph = materializeSchematic(definition, nextConfiguration);
    const nodeIds = new Set(nextGraph.nodes.map((node) => node.id));
    const terminalIds = new Set(nextGraph.terminals.map((terminal) => terminal.id));
    const netIds = new Set(nextGraph.nets.map((net) => net.id));
    setConfigurationState(nextConfiguration);
    selectNode((id) => (id && nodeIds.has(id) ? id : null));
    const selectedTerminalRemoved = Boolean(selectedTerminalId && !terminalIds.has(selectedTerminalId));
    selectTerminalState((id) => (id && terminalIds.has(id) ? id : null));
    selectNet((id) => (selectedTerminalRemoved ? null : id && netIds.has(id) ? id : null));
    hoverNode((id) => (id && nodeIds.has(id) ? id : null));
    hoverTerminal((id) => (id && terminalIds.has(id) ? id : null));
    hoverNet((id) => (id && netIds.has(id) ? id : null));
  }, [definition, selectedTerminalId]);

  const toggleLayer = useCallback((kind: NetKind) => {
    setLayers((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const selectTerminal = useCallback((id: string | null) => {
    selectTerminalState(id);
    if (!id) return;
    selectNet(graph.nets.find((net) => net.terminals.includes(id))?.id ?? null);
  }, [graph.nets]);

  const state = useMemo<SchematicState>(() => ({
    configuration,
    view,
    host,
    layers,
    selectedNetId,
    selectedTerminalId,
    selectedNodeId,
    selectedHotspotId,
    hoveredNetId,
    hoveredTerminalId,
    hoveredNodeId,
    hoveredHotspotId,
  }), [
    configuration, host, hoveredHotspotId, hoveredNetId, hoveredNodeId, hoveredTerminalId,
    layers, selectedHotspotId, selectedNetId, selectedNodeId, selectedTerminalId, view,
  ]);

  const actions = useMemo<SchematicActions>(() => ({
    setConfiguration,
    setView,
    setHost,
    toggleLayer,
    selectNet,
    selectTerminal,
    selectNode,
    selectHotspot,
    hoverNet,
    hoverTerminal,
    hoverNode,
    hoverHotspot,
  }), [setConfiguration, selectTerminal, toggleLayer]);

  const meta = useMemo<SchematicMeta>(() => ({
    definition,
    graph,
    layout,
    reducedMotion,
    interactive,
  }), [definition, graph, interactive, layout, reducedMotion]);

  return <SchematicContext.Provider value={{ state, actions, meta }}>{children}</SchematicContext.Provider>;
}

export function useSchematic(): SchematicContextValue {
  const context = useContext(SchematicContext);
  if (!context) throw new Error('useSchematic must be used within SchematicProvider');
  return context;
}
