'use client';

import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';
import { SchematicConfigurationSwitch as ConfigurationSwitch } from '@/components/board/Controls';

export function SchematicFrame({ className, ...props }: ComponentProps<'div'>) {
  return <div className={clsx('panel corner-bracket blueprint-grid relative overflow-hidden', className)} {...props} />;
}

export const SchematicConfigurationSwitch = ConfigurationSwitch;

export function SchematicToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('flex flex-wrap items-center justify-between gap-3', className)}>{children}</div>;
}

export function SchematicCanvas({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function SchematicInspector({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function SchematicReadout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function SchematicHotspotLayer({ children }: { children: ReactNode }) {
  return <g data-schematic-layer="hotspots">{children}</g>;
}

export function SchematicConnectionLayer({ children }: { children: ReactNode }) {
  return <g data-schematic-layer="connections">{children}</g>;
}

