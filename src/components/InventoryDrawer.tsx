'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Info } from 'lucide-react';
import { useHangar } from '@/lib/store';
import { useMemo, useState } from 'react';
import type { Unit, LoadoutSlot } from '@/data/types';
import clsx from 'clsx';

// Pure helper function defined outside component to avoid useMemo dependency issues
const checkCompatibility = (u: Unit, targetSlot: LoadoutSlot | null) => {
  if (!targetSlot) return true;
  const nameLower = targetSlot.slot.toLowerCase();
  const classLower = (u.class || '').toLowerCase();
  const tagsLower = (u.tags || []).map(t => t.toLowerCase());
  const bay = u.bay;

  if (nameLower.includes('host') || nameLower.includes('controller') || nameLower.includes('compute')) {
    return bay === 'compute' || classLower.includes('sbc') || classLower.includes('controller') || tagsLower.includes('compute');
  }
  if (nameLower.includes('power') || nameLower.includes('battery') || nameLower.includes('ups') || nameLower.includes('undercarriage') || nameLower.includes('input')) {
    return classLower.includes('power') || classLower.includes('ups') || classLower.includes('battery') || tagsLower.includes('power') || tagsLower.includes('ups');
  }
  if (nameLower.includes('servo') || nameLower.includes('arm') || nameLower.includes('manipulator') || nameLower.includes('bus')) {
    return classLower.includes('arm') || classLower.includes('servo') || tagsLower.includes('arm') || tagsLower.includes('roarm');
  }
  if (nameLower.includes('rail') || nameLower.includes('sensor') || nameLower.includes('camera') || nameLower.includes('lidar') || nameLower.includes('lighting') || nameLower.includes('interface')) {
    return (
      classLower.includes('sensor') ||
      classLower.includes('camera') ||
      classLower.includes('lidar') ||
      classLower.includes('lighting') ||
      tagsLower.includes('sensor') ||
      tagsLower.includes('camera') ||
      tagsLower.includes('lidar')
    );
  }
  return true;
};

