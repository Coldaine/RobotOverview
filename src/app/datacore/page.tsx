import { getBriefings, getPacks } from '@/server/hangar/briefings';
import { DatacoreClient } from './DatacoreClient';

export const dynamic = 'force-dynamic';

export default async function Datacore() {
  const [briefingsRead, packsRead] = await Promise.all([getBriefings(), getPacks()]);

  // Per-lane sources: a failed lane shows its own offline notice while the
  // healthy lane keeps its data — never downgrade both, never silent static.
  return (
    <DatacoreClient
      briefings={briefingsRead.briefings}
      briefingsSource={briefingsRead.source}
      packs={packsRead.packs}
      packsSource={packsRead.source}
    />
  );
}
