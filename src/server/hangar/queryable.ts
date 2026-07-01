export type Queryable = {
  query: <T>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};
