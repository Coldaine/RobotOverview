'use client';
/**
 * BEAST Console — live-plug wiring tracker & Jetson mount planner.
 * Datacore tab wrapping the bench, mount, and reference views with a
 * per-robot project switcher and JSON export/import.
 */
import { useRef, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Cable, Boxes, Grid3x3, Zap, Download, Upload } from 'lucide-react';
import clsx from 'clsx';
import { BenchView } from './BenchView';
import { MountView } from './MountView';
import { PowerView } from './PowerView';
import { RefView } from './RefView';
import { useConsoleStore, consoleActions, exportConsoleSave, consoleStorageMode } from './console-store';
import { SPRING } from './ConsoleUi';

type ConsoleTab = 'bench' | 'mount' | 'power' | 'ref';

const TABS: { id: ConsoleTab; label: string; desc: string; icon: typeof Cable }[] = [
  { id: 'bench', label: 'Live Plug', desc: "record what's actually plugged in", icon: Cable },
  { id: 'mount', label: 'Mount Planner', desc: 'how the stack gets fitted', icon: Boxes },
  { id: 'power', label: 'Power Planner', desc: 'load budget · expansion options', icon: Zap },
  { id: 'ref', label: 'Reference', desc: 'pinout · board callouts · docs · schematic', icon: Grid3x3 },
];

function ProjectBar() {
  const projects = useConsoleStore((s) => s.projects);
  const active = useConsoleStore((s) => s.activeProject);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AnimatePresence>
        {toast && (
          <motion.span
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="font-mono text-[10px] text-cyan"
          >
            {toast}
          </motion.span>
        )}
      </AnimatePresence>
      <select
        value={active}
        onChange={(e) => {
          if (e.target.value === '__new__') {
            const name = window.prompt('Name the new robot project:');
            if (name?.trim()) consoleActions.addProject(name.trim());
          } else {
            consoleActions.switchProject(e.target.value);
          }
        }}
        className="max-w-64 rounded-md border border-rim bg-panel-2/40 px-2.5 py-2 font-mono text-xs text-ink outline-none"
      >
        {Object.entries(projects).map(([id, p]) => (
          <option key={id} value={id}>{p.name}</option>
        ))}
        <option value="__new__">＋ new robot project…</option>
      </select>
      <button
        type="button"
        onClick={() => flash(exportConsoleSave() ? 'Save exported.' : 'Export failed.')}
        className="btn btn-ghost text-[10px]"
      >
        <Download className="h-3 w-3" /> Export
      </button>
      <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-ghost text-[10px]">
        <Upload className="h-3 w-3" /> Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const rd = new FileReader();
          rd.onload = () => {
            try {
              consoleActions.importState(String(rd.result));
              flash('Save imported.');
            } catch (err) {
              flash(`Import failed: ${err instanceof Error ? err.message : 'bad file'}`);
            }
          };
          rd.readAsText(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function BeastConsole() {
  const [tab, setTab] = useState<ConsoleTab>('bench');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LayoutGroup>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const TabIcon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={clsx('btn relative text-[10px]', active ? 'btn-active' : 'btn-ghost')}
                  title={t.desc}
                >
                  <TabIcon className="h-3 w-3" />
                  {t.label}
                  {active && (
                    <motion.span
                      layoutId="beast-console-tab"
                      transition={SPRING}
                      className="absolute inset-x-2 -bottom-px h-px bg-cyan"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </LayoutGroup>
        <ProjectBar />
      </div>

      {consoleStorageMode === 'memory' && (
        <div className="rounded-md border border-amber/60 bg-amber/10 p-2.5 font-mono text-[11px] text-ink">
          ⚠ This browser blocks page storage — records live only until reload. Use Export to keep them.
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        >
          {tab === 'bench' && <BenchView />}
          {tab === 'mount' && <MountView />}
          {tab === 'power' && <PowerView />}
          {tab === 'ref' && <RefView />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
