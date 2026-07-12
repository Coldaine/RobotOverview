import { describe, expect, it } from 'vitest';
import { beastSchematicDefinition } from '@/data/schematics/beast';
import { hangarData } from '@/data/hangar';
import type { SchematicDefinition } from '@/data/schematic-types';
import {
  materializeSchematic,
  validateSchematicDefinition,
} from '@/lib/schematic-definition';
import { buildLayout, resolveActive } from '@/lib/twin';

const syntheticDefinition: SchematicDefinition = {
  id: 'synthetic-link',
  name: 'Synthetic Link',
  defaultConfiguration: 'installed',
  defaultView: 'board',
  defaultHost: 'alpha',
  hosts: [
    { id: 'alpha', label: 'Alpha Host', terminalIds: ['a-out'] },
    { id: 'beta', label: 'Beta Host', terminalIds: [] },
  ],
  hotspots: [
    { id: 'left', label: 'Left module', x: 20, y: 50 },
    { id: 'right', label: 'Right module', x: 80, y: 50 },
  ],
  graph: {
    nodes: [
      { id: 'node-a', label: 'Node A', className: 'Source', bay: 'compute', state: 'installed' },
      { id: 'node-b', label: 'Node B', className: 'Sink', bay: 'robotics', state: 'installed' },
    ],
    terminals: [
      { id: 'a-out', unitId: 'node-a', name: 'Output', role: 'output' },
      { id: 'b-in', unitId: 'node-b', name: 'Input', role: 'input' },
    ],
    nets: [
      { id: 'link', name: 'Link', kind: 'data', terminals: ['a-out', 'b-in'] },
    ],
  },
  configurations: [
    { id: 'installed', label: 'As Installed' },
  ],
  views: {
    board: {
      kind: 'board',
      width: 400,
      height: 240,
      wireBow: 30,
      moduleOrder: ['node-a', 'node-b'],
      modules: {
        'node-a': { x: 30, y: 60, w: 120, h: 90 },
        'node-b': { x: 250, y: 60, w: 120, h: 90 },
      },
      terminalEdges: { 'a-out': 'right', 'b-in': 'left' },
    },
    iso: {
      kind: 'cutaway',
      width: 400,
      height: 240,
      wireBow: 36,
      moduleOrder: ['node-a', 'node-b'],
      modules: {
        'node-a': { x: 40, y: 100, w: 120, h: 90 },
        'node-b': { x: 240, y: 35, w: 120, h: 90 },
      },
      terminalEdges: { 'a-out': 'right', 'b-in': 'left' },
    },
    bus: {
      kind: 'bus',
      width: 400,
      height: 240,
      moduleWidth: 120,
      columnOrder: ['node-a', 'node-b'],
      rowOrder: ['link'],
      x0: 100,
      columnGap: 200,
      y0: 120,
      rowGap: 40,
      top: 30,
      bottom: 210,
    },
  },
};

describe('schematic definition validation', () => {
  it('accepts a complete non-BEAST definition', () => {
    expect(validateSchematicDefinition(syntheticDefinition)).toEqual([]);
  });

  it('reports duplicate graph IDs and dangling references', () => {
    const invalid: SchematicDefinition = {
      ...syntheticDefinition,
      graph: {
        ...syntheticDefinition.graph,
        nodes: [...syntheticDefinition.graph.nodes, syntheticDefinition.graph.nodes[0]],
        terminals: [
          ...syntheticDefinition.graph.terminals,
          { id: 'ghost-port', unitId: 'ghost', name: 'Ghost port' },
        ],
        nets: [
          ...syntheticDefinition.graph.nets,
          { id: 'broken', name: 'Broken', kind: 'data', terminals: ['a-out', 'missing'] },
        ],
      },
    };

    expect(validateSchematicDefinition(invalid)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('duplicate node id "node-a"'),
        expect.stringContaining('terminal "ghost-port" references unknown node "ghost"'),
        expect.stringContaining('net "broken" references unknown terminal "missing"'),
        expect.stringContaining('board view is missing placement for node "ghost"'),
      ]),
    );
  });

  it('requires valid defaults and complete configuration patches', () => {
    const invalid: SchematicDefinition = {
      ...syntheticDefinition,
      defaultConfiguration: 'missing',
      defaultHost: 'missing',
      configurations: [
        ...syntheticDefinition.configurations,
        {
          id: 'preview',
          label: 'Preview',
          patch: {
            addNodes: [
              { id: 'node-c', label: 'Node C', className: 'Preview', bay: 'robotics', state: 'preview' },
            ],
            addTerminals: [
              { id: 'c-in', unitId: 'node-c', name: 'Input' },
            ],
            extendNets: [{ netId: 'missing-net', terminalIds: ['c-in', 'missing-terminal'] }],
          },
        },
      ],
    };

    expect(validateSchematicDefinition(invalid)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('default configuration "missing" does not exist'),
        expect.stringContaining('default host "missing" does not exist'),
        expect.stringContaining('configuration "preview" extends unknown net "missing-net"'),
        expect.stringContaining('configuration "preview" references unknown terminal "missing-terminal"'),
        expect.stringContaining('board view is missing placement for node "node-c"'),
        expect.stringContaining('iso view is missing placement for node "node-c"'),
      ]),
    );
  });
});

