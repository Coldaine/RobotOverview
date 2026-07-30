/**
 * One-time / repeatable: push hangar.ts into Postgres as content_snapshots.hangar
 * and (optionally) refresh normalized seed.sql for inventory queries.
 *
 *   doppler run -p homelab -c dev -- npx tsx db/hangar/seed-spine.ts
 *
 * Requires HANGAR_DB_* (or HANGAR_DATABASE_URL) pointing at the hangar database.
 */
import { hangarData } from '../../src/data/hangar';
import { closeHangarPoolForTests } from '../../src/server/hangar/db';
import { putHangarSpine } from '../../src/server/hangar/spine';
import { resetHangarDrizzleForTests } from '../../src/server/hangar/drizzle';

async function main() {
  await putHangarSpine({
    ...hangarData,
    meta: {
      ...hangarData.meta,
      updated: new Date().toISOString().slice(0, 10),
    },
  });
  console.log(
    JSON.stringify({
      ok: true,
      snapshot: 'hangar',
      units: hangarData.units.length,
      items: hangarData.items.length,
      missions: hangarData.missions.length,
      insights: hangarData.insights.length,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    resetHangarDrizzleForTests();
    await closeHangarPoolForTests();
  });
