'use client';

import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { useHangar } from '@/lib/store';
import {
  resolveActive,
  traceFromNet,
  traceFromTerminal,
  type TraceSet,
} from '@/lib/twin';
import { useSchematic } from '@/components/schematic/SchematicProvider';
import {
  SchematicCanvas,
  SchematicConfigurationSwitch,
  SchematicFrame,
  SchematicInspector,
  SchematicToolbar,
} from '@/components/schematic/SchematicPrimitives';
import { ViewModeSwitch, HostSwitch, LayerBar } from './Controls';
import { TwinCanvas } from './TwinCanvas';
import { NetInspector } from './NetInspector';

export function ConnectedTwin() {
  const { units, documents } = useHangar();
  const { state, actions, meta } = useSchematic();
  const { graph, layout, definition, interactive, reducedMotion } = meta;
  const { terminals, nets } = graph;

  const active = useMemo(
    () => resolveActive(terminals, nets, state.host, definition.hosts),
    [definition.hosts, nets, state.host, terminals],
  );
  const highlight = useMemo<TraceSet | null>(() => {
    if (state.hoveredNetId) return traceFromNet(nets, state.hoveredNetId);
    if (state.hoveredTerminalId) return traceFromTerminal(nets, state.hoveredTerminalId);
    if (state.selectedNetId) return traceFromNet(nets, state.selectedNetId);
    return null;
  }, [nets, state.hoveredNetId, state.hoveredTerminalId, state.selectedNetId]);
  const selectedNet = useMemo(
    () => nets.find((net) => net.id === state.selectedNetId) ?? null,
    [nets, state.selectedNetId],
  );

  useEffect(() => {
    if (!interactive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        actions.selectNet(null);
        actions.selectTerminal(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, interactive]);

  const canvas = (
    <SchematicCanvas>
      <TwinCanvas
        key={state.view}
        layout={layout}
        mode={state.view}
        units={units}
        nodes={graph.nodes}
        terminals={terminals}
        active={active}
        highlight={highlight}
        dimOthers={Boolean(highlight)}
        selectedNetId={state.selectedNetId}
        layerEnabled={state.layers}
        hoveredModule={state.hoveredNodeId}
        reducedMotion={reducedMotion}
        interactive={interactive}
        coreNodeId={definition.coreNodeId}
        onHoverTerminal={actions.hoverTerminal}
        onHoverNet={actions.hoverNet}
        onHoverModule={actions.hoverNode}
        onSelectNet={actions.selectNet}
        onSelectTerminal={actions.selectTerminal}
      />
    </SchematicCanvas>
  );

  if (!interactive) {
    return (
      <SchematicFrame className="h-64">
        {canvas}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-transparent" />
        <div className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
          Connected Twin · {terminals.length} terminals · {nets.length} nets
        </div>
      </SchematicFrame>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SchematicToolbar>
        <ViewModeSwitch mode={state.view} onChange={actions.setView} />
        <LayerBar enabled={state.layers} onToggle={actions.toggleLayer} />
        <HostSwitch hosts={definition.hosts} host={state.host} onChange={actions.setHost} />
      </SchematicToolbar>
      <SchematicConfigurationSwitch
        configurations={definition.configurations}
        configuration={state.configuration}
        onChange={actions.setConfiguration}
        compact
      />

      <SchematicFrame className="h-[74vh] min-h-[520px]">
        {canvas}
        <SchematicInspector>
          <NetInspector
            net={selectedNet}
            units={units}
            terminals={terminals}
            documents={documents}
            active={active}
            onClose={() => {
              actions.selectNet(null);
              actions.selectTerminal(null);
            }}
            onHoverTerminal={actions.hoverTerminal}
          />
        </SchematicInspector>
        <div
          className={clsx(
            'pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim transition-opacity',
            selectedNet ? 'opacity-0' : 'opacity-100',
          )}
        >
          Hover a port to trace its net · click to open · scroll to zoom · drag to pan
        </div>
      </SchematicFrame>
    </div>
  );
}
