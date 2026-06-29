import type { Pool } from 'pg';

let pool: Pool | null = null;
let poolConnectionString: string | null = null;

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

  if (!pool || poolConnectionString !== connectionString) {
    const { Pool } = await import('pg');
    pool = new Pool({
      connectionString,
      max: positiveIntegerEnv('HANGAR_DB_POOL_MAX', 5),
      connectionTimeoutMillis: positiveIntegerEnv('HANGAR_DB_CONNECT_TIMEOUT_MS', 2_500),
      idleTimeoutMillis: positiveIntegerEnv('HANGAR_DB_IDLE_TIMEOUT_MS', 30_000),
    });
    poolConnectionString = connectionString;
  }

  return pool;
}

export async function closeHangarPoolForTests() {
  if (!pool) return;
  await pool.end();
  pool = null;
  poolConnectionString = null;
}
