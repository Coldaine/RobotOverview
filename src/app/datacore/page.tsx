import { getBriefings, getPacks } from '@/server/hangar/briefings';
import { DatacoreClient } from './DatacoreClient';

export const dynamic = 'force-dynamic';

export default async function Datacore() {
  const [briefingsRead, packsRead] = await Promise.all([getBriefings(), getPacks()]);

  // Either lane offline marks the surface offline — never silent static content.
  const briefingsSource =
    briefingsRead.source === 'postgres' && packsRead.source === 'postgres'
      ? 'postgres'
      : 'static';

  return (
    <DatacoreClient
      briefings={briefingsRead.briefings}
      packs={packsRead.packs}
      briefingsSource={briefingsSource}
    />
  );
}
