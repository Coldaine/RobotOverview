import { hangarData } from '@/data/hangar';
import type { SchematicDefinition, SchematicNode } from '@/data/schematic-types';

const schematicUnitIds = [...new Set(hangarData.terminals.map((terminal) => terminal.unitId))];
const nodes: SchematicNode[] = schematicUnitIds.map((unitId) => {
  const unit = hangarData.units.find((candidate) => candidate.id === unitId);
  if (!unit) throw new Error(`BEAST schematic references missing inventory unit "${unitId}"`);
  return {
    id: unit.id,
    unitId: unit.id,
    label: unit.name,
    callsign: unit.callsign,
    className: unit.class,
    bay: unit.bay,
    state: unit.id === 'orin-nano' ? 'available' : 'installed',
  };
});

const terminalEdges = {
  'gdb-power-in': 'left',
  'gdb-12v-switched': 'left',
  'gdb-5v-host': 'top',
  'gdb-usb-esp32': 'top',
  'gdb-lidar-uart': 'top',
  'gdb-host-uart': 'right',
  'gdb-servo-bus': 'bottom',
  'gdb-motor-a': 'bottom',
  'gdb-motor-b': 'bottom',
  'gdb-i2c': 'bottom',
  'ups-rail-out': 'bottom',
  'ups-telemetry': 'right',
  'ups-charge-in': 'top',
  'pi5-40pin': 'left',
  'pi5-usb': 'bottom',
  'orin-uart': 'left',
  'orin-dc-in': 'left',
  'orin-usb': 'left',
  'oak-usb': 'right',
  'd500-uart': 'right',
  'beast-motor-left': 'top',
  'beast-motor-right': 'top',
  'beast-pan-tilt': 'top',
  'beast-camera': 'top',
  'beast-oled': 'top',
  'roarm-servo-in': 'top',
} as const;

export const beastSchematicDefinition: SchematicDefinition = {
  id: 'beast-01',
  name: 'BEAST-01',
  defaultConfiguration: 'installed',
  defaultView: 'board',
  defaultHost: 'pi5',
  coreNodeId: 'driver-board',
  hosts: [
    { id: 'pi5', label: 'Raspberry Pi 5', terminalIds: ['pi5-40pin', 'pi5-usb'] },
    { id: 'orin', label: 'Jetson Orin', terminalIds: ['orin-uart', 'orin-dc-in', 'orin-usb'] },
  ],
  hotspots: [
    { id: 'lighting', label: 'Top Deck / Sensor Mast', x: 30, y: 19 },
    { id: 'compute', label: 'Host Controller Board', x: 50, y: 54 },
    { id: 'power', label: 'Undercarriage Bay', x: 50, y: 79 },
    { id: 'arm', label: 'Manipulator Arm Base', x: 64, y: 40 },
    { id: 'driver', label: 'Driver Board I/O', x: 40, y: 48 },
  ],
  graph: {
    nodes,
    terminals: hangarData.terminals,
    nets: hangarData.nets,
  },
  configurations: [
    {
      id: 'installed',
      label: 'As Installed',
      description: 'Truthful current BEAST-01 hardware.',
    },
    {
      id: 'roarm-preview',
      label: 'RoArm Preview',
      badge: 'PREVIEW · NOT INSTALLED',
      description: 'Hypothetical RoArm-M3 expansion on the existing servo bus.',
      patch: {
        addNodes: [
          {
            id: 'roarm-m3',
            label: 'RoArm-M3',
            callsign: 'ROARM PREVIEW',
            className: 'Manipulator Arm',
            bay: 'robotics',
            state: 'preview',
          },
        ],
        addTerminals: [
          {
            id: 'roarm-servo-in',
            unitId: 'roarm-m3',
            name: 'ST3215 Servo Bus Input',
            connector: 'TTL bus header',
            role: 'bidirectional',
            note: 'Preview-only daisy-chain connection; no RoArm is installed.',
          },
        ],
        extendNets: [{ netId: 'net-servo-bus', terminalIds: ['roarm-servo-in'] }],
      },
    },
  ],
  views: {
    board: {
      kind: 'board',
      width: 1040,
      height: 680,
      wireBow: 48,
      moduleOrder: ['stock-ups', 'oak-d-lite', 'd500-lidar', 'driver-board', 'pi5', 'orin-nano', 'beast', 'roarm-m3'],
      modules: {
        'driver-board': { x: 390, y: 250, w: 260, h: 190 },
        'stock-ups': { x: 60, y: 70, w: 210, h: 130 },
        'oak-d-lite': { x: 70, y: 280, w: 210, h: 120 },
        'd500-lidar': { x: 80, y: 470, w: 200, h: 120 },
        pi5: { x: 790, y: 80, w: 190, h: 120 },
        'orin-nano': { x: 810, y: 300, w: 190, h: 120 },
        beast: { x: 350, y: 500, w: 350, h: 140 },
        'roarm-m3': { x: 790, y: 510, w: 190, h: 120 },
      },
      terminalEdges,
    },
    iso: {
      kind: 'cutaway',
      width: 1040,
      height: 680,
      wireBow: 90,
      moduleOrder: ['stock-ups', 'beast', 'driver-board', 'oak-d-lite', 'd500-lidar', 'pi5', 'orin-nano', 'roarm-m3'],
      modules: {
        'stock-ups': { x: 145, y: 190, w: 210, h: 120 },
        beast: { x: 145, y: 400, w: 210, h: 120 },
        'driver-board': { x: 338.2, y: 145, w: 210, h: 120 },
        'oak-d-lite': { x: -48.2, y: -5, w: 210, h: 120 },
        'd500-lidar': { x: 145, y: 100, w: 210, h: 120 },
        pi5: { x: 531.4, y: 100, w: 210, h: 120 },
        'orin-nano': { x: 338.2, y: 205, w: 210, h: 120 },
        'roarm-m3': { x: 600, y: 390, w: 210, h: 120 },
      },
      terminalEdges,
    },
    bus: {
      kind: 'bus',
      width: 1200,
      height: 680,
      moduleWidth: 130,
      columnOrder: ['stock-ups', 'driver-board', 'pi5', 'orin-nano', 'oak-d-lite', 'd500-lidar', 'beast', 'roarm-m3'],
      rowOrder: [
        'net-battery-rail',
        'net-5v-host',
        'net-host-uart',
        'net-servo-bus',
        'net-ups-telemetry',
        'net-oled-i2c',
        'net-camera',
        'net-oak-camera',
        'net-d500-lidar',
        'net-motor-left',
        'net-motor-right',
      ],
      x0: 100,
      columnGap: 140,
      y0: 150,
      rowGap: 52,
      top: 70,
      bottom: 630,
    },
  },
};
