import type { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;
let poolConfigKey: string | null = null;
let poolLock: Promise<void> = Promise.resolve();

type HangarPoolConfigSource = 'structured' | 'url';

export interface HangarPoolConfig {
  source: HangarPoolConfigSource;
  poolConfig: PoolConfig;
}

export function getHangarDatabaseUrl() {
  return process.env.HANGAR_DATABASE_URL || process.env.DATABASE_URL || null;
}

export function getHangarPoolConfig(): HangarPoolConfig | null {
  const structured = getStructuredHangarPoolConfig();
  if (structured) {
    return {
      source: 'structured',
      poolConfig: structured,
    };
  }

  const connectionString = getHangarDatabaseUrl();
  return connectionString
    ? {
        source: 'url',
        poolConfig: { connectionString },
      }
    : null;
}

function positiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function getStructuredHangarPoolConfig(): PoolConfig | null {
  const host = optionalEnv('HANGAR_DB_HOST');
  if (!host) return null;

  return {
    host,
    port: positiveIntegerEnv('HANGAR_DB_PORT', 5432),
    database: optionalEnv('HANGAR_DB_NAME') ?? 'hangar',
    user: optionalEnv('HANGAR_DB_USER') ?? 'hangar',
    password: optionalEnv('HANGAR_DB_PASSWORD'),
    ssl: sslConfigFromMode(optionalEnv('HANGAR_DB_SSLMODE')),
  };
}

function sslConfigFromMode(sslmode: string | undefined): PoolConfig['ssl'] {
  const mode = sslmode?.toLowerCase() ?? 'disable';

  switch (mode) {
    case 'disable':
      return false;
    case 'require':
      return true;
    default:
      throw new Error(
        `Unsupported HANGAR_DB_SSLMODE "${sslmode}". Supported values: disable, require.`,
      );
  }
}

function poolConfigWithRuntimeOptions(poolConfig: PoolConfig): PoolConfig {
  return {
    ...poolConfig,
    max: positiveIntegerEnv('HANGAR_DB_POOL_MAX', 5),
    connectionTimeoutMillis: positiveIntegerEnv('HANGAR_DB_CONNECT_TIMEOUT_MS', 2_500),
    idleTimeoutMillis: positiveIntegerEnv('HANGAR_DB_IDLE_TIMEOUT_MS', 30_000),
  };
}

function poolConfigFingerprint(poolConfig: PoolConfig) {
  return JSON.stringify(poolConfig);
}

export async function getHangarPool() {
  const config = getHangarPoolConfig();
  if (!config) return null;

  const poolConfig = poolConfigWithRuntimeOptions(config.poolConfig);
  const configKey = poolConfigFingerprint(poolConfig);

  if (pool && poolConfigKey === configKey) return pool;

  return withPoolLock(async () => {
    if (pool && poolConfigKey === configKey) return pool;

    const previousPool = pool;
    pool = null;
    poolConfigKey = null;
    if (previousPool) await previousPool.end();

    const { Pool } = await import('pg');
    pool = new Pool(poolConfig);
    poolConfigKey = configKey;

    return pool;
  });
}

export async function closeHangarPoolForTests() {
  await withPoolLock(async () => {
    if (!pool) return;
    const closingPool = pool;
    pool = null;
    poolConfigKey = null;
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
