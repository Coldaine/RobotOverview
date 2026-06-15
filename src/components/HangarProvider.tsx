'use client';
import { HangarProvider as Provider } from '@/lib/store';
import type { ReactNode } from 'react';

export function HangarProvider({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>;
}
