'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { hangarData } from '../data/hangar';
import type {
  Bay,
  BayId,
  Capability,
  HangarData,
  Insight,
  InventoryItem,
  Mission,
  MissionObjective,
  Unit,
  WishlistItem,
} from '../data/types';

const SELECTED_WISHLIST_STATUSES = new Set<WishlistItem['status']>(['planned', 'buy-next', 'on-order', 'received']);
const SELECTED_STATUS_PRIORITY: Partial<Record<WishlistItem['status'], number>> = {
  planned: 1,
  'buy-next': 2,
  'on-order': 3,
  received: 4,
};
const STORE_KEYS = {
  source: 'hangar:source',
  lensMissionId: 'hangar:lensMissionId',
  theme: 'hangar:theme',
  objectives: 'hangar:objectives',
  wishStatus: 'hangar:wishStatus',
  localInsights: 'hangar:localInsights',
} as const;
export const LOCAL_INSIGHT_PREFIX = 'local-';
const SOURCES = ['us', 'import'] as const;
const WISHLIST_STATUSES: WishlistItem['status'][] = [
  'watching',
  'researching',
  'planned',
  'buy-next',
  'on-order',
  'received',
  'rejected',
];
export type WishlistStatus = WishlistItem['status'];
// User overrides layered over the static spine — keep hangarData immutable.
type ObjectiveOverrides = Record<string, Record<number, boolean>>; // missionId -> objIdx -> done
type WishStatusOverrides = Record<string, WishlistStatus>; // wishlist id -> status
export interface NewInsightInput {
  title: string;
  body: string;
  bay?: BayId;
  tags?: string[];
  confidence?: Insight['confidence'];
}
const THEMES = ['blueprint', 'industrial', 'topology'] as const;
export type ThemeMode = (typeof THEMES)[number];

type SourcePreference = (typeof SOURCES)[number];

function isThemeMode(value: string | null): value is ThemeMode {
  return THEMES.some((t) => t === value);
}

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'blueprint';
  try {
    const stored = window.localStorage.getItem(STORE_KEYS.theme);
    return isThemeMode(stored) ? stored : 'blueprint';
  } catch {
    return 'blueprint';
  }
}

function isSourcePreference(value: string | null): value is SourcePreference {
  return SOURCES.some((source) => source === value);
}

function readStoredSource(): SourcePreference {
  if (typeof window === 'undefined') return 'us';

  try {
    const storedSource = window.localStorage.getItem(STORE_KEYS.source);
    return isSourcePreference(storedSource) ? storedSource : 'us';
  } catch {
    return 'us';
  }
}

function readStoredLensMissionId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const storedMissionId = window.localStorage.getItem(STORE_KEYS.lensMissionId);
    if (!storedMissionId) return null;

    return hangarData.missions.some((mission) => mission.id === storedMissionId) ? storedMissionId : null;
  } catch {
    return null;
  }
}

function readStoredObjectives(): ObjectiveOverrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEYS.objectives);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as ObjectiveOverrides)
      : {};
  } catch {
    return {};
  }
}

function readStoredWishStatus(): WishStatusOverrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEYS.wishStatus);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: WishStatusOverrides = {};
    for (const [id, status] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof status === 'string' && WISHLIST_STATUSES.includes(status as WishlistStatus)) {
        out[id] = status as WishlistStatus;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function readStoredLocalInsights(): Insight[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEYS.localInsights);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Keep only well-formed records so a corrupt entry can't break the Codex.
    return parsed.filter(
      (x): x is Insight =>
        x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.body === 'string',
    );
  } catch {
    return [];
  }
}

function writeStorageValue(key: string, value: string | null) {
  if (typeof window === 'undefined') return;

  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Persistence is a convenience layer; private browsing and quotas should not break the app.
  }
}

function isWishlistItem(item: WishlistItem | undefined): item is WishlistItem {
  return Boolean(item);
}

export function selectedMissionWishes(wishes: WishlistItem[]): WishlistItem[] {
  const selected = new Map<string, WishlistItem>();

  wishes.forEach((w) => {
    if (!SELECTED_WISHLIST_STATUSES.has(w.status)) return;

    // Treat matching categories in a mission wishlist as alternative choices
    // until there is a first-class loadout-selection model.
    const current = selected.get(w.category);
    const currentPriority = current ? SELECTED_STATUS_PRIORITY[current.status] ?? 0 : 0;
    const nextPriority = SELECTED_STATUS_PRIORITY[w.status] ?? 0;
    if (!current || nextPriority > currentPriority) selected.set(w.category, w);
  });

  return Array.from(selected.values());
}