export function InventoryDrawer() {
  const {
    units,
    drawerOpen,
    drawerSlotContext,
    closeDrawer,
    updateSlot,
    theme,
  } = useHangar();

  const [showAll, setShowAll] = useState(false);

  // Get active parent unit and slot
  const parentUnit = useMemo(() => {
    if (!drawerSlotContext) return null;
    return units.find(u => u.id === drawerSlotContext.parentId) || null;
  }, [units, drawerSlotContext]);

  const targetSlot = useMemo(() => {
    if (!parentUnit || !drawerSlotContext) return null;
    return parentUnit.loadout?.find(s => s.slot === drawerSlotContext.slotName) || null;
  }, [parentUnit, drawerSlotContext]);

  // Determine currently equipped unit in this slot
  const equippedUnit = useMemo(() => {
    if (!targetSlot || !targetSlot.filledBy) return null;
    return units.find(u => u.id === targetSlot.filledBy) || null;
  }, [units, targetSlot]);

  // Filter workbench units (owned: true, and not present in any other unit's loadout slot)
  const unassignedUnits = useMemo(() => {
    const equippedIds = new Set<string>();
    units.forEach(u => {
      u.loadout?.forEach(s => {
        if (s.filledBy) {
          equippedIds.add(s.filledBy);
        }
      });
    });

    return units.filter(u => {
      const isOwned = u.lifecycle !== 'wishlist' && u.lifecycle !== 'on-order';
      const isNotEquipped = !equippedIds.has(u.id);
      const isNotParent = drawerSlotContext ? u.id !== drawerSlotContext.parentId : true;
      return isOwned && isNotEquipped && isNotParent;
    });
  }, [units, drawerSlotContext]);

  const { compatibleUnits } = useMemo(() => {
    const comp: Unit[] = [];
    unassignedUnits.forEach(u => {
      if (checkCompatibility(u, targetSlot)) {
        comp.push(u);
      }
    });
    return { compatibleUnits: comp };
  }, [unassignedUnits, targetSlot]);

  const handleEquip = (unitId: string) => {
    if (!drawerSlotContext) return;
    updateSlot(drawerSlotContext.parentId, drawerSlotContext.slotName, unitId);
    closeDrawer();
  };

  const handleUnequip = () => {
    if (!drawerSlotContext) return;
    updateSlot(drawerSlotContext.parentId, drawerSlotContext.slotName, null);
    closeDrawer();
  };

  const activeList = showAll ? unassignedUnits : compatibleUnits;

  return (
    <AnimatePresence>
      {drawerOpen && drawerSlotContext && (
        <>
          {/* Overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
            className="fixed inset-0 z-50 bg-void/60 backdrop-blur-sm"
          />

          {/* Drawer container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md border-l border-rim/70 bg-hull/95 p-6 shadow-hud-cyan backdrop-blur-md flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-rim pb-4 mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan/70">Workbench Allocation</div>
                <h3 className="font-display text-base font-bold uppercase tracking-[0.06em] text-ink mt-0.5">
                  Slot: {drawerSlotContext.slotName}
                </h3>
                {parentUnit && (
                  <p className="font-mono text-[10px] text-ink-dim mt-0.5">
                    Parent Unit: <span className="text-ink">{parentUnit.name}</span>
                  </p>
                )}
              </div>
              <button
                onClick={closeDrawer}
                className="p-1 rounded-md border border-rim/60 bg-panel-2/30 hover:border-cyan/50 hover:text-cyan transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Currently Equipped Section */}
            {equippedUnit ? (
              <div className="panel p-3 border-amber/40 bg-amber/5 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber animate-pulse-trace" />
                    <span className="font-mono text-xs uppercase tracking-wide text-ink-dim">Currently Slotted</span>
                  </div>
                  <button
                    onClick={handleUnequip}
                    className="px-2 py-0.5 rounded border border-signal-crit/45 bg-signal-crit/10 text-signal-crit text-[10px] uppercase font-mono hover:bg-signal-crit/20 transition-all cursor-pointer"
                  >
                    Unequip Item
                  </button>
                </div>
                <div className="mt-2 font-display text-sm font-bold uppercase text-ink">{equippedUnit.name}</div>
                <p className="mt-0.5 font-mono text-[10px] text-ink-dim">{equippedUnit.class}</p>
              </div>
            ) : (
              <div className="panel p-3 border-rim/55 bg-panel-2/20 mb-4 flex items-center gap-2.5">
                <Info className="h-4 w-4 text-cyan shrink-0" />
                <span className="font-mono text-[11px] text-ink-dim">This loadout slot is empty. Select a compatible unit from the workbench below to equip it.</span>
              </div>
            )}

            {/* Filters / Compatibility Toggles */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                Available Workbench ({activeList.length})
              </span>
              <button
                onClick={() => setShowAll(!showAll)}
                className={clsx(
                  'px-2 py-1 rounded text-[10px] uppercase font-mono border transition-all cursor-pointer',
                  showAll
                    ? 'border-amber/45 bg-amber/10 text-amber'
                    : 'border-rim bg-panel-2/40 text-ink-dim hover:text-ink hover:border-rim'
                )}
              >
                {showAll ? 'Show Compatible Only' : 'Show All Units'}
              </button>
            </div>

            {/* Main Workbench List */}
            <div className="flex-1 overflow-y-auto pr-1">
              {activeList.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-rim rounded-lg bg-panel-2/10">
                  <Package className="h-8 w-8 text-ink-dim mx-auto mb-2 opacity-50" />
                  <p className="font-mono text-xs text-ink-dim">No unassigned workbench units found.</p>
                  {compatibleUnits.length === 0 && !showAll && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="mt-2 font-mono text-[10px] text-cyan hover:underline cursor-pointer"
                    >
                      Show incompatible items
                    </button>
                  )}
                </div>
              ) : (
                /* Theme Adaptive Lists */
                <>
                  {/* Theme: Blueprint — raw terminal hex editor */}
                  {theme === 'blueprint' && (
                    <div className="font-mono text-xs space-y-1 bg-void/50 p-3 rounded-md border border-rim/60">
                      <div className="grid grid-cols-[60px_1fr_90px] gap-2 border-b border-rim/70 pb-1.5 text-cyan/70 font-semibold uppercase text-[10px] tracking-wider">
                        <span>[OFFSET]</span>
                        <span>IDENTIFIER</span>
                        <span>STATUS</span>
                      </div>
                      <div className="space-y-1 divide-y divide-rim/20 pt-1">
                        {activeList.map((u, i) => {
                          const compat = checkCompatibility(u, targetSlot);
                          return (
                            <div
                              key={u.id}
                              className="grid grid-cols-[60px_1fr_90px] gap-2 py-2 items-center text-left"
                            >
                              <span className="text-ink-dim font-mono">0x{i.toString(16).toUpperCase().padStart(2, '0')}</span>
                              <div className="min-w-0 pr-2">
                                <div className="truncate font-semibold text-ink">{u.name}</div>
                                <div className="text-[10px] text-ink-dim truncate">{u.class}</div>
                                {!compat && (
                                  <span className="text-[8px] text-signal-warn bg-signal-warn/15 border border-signal-warn/30 px-1 rounded uppercase tracking-widest mt-0.5 inline-block">
                                    INCOMPATIBLE
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleEquip(u.id)}
                                className="px-2 py-1 bg-cyan/15 hover:bg-cyan/35 text-cyan border border-cyan/45 rounded-sm font-mono text-[9px] uppercase tracking-wider text-center cursor-pointer transition-all"
                              >
                                SLOT
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Theme: Industrial — alternating ledger rows */}
                  {theme === 'industrial' && (
                    <table className="w-full text-left font-mono text-xs border border-rim">
                      <thead>
                        <tr className="border-b border-rim text-ink bg-panel-2/50">
                          <th className="py-2 px-3">Item Details</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeList.map((u, i) => {
                          const compat = checkCompatibility(u, targetSlot);
                          return (
                            <tr
                              key={u.id}
                              className={clsx(
                                'hover:bg-amber/10 border-b border-rim/30 transition-colors',
                                i % 2 === 0 ? 'bg-panel/30' : 'bg-panel-2/40'
                              )}
                            >
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-ink">{u.name}</div>
                                <div className="text-[10px] text-ink-dim">{u.class}</div>
                                {!compat && (
                                  <span className="text-[8px] text-signal-warn font-semibold uppercase tracking-wider block mt-0.5">
                                    INCOMPATIBLE
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => handleEquip(u.id)}
                                  className="px-2.5 py-1 bg-amber/15 hover:bg-amber/35 text-amber border border-amber/35 rounded-sm uppercase tracking-wider text-[9px] font-bold cursor-pointer transition-all"
                                >
                                  Equip
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* Theme: Topology — modern floating cards */}
                  {theme === 'topology' && (
                    <div className="grid gap-2.5 grid-cols-1">
                      {activeList.map((u) => {
                        const compat = checkCompatibility(u, targetSlot);
                        return (
                          <div
                            key={u.id}
                            onClick={() => handleEquip(u.id)}
                            className={clsx(
                              'panel group cursor-pointer p-3.5 transition-all hover:border-cyan/40 hover:shadow-hud-cyan flex items-center justify-between',
                              !compat && 'opacity-75 border-dashed hover:opacity-100'
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={clsx(
                                'grid h-8.5 w-8.5 place-items-center rounded-lg border text-cyan shrink-0',
                                compat ? 'border-cyan/30 bg-cyan/5' : 'border-signal-warn/30 bg-signal-warn/5 text-signal-warn'
                              )}>
                                <Package className="h-4.5 w-4.5" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-display text-sm font-bold text-ink group-hover:text-glow-cyan transition-all truncate">
                                  {u.name}
                                </h4>
                                <p className="font-mono text-[10px] text-ink-dim truncate">{u.class}</p>
                              </div>
                            </div>
                            <span className="text-[11px] font-mono font-semibold text-cyan hover:underline shrink-0 pl-2">
                              Select &rarr;
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
