import type { Pool } from 'pg';

let pool: Pool | null = null;
let poolConnectionString: string | null = null;
let poolLock: Promise<void> = Promise.resolve();

export function getHangarDatabaseUrl() {
  return process.env.HANGAR_DATABASE_URL || process.env.DATABASE_URL || null;
}

function positiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export async function getHangarPool() {
  const connectionString = getHangarDatabaseUrl();
  if (!connectionString) return null;

  if (pool && poolConnectionString === connectionString) return pool;

  return withPoolLock(async () => {
    if (pool && poolConnectionString === connectionString) return pool;

    const previousPool = pool;
    pool = null;
    poolConnectionString = null;
    if (previousPool) await previousPool.end();

    const { Pool } = await import('pg');
    pool = new Pool({
      connectionString,
      max: positiveIntegerEnv('HANGAR_DB_POOL_MAX', 5),
      connectionTimeoutMillis: positiveIntegerEnv('HANGAR_DB_CONNECT_TIMEOUT_MS', 2_500),
      idleTimeoutMillis: positiveIntegerEnv('HANGAR_DB_IDLE_TIMEOUT_MS', 30_000),
    });
    poolConnectionString = connectionString;

    return pool;
  });
}

export async function closeHangarPoolForTests() {
  await withPoolLock(async () => {
    if (!pool) return;
    const closingPool = pool;
    pool = null;
    poolConnectionString = null;
    await closingPool.end();
  });
}

async function withPoolLock<T>(operation: () => Promise<T>) {
  const previousLock = poolLock;
  let release!: () => void;
  poolLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previousLock;

  try {
    return await operation();
  } finally {
    release();
  }
}
