'use client';
import { HangarProvider as Provider } from '@/lib/store';
import type { InventoryItem } from '@/data/types';
import type { HangarReadStatus } from '@/lib/hangar-read-status';
import type { ReactNode } from 'react';

export function HangarProvider({
  children,
  initialItems,
  initialInventoryRead,
  initialLibraryBaseUrl,
}: {
  children: ReactNode;
  initialItems?: InventoryItem[];
  initialInventoryRead?: HangarReadStatus;
  initialLibraryBaseUrl?: string | null;
}) {
  return (
    <Provider
      initialItems={initialItems}
      initialInventoryRead={initialInventoryRead}
      initialLibraryBaseUrl={initialLibraryBaseUrl}
    >
      {children}
    </Provider>
  );
}
