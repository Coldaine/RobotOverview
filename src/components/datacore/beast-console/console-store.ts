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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

function isPortRecord(v: unknown): v is PortRecord {
  if (!isRecord(v)) return false;
  return (
    (v.status === 'empty' || v.status === 'planned' || v.status === 'plugged') &&
    typeof v.connectedTo === 'string' &&
    typeof v.cable === 'string' &&
    typeof v.notes === 'string'
  );
}

function isMountRecord(v: unknown): v is MountRecord {
  if (!isRecord(v)) return false;
  return (
    (v.status === 'planned' || v.status === 'mounted' || v.status === 'removed') &&
    typeof v.hardware === 'string' &&
    typeof v.notes === 'string'
  );
}

/**
 * Repair a project from a save file: missing maps become empty, malformed
 * records are dropped rather than crashing the editor later. Returns null when
 * the value cannot be a project at all.
 */
function normalizeProject(value: unknown): ConsoleProject | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null;
  const { name } = value;
  const v = value as Partial<ConsoleProject>;
  const ports: Record<string, PortRecord> = {};
  if (isRecord(v.ports)) {
    for (const [id, rec] of Object.entries(v.ports)) {
      if (isPortRecord(rec)) ports[id] = rec;
    }
  }
  const mounts: Record<string, MountRecord> = {};
  if (isRecord(v.mounts)) {
    for (const [id, rec] of Object.entries(v.mounts)) {
      if (isMountRecord(rec)) mounts[id] = rec;
    }
  }
  const checks: Record<string, boolean> = {};
  if (isRecord(v.checks)) {
    for (const [id, c] of Object.entries(v.checks)) {
      if (typeof c === 'boolean') checks[id] = c;
    }
  }
  return { name, ports, mounts, checks, notes: typeof v.notes === 'string' ? v.notes : '' };
}

/**
 * Deep validation for save files: every project is normalized, and the active
 * project must survive. Anything less is not a console save.
 */
function normalizeState(value: unknown): ConsoleState | null {
  if (!isRecord(value) || typeof value.activeProject !== 'string' || !isRecord(value.projects)) {
    return null;
  }
  const projects: Record<string, ConsoleProject> = {};
  for (const [pid, proj] of Object.entries(value.projects)) {
    const normalized = normalizeProject(proj);
    if (normalized) projects[pid] = normalized;
  }
  const activeProject = value.activeProject;
  if (!projects[activeProject]) return null;
  return { activeProject, projects };
}

function load(): ConsoleState {
  try {
    const raw = storage?.getItem(KEY);
    if (raw) {
      const normalized = normalizeState(JSON.parse(raw));
      if (normalized) return normalized;
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
    const normalized = normalizeState(JSON.parse(json));
    if (!normalized) {
      throw new Error('Not a BEAST Console save file');
    }
    state = normalized;
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
