import type {
  SchematicDefinition,
  SchematicGraph,
  SchematicGraphPatch,
  SchematicView,
} from '@/data/schematic-types';

function duplicateIds<T extends { id: string }>(items: T[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

function patchedGraph(graph: SchematicGraph, patch?: SchematicGraphPatch): SchematicGraph {
  const nodes = [...graph.nodes, ...(patch?.addNodes ?? [])];
  const terminals = [...graph.terminals, ...(patch?.addTerminals ?? [])];
  const extensions = new Map((patch?.extendNets ?? []).map((extension) => [extension.netId, extension.terminalIds]));
  const nets = [...graph.nets, ...(patch?.addNets ?? [])].map((net) => ({
    ...net,
    terminals: [...net.terminals, ...(extensions.get(net.id) ?? [])],
  }));
  return { nodes, terminals, nets };
}

export function materializeSchematic(
  definition: SchematicDefinition,
  configurationId: string,
): SchematicGraph {
  const configuration = definition.configurations.find((candidate) => candidate.id === configurationId);
  if (!configuration) throw new Error(`Unknown schematic configuration "${configurationId}"`);
  return patchedGraph(definition.graph, configuration.patch);
}

function validateGraph(
  definition: SchematicDefinition,
  graph: SchematicGraph,
  context: string,
  errors: string[],
) {
  for (const id of duplicateIds(graph.nodes)) errors.push(`${context} has duplicate node id "${id}"`);
  for (const id of duplicateIds(graph.terminals)) errors.push(`${context} has duplicate terminal id "${id}"`);
  for (const id of duplicateIds(graph.nets)) errors.push(`${context} has duplicate net id "${id}"`);

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const terminalIds = new Set(graph.terminals.map((terminal) => terminal.id));
  for (const terminal of graph.terminals) {
    if (!nodeIds.has(terminal.unitId)) {
      errors.push(`terminal "${terminal.id}" references unknown node "${terminal.unitId}"`);
    }
  }
  for (const net of graph.nets) {
    for (const terminalId of net.terminals) {
      if (!terminalIds.has(terminalId)) {
        errors.push(`net "${net.id}" references unknown terminal "${terminalId}"`);
      }
    }
  }

  const wiredNodeIds = new Set(graph.terminals.map((terminal) => terminal.unitId));
  for (const viewId of ['board', 'iso'] as const) {
    const view = definition.views[viewId];
    for (const nodeId of wiredNodeIds) {
      if (!view.modules[nodeId]) errors.push(`${viewId} view is missing placement for node "${nodeId}"`);
    }
    for (const terminal of graph.terminals) {
      if (!view.terminalEdges[terminal.id]) {
        errors.push(`${viewId} view is missing edge for terminal "${terminal.id}"`);
      }
    }
  }
  for (const nodeId of wiredNodeIds) {
    if (!definition.views.bus.columnOrder.includes(nodeId)) {
      errors.push(`bus view is missing column for node "${nodeId}"`);
    }
  }
}

export function validateSchematicDefinition(definition: SchematicDefinition): string[] {
  const errors: string[] = [];
  const configurationIds = new Set(definition.configurations.map((configuration) => configuration.id));
  const hostIds = new Set(definition.hosts.map((host) => host.id));
  if (!configurationIds.has(definition.defaultConfiguration)) {
    errors.push(`default configuration "${definition.defaultConfiguration}" does not exist`);
  }
  if (!hostIds.has(definition.defaultHost)) errors.push(`default host "${definition.defaultHost}" does not exist`);
  if (!(definition.defaultView in definition.views)) {
    errors.push(`default view "${definition.defaultView}" does not exist`);
  }
  for (const id of duplicateIds(definition.configurations)) errors.push(`duplicate configuration id "${id}"`);
  for (const id of duplicateIds(definition.hosts)) errors.push(`duplicate host id "${id}"`);
  for (const id of duplicateIds(definition.hotspots)) errors.push(`duplicate hotspot id "${id}"`);

  validateGraph(definition, definition.graph, 'base graph', errors);
  const baseTerminalIds = new Set(definition.graph.terminals.map((terminal) => terminal.id));
  for (const host of definition.hosts) {
    for (const terminalId of host.terminalIds) {
      if (!baseTerminalIds.has(terminalId)) {
        errors.push(`host "${host.id}" references unknown terminal "${terminalId}"`);
      }
    }
  }

  const baseNetIds = new Set(definition.graph.nets.map((net) => net.id));
  for (const configuration of definition.configurations) {
    const patch = configuration.patch;
    if (!patch) continue;
    const patchedTerminalIds = new Set([
      ...definition.graph.terminals.map((terminal) => terminal.id),
      ...(patch.addTerminals ?? []).map((terminal) => terminal.id),
    ]);
    for (const extension of patch.extendNets ?? []) {
      if (!baseNetIds.has(extension.netId) && !(patch.addNets ?? []).some((net) => net.id === extension.netId)) {
        errors.push(`configuration "${configuration.id}" extends unknown net "${extension.netId}"`);
      }
      for (const terminalId of extension.terminalIds) {
        if (!patchedTerminalIds.has(terminalId)) {
          errors.push(`configuration "${configuration.id}" references unknown terminal "${terminalId}"`);
        }
      }
    }
    validateGraph(
      definition,
      patchedGraph(definition.graph, patch),
      `configuration "${configuration.id}" graph`,
      errors,
    );
  }
  return [...new Set(errors)];
}

export function isSchematicView(value: string): value is SchematicView {
  return value === 'board' || value === 'iso' || value === 'bus';
}
