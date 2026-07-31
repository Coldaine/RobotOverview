import { CockpitClient } from './CockpitClient';

export const dynamic = 'force-dynamic';

export default async function CockpitPage() {
  const wsUrl = process.env.BEAST_COCKPIT_WS_URL || '';
  return <CockpitClient wsUrl={wsUrl} />;
}