interface HangarStore {
  data: HangarData;
  units: Unit[];
  items: InventoryItem[];
  // Active UI theme
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  // Mission lens — when set, the hub spotlights the mission's requisitioned units.
  lensMissionId: string | null;
  setLensMissionId: (id: string | null) => void;
  // Global sourcing preference
  source: SourcePreference;
  setSource: (source: SourcePreference) => void;
  // Tech Tree spotlight
  spotlightId: string | null;
  setSpotlightId: (id: string | null) => void;
  // selectors
  unit: (id: string) => Unit | undefined;
  item: (id: string) => InventoryItem | undefined;
  mission: (id: string) => Mission | undefined;
  capability: (id: string) => Capability | undefined;
  insight: (id: string) => Insight | undefined;
  // combined spine + locally-authored insights (the LLM-populate / curate loop)
  insights: Insight[];
  addLocalInsight: (input: NewInsightInput) => void;
  removeLocalInsight: (id: string) => void;
  wish: (id: string) => WishlistItem | undefined;
  bay: (id: string) => Bay | undefined;
  unitsByBay: (bayId: string) => Unit[];
  // mission objective progress (local, reversible overrides over the spine)
  missionObjectives: (missionId: string) => MissionObjective[];
  toggleObjective: (missionId: string, idx: number) => void;
  // wishlist acquisition status (local, reversible overrides over the spine)
  setWishlistStatus: (id: string, status: WishlistStatus) => void;
  // slot management
  updateSlot: (parentId: string, slotName: string, unitId: string | null) => void;
  // drawer state
  drawerOpen: boolean;
  drawerSlotContext: { parentId: string; slotName: string } | null;
  openDrawer: (parentId: string, slotName: string) => void;
  closeDrawer: () => void;
}

const Ctx = createContext<HangarStore | null>(null);

