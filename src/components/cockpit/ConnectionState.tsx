'use client';

import { useConnectionState } from '@/lib/ros/client';
import clsx from 'clsx';

interface ConnectionStateProps {
  url: string;
}

export function ConnectionStateBadge({ url }: ConnectionStateProps) {
  const state = useConnectionState();

  const domain = (() => {
    try {
      const u = new URL(url);
      return u.hostname;
    } catch {
      return url;
    }
  })();

  const meta = {
    connected: {
      label: `Tailscale · ${domain}`,
      dotCls: 'bg-emerald-500 shadow-[0_0_8px_#10b981]',
      textCls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    },
    connecting: {
      label: `Connecting · ${domain}`,
      dotCls: 'bg-amber-500 shadow-[0_0_8px_#f59e0b] animate-ping',
      textCls: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    },
    disconnected: {
      label: 'Disconnected',
      dotCls: 'bg-rose-500 shadow-[0_0_8px_#f43f5e]',
      textCls: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    },
  }[state];

  return (
    <div className={clsx('chip flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] tracking-widest', meta.textCls)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dotCls)} />
      <span>{meta.label}</span>
    </div>
  );
}
