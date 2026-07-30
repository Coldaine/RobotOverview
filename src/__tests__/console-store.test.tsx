import { beforeEach, describe, expect, it } from 'vitest';
import { consoleActions, useConsoleStore } from '@/components/datacore/beast-console/console-store';
import { renderHook } from '@testing-library/react';

function readState() {
  const { result } = renderHook(() => useConsoleStore((s) => s));
  return result.current;
}

beforeEach(() => {
  window.localStorage.clear();
  consoleActions.importState(
    JSON.stringify({
      activeProject: 'beast-01',
      projects: {
        'beast-01': { name: 'BEAST-01', ports: {}, mounts: {}, checks: {}, notes: '' },
      },
    }),
  );
});

describe('console-store importState', () => {
  it('rejects JSON that is not a console save', () => {
    expect(() => consoleActions.importState('{"hello":"world"}')).toThrow(
      'Not a BEAST Console save file',
    );
    expect(() => consoleActions.importState('"just a string"')).toThrow(
      'Not a BEAST Console save file',
    );
  });

  it('rejects a save whose active project does not exist', () => {
    expect(() =>
      consoleActions.importState(
        JSON.stringify({ activeProject: 'ghost', projects: { real: { name: 'Real' } } }),
      ),
    ).toThrow('Not a BEAST Console save file');
  });

  it('normalizes a project missing nested maps instead of crashing on first edit', () => {
    consoleActions.importState(
      JSON.stringify({
        activeProject: 'old',
        projects: { old: { name: 'Old save from before maps existed' } },
      }),
    );

    expect(() =>
      consoleActions.setPort('drv-esp32-usb', { status: 'plugged', cable: 'USB-C' }),
    ).not.toThrow();

    const project = readState().projects.old;
    expect(project.ports['drv-esp32-usb'].status).toBe('plugged');
    expect(project.mounts).toEqual({});
    expect(project.checks).toEqual({});
    expect(project.notes).toBe('');
  });

  it('keeps valid records and drops malformed ones', () => {
    consoleActions.importState(
      JSON.stringify({
        activeProject: 'mixed',
        projects: {
          mixed: {
            name: 'Mixed',
            ports: {
              good: { status: 'plugged', connectedTo: 'periph', cable: 'c', notes: '' },
              'bad-status': { status: 'welded', connectedTo: '', cable: '', notes: '' },
              'bad-shape': 'not a record',
            },
            mounts: { layer: { status: 'mounted', hardware: 'Orin', notes: '' } },
            checks: { step1: true, step2: 'yes' },
            notes: 42,
          },
        },
      }),
    );

    const project = readState().projects.mixed;
    expect(Object.keys(project.ports)).toEqual(['good']);
    expect(project.mounts.layer.hardware).toBe('Orin');
    expect(project.checks).toEqual({ step1: true });
    expect(project.notes).toBe('');
  });

  it('ignores saves where projects is not a map', () => {
    expect(() =>
      consoleActions.importState(
        JSON.stringify({ activeProject: 'x', projects: ['not', 'a', 'map'] }),
      ),
    ).toThrow('Not a BEAST Console save file');
  });
});
