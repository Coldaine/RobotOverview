'use client';
import { HangarProvider as Provider } from '@/lib/store';
import type { InventoryItem } from '@/data/types';
import type { ReactNode } from 'react';

export function HangarProvider({
  children,
  initialItems,
}: {
  children: ReactNode;
  initialItems?: InventoryItem[];
}) {
  return <Provider initialItems={initialItems}>{children}</Provider>;
}
