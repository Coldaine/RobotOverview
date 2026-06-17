'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { hangarData } from '../data/hangar';
import type {
  Bay,
  Capability,
  HangarData,
  Insight,
  Mission,
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
} as const;
const SOURCES = ['us', 'import'] as const;
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

function selectedMissionWishes(wishes: WishlistItem[]): WishlistItem[] {
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
  mission: (id: string) => Mission | undefined;
  capability: (id: string) => Capability | undefined;
  insight: (id: string) => Insight | undefined;
  wish: (id: string) => WishlistItem | undefined;
  bay: (id: string) => Bay | undefined;
  unitsByBay: (bayId: string) => Unit[];
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
    const missions = byId(data.missions);
    const caps = byId(data.capabilities);
    const insights = byId(data.insights);
    const wishes = byId(data.wishlist);
    const bays = byId(data.bays);

    return {
      data,
      units,
      theme,
      setTheme,
      lensMissionId,
      setLensMissionId,
      source,
      setSource,
      spotlightId,
      setSpotlightId,
      unit: (id) => unitsMap.get(id),
      mission: (id) => missions.get(id),
      capability: (id) => caps.get(id),
      insight: (id) => insights.get(id),
      wish: (id) => wishes.get(id),
      bay: (id) => bays.get(id),
      unitsByBay: (bayId) => units.filter((u) => u.bay === bayId),
      updateSlot,
      drawerOpen,
      drawerSlotContext,
      openDrawer,
      closeDrawer,
    };
  }, [theme, lensMissionId, source, spotlightId, units, drawerOpen, drawerSlotContext]);

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
        liveValue = Math.max(c.value, c.value + selectedWatts);
      } else if (c.unit === 'g') {
        const selectedMass = selectedWishes.reduce((sum, w) => sum + (w.massGrams ?? 0), 0);
        liveValue = Math.max(c.value, c.value + selectedMass);
      } else if (c.unit === '$') {
        const selectedCost = selectedWishes.reduce((sum, w) => {
          const p = source === 'us' ? w.price.us : w.price.import ?? w.price.us;
          return sum + (p ?? 0);
        }, 0);
        liveValue = Math.max(c.value, selectedCost);
      }
      return { ...c, value: liveValue };
    });
  }, [m, wish, source]);
}