export function HangarProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());
  const [lensMissionId, setLensMissionId] = useState<string | null>(() => readStoredLensMissionId());
  const [source, setSource] = useState<SourcePreference>(() => readStoredSource());
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>(() => hangarData.units);
  const [objectiveOverrides, setObjectiveOverrides] = useState<ObjectiveOverrides>(() => readStoredObjectives());
  const [wishStatusOverrides, setWishStatusOverrides] = useState<WishStatusOverrides>(() => readStoredWishStatus());
  const [localInsights, setLocalInsights] = useState<Insight[]>(() => readStoredLocalInsights());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSlotContext, setDrawerSlotContext] = useState<{ parentId: string; slotName: string } | null>(null);

  useEffect(() => {
    writeStorageValue(STORE_KEYS.theme, theme);
    const body = document.body;
    THEMES.forEach((t) => body.classList.remove(`theme-${t}`));
    body.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    writeStorageValue(STORE_KEYS.source, source);
  }, [source]);

  useEffect(() => {
    writeStorageValue(STORE_KEYS.lensMissionId, lensMissionId);
  }, [lensMissionId]);

  useEffect(() => {
    writeStorageValue(STORE_KEYS.objectives, JSON.stringify(objectiveOverrides));
  }, [objectiveOverrides]);

  useEffect(() => {
    writeStorageValue(STORE_KEYS.wishStatus, JSON.stringify(wishStatusOverrides));
  }, [wishStatusOverrides]);

  useEffect(() => {
    writeStorageValue(STORE_KEYS.localInsights, JSON.stringify(localInsights));
  }, [localInsights]);

  const addLocalInsight = (input: NewInsightInput) => {
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || !body) return; // ignore empty drafts
    // Collision-free id even for rapid/batched adds (Date.now() is only ms-granular).
    const rand =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.round(typeof performance !== 'undefined' ? performance.now() : 0)}`;
    const insight: Insight = {
      id: `${LOCAL_INSIGHT_PREFIX}${rand}`,
      title,
      body,
      tags: input.tags?.map((t) => t.trim()).filter(Boolean) ?? [],
      bay: input.bay,
      confidence: input.confidence ?? 'medium',
      capturedAt: new Date().toISOString(),
    };
    setLocalInsights((prev) => [insight, ...prev]);
  };

  const removeLocalInsight = (id: string) => {
    setLocalInsights((prev) => prev.filter((ins) => ins.id !== id));
  };

  const toggleObjective = (missionId: string, idx: number) => {
    setObjectiveOverrides((prev) => {
      const base = hangarData.missions.find((m) => m.id === missionId)?.objectives[idx]?.done ?? false;
      const current = prev[missionId]?.[idx] ?? base;
      return {
        ...prev,
        [missionId]: { ...(prev[missionId] ?? {}), [idx]: !current },
      };
    });
  };

  const setWishlistStatus = (id: string, status: WishlistStatus) => {
    setWishStatusOverrides((prev) => ({ ...prev, [id]: status }));
  };

  const updateSlot = (parentId: string, slotName: string, unitId: string | null) => {
    setUnits((prevUnits) =>
      prevUnits.map((u) => {
        if (u.id === parentId) {
          const updatedLoadout = u.loadout?.map((s) => {
            if (s.slot === slotName) {
              return { ...s, filledBy: unitId };
            }
            return s;
          });
          return { ...u, loadout: updatedLoadout };
        }
        if (unitId !== null && u.loadout) {
          const hasUnit = u.loadout.some((s) => s.filledBy === unitId);
          if (hasUnit) {
            const updatedLoadout = u.loadout.map((s) => {
              if (s.filledBy === unitId) {
                return { ...s, filledBy: null };
              }
              return s;
            });
            return { ...u, loadout: updatedLoadout };
          }
        }
        return u;
      })
    );
  };

  const openDrawer = (parentId: string, slotName: string) => {
    setDrawerSlotContext({ parentId, slotName });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerSlotContext(null);
  };

  const value = useMemo<HangarStore>(() => {
    const data = { ...hangarData, units };
    const byId = <T extends { id: string }>(arr: T[]) => {
      const m = new Map<string, T>();
      arr.forEach((x) => m.set(x.id, x));
      return m;
    };
    const unitsMap = byId(units);
    const itemsMap = byId(data.items);
    const missions = byId(data.missions);
    const caps = byId(data.capabilities);
    const allInsights = [...data.insights, ...localInsights];
    const insights = byId(allInsights);
    const wishes = byId(data.wishlist);
    const bays = byId(data.bays);

    return {
      data,
      units,
      items: data.items,
      theme,
      setTheme,
      lensMissionId,
      setLensMissionId,
      source,
      setSource,
      spotlightId,
      setSpotlightId,
      unit: (id) => unitsMap.get(id),
      item: (id) => itemsMap.get(id),
      mission: (id) => missions.get(id),
      capability: (id) => caps.get(id),
      insight: (id) => insights.get(id),
      insights: allInsights,
      addLocalInsight,
      removeLocalInsight,
      wish: (id) => {
        const w = wishes.get(id);
        if (!w) return undefined;
        const override = wishStatusOverrides[id];
        return override && override !== w.status ? { ...w, status: override } : w;
      },
      bay: (id) => bays.get(id),
      unitsByBay: (bayId) => units.filter((u) => u.bay === bayId),
      missionObjectives: (missionId) => {
        const m = missions.get(missionId);
        if (!m) return [];
        const overrides = objectiveOverrides[missionId];
        if (!overrides) return m.objectives;
        return m.objectives.map((o, i) => (i in overrides ? { ...o, done: overrides[i] } : o));
      },
      toggleObjective,
      setWishlistStatus,
      updateSlot,
      drawerOpen,
      drawerSlotContext,
      openDrawer,
      closeDrawer,
    };
  }, [theme, lensMissionId, source, spotlightId, units, objectiveOverrides, wishStatusOverrides, localInsights, drawerOpen, drawerSlotContext]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHangar(): HangarStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHangar must be used within HangarProvider');
  return ctx;
}

export function useCalculatedConstraints(missionId: string) {
  const { mission, wish, source } = useHangar();
  const m = mission(missionId);

  return useMemo(() => {
    if (!m) return [];

    const wishes = (m.wishlist ?? []).map(wish).filter(isWishlistItem);
    const selectedWishes = selectedMissionWishes(wishes);

    return m.constraints.map((c) => {
      let liveValue = c.value;
      if (c.unit === 'W') {
        const selectedWatts = selectedWishes.reduce((sum, w) => sum + (w.power?.watts ?? 0), 0);
        liveValue = c.value + selectedWatts;
      } else if (c.unit === 'g') {
        const selectedMass = selectedWishes.reduce((sum, w) => sum + (w.massGrams ?? 0), 0);
        liveValue = c.value + selectedMass;
      } else if (c.unit === '$') {
        const selectedCost = selectedWishes.reduce((sum, w) => {
          const p = source === 'us' ? w.price.us : w.price.import ?? w.price.us;
          return sum + (p ?? 0);
        }, 0);
        liveValue = c.value + selectedCost;
      }
      return { ...c, value: liveValue };
    });
  }, [m, wish, source]);
}
