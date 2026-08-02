'use client';

import { useSyncExternalStore } from 'react';

/**
 * E-stop state lives in its own module, separate from the rosbridge client.
 *
 * The app-wide "E-STOP HELD" banner has to render on EVERY route — that is the
 * point of it, since an engaged stop deliberately outlives the cockpit page. If
 * that banner imported the full client, every route in the Hangar would pull the
 * entire rosbridge transport, its parsers and its timers just to ask one boolean
 * question. This module is the whole dependency the banner needs.
 *
 * `client.ts` imports these setters; nothing here imports `client.ts` back.
 */
export interface CockpitEstop {
  /**
   * Operator intent — the stop is latched down. Survives component unmount and
   * socket drops; only an explicit release clears it.
   */
  engaged: boolean;
  /** Epoch ms the intent was latched. */
  engagedAt: number | null;
  /** Command writer capability enabled for connected sessions. */
  writer: boolean;
}

const BLANK: CockpitEstop = {
  engaged: false,
  engagedAt: null,
  writer: true,
};

/** Server render has no socket and no operator, so nothing is ever engaged. */
const SERVER_SNAPSHOT: CockpitEstop = BLANK;

let estopState: CockpitEstop = { ...BLANK };
const estopListeners = new Set<() => void>();

export function getEstopState(): CockpitEstop {
  return estopState;
}

export function setEstopState(next: Partial<CockpitEstop>) {
  const merged = { ...estopState, ...next };
  if (
    merged.engaged === estopState.engaged &&
    merged.engagedAt === estopState.engagedAt &&
    merged.writer === estopState.writer
  ) {
    return; // keep the snapshot referentially stable for useSyncExternalStore
  }
  estopState = merged;
  for (const l of estopListeners) l();
}

// Hoisted to module scope: an inline arrow would give React a new `subscribe`
// identity every render and force a full teardown/rebuild of the subscription —
// on every route, now that the shell subscribes.
const subscribeEstop = (cb: () => void) => {
  estopListeners.add(cb);
  return () => estopListeners.delete(cb);
};
const getEstopSnapshot = () => estopState;
const getEstopServerSnapshot = () => SERVER_SNAPSHOT;

export function useCockpitEstop(): CockpitEstop {
  return useSyncExternalStore(subscribeEstop, getEstopSnapshot, getEstopServerSnapshot);
}
