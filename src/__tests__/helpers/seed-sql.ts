/**
 * Shared seed.sql helpers for pg-mem suites.
 * The Datacore corpus fence is huge; strip it before loading into pg-mem.
 */

const CORPUS_FENCE =
  /-- >>> DATACORE_CORPUS_BEGIN[\s\S]*?-- <<< DATACORE_CORPUS_END\s*/m;

/** Remove the generated Datacore corpus block. Throws if markers are missing. */
export function stripDatacoreCorpus(
  sql: string,
  replacement = '-- (datacore corpus stripped for pg-mem)\n',
): string {
  if (!sql.includes('-- >>> DATACORE_CORPUS_BEGIN') || !sql.includes('-- <<< DATACORE_CORPUS_END')) {
    throw new Error(
      'seed.sql missing DATACORE_CORPUS_BEGIN/END markers — regenerate with gen-seed.ts',
    );
  }
  return sql.replace(CORPUS_FENCE, replacement);
}