describe('definition-driven layout builders', () => {
  it.each(['board', 'iso', 'bus'] as const)('builds a synthetic %s layout without known IDs', (view) => {
    const graph = materializeSchematic(syntheticDefinition, 'installed');
    const layout = buildLayout(view, graph, syntheticDefinition.views[view]);

    expect(layout.modules.map((module) => module.unitId)).toEqual(['node-a', 'node-b']);
    expect(layout.wires).toHaveLength(1);
    expect(layout.wires[0].terminalIds).toEqual(['a-out', 'b-in']);
    expect(layout.ports.every((port) => ['a-out', 'b-in'].includes(port.terminalId))).toBe(true);
  });

  it('resolves arbitrary host IDs from definition data', () => {
    const graph = materializeSchematic(syntheticDefinition, 'installed');
    const alpha = resolveActive(graph.terminals, graph.nets, 'alpha', syntheticDefinition.hosts);
    const beta = resolveActive(graph.terminals, graph.nets, 'beta', syntheticDefinition.hosts);

    expect(alpha.terminalIds.has('a-out')).toBe(true);
    expect(beta.terminalIds.has('a-out')).toBe(false);
    expect(alpha.netIds.has('link')).toBe(true);
    expect(beta.netIds.has('link')).toBe(false);
  });
});

describe('BEAST configurations', () => {
  it('validates the canonical definition', () => {
    expect(validateSchematicDefinition(beastSchematicDefinition)).toEqual([]);
  });

  it('keeps RoArm out of As Installed', () => {
    const graph = materializeSchematic(beastSchematicDefinition, 'installed');

    expect(graph.nodes.some((node) => node.id === 'roarm-m3')).toBe(false);
    expect(graph.terminals.some((terminal) => terminal.id === 'roarm-servo-in')).toBe(false);
    expect(graph.nets.find((net) => net.id === 'net-servo-bus')?.terminals).toEqual([
      'gdb-servo-bus',
      'beast-pan-tilt',
    ]);
  });

  it('adds a preview node and extends the servo bus without inventory data', () => {
    const inventoryCount = beastSchematicDefinition.graph.nodes.filter((node) => node.unitId).length;
    const graph = materializeSchematic(beastSchematicDefinition, 'roarm-preview');

    const roarm = graph.nodes.find((node) => node.id === 'roarm-m3');
    expect(roarm).toMatchObject({
      label: 'RoArm-M3',
      state: 'preview',
    });
    expect(roarm).not.toHaveProperty('unitId');
    expect(graph.terminals.some((terminal) => terminal.id === 'roarm-servo-in')).toBe(true);
    expect(graph.nets.find((net) => net.id === 'net-servo-bus')?.terminals).toContain('roarm-servo-in');
    expect(beastSchematicDefinition.graph.nodes.filter((node) => node.unitId)).toHaveLength(inventoryCount);
    expect(hangarData.units.some((unit) => unit.id.includes('roarm'))).toBe(false);
    expect(hangarData.wishlist.some((item) => item.id.includes('roarm'))).toBe(false);
  });
});
