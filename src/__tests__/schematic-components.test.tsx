import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BeastBoardPreview, BeastBoardSchematic } from '@/components/board/BeastBoard';
import { RoverSchematic } from '@/components/RoverSchematic';
import { beastSchematicDefinition } from '@/data/schematics/beast';
import { HangarProvider } from '@/lib/store';
import { SchematicProvider, useSchematic } from '@/components/schematic/SchematicProvider';

function StateHarness() {
  const { state, actions, meta } = useSchematic();
  return (
    <div>
      <output data-testid="configuration">{state.configuration}</output>
      <output data-testid="view">{state.view}</output>
      <output data-testid="host">{state.host}</output>
      <output data-testid="layers">{[...state.layers].sort().join(',')}</output>
      <output data-testid="selection">{state.selectedTerminalId ?? state.selectedNetId ?? 'none'}</output>
      <output data-testid="nodes">{meta.graph.nodes.map((node) => node.id).join(',')}</output>
      <button onClick={() => actions.setView('iso')}>Cutaway state</button>
      <button onClick={() => actions.setHost('orin')}>Orin state</button>
      <button onClick={() => actions.toggleLayer('power')}>Power layer state</button>
      <button onClick={() => actions.setConfiguration('roarm-preview')}>Preview state</button>
      <button onClick={() => actions.selectTerminal('roarm-servo-in')}>Select RoArm</button>
      <button onClick={() => actions.setConfiguration('installed')}>Installed state</button>
    </div>
  );
}

describe('SchematicProvider', () => {
  it('preserves view, host, and layers while clearing entities removed by a configuration switch', () => {
    render(
      <SchematicProvider definition={beastSchematicDefinition}>
        <StateHarness />
      </SchematicProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cutaway state' }));
    fireEvent.click(screen.getByRole('button', { name: 'Orin state' }));
    fireEvent.click(screen.getByRole('button', { name: 'Power layer state' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview state' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select RoArm' }));

    expect(screen.getByTestId('nodes')).toHaveTextContent('roarm-m3');
    expect(screen.getByTestId('selection')).toHaveTextContent('roarm-servo-in');

    fireEvent.click(screen.getByRole('button', { name: 'Installed state' }));

    expect(screen.getByTestId('configuration')).toHaveTextContent('installed');
    expect(screen.getByTestId('view')).toHaveTextContent('iso');
    expect(screen.getByTestId('host')).toHaveTextContent('orin');
    expect(screen.getByTestId('layers')).not.toHaveTextContent('power');
    expect(screen.getByTestId('selection')).toHaveTextContent('none');
    expect(screen.getByTestId('nodes')).not.toHaveTextContent('roarm-m3');
  });
});

describe('explicit BEAST Board compositions', () => {
  it('switches the full Board configuration with accessible controls and traces the preview servo bus', () => {
    render(
      <HangarProvider>
        <BeastBoardSchematic />
      </HangarProvider>,
    );

    expect(screen.getByRole('radio', { name: 'As Installed' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'RoArm Preview' }));

    expect(screen.getAllByText('PREVIEW · NOT INSTALLED')).not.toHaveLength(0);
    expect(screen.getByRole('group', { name: 'RoArm-M3' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trace net-servo-bus' }));
    expect(screen.getByRole('heading', { name: 'ST3215 Serial Servo Bus' })).toBeInTheDocument();
    expect(screen.getByText('ST3215 Servo Bus Input')).toBeInTheDocument();
  });

  it('keeps Board preview noninteractive and As Installed only', () => {
    render(
      <HangarProvider>
        <BeastBoardPreview />
      </HangarProvider>,
    );

    expect(screen.queryByRole('radiogroup', { name: 'Configuration' })).not.toBeInTheDocument();
    expect(screen.queryByText('RoArm-M3')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Trace net-/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Connected Twin/)).toBeInTheDocument();
  });
});

describe('physical BEAST hero configuration', () => {
  it('uses keyboard-accessible radio controls and marks the RoArm overlay as hypothetical', () => {
    render(
      <HangarProvider>
        <RoverSchematic />
      </HangarProvider>,
    );

    const preview = screen.getByRole('radio', { name: 'RoArm Preview' });
    preview.focus();
    fireEvent.keyDown(preview, { key: ' ' });
    fireEvent.click(preview);

    expect(preview).toBeChecked();
    expect(screen.getByRole('img', { name: 'RoArm preview overlay' })).toBeInTheDocument();
    expect(screen.getByText('PREVIEW · NOT INSTALLED')).toBeInTheDocument();
  });
});
