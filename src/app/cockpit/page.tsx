import { CockpitClient } from './CockpitClient';
import { resolveBeastCockpitWsUrl } from '@/lib/beast-constants';

export const dynamic = 'force-dynamic';

export default async function CockpitPage() {
  const wsUrl = resolveBeastCockpitWsUrl();
  return <CockpitClient wsUrl={wsUrl} />;
}
