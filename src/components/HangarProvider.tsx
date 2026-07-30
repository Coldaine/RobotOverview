'use client';
import { HangarProvider as Provider } from '@/lib/store';
import type { HangarData, InventoryItem } from '@/data/types';
import type { HangarReadStatus } from '@/lib/hangar-read-status';
import type { ReactNode } from 'react';

export function HangarProvider({
  children,
  initialData,
  initialSpineRead,
  initialItems,
  initialInventoryRead,
  initialLibraryBaseUrl,
}: {
  children: ReactNode;
  initialData?: HangarData;
  initialSpineRead?: HangarReadStatus;
  initialItems?: InventoryItem[];
  initialInventoryRead?: HangarReadStatus;
  initialLibraryBaseUrl?: string | null;
}) {
  return (
    <Provider
      initialData={initialData}
      initialSpineRead={initialSpineRead}
      initialItems={initialItems}
      initialInventoryRead={initialInventoryRead}
      initialLibraryBaseUrl={initialLibraryBaseUrl}
    >
      {children}
    </Provider>
  );
}
