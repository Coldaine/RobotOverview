import { getHangarPool } from './db';
import type { Queryable } from './queryable';
import type { HangarFallbackReason, HangarReadSource } from '@/lib/hangar-read-status';

export interface HangarRead<T> {
  source: HangarReadSource;
  fallbackReason?: HangarFallbackReason;
  data: T;
}

export async function readWithStaticFallback<T>({
  label,
  staticData,
  readFromPostgres,
  getClient = getHangarPool,
}: {
  label: string;
  staticData: T;
  readFromPostgres: (client: Queryable) => Promise<T>;
  getClient?: () => Promise<Queryable | null>;
}): Promise<HangarRead<T>> {
  try {
    const pool = await getClient();
    if (!pool) {
      return {
        source: 'static',
        fallbackReason: 'not-configured',
        data: staticData,
      };
    }

    return {
      source: 'postgres',
      data: await readFromPostgres(pool),
    };
  } catch (error) {
    console.warn(`Hangar Postgres ${label} read failed; falling back to static spine.`, error);
    return {
      source: 'static',
      fallbackReason: 'postgres-error',
      data: staticData,
    };
  }
}
