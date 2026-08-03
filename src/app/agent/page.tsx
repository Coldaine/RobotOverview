import { isHangarAgentEnabled, readAgentModelConfig } from '@/server/beast/model';
import { AgentClient } from './AgentClient';
import { resolveBeastCockpitWsUrl } from '@/lib/beast-constants';

export const dynamic = 'force-dynamic';

export default async function AgentPage() {
  const enabled = isHangarAgentEnabled();
  const modelConfig = readAgentModelConfig();
  const bridgeUrl = resolveBeastCockpitWsUrl();

  return (
    <AgentClient
      enabled={enabled}
      bridgeConfigured={Boolean(bridgeUrl)}
      plannerConfigured={Boolean(modelConfig)}
      modelLabel={modelConfig?.model ?? null}
    />
  );
}
