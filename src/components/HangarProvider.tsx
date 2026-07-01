'use client';
import { HangarProvider as Provider } from '@/lib/store';
import type { InventoryItem } from '@/data/types';
import type { InventoryReadStatus } from '@/lib/store';
import type { ReactNode } from 'react';

export function HangarProvider({
  children,
  initialItems,
  initialInventoryRead,
}: {
  children: ReactNode;
  initialItems?: InventoryItem[];
  initialInventoryRead?: InventoryReadStatus;
}) {
  return (
    <Provider initialItems={initialItems} initialInventoryRead={initialInventoryRead}>
      {children}
    </Provider>
  );
}
