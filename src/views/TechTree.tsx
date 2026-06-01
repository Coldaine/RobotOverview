import { motion } from 'framer-motion';
import { GitBranchPlus, Lock, Sparkles, Unlock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionTitle } from '../components/ui/Primitives';
import { useHangar } from '../lib/store';
import clsx from 'clsx';

export function TechTree() {
  const { data, unit, wish, spotlightId, setSpotlightId } = useHangar();

  return (
    <div className="space-y-6">
      <header>
        <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan/70">Capability Graph</div>
        <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink">Tech Tree</h1>
        <p className="mt-1 font-mono text-xs text-ink-dim">Hover a node to see what unlocks it. (Yes, this is the talent tree your robots deserve.)</p>
      </header>

      <SectionTitle code="CAP"><span className="inline-flex items-center gap-2"><GitBranchPlus className="h-3.5 w-3.5 text-cyan" /> Capability Nodes</span></SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onMouseLeave={() => setSpotlightId(null)}>
        {data.capabilities.map((c, i) => {
          const unlockers = c.unlockedBy
            .map((id) => unit(id) ?? wish(id))
            .filter(Boolean);
          
          const isActive = spotlightId === c.id;
          const isDependency = spotlightId ? data.capabilities.find(cat => cat.id === spotlightId)?.dependsOn?.includes(c.id) : false;
          const isDependent = spotlightId ? c.dependsOn?.includes(spotlightId) : false;

          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ 
                opacity: spotlightId ? (isActive || isDependency || isDependent ? 1 : 0.4) : 1, 
                y: 0,
                scale: isActive ? 1.02 : 1 
              }}
              onMouseEnter={() => setSpotlightId(c.id)}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className={clsx(
                'group panel relative overflow-hidden p-4 transition-all duration-300',
                c.unlocked ? 'border-signal-ok/40 bg-signal-ok/5' : 'border-rim',
                isActive && 'border-amber/60 shadow-hud-amber ring-1 ring-amber/20',
              )}
            >
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-panel-sheen" />
              <div className="relative flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {c.unlocked ? (
                      <Unlock className="h-4 w-4 text-signal-ok" />
                    ) : (
                      <Lock className="h-4 w-4 text-ink-dim" />
                    )}
                    <h2 className="font-display text-sm uppercase tracking-[0.08em] text-ink">{c.name}</h2>
                  </div>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink-dim">{c.description}</p>
                </div>
                <span className={clsx('chip', c.unlocked ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok' : 'border-rim bg-panel-2/40 text-ink-dim')}>
                  {c.unlocked ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>

              <div className="relative mt-3 border-t border-rim/50 pt-2">
                <div className="hud-label mb-1">Requirement Check</div>
                <div className="flex flex-wrap gap-1.5">
                  {unlockers.map((u, idx) => {
                    const available = 'status' in u! ? u.status === 'operational' || u.status === 'received' : false;
                    return (
                      <span key={`${u!.id}-${idx}`} className={clsx('chip flex items-center gap-1.5', available ? 'border-cyan/30 bg-cyan/5 text-cyan' : 'border-rim bg-panel-2/30 text-ink-dim')}>
                        <Sparkles className={clsx('h-3 w-3', available ? 'text-amber' : 'text-ink-dim')} /> {u!.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="relative mt-3 text-right">
                <Link to="/quartermaster" className="font-mono text-[10px] uppercase tracking-wider text-amber hover:underline">
                  source parts
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
