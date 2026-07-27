'use client';
/**
 * BEAST Console persistence: per-project plug/mount/checklist records.
 * localStorage-backed with a probe (falls back to memory-only in blocked
 * contexts), plus JSON export/import so records travel between machines.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'hangar:beast-console:v1';

export type PortStatus = 'empty' | 'planned' | 'plugged';

export interface PortRecord {
  status: PortStatus;
  connectedTo: string;
  cable: string;
  notes: string;
  updatedAt?: string;
}

export interface MountRecord {
  status: 'planned' | 'mounted' | 'removed';
  hardware: string;
  notes: string;
  updatedAt?: string;
}

export interface ConsoleProject {
  name: string;
  ports: Record<string, PortRecord>;
  mounts: Record<string, MountRecord>;
  checks: Record<string, boolean>;
  notes: string;
}

export interface ConsoleState {
  activeProject: string;
  projects: Record<string, ConsoleProject>;
}

const defaultProject = (name: string): ConsoleProject => ({
  name,
  ports: {},
  mounts: {},
  checks: {},
  notes: '',
});

const initial = (): ConsoleState => ({
  activeProject: 'beast-01',
  projects: { 'beast-01': defaultProject('BEAST-01 · UGV Beast + Orin Nano') },
});

const storage = (() => {
  if (typeof window === 'undefined') return null;
  try {
    const s = window.localStorage;
    s.setItem('__beast_probe__', '1');
    s.removeItem('__beast_probe__');
    return s;
  } catch {
    return null;
  }
})();

export const consoleStorageMode: 'local' | 'memory' = storage ? 'local' : 'memory';

function isConsoleState(value: unknown): value is ConsoleState {
  if (!value || typeof value !== 'object') return false;
  const v = value as ConsoleState;
  return typeof v.activeProject === 'string' && !!v.projects && typeof v.projects === 'object';
}

function load(): ConsoleState {
  try {
    const raw = storage?.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isConsoleState(parsed) && parsed.projects[parsed.activeProject]) return parsed;
    }
  } catch {
    /* fresh start */
  }
  return initial();
}

let state: ConsoleState = load();
const listeners = new Set<() => void>();
// Server snapshot must be referentially stable for useSyncExternalStore.
const serverState: ConsoleState = initial();

function persist() {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function emit() {
  persist();
  for (const l of listeners) l();
}

export function useConsoleStore<T>(selector: (s: ConsoleState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(serverState),
  );
}

function updateProject(fn: (p: ConsoleProject) => ConsoleProject) {
  const pid = state.activeProject;
  const proj = state.projects[pid];
  if (!proj) return;
  state = { ...state, projects: { ...state.projects, [pid]: fn(proj) } };
  emit();
}

export const consoleActions = {
  setPort(portId: string, patch: Partial<PortRecord>) {
    updateProject((p) => {
      const prev: PortRecord = p.ports[portId] ?? { status: 'empty', connectedTo: '', cable: '', notes: '' };
      return {
        ...p,
        ports: { ...p.ports, [portId]: { ...prev, ...patch, updatedAt: new Date().toISOString() } },
      };
    });
  },
  clearPort(portId: string) {
    updateProject((p) => {
      const ports = { ...p.ports };
      delete ports[portId];
      return { ...p, ports };
    });
  },
  setMount(layerId: string, patch: Partial<MountRecord>) {
    updateProject((p) => {
      const prev: MountRecord = p.mounts[layerId] ?? { status: 'planned', hardware: '', notes: '' };
      return {
        ...p,
        mounts: { ...p.mounts, [layerId]: { ...prev, ...patch, updatedAt: new Date().toISOString() } },
      };
    });
  },
  toggleCheck(checkId: string) {
    updateProject((p) => ({ ...p, checks: { ...p.checks, [checkId]: !p.checks[checkId] } }));
  },
  switchProject(pid: string) {
    if (!state.projects[pid]) return;
    state = { ...state, activeProject: pid };
    emit();
  },
  addProject(name: string): string {
    const pid =
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
      `project-${Object.keys(state.projects).length + 1}`;
    if (!state.projects[pid]) {
      state = { ...state, projects: { ...state.projects, [pid]: defaultProject(name) } };
    }
    state = { ...state, activeProject: pid };
    emit();
    return pid;
  },
  importState(json: string) {
    const parsed: unknown = JSON.parse(json);
    if (!isConsoleState(parsed) || !parsed.projects[parsed.activeProject]) {
      throw new Error('Not a BEAST Console save file');
    }
    state = parsed;
    emit();
  },
};

export function exportConsoleSave(): boolean {
  try {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beast-console-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}
