import { isHangarAgentEnabled, readAgentModelConfig } from '@/server/beast/model';
import { AgentClient } from './AgentClient';

export const dynamic = 'force-dynamic';

export default async function AgentPage() {
  const enabled = isHangarAgentEnabled();
  const modelConfig = readAgentModelConfig();
  const bridgeUrl = process.env.BEAST_COCKPIT_WS_URL?.trim() || '';

  return (
    <AgentClient
      enabled={enabled}
      bridgeConfigured={Boolean(bridgeUrl)}
      plannerConfigured={Boolean(modelConfig)}
      modelLabel={modelConfig?.model ?? null}
    />
  );
}
