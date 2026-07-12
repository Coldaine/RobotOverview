'use client';

import { beastSchematicDefinition } from '@/data/schematics/beast';
import { SchematicProvider } from '@/components/schematic/SchematicProvider';
import { ConnectedTwin } from './ConnectedTwin';

export function BeastBoardSchematic() {
  return (
    <SchematicProvider definition={beastSchematicDefinition}>
      <ConnectedTwin />
    </SchematicProvider>
  );
}

export function BeastBoardPreview() {
  return (
    <SchematicProvider
      definition={beastSchematicDefinition}
      initialConfiguration="installed"
      interactive={false}
    >
      <ConnectedTwin />
    </SchematicProvider>
  );
}

