import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
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

function isWishlistItem(item: WishlistItem | undefined): item is WishlistItem {
  return Boolean(item);
}

function selectedMissionWishes(wishes: WishlistItem[]): WishlistItem[] {
  const selected = new Map<string, WishlistItem>();

  wishes.forEach((w) => {
    if (!SELECTED_WISHLIST_STATUSES.has(w.status)) return;

    const current = selected.get(w.category);
    const currentPriority = current ? SELECTED_STATUS_PRIORITY[current.status] ?? 0 : 0;
    const nextPriority = SELECTED_STATUS_PRIORITY[w.status] ?? 0;
    if (!current || nextPriority > currentPriority) selected.set(w.category, w);
  });

  return Array.from(selected.values());
}

interface HangarStore {
  data: HangarData;
  // Mission lens — when set, the hub spotlights the mission's requisitioned units.
  lensMissionId: string | null;
  setLensMissionId: (id: string | null) => void;
  // Global sourcing preference
  source: 'us' | 'import';
  setSource: (source: 'us' | 'import') => void;
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
}

const Ctx = createContext<HangarStore | null>(null);

export function HangarProvider({ children }: { children: ReactNode }) {
  const [lensMissionId, setLensMissionId] = useState<string | null>(null);
  const [source, setSource] = useState<'us' | 'import'>('us');
  const [spotlightId, setSpotlightId] = useState<string | null>(null);

  const value = useMemo<HangarStore>(() => {
    const data = hangarData;
    const byId = <T extends { id: string }>(arr: T[]) => {
      const m = new Map<string, T>();
      arr.forEach((x) => m.set(x.id, x));
      return m;
    };
    const units = byId(data.units);
    const missions = byId(data.missions);
    const caps = byId(data.capabilities);
    const insights = byId(data.insights);
    const wishes = byId(data.wishlist);
    const bays = byId(data.bays);

    return {
      data,
      lensMissionId,
      setLensMissionId,
      source,
      setSource,
      spotlightId,
      setSpotlightId,
      unit: (id) => units.get(id),
      mission: (id) => missions.get(id),
      capability: (id) => caps.get(id),
      insight: (id) => insights.get(id),
      wish: (id) => wishes.get(id),
      bay: (id) => bays.get(id),
      unitsByBay: (bayId) => data.units.filter((u) => u.bay === bayId),
    };
  }, [lensMissionId, source, spotlightId]);

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
        liveValue = Math.max(c.value, selectedCost);
      }
      return { ...c, value: liveValue };
    });
  }, [m, wish, source]);
}
